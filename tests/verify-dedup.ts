
try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { SmartDeduplicator } from '../src/lib/entity-resolution/smartDeduplicator';

async function verify() {
    console.log('Attempting to import and instantiate SmartDeduplicator...');
    try {
        const dedup = new SmartDeduplicator();
        console.log('✅ SmartDeduplicator instantiated successfully.');
        console.log('Code structure and imports are valid.');
    } catch (error) {
        console.error('❌ Failed to instantiate SmartDeduplicator:', error);
        process.exit(1);
    }
}

verify();
