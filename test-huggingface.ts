/**
 * Test HuggingFace Embedding API
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) {
    // dotenv not available, assume env vars are already set
}


const EMBEDDING_MODEL = 'BAAI/bge-base-en-v1.5';
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${EMBEDDING_MODEL}`;

async function testHuggingFace() {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        console.error('❌ HUGGINGFACE_API_KEY not found in environment!');
        process.exit(1);
    }

    console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');
    console.log('🌐 Testing URL:', HF_API_URL);
    console.log('');

    const testTexts = [
        'query: iPhone 15 Pro Max giá bao nhiêu',
        'passage: Samsung Galaxy S24 Ultra điện thoại thông minh cao cấp',
    ];

    for (const text of testTexts) {
        console.log(`📝 Testing: "${text.substring(0, 50)}..."`);

        try {
            const response = await fetch(HF_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: text,
                }),
            });

            console.log(`   Status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const error = await response.text();
                console.error(`   ❌ Error: ${error}`);
                continue;
            }

            const result = await response.json();

            // OpenAI-compatible response format: { data: [{ embedding: [...] }] }
            if (result.data && Array.isArray(result.data) && result.data[0]?.embedding) {
                const embedding = result.data[0].embedding;
                console.log(`   ✅ Success! Embedding dimension: ${embedding.length}`);
                console.log(`   📊 First 5 values: [${embedding.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]`);
            } else if (Array.isArray(result)) {
                // Legacy format fallback
                const embedding = Array.isArray(result[0]) ? result[0] : result;
                console.log(`   ✅ Success! Embedding dimension: ${embedding.length}`);
                console.log(`   📊 First 5 values: [${embedding.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]`);
            } else {
                console.log(`   ⚠️ Unexpected response format:`, JSON.stringify(result).substring(0, 200));
            }
        } catch (error) {
            console.error(`   ❌ Network error:`, error);
        }

        console.log('');
    }

    console.log('✅ Test completed!');
}

testHuggingFace();
