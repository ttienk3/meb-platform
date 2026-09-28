const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('Connected successfully.');

    const schemaPath = path.join(__dirname, '../schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql...');
    await client.query(sql);
    console.log('schema.sql executed successfully.');

    // Query tables in public schema
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('\n--- ACTUAL TABLES IN SUPABASE ---');
    const tables = res.rows.map(r => r.table_name);
    console.log(tables);

    const requiredTables = [
      'tenants', 'stores', 'branches', 'warehouses', 'users',
      'products', 'inventory', 'orders', 'order_items'
    ];

    const missing = requiredTables.filter(t => !tables.includes(t));
    if (missing.length === 0) {
      console.log('\nVERIFICATION RESULT: ALL 9 REQUIRED TABLES EXIST!');
    } else {
      console.error('\nMISSING TABLES:', missing);
      process.exit(1);
    }
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
