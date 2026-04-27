const db = require('../backend/database');

async function check() {
  try {
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables:', tables.rows.map(r => r.name).join(', '));

    const cats = await db.execute('SELECT * FROM categories');
    console.log('Categories:', JSON.stringify(cats.rows, null, 2));

    const items = await db.execute('SELECT * FROM inventory_items');
    console.log('Inventory Items:', JSON.stringify(items.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

check();
