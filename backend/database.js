const Database = require('better-sqlite3');
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let db;
const useTurso = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;

if (useTurso) {
  console.log("Using Turso Remote Database");
  db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  // Add a simple exec mock for init
  db.exec = async (sql) => await db.execute(sql);
} else {
  console.log("Using Local SQLite Database");
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  const dbPath = path.join(dataDir, 'database.sqlite');
  db = new Database(dbPath);
}

// Initialize schema
// Initialize schema
async function initDB() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS business_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      business_name TEXT,
      name_kn TEXT,
      owner_name TEXT,
      blessing_kn TEXT,
      phone TEXT,
      phone1 TEXT,
      phone2 TEXT,
      phone3 TEXT,
      address TEXT,
      address1_kn TEXT,
      address2_kn TEXT,
      address3_kn TEXT,
      photo_url TEXT,
      deity_image_path TEXT,
      upi_id TEXT,
      upi_name TEXT,
      static_qr_path TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT single_profile CHECK (id = 1)
    )`,
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      place TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_kn TEXT,
      parent_id INTEGER,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER,
      takeaway_price REAL,
      delivery_price REAL,
      available_quantity INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      delivery_takeaway_date DATETIME,
      pricing_mode TEXT CHECK(pricing_mode IN ('delivery', 'takeaway')),
      delivery_charge REAL DEFAULT 0,
      place TEXT,
      function_type TEXT,
      total_amount REAL DEFAULT 0,
      advance_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      pending_amount REAL DEFAULT 0,
      order_status TEXT DEFAULT 'confirmed',
      payment_status TEXT DEFAULT 'pending',
      voice_note_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    )`,
    `CREATE TABLE IF NOT EXISTS booking_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      return_status TEXT DEFAULT 'pending',
      missing_quantity INTEGER DEFAULT 0,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT CHECK(method IN ('cash', 'upi')),
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS order_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vendor_borrows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER,
      booking_id TEXT,
      item_id INTEGER,
      item_name TEXT,
      borrowed_quantity INTEGER,
      return_quantity INTEGER DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      return_status TEXT DEFAULT 'pending',
      borrowed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS vendor_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER,
      vendor_borrow_id INTEGER,
      item_name TEXT,
      quantity_returned INTEGER,
      amount_paid REAL,
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
      FOREIGN KEY (vendor_borrow_id) REFERENCES vendor_borrows(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS function_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS gallery_albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      album_type TEXT CHECK(album_type IN ('booking', 'inventory', 'general')),
      booking_id TEXT,
      inventory_item_id INTEGER,
      cover_photo_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS gallery_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL,
      original_filename TEXT,
      stored_filename TEXT UNIQUE,
      file_path TEXT,
      file_size INTEGER,
      caption TEXT,
      date_taken DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (album_id) REFERENCES gallery_albums(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      phone TEXT,
      salary REAL,
      address TEXT,
      join_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS expense_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      description TEXT,
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS gallery_photo_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (photo_id) REFERENCES gallery_photos(id) ON DELETE CASCADE
    )`
  ];

  for (const tableSql of tables) {
    try {
      await db.exec(tableSql);
    } catch (err) {
      console.error("Error creating table:", err.message);
    }
  }

  // Migrations
  try { await db.exec('ALTER TABLE order_links ADD COLUMN status TEXT DEFAULT "active"'); } catch (e) {}

  // Seed default function types
  const defaultTypes = ['Wedding', 'Engagement', 'Birthday', 'Naming Ceremony', 'Other'];
  for (const type of defaultTypes) {
    try {
      await db.execute({ sql: 'INSERT INTO function_types (name) VALUES (?)', args: [type] });
    } catch (e) {}
  }

  console.log("Database initialized successfully.");
}

initDB();


// Mock the execute method to avoid changing all server.js calls
const originalExecute = db.execute ? db.execute.bind(db) : null;
db.execute = async (options) => {
  const { sql, args = [] } = typeof options === 'string' ? { sql: options } : options;
  if (useTurso) {
    const res = await originalExecute(options);
    return {
      rows: res.rows,
      lastInsertRowid: res.lastInsertRowid,
      rowsAffected: res.rowsAffected
    };
  }

    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
  
  try {
    const stmt = db.prepare(sql);
    if (isSelect) {
      const rows = stmt.all(...args);
      return { rows };
    } else {
      const info = stmt.run(...args);
      return { 
        rows: [], 
        lastInsertRowid: info.lastInsertRowid, 
        rowsAffected: info.changes 
      };
    }
  } catch (err) {
    console.error(`DB Execute Error [${sql}]:`, err.message);
    throw err;
  }
};

// Mock transaction
db.transaction = async (mode) => {
  if (useTurso) return db.batch ? db : { execute: db.execute }; // Simplified for Turso
  
  db.exec('BEGIN');
  return {
    execute: db.execute,
    commit: async () => db.exec('COMMIT'),
    rollback: async () => db.exec('ROLLBACK')
  };
};

module.exports = db;
