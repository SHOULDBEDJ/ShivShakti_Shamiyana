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

async function addTest() {
  try {
    console.log('Adding test data to Turso...');
    
    const catRes = await db.execute({
      sql: 'INSERT INTO categories (name) VALUES (?)',
      args: ['Test Category']
    });
    const catId = catRes.lastInsertRowid;
    console.log('Created category with ID:', catId);

    const itemRes = await db.execute({
      sql: 'INSERT INTO inventory_items (name, category_id, takeaway_price, delivery_price, available_quantity) VALUES (?, ?, ?, ?, ?)',
      args: ['Test Item', Number(catId), 100, 120, 50]
    });
    console.log('Created item with ID:', itemRes.lastInsertRowid);

    const otherRes = await db.execute({
        sql: 'INSERT INTO inventory_items (name, category_id, takeaway_price, delivery_price, available_quantity) VALUES (?, ?, ?, ?, ?)',
        args: ['Test Other Item', null, 200, 220, 10]
      });
      console.log('Created other item with ID:', otherRes.lastInsertRowid);

  } catch (err) {
    console.error('Error:', err);
  }
}

addTest();
