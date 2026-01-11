
import axios from 'axios';

async function findCategoryId(slug: string) {
    const url = `https://cellphones.com.vn/${slug}.html`;
    console.log(`Fetching ${url}...`);
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Look for typical patterns
        const patterns = [
            /"categoryId":\s*(\d+)/,
            /"category_id":\s*"?(\d+)"?/,
            /currentCategoryId:\s*(\d+)/,
            /category_id:\s*(\d+)/
        ];

        for (const p of patterns) {
            const match = data.match(p);
            if (match) {
                console.log(`✅ Found ID for ${slug}: ${match[1]} (Pattern: ${p})`);
                return match[1];
            }
        }
        console.log(`❌ Could not find ID for ${slug}`);
    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

async function run() {
    await findCategoryId('laptop');
    await findCategoryId('dien-thoai');
}

run();
