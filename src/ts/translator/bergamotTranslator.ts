import { BatchTranslator, TranslatorBacking } from "@browsermt/bergamot-translator";
import { globalFetch } from "../globalApi.svelte";

// Cache Translations Models
class CacheDB {
    private readonly dbName: string;
    private readonly storeName: string = "cache";

    constructor(dbName: string = "cache") {
        this.dbName = dbName;
    }

    private async getDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: "url" });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async load(url: string, checksum: string): Promise<ArrayBuffer | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.get(url);

            request.onsuccess = () => {
                const result = request.result;
                if (result && result.checksum === checksum) {
                    resolve(result.buffer);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async save(url: string, checksum: string, buffer: ArrayBuffer): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ url, checksum, buffer });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Mozilla Firefox Translations Models
class FirefoxBacking extends TranslatorBacking {
    private cache: CacheDB;
    downloadTimeout: number;

    constructor(options?) {
        super(options);
        this.cache = new CacheDB("firefox-translations-models");
    }

    async loadModelRegistery() {
        const recordUrl = 'https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/translations-models/records';
        const modelUrl = 'https://firefox-settings-attachments.cdn.mozilla.net/';
        const res = await fetch(recordUrl, { method: 'GET' });
        const json = await res.json();

        const registery = {};
        for (const item of json.data) {
            const lang = item.fromLang + item.toLang;
            const model = registery[lang] ??= { from: item.fromLang, to: item.toLang };
            model.files ??= {};
            model.files[item.fileType] = {
                name: modelUrl + item.attachment.location,
                size : item.attachment.size,
                expectedSha256Hash: item.attachment.hash
            };
        }
        return Array.from(Object.values(registery));
    }

    async fetch(url, checksum, extra) {
        const cacheBuffer = await this.cache.load(url, checksum);
        console.log(url, cacheBuffer);
        if (cacheBuffer) { return cacheBuffer; }

        // Fetch
        const res = await globalFetch(url, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
                "Accept": "*/*",
            },
            rawResponse: true,
        });
        if(!res.ok) {
            throw res.data;
        }

        // Save cache
        const buffer = res.data.buffer;
        await this.cache.save(url, checksum, buffer);
        return buffer;
    }
}

let translator = null;

// Translate
export async function bergamotTranslate(text:string, from:string, to:string, html:boolean|null) {
    translator ??= new BatchTranslator({ batchSize: 1 }, new FirefoxBacking());

    const translate = await translator.translate({
        from: from, to: to,
        text: text, html: html,
    });
    return translate.target.text;
}

// Clear Cache
export async function clearCache() {
    await new CacheDB("firefox-translations-models").clear();
}