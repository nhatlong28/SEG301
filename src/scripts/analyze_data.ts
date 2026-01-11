
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function analyzeFile(filename: string) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filename}`);
        return;
    }

    console.log(`\n📊 Analyzing ${filename}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let validCount = 0;
    let errorCount = 0;
    const seenIds = new Set<string>();
    let duplicateCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            const data = JSON.parse(line);
            if (data.external_id) {
                const id = String(data.external_id);
                if (seenIds.has(id)) {
                    duplicateCount++;
                    if (duplicateCount <= 3) {
                        console.log(`   ⚠️ Duplicate found: ${id} at line ${i + 1}`);
                    }
                } else {
                    seenIds.add(id);
                }
            } else {
                console.log(`   ⚠️ Line ${i + 1} missing external_id`);
            }
            validCount++;
        } catch (e) {
            errorCount++;
            if (errorCount <= 3) {
                console.log(`   ❌ Invalid JSON at line ${i + 1}: ${line.substring(0, 50)}...`);
            }
        }
    }

    console.log(`   ✅ Total Valid Lines: ${validCount}`);
    console.log(`   ❌ Total Errors: ${errorCount}`);
    console.log(`   🔁 Total Duplicates: ${duplicateCount}`);
    console.log(`   ✨ Unique Products: ${seenIds.size}`);
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
        console.log("No JSONL files found in data directory or its subdirectories.");
        return;
    }

    for (const file of files) {
        analyzeFile(file);
    }
}

main();
