/**
 * Custom BM25 Ranking Implementation for SEG301
 * Used to re-rank search results for maximum relevance.
 */

export interface Document {
    id: number | string;
    text: string;
    [key: string]: any;
}

export class BM25Ranker {
    private k1: number = 1.5;
    private b: number = 0.75;
    private avgDocLength: number = 0;
    private docCount: number = 0;
    private idf: Map<string, number> = new Map();
    private docLengths: Map<number | string, number> = new Map();

    constructor(k1 = 1.5, b = 0.75) {
        this.k1 = k1;
        this.b = b;
    }

    /**
     * Train the ranker with a collection of documents
     */
    train(docs: Document[]) {
        this.docCount = docs.length;
        let totalLength = 0;
        const df: Map<string, number> = new Map();

        for (const doc of docs) {
            const tokens = this.tokenize(doc.text);
            this.docLengths.set(doc.id, tokens.length);
            totalLength += tokens.length;

            const uniqueTokens = new Set(tokens);
            for (const token of uniqueTokens) {
                df.set(token, (df.get(token) || 0) + 1);
            }
        }

        this.avgDocLength = totalLength / this.docCount;

        // Calculate IDF
        for (const [token, count] of df.entries()) {
            // BM25 standard IDF: log( (N - n + 0.5) / (n + 0.5) + 1 )
            const idfValue = Math.log((this.docCount - count + 0.5) / (count + 0.5) + 1);
            this.idf.set(token, idfValue);
        }
    }

    /**
     * Score a document against a query
     */
    score(query: string, doc: Document): number {
        const queryTokens = this.tokenize(query);
        const docTokens = this.tokenize(doc.text);
        const docLength = this.docLengths.get(doc.id) || docTokens.length;

        // Term frequencies in document
        const tf: Map<string, number> = new Map();
        for (const token of docTokens) {
            tf.set(token, (tf.get(token) || 0) + 1);
        }

        let score = 0;
        for (const token of queryTokens) {
            if (!this.idf.has(token)) continue;

            const idf = this.idf.get(token)!;
            const freq = tf.get(token) || 0;

            // BM25 formula: IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (L / avgL)))
            const numerator = freq * (this.k1 + 1);
            const denominator = freq + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

            score += idf * (numerator / denominator);
        }

        return score;
    }

    private tokenize(text: string): string[] {
        return text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    }
}
