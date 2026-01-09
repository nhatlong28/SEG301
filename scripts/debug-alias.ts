require('dotenv').config({ path: '.env.local' });
require('@/lib/db/supabase'); // This should fail if tsconfig paths are not working for tsx
console.log('Path alias loaded');
