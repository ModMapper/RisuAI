import { get } from "svelte/store"
import { DataBase, type Database } from "../storage/database"
import { alertError } from "../alert"
import { doingChat } from "../process"
import type { simpleCharacterArgument } from "../parser"
import { selectedCharID } from "../stores"
import { getModuleRegexScripts } from "../process/modules"
import type { TranslatorBase } from "./translatorbase"
import { LLMTranslator } from "./llmtranslator"
import { DeepLTranslator } from "./deepltranslator"
import { DeepLXTranslator } from "./deeplxtranslator"
import { GoogleTranslator } from "./googletranslator"
import { PluginTranslator } from "./pluginTranslator"

let cache={
    origin: [''],
    trans: ['']
}

export async function translate(text: string, reverse: boolean) {
    if(!reverse){
        const ind = cache.origin.indexOf(text)
        if(ind !== -1){
            return cache.trans[ind]
        }
    }
    else{
        const ind = cache.trans.indexOf(text)
        if(ind !== -1){
            return cache.origin[ind]
        }
    }
    
    const [source, target] = getLanguage(get(DataBase), reverse);
    return await runTranslator(text, reverse, source, target);
}

export async function runTranslator(text: string, reverse: boolean, source: string, target: string) {
    const texts = text.split('\n');
    let chunks:[string,boolean][] = [['', true]];
    for(let i = 0; i < texts.length; i++){
        if( texts[i].startsWith('{{img')
            || texts[i].startsWith('{{raw')
            || texts[i].startsWith('{{video')
            || texts[i].startsWith('{{audio')
            && texts[i].endsWith('}}')
            || texts[i].length === 0){
            chunks.push([texts[i], false])
            chunks.push(["", true])
        }
        else{
            chunks[chunks.length-1][0] += texts[i]
        }
    }

    let fullResult:string[] = [];
    const translator = getTranslator(get(DataBase));
    for(const chunk of chunks){
        if(chunk[1]){
            const trimed = chunk[0].trim();
            if(trimed.length === 0){
                fullResult.push(chunk[0])
                continue
            }
            const result = await translator.translate(trimed, source, target);

            if(result.startsWith('ERR::')){
                alertError(result)
                return text
            }


            fullResult.push(result.trim())
        }
        else{
            fullResult.push(chunk[0])
        }
    }

    const result = fullResult.join("\n").trim()

    cache.origin.push(reverse ? result : text)
    cache.trans.push(reverse ? text : result)

    return result
}


export async function translateHTML(html: string, reverse:boolean, charArg:simpleCharacterArgument|string = ''): Promise<string> {
    let db = get(DataBase)
    const translator = getTranslator(db);
    if(translator.isExp() && get(doingChat)) {
        return html;
    }
    
    const [source, target] = getLanguage(db, reverse);
    const translated = await translator.translateHTML(html, source, target);
    return applyRegex(db, translated, 'edittrans', charArg);  
}

export async function translateVox(text:string) {
    return runTranslator(text, true, 'ja', 'en');
}

export function isExpTranslator(){
    return getTranslator(get(DataBase)).isExp();
}

function getLanguage(db : Database, reverse: boolean) : [string, string] {
    const model = db.aiModel.startsWith('novellist') ? 'ja' : 'en';
    const user = db.translator;
    return reverse ? [user, model] : [model, user];
}

function getTranslator(db: Database) : TranslatorBase {
    switch(db.translatorType) {
        case "plugin":
            return new PluginTranslator(db);
        case "llm":
            return new LLMTranslator(db);
        case "deepl":
            return new DeepLTranslator(db);
        case "deeplX":
            return new DeepLXTranslator(db);
        default:
            return new GoogleTranslator(db);
    }
}

function applyRegex(db: Database, text: string, type: string, charArg:simpleCharacterArgument|string): string {
    if(charArg == '') return text;
    let scripts = getModuleRegexScripts() ?? [];
    
    let char = typeof(charArg) === 'string'
        ? db.characters[get(selectedCharID)]
        : charArg;
    if(char?.customscript != null)
        scripts = scripts.concat(char.customscript);

    for(const script of scripts){
        if(script.type === type){
            const reg = new RegExp(script.in, script.ableFlag ? script.flag : 'g');
            let outScript = script.out.replaceAll("$n", "\n");
            text = text.replace(reg, outScript);
        }
    }
    return text;
}