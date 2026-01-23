import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

interface QualityStats {
    total: number;
    missingName: number;
    missingPrice: number;
    invalidPrice: number;
    missingImage: number;
    missingUrl: number;
    shortName: number;
    good: number;
}

async function evaluateSource(source: string) {
    const filename = path.join(DATA_DIR, source, 'products.jsonl');
    if (!fs.existsSync(filename)) return;

    console.log(`\n📊 [${source.toUpperCase()}] EVALUATING QUALITY...`);
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const stats: QualityStats = {
        total: lines.length,
        missingName: 0,
        missingPrice: 0,
        invalidPrice: 0,
        missingImage: 0,
        missingUrl: 0,
        shortName: 0,
        good: 0
    };

    for (const line of lines) {
        try {
            const p = JSON.parse(line);
            let isBad = false;

            if (!p.name || p.name.trim() === '') {
                stats.missingName++;
                isBad = true;
            } else if (p.name.length < 10) {
                stats.shortName++;
                // Không đánh dấu là "bad" hoàn toàn, nhưng note lại
            }

            if (!p.price && p.price !== 0) {
                stats.missingPrice++;
                isBad = true;
            } else if (p.price <= 0 || p.price > 1000000000) { // > 1 Billion VND
                stats.invalidPrice++;
                isBad = true;
            }

            if (!p.image_url || !p.image_url.startsWith('http')) {
                stats.missingImage++;
                isBad = true;
            }

            if (!p.external_url || !p.external_url.startsWith('http')) {
                stats.missingUrl++;
                isBad = true;
            }

            if (!isBad) stats.good++;

        } catch {
            // Ignore parse errors from corrupt lines
        }
    }

    const goodRate = ((stats.good / stats.total) * 100).toFixed(2);

    console.log(`   - Total Products: ${stats.total.toLocaleString()}`);
    console.log(`   - "Good" Products: ${stats.good.toLocaleString()} (${goodRate}%)`);
    console.log(`   - Quality Issues:`);
    if (stats.missingName > 0) console.log(`     * Missing Name: ${stats.missingName}`);
    if (stats.shortName > 0) console.log(`     * Name too short (<10 chars): ${stats.shortName}`);
    if (stats.missingPrice > 0) console.log(`     * Missing Price: ${stats.missingPrice}`);
    if (stats.invalidPrice > 0) console.log(`     * Invalid/Outlier Price: ${stats.invalidPrice}`);
    if (stats.missingImage > 0) console.log(`     * Missing/Invalid Image: ${stats.missingImage}`);
    if (stats.missingUrl > 0) console.log(`     * Missing/Invalid URL: ${stats.missingUrl}`);

    if (stats.good === stats.total) {
        console.log(`   ✅ Perfect quality!`);
    } else if (stats.good / stats.total > 0.9) {
        console.log(`   ✅ High quality!`);
    } else {
        console.log(`   ⚠️ Quality needs improvement.`);
    }
}

async function main() {
    if (!fs.existsSync(DATA_DIR)) return;

    const args = process.argv.slice(2);
    const targetSource = args[0];

    const sources = fs.readdirSync(DATA_DIR).filter(f => fs.statSync(path.join(DATA_DIR, f)).isDirectory());

    if (targetSource) {
        if (sources.includes(targetSource)) {
            await evaluateSource(targetSource);
        } else {
            console.error(`Source ${targetSource} not found.`);
        }
    } else {
        for (const source of sources) {
            await evaluateSource(source);
        }
    }
}

main().catch(console.error);
