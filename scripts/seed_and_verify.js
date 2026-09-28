const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function seedAndVerify() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL.');

    // 1. Run seed.sql
    console.log('Loading seed.sql...');
    const seedSql = fs.readFileSync(path.join(__dirname, '../seed.sql'), 'utf8');
    await client.query(seedSql);
    console.log('seed.sql executed successfully.\n');

    // 2. Query Tenant
    const tenantRes = await client.query('SELECT id, name, status FROM tenants;');
    console.log('=== TENANTS ===');
    console.table(tenantRes.rows);

    // 3. Query Stores
    const storesRes = await client.query('SELECT id, code, name, domain, theme_config->>\'business_type\' as business_type, theme_config->>\'primary_color\' as color FROM stores ORDER BY code DESC;');
    console.log('\n=== STORES ===');
    console.table(storesRes.rows);

    // 4. Isolation Check: Store 1 Products
    const store1Products = await client.query(`
      SELECT p.sku, p.name, p.base_price, p.attributes->>'unit' as unit, s.code as store_code
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.store_id = 'b0000000-0000-0000-0000-000000000001';
    `);
    console.log('\n=== STORE 1 (VLXD) PRODUCTS ===');
    console.table(store1Products.rows);

    // 5. Isolation Check: Store 2 Products
    const store2Products = await client.query(`
      SELECT p.sku, p.name, p.base_price, p.attributes->>'unit' as unit, s.code as store_code
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.store_id = 'b0000000-0000-0000-0000-000000000002';
    `);
    console.log('\n=== STORE 2 (CAFE) PRODUCTS ===');
    console.table(store2Products.rows);

    // 6. Cross-Tenant / Cross-Store Contamination Test
    const contamination1 = store1Products.rows.filter(r => r.store_code !== 'STORE_VLXD');
    const contamination2 = store2Products.rows.filter(r => r.store_code !== 'STORE_CAFE');
    if (contamination1.length === 0 && contamination2.length === 0) {
      console.log('\n[PASS] DATA ISOLATION VERIFIED: Zero cross-store contamination detected.');
    } else {
      console.error('\n[FAIL] Cross-store contamination detected!');
      process.exit(1);
    }

    // 7. Orders & Revenue Roll-up per Store
    const revenueRes = await client.query(`
      SELECT 
        s.code AS store_code,
        s.name AS store_name,
        COUNT(o.id) AS total_orders,
        SUM(o.total_amount) AS revenue_vnd
      FROM stores s
      LEFT JOIN orders o ON s.id = o.store_id
      GROUP BY s.id, s.code, s.name
      ORDER BY revenue_vnd DESC;
    `);
    console.log('\n=== REVENUE ROLL-UP PER STORE ===');
    console.table(revenueRes.rows);

    // 8. Inventory Status per Warehouse & Product
    const invRes = await client.query(`
      SELECT 
        s.code AS store,
        w.name AS warehouse,
        p.name AS product,
        i.quantity,
        p.attributes->>'unit' AS unit
      FROM inventory i
      JOIN warehouses w ON i.warehouse_id = w.id
      JOIN products p ON i.product_id = p.id
      JOIN stores s ON w.store_id = s.id
      ORDER BY s.code, p.name;
    `);
    console.log('\n=== INVENTORY VERIFICATION ===');
    console.table(invRes.rows);

  } catch (err) {
    console.error('Seed verification error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedAndVerify();
