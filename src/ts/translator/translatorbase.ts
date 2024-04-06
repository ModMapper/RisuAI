import type { Database } from "../storage/database";

const range = new Range();

export abstract class TranslatorBase {
    protected db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    abstract isExp(): boolean;

    abstract validate(source: string, target: string): string;

    protected abstract performTranslate(text: string, source: string, target: string): Promise<string>;

    protected performTranslateContext(text: string, context: string, source: string, target: string): Promise<string> {
        return this.performTranslate(text, source, target);
    }

    protected async performTranslateBatch(texts: string[], source: string, target: string): Promise<string[]> {
        return Promise.all(texts.map((text) => this.performTranslate(text, source, target)));
    }

    protected async performTranslateContextBatch(texts: string[], context: string, source: string, target: string): Promise<string[]> {
        return Promise.all(texts.map((text) => {
            const task = this.performTranslateContext(text, context, source, target);
            context += text;
            return task;
        }));
    }

    protected async performTranslateHTML(html: string, source: string, target: string): Promise<string> {
        const fragment = range.createContextualFragment(html);
        const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);

        const nodes: Text[] = [];
        while(walker.nextNode()) {
            if(walker.currentNode.parentElement?.getAttribute('translate')?.toLowerCase() != "no")
                nodes.push(walker.currentNode as Text);
        }

        const texts = nodes.map((node) => node.textContent);
        const translates = await this.performTranslateContextBatch(texts, "", source, target);
        for(let i = 0; i < nodes.length; i++) {
            nodes[i].textContent = translates[i];
        }

        const wrap = document.createElement("div");
        wrap.append(fragment);
        return wrap.innerHTML;
    }

    async translate(text: string, source: string, target: string): Promise<string> {
        const validate = this.validate(source, target);
        if(validate != null) return validate;
        try {
            return await this.performTranslate(text, source, target);
        } catch(ex) {
            return  'ERR::' + ex;
        }
    }

    async translateContext(text: string, context: string, source: string, target: string): Promise<string> {
        const validate = this.validate(source, target);
        if(validate != null) return validate;
        try {
            return await this.performTranslateContext(text, context, source, target);
        } catch(ex) {
            return  'ERR::' + ex;
        }
    }
    
    async translateHTML(html: string, source: string, target: string): Promise<string> {
        const validate = this.validate(source, target);
        if(validate != null) return validate;
        try {
            return await this.performTranslateHTML(html, source, target);
        } catch(ex) {
            return  'ERR::' + ex;
        }
    }
}