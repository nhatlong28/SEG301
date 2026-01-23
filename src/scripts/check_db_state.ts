
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkStatus() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();
        console.log('📊 DATABASE STATUS (CockroachDB)\n');

        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);

        console.log('Table Name          | Row Count');
        console.log('--------------------|-----------');

        for (const row of tablesRes.rows) {
            const tableName = row.table_name;
            const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
            const count = countRes.rows[0].count;
            console.log(`${tableName.padEnd(20)} | ${parseInt(count).toLocaleString()}`);
        }

    } catch (e: any) {
        console.error('❌ Error checking DB status:', e.message);
    } finally {
        await client.end();
    }
}

checkStatus();
