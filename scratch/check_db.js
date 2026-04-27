const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../backend/database.sqlite');
const db = new Database(dbPath);

try {
  const rows = db.prepare('SELECT * FROM vendors').all();
  console.log('VENDORS:', JSON.stringify(rows, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  db.close();
}
