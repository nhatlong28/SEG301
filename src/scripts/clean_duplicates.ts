import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

async function cleanSource(source: string) {
    const filename = path.join(DATA_DIR, source, 'products.jsonl');
    if (!fs.existsSync(filename)) {
        console.log(`[${source}] No products.jsonl found.`);
        return;
    }

    console.log(`[${source}] Processing duplicates...`);
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const uniqueProducts = new Map<string, any>();
    let duplicateCount = 0;

    for (const line of lines) {
        try {
            const p = JSON.parse(line);
            const id = String(p.external_id);

            if (uniqueProducts.has(id)) {
                duplicateCount++;
                // Có thể giữ cái mới nhất hoặc cái cũ nhất. Ở đây mặc định giữ cái đầu tiên thấy.
                continue;
            }
            uniqueProducts.set(id, p);
        } catch {
            console.error(`[${source}] Failed to parse line: ${line.substring(0, 100)}...`);
        }
    }

    if (duplicateCount > 0) {
        console.log(`[${source}] Found ${duplicateCount} duplicates. Retaining ${uniqueProducts.size} unique products.`);

        // Backup original file
        const backupFile = filename + '.bak';
        fs.copyFileSync(filename, backupFile);

        // Write cleaned file
        const cleanedContent = Array.from(uniqueProducts.values()).map(p => JSON.stringify(p)).join('\n') + '\n';
        fs.writeFileSync(filename, cleanedContent);
        console.log(`[${source}] Cleaned file saved. Backup created at ${backupFile}`);
    } else {
        console.log(`[${source}] No duplicates found. Total: ${uniqueProducts.size}`);
    }
}

async function main() {
    if (!fs.existsSync(DATA_DIR)) {
        console.error('Data directory not found.');
        return;
    }

    const args = process.argv.slice(2);
    const targetSource = args[0];

    const sources = fs.readdirSync(DATA_DIR).filter(f => fs.statSync(path.join(DATA_DIR, f)).isDirectory());

    if (targetSource) {
        if (sources.includes(targetSource)) {
            await cleanSource(targetSource);
        } else {
            console.error(`Source ${targetSource} not found in data directory.`);
        }
    } else {
        for (const source of sources) {
            await cleanSource(source);
        }
    }
}

main().catch(console.error);
