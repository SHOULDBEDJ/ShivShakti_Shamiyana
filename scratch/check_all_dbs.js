const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbFiles = [
  path.join(__dirname, '..', 'api', 'database.sqlite'),
  path.join(__dirname, '..', 'backend', 'database.sqlite'),
  path.join(__dirname, '..', 'backend', 'data', 'database.sqlite')
];

dbFiles.forEach(dbPath => {
  if (!fs.existsSync(dbPath)) {
    console.log(`\n--- ${dbPath} (Does not exist) ---`);
    return;
  }
  console.log(`\n--- Checking ${dbPath} ---`);
  try {
    const db = new Database(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    tables.forEach(t => {
      const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get().c;
      if (count > 0) {
        console.log(`${t.name}: ${count} rows`);
        if (t.name === 'inventory_items' || t.name === 'categories') {
            const data = db.prepare(`SELECT * FROM ${t.name}`).all();
            console.log(JSON.stringify(data, null, 2));
        }
      }
    });
    db.close();
  } catch (err) {
    console.error(`Error checking ${dbPath}:`, err.message);
  }
});
