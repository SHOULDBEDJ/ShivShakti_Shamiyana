const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'api', 'database.sqlite');
console.log('Connecting to:', dbPath);

const db = new Database(dbPath);

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(r => r.name).join(', '));

  const cats = db.prepare('SELECT * FROM categories').all();
  console.log('Categories:', JSON.stringify(cats, null, 2));

  const items = db.prepare('SELECT * FROM inventory_items').all();
  console.log('Inventory Items:', JSON.stringify(items, null, 2));
} catch (err) {
  console.error('Error:', err);
}
