
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function cleanFile(filename: string) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return;
    }

    console.log(`🧹 Cleaning duplicates in ${filename}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Use a Map to store the LAST seen version of each product (by external_id)
    // This ensures if data was updated, we keep the latest crawl.
    const uniqueProducts = new Map<string, string>();
    let originalCount = 0;

    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const data = JSON.parse(line);
            if (data.external_id) {
                originalCount++;
                uniqueProducts.set(String(data.external_id), line);
            }
        } catch (e) {
            // Ignore bad lines
        }
    }

    if (uniqueProducts.size < originalCount) {
        const uniqueLines = Array.from(uniqueProducts.values()).join('\n');
        fs.writeFileSync(filePath, uniqueLines + '\n');
        console.log(`   ✅ Removed ${originalCount - uniqueProducts.size} duplicates.`);
        console.log(`   ✨ Retained ${uniqueProducts.size} unique products.`);
    } else {
        console.log(`   ✅ No duplicates found.`);
    }
}

async function main() {
    // Recursively find all .jsonl files in DATA_DIR
    const files: string[] = [];

    function scanDir(dir: string, relativePath: string = '') {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const itemRelativePath = path.join(relativePath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scanDir(fullPath, itemRelativePath);
            } else if (item.endsWith('.jsonl')) {
                files.push(itemRelativePath);
            }
        }
    }

    if (fs.existsSync(DATA_DIR)) {
        scanDir(DATA_DIR);
    }

    if (files.length === 0) {
        console.log("No JSONL files found to clean.");
    }

    for (const file of files) {
        cleanFile(file);
    }
}

main();
