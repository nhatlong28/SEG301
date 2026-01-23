
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkDuplicates() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    console.log('🔍 CHECKING FOR DUPLICATE EXTERNAL_IDS WITHIN EACH SOURCE...');

    const query = `
        SELECT 
            s.name as source_name,
            COUNT(r.external_id) as total_rows,
            COUNT(DISTINCT r.external_id) as unique_ids,
            COUNT(r.external_id) - COUNT(DISTINCT r.external_id) as duplicate_count
        FROM sources s
        JOIN raw_products r ON s.id = r.source_id
        GROUP BY s.name
        HAVING COUNT(r.external_id) > COUNT(DISTINCT r.external_id)
        ORDER BY duplicate_count DESC;
    `;

    try {
        const res = await client.query(query);

        if (res.rows.length === 0) {
            console.log('✅ GREAT NEWS: No duplicates found based on (source_id, external_id)!');
        } else {
            console.log('\n⚠️ DUPLICATES DETECTED:');
            console.log('Source Name          | Total Rows | Unique IDs | Duplicates');
            console.log('---------------------|------------|------------|-----------');
            res.rows.forEach(row => {
                console.log(
                    `${row.source_name.padEnd(20)} | ` +
                    `${row.total_rows.toString().padStart(10)} | ` +
                    `${row.unique_ids.toString().padStart(10)} | ` +
                    `${row.duplicate_count.toString().padStart(9)}`
                );
            });
            console.log('\nNote: CockroachDB has a UNIQUE constraint on (source_id, external_id), so technically duplicates cannot exist unless the constraint is missing.');
        }

        // Also check for duplicate names (potential same product with different external_id)
        console.log('\n🔍 CHECKING FOR POTENTIAL DUPLICATE NAMES (Same source, same name):');
        const nameQuery = `
            SELECT 
                s.name as source_name,
                COUNT(*) as dup_name_count
            FROM (
                SELECT source_id, name, COUNT(*) 
                FROM raw_products 
                GROUP BY source_id, name 
                HAVING COUNT(*) > 1
            ) sub
            JOIN sources s ON s.id = sub.source_id
            GROUP BY s.name
            ORDER BY dup_name_count DESC;
        `;
        const resNames = await client.query(nameQuery);
        if (resNames.rows.length > 0) {
            console.log('Source Name          | Products with duplicate names');
            console.log('---------------------|-----------------------------');
            resNames.rows.forEach(row => {
                console.log(`${row.source_name.padEnd(20)} | ${row.dup_name_count.toString().padStart(27)}`);
            });
        }

    } catch (e) {
        console.error('Error checking duplicates:', e);
    } finally {
        await client.end();
    }
}

checkDuplicates().catch(console.error);
