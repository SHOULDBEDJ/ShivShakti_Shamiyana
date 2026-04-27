const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env from backend/.env
const envPath = path.join(__dirname, '..', 'backend', '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const db = createClient({
  url: envConfig.TURSO_DATABASE_URL,
  authToken: envConfig.TURSO_AUTH_TOKEN,
});

async function check() {
  try {
    console.log('Connecting to Turso...');
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables:', tables.rows.map(r => r.name).join(', '));

    const seq = await db.execute('SELECT * FROM sqlite_sequence');
    console.log('Sequences:', JSON.stringify(seq.rows, null, 2));

    const cats = await db.execute('SELECT * FROM categories');
    console.log('Categories:', JSON.stringify(cats.rows, null, 2));
    if (cats.rows.length > 0) console.log('Category ID type:', typeof cats.rows[0].id, cats.rows[0].id);

    const items = await db.execute('SELECT * FROM inventory_items');
    console.log('Inventory Items:', JSON.stringify(items.rows, null, 2));
    if (items.rows.length > 0) console.log('Item category_id type:', typeof items.rows[0].category_id, items.rows[0].category_id);

  } catch (err) {
    console.error('Error:', err);
  }
}

check();
