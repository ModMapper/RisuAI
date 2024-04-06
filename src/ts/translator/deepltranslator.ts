import { TranslatorBase } from "./translatorbase";
import type { Database } from "../storage/database";
import { globalFetch } from "../storage/globalApi";

const lang = {
    "en": "EN-US",
    "ko": "KO",
    "ru": "RU",
    "zh": "ZH",
    "ja": "JA",
    "fr": "FR",
    "es": "ES",
    "pt": "PT-PT",
    "de": "DE",
    "id": "ID",
    //"ms": "MS",
    "uk": "UK",
};

interface DeepLResponse {
    translations: {
        detected_source_language: string,
        text: string,
    }[]
}

async function fetchDeepL(deeplOptions : Database["deeplOptions"], body : any) : Promise<DeepLResponse> {
    const url = deeplOptions.freeApi 
        ? "https://api-free.deepl.com/v2/translate"
        : "https://api.deepl.com/v2/translate";

    const res = await globalFetch(url, {
        headers: {
            "Authorization": "DeepL-Auth-Key " + deeplOptions.key,
            "Content-Type": "application/json"
        },
        body: body,
    });

    if(!res.ok) {
        throw  `DeepL API Error "${await res.data}"`;
    }
    return await res.data;
}

export class DeepLTranslator extends TranslatorBase {
    isExp(): boolean {
        return true;
    }

    validate(source: string, target: string): string {
        console.log(target);
        //if(lang[source] == null) {
        //    return 'ERR::DeepL API Error "Invalid source language"';
        //}
        if(lang[target] == null) {
            return 'ERR::DeepL API Error "Invalid target language"';
        }
        return null;
    }

    protected async performTranslate(text: string, source: string, target: string): Promise<string> {
        const deeplOptions = this.db.deeplOptions;
        const result = await fetchDeepL(deeplOptions, {
            text: [text],
            target_lang: lang[target],
        });
        return result.translations[0].text;
    }

    protected async performTranslateContext(text: string, context: string, source: string, target: string): Promise<string> {
        const deeplOptions = this.db.deeplOptions;
        const result = await fetchDeepL(deeplOptions, {
            text: [text],
            target_lang: lang[target],
            context: context,
        });
        return result.translations[0].text;
    }

    protected async performTranslateBatch(texts: string[], source: string, target: string): Promise<string[]> {
        const deeplOptions = this.db.deeplOptions;
        const result = await fetchDeepL(deeplOptions, {
            text: texts,
            target_lang: lang[target],
        });
        return result.translations.map((item) => item.text);
    }

    protected async performTranslateContextBatch(texts: string[], context: string, source: string, target: string): Promise<string[]> {
        const deeplOptions = this.db.deeplOptions;
        const result = await fetchDeepL(deeplOptions, {
            text: texts,
            target_lang: lang[target],
            context: context,
        });
        return result.translations.map((item) => item.text);
    }

    protected async performTranslateHTML(html: string, source: string, target: string): Promise<string> {
        const deeplOptions = this.db.deeplOptions;
        const result = await fetchDeepL(deeplOptions, {
            text: [html],
            target_lang: lang[target],
            tag_handling: 'html',
        });
        return result.translations[0].text;
    }
}