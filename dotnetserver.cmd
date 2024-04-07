@echo off
dotnet build server/dotnet --configuration Release
call npm install
call npm run build
set Logging__LogLevel__Microsoft.AspNetCore=Warning
dotnet server/dotnet/bin/Release/net8.0/risuai.dll