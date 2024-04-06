import { TranslatorBase } from "./translatorbase";
import { translatorPlugin } from "../plugins/plugins";

export class PluginTranslator extends TranslatorBase {
    isExp(): boolean {
        return false;
    }

    validate(source: string, target: string): string {
        return null;
    }

    protected async performTranslate(text: string, source: string, target: string): Promise<string> {
        const result = await translatorPlugin(text, source, target);
        if(!result){
            throw `Plugin Error "Translator plugin is missing."`;
        }
        if(!result.success) {
            throw `Plugin Error "${result.content}"`;
        }
        return result.content;
    }
}