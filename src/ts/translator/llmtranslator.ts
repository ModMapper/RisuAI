import { TranslatorBase } from "./translatorbase";
import type { OpenAIChat } from "../process";
import { requestChatData } from "../process/request";

const llmCache = new Map<string, string>();

async function requestLLM(chats: OpenAIChat[]) {
    const rq = await requestChatData({
        formated: chats,
        bias: {},
        useStreaming: false,
    }, 'submodel');

    if(rq.type === 'fail' || rq.type === 'streaming' || rq.type === 'multiline'){
        throw `LLM Error "${rq.result.toString()}"`;
    }
    return rq.result;
}

export class LLMTranslator extends TranslatorBase {
    isExp(): boolean {
        return true;
    }

    validate(source: string, target: string): string {
        return null;
    }

    protected async performTranslate(text: string, source: string, target: string): Promise<string> {
        const key = `text/${source}/${target}/${text}`;
        if(llmCache.has(key)) return llmCache.get(key);

        let prompt = this.db.translatorPrompt
            ?? 'You are a translator. translate the following html or text into {{slot}}. do not output anything other than the translation.';
        prompt = prompt.replace('{{slot}}', target);
        
        const trans = await requestLLM([
            {
                'role': 'system',
                'content': prompt
            },
            {
                'role': 'user',
                'content': text
            }
        ]);

        llmCache.set(key, trans);
        return trans;
    }

    protected async performTranslateHTML(html: string, source: string, target: string): Promise<string> {
        const key = `html/${source}/${target}/${html}`;
        if(llmCache.has(key)) return llmCache.get(key);

        let prompt = this.db.translatorPrompt
            ?? 'You are a translator. translate the following html or text into {{slot}}. do not output anything other than the translation.';
        prompt = prompt.replace('{{slot}}', target);
        
        const trans = await requestLLM([
            {
                'role': 'system',
                'content': prompt
            },
            {
                'role': 'user',
                'content': html
            }
        ]);

        llmCache.set(key, trans);
        return trans;
    }
}