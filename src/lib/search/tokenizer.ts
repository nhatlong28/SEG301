/**
 * Simple Vietnamese Tokenizer for Search Enginer (SEG301 Project)
 * Implements a dictionary-based approach + n-grams for Vietnamese word segmentation.
 */

export class VietnameseTokenizer {
    // Basic dictionary for common Vietnamese compound words (shortened for demo)
    private static readonly COMPOUND_WORDS = new Set([
        'điện thoại', 'máy tính', 'xách tay', 'tông màu', 'ốp lưng', 'cường lực',
        'màn hình', 'bàn phím', 'chuột không dây', 'tai nghe', 'chống ồn',
        'sạc dự phòng', 'bình nước', 'tủ lạnh', 'máy giặt', 'máy lọc nước',
        'điều hòa', 'quạt điện', 'xe máy', 'ô tô', 'thời trang', 'giày dép',
        'chính hãng', 'giá rẻ', 'trả góp', 'mới nhất', 'cũ đẹp', 'fullbox'
    ]);

    /**
     * Tokenize Vietnamese text into words and compound words
     */
    static tokenize(text: string): string[] {
        if (!text) return [];

        const normalized = text.toLowerCase()
            .normalize('NFC')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const tokens: string[] = [];
        const words = normalized.split(' ');

        let i = 0;
        while (i < words.length) {
            // Try matching 3-word compounds
            if (i + 2 < words.length) {
                const combined3 = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
                if (this.COMPOUND_WORDS.has(combined3)) {
                    tokens.push(combined3.replace(/ /g, '_'));
                    i += 3;
                    continue;
                }
            }

            // Try matching 2-word compounds
            if (i + 1 < words.length) {
                const combined2 = `${words[i]} ${words[i + 1]}`;
                if (this.COMPOUND_WORDS.has(combined2)) {
                    tokens.push(combined2.replace(/ /g, '_'));
                    i += 2;
                    continue;
                }
            }

            // Default to single word
            tokens.push(words[i]);
            i++;
        }

        return tokens;
    }

    /**
     * For PostgreSQL tsvector - joins words with _
     */
    static forSearch(text: string): string {
        return this.tokenize(text).join(' ');
    }
}
