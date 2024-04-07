using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;

using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.UseStaticFiles(new StaticFileOptions() {
    FileProvider = new PhysicalFileProvider(DistPath),
    //RequestPath = ""
});

Directory.CreateDirectory(SavePath);
if(Directory.Exists(PasswordFile)) {
    Password = File.ReadAllText(PasswordFile);
}

app.Map("/", index);
app.Map("/index.html", index);
app.MapPost("/proxy", proxy);
app.MapPost("/proxy2", proxy);
app.MapGet("/api/password", api_password);
app.MapPost("/api/crypto", api_crypto);
app.MapPost("/api/set_password", api_set_password);
app.MapGet("/api/read", api_read);
app.MapGet("/api/remove", api_remove);
app.MapGet("/api/list", api_list);
app.MapPost("/api/write", api_write);
app.Run("http://localhost:6001/");

async Task index(HttpResponse res) {
    Console.WriteLine("connected");
    const string inject = "<script>globalThis.__NODE__ = true</script>";
    string html = File.ReadAllText(Path.Combine(DistPath, "index.html"));
    int index = html.IndexOf("<script", StringComparison.OrdinalIgnoreCase);
    res.ContentType = "text/html";
    await res.WriteAsync(html[..index] + inject + html[index..]);
}

async Task proxy(HttpContext context
        , [FromHeader(Name = "risu-url")]string? url
        , [FromHeader(Name = "risu-header")] string? risuHeader) {
    var request = context.Request;
    var response = context.Response;
    url = string.IsNullOrEmpty(url) ? request.Query["risu-url"] : Uri.UnescapeDataString(url);
    if (string.IsNullOrEmpty(url)) {
        await ErrorAsync(context.Response, "URL has no param");
        return;
    }
    HttpRequestMessage req = new(new(request.Method), url);
    if (string.IsNullOrEmpty(risuHeader)) {
        foreach(var header in request.Headers) {
            req.Headers.TryAddWithoutValidation(header.Key, (IEnumerable<string>)header.Value);
        }
    } else {
        using JsonDocument doc = JsonDocument.Parse(Uri.UnescapeDataString(risuHeader));
        foreach (var header in doc.RootElement.EnumerateObject()) {
            req.Headers.TryAddWithoutValidation(header.Name, header.Value.GetString());
        }
    }
    if (!req.Headers.Contains("x-forwarded-for")) {
        req.Headers.TryAddWithoutValidation("x-forwarded-for", context.Connection.RemoteIpAddress?.ToString());
    }

    req.Content = new StreamContent(request.Body);
    req.Content.Headers.Add("content-type", "application/json");
    using HttpResponseMessage res = await Client.SendAsync(req);

    response.StatusCode = (int)res.StatusCode;
    foreach (var header in res.Headers) {
        response.Headers[header.Key] = header.Value.ToArray();
    }
    response.Headers.Remove("content-security-policy");
    response.Headers.Remove("content-security-policy-report-only");
    response.Headers.Remove("clear-site-data");
    response.Headers.Remove("Cache-Control");

    await response.StartAsync();
    await res.Content.CopyToAsync(response.Body);
}
async Task api_password(HttpResponse res
        , [FromHeader(Name = "risu-auth")] string? auth) {
    string status;
    if (string.IsNullOrEmpty(Password)) {
        status = "unset";
    } else if (auth == Password) {
        status = "correct";
    } else {
        status = "incorrect";
    }
    await res.WriteAsJsonAsync(new { status });
}

async Task api_crypto(HttpResponse res
        , [FromBody] api_crypto_param param) {
    res.ContentType = "text/plain";
    var hash = SHA256.HashData(Encoding.UTF8.GetBytes(param.Data ?? string.Empty));
    await res.WriteAsync(Convert.ToHexString(hash));
}

async Task api_set_password(HttpResponse res
        , [FromBody] api_set_password_param param) {
    if (string.IsNullOrEmpty(Password)) {
        Password = param.Password ?? string.Empty;
        await File.WriteAllTextAsync(PasswordFile, Password);
    } else {
        await ErrorAsync(res, "already set");
    }
}

async Task api_read(HttpResponse res
        , [FromHeader(Name = "risu-auth")] string? auth
        , [FromHeader(Name = "file-path")] string? filepath) {
    if (auth?.Trim() != Password) {
        Console.WriteLine("incorrect");
        await ErrorAsync(res, "Password Incorrect");
        return;
    }

    if(string.IsNullOrEmpty(filepath)) {
        Console.WriteLine("no path");
        await ErrorAsync(res, "File path required");
        return;
    }

    if(!IsHex(filepath)) {
        await ErrorAsync(res, "Invaild Path");
        return;
    }

    try {
        string path = Path.Combine(SavePath, filepath);
        string? content;
        if (!File.Exists(path)) {
            content = null;
        } else {
            var data = await File.ReadAllBytesAsync(Path.Combine(SavePath, filepath));
            content = Convert.ToBase64String(data);
        }
        await res.WriteAsJsonAsync(new { success = true, content });
    } catch {
        throw;
    }
}

async Task api_remove(HttpResponse res
        , [FromHeader(Name = "risu-auth")] string? auth
        , [FromHeader(Name = "file-path")] string? filepath) {
    if (auth?.Trim() != Password) {
        Console.WriteLine("incorrect");
        await ErrorAsync(res, "Password Incorrect");
        return;
    }

    if (string.IsNullOrEmpty(filepath)) {
        Console.WriteLine("no path");
        await ErrorAsync(res, "File path required");
        return;
    }

    if (!IsHex(filepath)) {
        await ErrorAsync(res, "Invaild Path");
        return;
    }

    try {
        File.Delete(Path.Combine(SavePath, filepath));
        await res.WriteAsJsonAsync(new { success = true });
    } catch {
        throw;
    }
}

async Task api_list(HttpResponse res
        , [FromHeader(Name = "risu-auth")] string? auth
        , [FromHeader(Name = "file-path")] string? filepath) {
    if (auth?.Trim() != Password) {
        Console.WriteLine("incorrect");
        await ErrorAsync(res, "Password Incorrect");
        return;
    }
    try {
        string[] data = new DirectoryInfo(SavePath).EnumerateFiles()
            .Where((item) => IsHex(item.Name))
            .Select((item) => Encoding.UTF8.GetString(Convert.FromHexString(item.Name)))
            .ToArray();
        await res.WriteAsJsonAsync(new { success = true, content = data });
    } catch {
        throw;
    }
}

async Task api_write(HttpResponse res
        , [FromHeader(Name = "risu-auth")] string? auth
        , [FromHeader(Name = "file-path")] string? filepath
        , [FromBody] api_write_param param) {
    if (auth?.Trim() != Password) {
        Console.WriteLine("incorrect");
        await ErrorAsync(res, "Password Incorrect");
        return;
    }

    byte[]? fileContent = null;
    try {
        if (param.Content != null)
            fileContent = Convert.FromBase64String(param.Content);
    } catch { }

    if (string.IsNullOrEmpty(filepath) || fileContent == null) {
        await ErrorAsync(res, "File path required");
        return;
    }

    if (!IsHex(filepath)) {
        await ErrorAsync(res, "Invaild Path");
        return;
    }

    try {
        await File.WriteAllBytesAsync(Path.Combine(SavePath, filepath), fileContent);
        await res.WriteAsJsonAsync(new { success = true });
    } catch {
        throw;
    }
}

static bool IsHex(string filePath) {
    return MyRegex().IsMatch(filePath);
}

static async Task ErrorAsync(HttpResponse response, string msg) {
    response.StatusCode = 400;
    await response.WriteAsJsonAsync(new { error = msg });
}

struct api_crypto_param {
    [JsonPropertyName("data")]
    public string? Data { get; set; }
}

struct api_set_password_param {
    [JsonPropertyName("Password")]
    public string? Password { get; set; }
}


struct api_write_param {
    [JsonPropertyName("content")]
    public string? Content { get; set; }
}

partial class Program {
    public static string SavePath = Path.Combine(Environment.CurrentDirectory, "save");

    public static string DistPath = Path.Combine(Environment.CurrentDirectory, "dist");

    public static string PasswordFile = Path.Combine(SavePath, "_password");

    public static HttpClient Client { get; } = new();
    public static string Password { get; set; } = string.Empty;

    [GeneratedRegex("^[0-9A-Fa-f]+$")]
    private static partial Regex MyRegex();
}