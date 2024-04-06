import { TranslatorBase } from "./translatorbase";
import { sleep } from "../util";
import { globalFetch } from "../storage/globalApi";

let waitTrans = 0;
async function WaitTranslate() : Promise<undefined> {
    if(waitTrans - Date.now() > 0){
        const waitTime = waitTrans - Date.now()
        waitTrans = Date.now() + 3000
        await sleep(waitTime)
    }
}

export class DeepLXTranslator extends TranslatorBase {
    isExp(): boolean {
        return true;
    }

    validate(source: string, target: string): string {
        return null;
    }

    protected async performTranslate(text: string, source: string, target: string): Promise<string> {
        const deeplXOptions = this.db.deeplXOptions;

        let url = deeplXOptions.url || 'http://localhost:1188';
        if(url.endsWith('/')){
            url = url.slice(0, -1)
        }
        if(!url.endsWith('/translate')){
            url += '/translate'
        }

        let headers = { "Content-Type": "application/json" }
        if(deeplXOptions.token.trim() !== '') {
            headers["Authorization"] = "Bearer " + deeplXOptions.token
        }
        
        const param = {
            text: text, 
            source_lang: source.toLocaleUpperCase(),
            target_lang: target.toLocaleUpperCase(),
        };

        const res = await globalFetch(url, {
            method: "POST",
            headers: headers,
            body: param,
            plainFetchForce: true,
        });

        if(!res.ok) {
            throw `DeepLX API Error "${await res.data}"`;
        }
        
        return (await res.data).data;
    }

    protected async performTranslateBatch(texts: string[], source: string, target: string): Promise<string[]> {
        const symbol = '■';
        // preserve
        const pre = texts.map((item) => item.split(symbol));
        const text = pre.flat().join(`\n${symbol}\n`);
        // translate
        const trans = await this.performTranslate(text, source, target);
        // restore
        let split = trans.split('■');
        const res = pre.map((item) => {
            const arr = split.slice(0, item.length);
            split = split.slice(item.length);
            return arr;
        });
        return res.map((item) => item.join(symbol));
    }

    protected performTranslateContextBatch(texts: string[], context: string, source: string, target: string): Promise<string[]> {
        return this.performTranslateBatch(texts, source, target);
    }
    
    async translate(text: string, source: string, target: string): Promise<string> {
        await WaitTranslate();
        return await super.translate(text, source, target);
    }

    async translateContext(text: string, context: string, source: string, target: string): Promise<string> {
        await WaitTranslate();
        return await super.translateContext(text, context, source, target);
    }
    
    async translateHTML(html: string, source: string, target: string): Promise<string> {
        await WaitTranslate();
        return await super.translateHTML(html, source, target);
    }
}