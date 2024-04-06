import { TranslatorBase } from "./translatorbase";

export class GoogleTranslator extends TranslatorBase {
    isExp(): boolean {
        return false;
    }

    validate(source: string, target: string): string {
        return null;
    }

    protected async performTranslate(text: string, source: string, target: string): Promise<string> {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${source}&tl=${target}&q=${encodeURIComponent(text)}`;
        
        const res = await fetch(url, {
            method: "GET",
        });

        const json = await res.json()
        if(typeof(json) === 'string') {
            return json as string;
        }

        if((!json[0]) || json[0].length === 0){
            return text;
        }

        const result = (json[0].map((s) => s[0]).filter(Boolean).join('') as string)
            .replace(/\* ([^*]+)\*/g, '*$1*')
            .replace(/\*([^*]+) \*/g, '*$1*');
        
        return result
    }
}