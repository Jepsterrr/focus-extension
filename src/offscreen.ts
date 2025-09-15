import { pipeline, env } from '@xenova/transformers';

env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = {
    'ort-wasm-simd-threaded.wasm': chrome.runtime.getURL('ort-wasm-simd-threaded.wasm'),
    'ort-wasm-threaded.wasm': chrome.runtime.getURL('ort-wasm-threaded.wasm'),
    'ort-wasm-simd.wasm': chrome.runtime.getURL('ort-wasm-simd.wasm'),
    'ort-wasm.wasm': chrome.runtime.getURL('ort-wasm.wasm'),
};

env.allowLocalModels = false;
env.useBrowserCache = false;

// Hjälpfunktion för att beräkna likhet
function cosineSimilarity(embedding1: number[], embedding2: number[]) {
    const dotProduct = embedding1.reduce((sum, a, i) => sum + a * embedding2[i], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, a) => sum + a * a, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, a) => sum + a * a, 0));
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
}

class AIKeywordExtractor {
    static task = 'token-classification';
    static model = 'Xenova/bert-base-multilingual-cased-ner-hrl';
    static instance: any = null;
    static async getInstance(progress_callback?: Function) {
        if (this.instance === null) {
            console.log("Laddar AI-modell för nyckelord...");
            this.instance = await pipeline(this.task as any, this.model, { progress_callback });
            console.log("AI-modell för nyckelord laddad!");
        }
        return this.instance;
    }
}

// Singleton-klass för AI-modellen
class AISimilarity {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance: any = null;

    static async getInstance(progress_callback?: Function) {
        if (this.instance === null) {
            console.log("Laddar AI-modell...");
            this.instance = await pipeline(this.task as any, this.model, { progress_callback });
            console.log("AI-modell laddad!");
        }
        return this.instance;
    }
}

const SENSITIVITY_THRESHOLDS = {
    flexible: { keyword: 0.4, similarity: 0.4, combined: 0.35 },
    balanced: { keyword: 0.5, similarity: 0.5, combined: 0.44 },
    strict: { keyword: 0.6, similarity: 0.6, combined: 0.55 },
};

async function getAIRelevance(
    task: string, 
    pageData: { title: string, mainText: string },
    sensitivity: 'flexible' | 'balanced' | 'strict' = 'balanced'
): Promise<boolean> {
    try {
        const thresholds = SENSITIVITY_THRESHOLDS[sensitivity];
        const [extractor, keywordFinder] = await Promise.all([
            AISimilarity.getInstance(),
            AIKeywordExtractor.getInstance()
        ]);

        if (!extractor || !keywordFinder) return true;

        // Nyckelordsanalys
        const taskKeywords = new Set((await keywordFinder(task)).map((item: any) => item.entity === 'B-MISC' || item.entity === 'B-LOC' || item.entity === 'B-PER' || item.entity === 'B-ORG' ? item.word.toLowerCase() : null).filter(Boolean));
        if (taskKeywords.size === 0) {
            task.toLowerCase().split(' ').forEach(word => { if (word.length > 3) taskKeywords.add(word) });
        }
        const pageKeywords = new Set((await keywordFinder(pageData.mainText.substring(0, 3000))).map((item: any) => item.word.toLowerCase()));
        
        let keywordMatches = 0;
        taskKeywords.forEach(keyword => {
            if (pageKeywords.has(keyword)) {
                keywordMatches++;
            }
        });
        const keywordScore = taskKeywords.size > 0 ? keywordMatches / taskKeywords.size : 0;

        // Konceptuell likhetsanalys
        const [taskEmbedding, titleEmbedding, contentEmbedding] = await Promise.all([
            extractor(task, { pooling: 'mean', normalize: true }),
            extractor(pageData.title, { pooling: 'mean', normalize: true }),
            extractor(pageData.mainText, { pooling: 'mean', normalize: true })
        ]);

        const titleSimilarity = cosineSimilarity(taskEmbedding.data, titleEmbedding.data);
        const contentSimilarity = cosineSimilarity(taskEmbedding.data, contentEmbedding.data);
        // Ge titeln lite mer vikt än innehållet
        const similarityScore = (titleSimilarity * 0.6) + (contentSimilarity * 0.4);

        // Chans 1: Nyckelorden överlappar mycket
        if (keywordScore >= thresholds.keyword) {
            console.log(`Bedömning (${sensitivity}): Relevant (Hög nyckelordsmatchning).`);
            return true;
        }

        // Chans 2: Hög likhet
        if (similarityScore >= thresholds.similarity) {
            console.log(`Bedömning (${sensitivity}): Relevant (Hög konceptuell likhet).`);
            return true;
        }

        // Chans 3: Kombinerad score är stark nog
        const combinedScore = (similarityScore * 0.7) + (keywordScore * 0.3);
        if (combinedScore > thresholds.combined) {
            console.log(`Bedömning (${sensitivity}): Relevant (Kombinerad score ${combinedScore.toFixed(2)} är över tröskeln).`);
            return true;
        }
        
        console.log(`Bedömning (${sensitivity}): Irrelevant (Alla chanser misslyckades).`);
        return false;

    } catch (e) {
        console.error("Fel vid avancerad AI-analys:", e);
        return true; // Returnera true vid fel för att undvika falska positiva
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ANALYZE_PAGE') {
        console.log("Offscreen document mottog analysjobb.");
        getAIRelevance(message.payload.task, message.payload.pageData, message.payload.sensitivity)
            .then(isRelevant => {
                sendResponse({ isRelevant });
            });
        // Returnera true för att indikera att vi kommer svara asynkront
        return true;
    }
});

AISimilarity.getInstance( (p: any) => console.log(`Laddar modell: ${p.file} (${(p.progress||0).toFixed(2)}%)`) );
AIKeywordExtractor.getInstance((p: any) => console.log(`Laddar nyckelordsmodell: ${p.file} (${(p.progress || 0).toFixed(2)}%)`));