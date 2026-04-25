const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
require('dotenv').config();
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'uploads');
const voiceNotesDir = path.join(uploadDir, 'voice_notes');
const galleryDir = path.join(uploadDir, 'gallery');
const settingsDir = path.join(uploadDir, 'settings');

[uploadDir, voiceNotesDir, galleryDir, settingsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for voice notes
const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/voice_notes/');
  },
  filename: (req, file, cb) => {
    cb(null, `voice_${Date.now()}.webm`);
  }
});
const voiceUpload = multer({ storage: voiceStorage });

// Multer setup for settings images
const settingsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/settings/');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const settingsUpload = multer({ storage: settingsStorage });

// --- UTILS ---
function generateID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function getUniqueCustomerID() {
  let id = generateID();
  const existing = db.prepare('SELECT id FROM customers WHERE customer_id = ?').get(id);
  if (existing) return getUniqueCustomerID();
  return id;
}

function getUniqueBookingID() {
  let id = generateID();
  const existing = db.prepare('SELECT id FROM bookings WHERE booking_id = ?').get(id);
  if (existing) return getUniqueBookingID();
  return id;
}

// --- ENDPOINTS ---

// GET /api/generate/customer-id
app.get('/api/generate/customer-id', (req, res) => {
  res.json({ customer_id: getUniqueCustomerID() });
});

// GET /api/generate/booking-id
app.get('/api/generate/booking-id', (req, res) => {
  res.json({ booking_id: getUniqueBookingID() });
});

// GET /api/customers/search
app.get('/api/customers/search', (req, res) => {
  const { query } = req.query;
  if (!query) return res.json([]);

  const sql = `
    SELECT * FROM customers 
    WHERE customer_id LIKE ? OR phone LIKE ? OR name LIKE ? OR place LIKE ?
    LIMIT 10
  `;
  const pattern = `%${query}%`;
  const customers = db.prepare(sql).all(pattern, pattern, pattern, pattern);

  const enriched = customers.map(c => {
    const lastBooking = db.prepare(`
      SELECT pending_amount, discount_amount 
      FROM bookings 
      WHERE customer_id = ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(c.customer_id);
    return { ...c, last_booking: lastBooking || null };
  });

  res.json(enriched);
});

// POST /api/customers
app.post('/api/customers', (req, res) => {
  const { name, phone, place } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

  const customer_id = getUniqueCustomerID();
  try {
    const info = db.prepare('INSERT INTO customers (customer_id, name, phone, place) VALUES (?, ?, ?, ?)')
      .run(customer_id, name, phone, place);
    res.status(201).json({ id: info.lastInsertRowid, customer_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings
app.get('/api/bookings', (req, res) => {
  const { search, status } = req.query;
  let sql = `
    SELECT b.*, c.name as customer_name, c.phone as phone_number 
    FROM bookings b
    JOIN customers c ON b.customer_id = c.customer_id
  `;
  const params = [];

  const conditions = [];
  if (search) {
    conditions.push('(c.name LIKE ? OR c.phone LIKE ? OR b.booking_id LIKE ? OR b.customer_id LIKE ?)');
    const p = `%${search}%`;
    params.push(p, p, p, p);
  }
  if (status && status !== 'all') {
    conditions.push('b.order_status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY b.created_at DESC';

  try {
    const bookings = db.prepare(sql).all(...params);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/:id (booking_id)
app.get('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  try {
    const booking = db.prepare(`
      SELECT b.*, c.name as customer_name, c.phone as phone_number 
      FROM bookings b
      JOIN customers c ON b.customer_id = c.customer_id
      WHERE b.booking_id = ?
    `).get(id);

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const items = db.prepare('SELECT * FROM booking_items WHERE booking_id = ?').all(id);
    const payments = db.prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY paid_at DESC').all(id);

    res.json({ ...booking, items, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings
app.post('/api/bookings', voiceUpload.single('voice_note'), (req, res) => {
  const {
    booking_id, customer_id, customer_name, phone_number, delivery_takeaway_date, pricing_mode, delivery_charge,
    place, function_type, total_amount, advance_amount, discount_amount,
    payment_method, items, order_status
  } = req.body;

  const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
  const voice_note_path = req.file ? req.file.path : null;

  const b_id = booking_id || getUniqueBookingID();
  const pending_amount = total_amount - advance_amount - discount_amount;
  const payment_status = pending_amount <= 0 ? 'paid' : 'pending';

  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      booking_id, customer_id, delivery_takeaway_date, pricing_mode, delivery_charge,
      place, function_type, total_amount, advance_amount, discount_amount,
      pending_amount, order_status, payment_status, voice_note_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO booking_items (booking_id, item_id, item_name, quantity, unit_price, subtotal)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO payments (booking_id, amount, method)
    VALUES (?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const existingCustomer = db.prepare('SELECT 1 FROM customers WHERE customer_id = ?').get(customer_id);
    if (!existingCustomer) {
      db.prepare('INSERT INTO customers (customer_id, name, phone, place) VALUES (?, ?, ?, ?)').run(
        customer_id, customer_name || 'Unknown', phone_number || '0000000000', place || ''
      );
    }

    insertBooking.run(
      b_id, customer_id, delivery_takeaway_date, pricing_mode, delivery_charge,
      place, function_type, total_amount, advance_amount, discount_amount,
      pending_amount, order_status || 'confirmed', payment_status, voice_note_path
    );

    for (const item of parsedItems) {
      insertItem.run(b_id, item.item_id, item.item_name, item.quantity, item.unit_price, item.subtotal);
    }

    if (advance_amount > 0) {
      insertPayment.run(b_id, advance_amount, payment_method);
    }

    for (const item of parsedItems) {
      if (item.vendor_id) {
        const invItem = db.prepare('SELECT available_quantity FROM inventory_items WHERE id = ?').get(item.item_id);
        const avail = invItem ? invItem.available_quantity : 0;
        const shortfall = item.quantity - (avail || 0);

        if (shortfall > 0) {
          db.prepare(`
            INSERT INTO vendor_borrows (vendor_id, booking_id, item_id, item_name, borrowed_quantity)
            VALUES (?, ?, ?, ?, ?)
          `).run(item.vendor_id, b_id, item.item_id, item.item_name, shortfall);
        }
      }
    }
  });

  try {
    transaction();
    res.status(201).json({ booking_id: b_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bookings/:id/payment (Add Installment)
app.post('/api/bookings/:id/payment', (req, res) => {
  const { id } = req.params;
  const { amount, method } = req.body;
  if (!amount || !method) return res.status(400).json({ error: 'Amount and method required' });
  const insertPayment = db.prepare('INSERT INTO payments (booking_id, amount, method) VALUES (?, ?, ?)');
  const updateBooking = db.prepare(`
    UPDATE bookings 
    SET advance_amount = advance_amount + ?, 
        pending_amount = pending_amount - ?,
        payment_status = CASE WHEN (pending_amount - ?) <= 0 THEN 'paid' ELSE 'pending' END
    WHERE booking_id = ?
  `);
  const transaction = db.transaction(() => {
    insertPayment.run(id, amount, method);
    updateBooking.run(amount, amount, amount, id);
  });
  try {
    transaction();
    res.json({ message: 'Payment added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bookings/:id/status
app.put('/api/bookings/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    db.prepare('UPDATE bookings SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?').run(status, id);
    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:id/return
app.post('/api/bookings/:id/return', (req, res) => {
  const { id } = req.params;
  const { items, payment_amount, payment_method, discount_amount, missing_total, final_payable } = req.body;
  
  const transaction = db.transaction(() => {
    let allReturned = true;
    for (const item of items) {
      db.prepare(`UPDATE booking_items SET return_status = ?, missing_quantity = ? WHERE booking_id = ? AND item_id = ?`)
        .run(item.return_status, item.missing_quantity || 0, id, item.item_id);
      
      if (item.return_status === 'missing' || item.return_status === 'partial') {
        allReturned = false;
      }
    }

    // Update Discount
    if (discount_amount > 0) {
      db.prepare('UPDATE bookings SET discount_amount = discount_amount + ? WHERE booking_id = ?').run(discount_amount, id);
    }

    // Process Payment if any
    if (payment_amount > 0) {
      db.prepare('INSERT INTO payments (booking_id, amount, method) VALUES (?, ?, ?)').run(id, payment_amount, payment_method);
      db.prepare('UPDATE bookings SET advance_amount = advance_amount + ? WHERE booking_id = ?').run(payment_amount, id);
    }

    // Recalculate Pending Amount
    // Pending = (Original Total + Missing Total) - (Advance + Discount)
    const b = db.prepare('SELECT total_amount, advance_amount, discount_amount FROM bookings WHERE booking_id = ?').get(id);
    const newPending = (b.total_amount + (missing_total || 0)) - (b.advance_amount + b.discount_amount);
    
    const paymentStatus = newPending <= 0 ? 'paid' : 'pending';
    const orderStatus = (allReturned && newPending <= 0) ? 'complete_returned' : 'returned_partial';

    db.prepare(`
      UPDATE bookings 
      SET pending_amount = ?, 
          payment_status = ?, 
          order_status = ?,
          updated_at = CURRENT_TIMESTAMP 
      WHERE booking_id = ?
    `).run(Math.max(0, newPending), paymentStatus, orderStatus, id);
  });

  try {
    transaction();
    res.json({ message: 'Return processed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bookings/:id
app.delete('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM bookings WHERE booking_id = ?').run(id);
    res.json({ message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ORDER LINKS & PUBLIC ORDERS ---

app.post('/api/order-links', (req, res) => {
  const token = require('crypto').randomBytes(16).toString('hex');
  const expires_at = new Date();
  expires_at.setHours(expires_at.getHours() + 24);
  try {
    const info = db.prepare('INSERT INTO order_links (token, expires_at) VALUES (?, ?)').run(token, expires_at.toISOString());
    res.json({ id: info.lastInsertRowid, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/order-links', (req, res) => {
  try {
    const links = db.prepare('SELECT * FROM order_links ORDER BY created_at DESC').all();
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/public-orders/validate/:token', (req, res) => {
  const { token } = req.params;
  try {
    const link = db.prepare('SELECT * FROM order_links WHERE token = ? AND status = "active"').get(token);
    if (!link) return res.status(404).json({ error: 'Invalid link' });
    if (new Date() > new Date(link.expires_at)) {
      db.prepare('UPDATE order_links SET status = "expired" WHERE token = ?').run(token);
      return res.status(404).json({ error: 'Link expired' });
    }
    res.json({ valid: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/public-orders/:token', (req, res) => {
  const { token } = req.params;
  const { customer_name, phone_number, place, pricing_mode, delivery_takeaway_date, items, total_amount } = req.body;
  try {
    const link = db.prepare('SELECT * FROM order_links WHERE token = ? AND status = "active"').get(token);
    if (!link) return res.status(404).json({ error: 'Invalid link' });
    let customer = db.prepare('SELECT customer_id FROM customers WHERE phone = ?').get(phone_number);
    let customer_id = customer ? customer.customer_id : getUniqueCustomerID();
    if (!customer) db.prepare('INSERT INTO customers (customer_id, name, phone, place) VALUES (?, ?, ?, ?)').run(customer_id, customer_name, phone_number, place);
    const booking_id = getUniqueBookingID();
    db.transaction(() => {
      db.prepare(`INSERT INTO bookings (booking_id, customer_id, delivery_takeaway_date, pricing_mode, place, total_amount, pending_amount, order_status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(booking_id, customer_id, delivery_takeaway_date, pricing_mode, place, total_amount, total_amount, 'pending_request', 'pending');
      for (const item of items) {
        db.prepare(`INSERT INTO booking_items (booking_id, item_id, item_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`).run(booking_id, item.item_id, item.item_name, item.quantity, item.unit_price, item.subtotal);
      }
      db.prepare('UPDATE order_links SET status = "used" WHERE token = ?').run(token);
    })();
    res.status(201).json({ booking_id, message: 'Order sent!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INVENTORY ---

app.get('/api/inventory/categories', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM categories ORDER BY name').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory/categories', (req, res) => {
  const { name, name_kn, parent_id } = req.body;
  try {
    const info = db.prepare('INSERT INTO categories (name, name_kn, parent_id) VALUES (?, ?, ?)').run(name, name_kn || null, parent_id || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/inventory/categories/:id', (req, res) => {
  const { name, name_kn, parent_id } = req.body;
  try {
    db.prepare('UPDATE categories SET name = ?, name_kn = ?, parent_id = ? WHERE id = ?').run(name, name_kn || null, parent_id || null, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/inventory/categories/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/items', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM inventory_items ORDER BY name').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/items/non-category', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM inventory_items WHERE category_id IS NULL ORDER BY name').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory/items', (req, res) => {
  const { name, category_id, takeaway_price, delivery_price, available_quantity } = req.body;
  try {
    const info = db.prepare('INSERT INTO inventory_items (name, category_id, takeaway_price, delivery_price, available_quantity) VALUES (?, ?, ?, ?, ?)').run(name, category_id || null, takeaway_price, delivery_price, available_quantity);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/inventory/items/:id', (req, res) => {
  const { id } = req.params;
  const { name, category_id, takeaway_price, delivery_price, available_quantity } = req.body;
  try {
    db.prepare('UPDATE inventory_items SET name = ?, category_id = ?, takeaway_price = ?, delivery_price = ?, available_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, category_id || null, takeaway_price, delivery_price, available_quantity, id);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/inventory/items/:id', (req, res) => {
  try { db.prepare('DELETE FROM inventory_items WHERE id = ?').run(req.params.id); res.json({ message: 'Deleted' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- VENDORS ---

app.get('/api/vendors', (req, res) => {
  try { res.json(db.prepare('SELECT v.*, (SELECT COUNT(*) FROM vendor_borrows WHERE vendor_id = v.id AND return_status != "returned") as pending_count FROM vendors v ORDER BY name').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vendors', (req, res) => {
  const { name, phone, notes } = req.body;
  try { const info = db.prepare('INSERT INTO vendors (name, phone, notes) VALUES (?, ?, ?)').run(name, phone, notes); res.status(201).json({ id: info.lastInsertRowid }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/vendors/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, notes } = req.body;
  try { db.prepare('UPDATE vendors SET name = ?, phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, phone, notes, id); res.json({ message: 'Updated' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/vendors/:id', (req, res) => {
  try { db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id); res.json({ message: 'Deleted' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/vendors/:id/borrows', (req, res) => {
  try { res.json(db.prepare('SELECT vb.*, b.delivery_takeaway_date as borrowed_at_date FROM vendor_borrows vb JOIN bookings b ON vb.booking_id = b.booking_id WHERE vb.vendor_id = ? ORDER BY vb.borrowed_at DESC').all(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/vendors/borrows/:id', (req, res) => {
  const { id } = req.params;
  const { return_quantity, amount_paid } = req.body;
  try {
    const borrow = db.prepare('SELECT * FROM vendor_borrows WHERE id = ?').get(id);
    const total_returned = (borrow.return_quantity || 0) + Number(return_quantity);
    const total_paid = (borrow.amount_paid || 0) + Number(amount_paid || 0);
    const status = total_returned >= borrow.borrowed_quantity ? 'returned' : 'partial';
    db.transaction(() => {
      db.prepare(`UPDATE vendor_borrows SET return_quantity = ?, amount_paid = ?, return_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(total_returned, total_paid, status, id);
      if (Number(return_quantity) > 0 || Number(amount_paid) > 0) db.prepare(`INSERT INTO vendor_payments (vendor_id, vendor_borrow_id, item_name, quantity_returned, amount_paid) VALUES (?, ?, ?, ?, ?)`).run(borrow.vendor_id, id, borrow.item_name, return_quantity, amount_paid);
    })();
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/vendors/:id/payments', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM vendor_payments WHERE vendor_id = ? ORDER BY paid_at DESC').all(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/items/:id/availability', (req, res) => {
  const { id } = req.params;
  const { quantity } = req.query;
  try {
    const item = db.prepare('SELECT available_quantity FROM inventory_items WHERE id = ?').get(id);
    const avail = item ? item.available_quantity : 0;
    res.json({ sufficient: avail !== null ? avail >= Number(quantity) : false, available: avail, shortfall: avail !== null ? Math.max(0, Number(quantity) - avail) : Number(quantity) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SETTINGS ---

app.get('/api/settings/function-types', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM function_types ORDER BY name').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/function-types', (req, res) => {
  const { name } = req.body;
  try {
    const existing = db.prepare('SELECT id FROM function_types WHERE LOWER(name) = LOWER(?)').get(name);
    if (existing) return res.status(400).json({ error: 'Exists' });
    db.prepare('INSERT INTO function_types (name) VALUES (?)').run(name);
    res.status(201).json({ message: 'Added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings/function-types/:id', (req, res) => {
  try { db.prepare('UPDATE function_types SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.body.name, req.params.id); res.json({ message: 'Updated' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/settings/function-types/:id', (req, res) => {
  try {
    const type = db.prepare('SELECT name FROM function_types WHERE id = ?').get(req.params.id);
    const count = db.prepare('SELECT COUNT(*) as count FROM bookings WHERE function_type = ?').get(type.name);
    db.prepare('DELETE FROM function_types WHERE id = ?').run(req.params.id);
    res.json({ count: count.count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const ALL_TABLES = ['customers', 'order_links', 'categories', 'inventory_items', 'bookings', 'booking_items', 'payments', 'vendors', 'vendor_borrows', 'vendor_payments', 'function_types', 'gallery_albums', 'gallery_photos', 'gallery_photo_tags'];

app.get('/api/settings/backup', (req, res) => {
  try {
    const dump = {};
    ALL_TABLES.forEach(t => dump[t] = db.prepare(`SELECT * FROM ${t}`).all());
    res.json({ data: dump });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/restore', (req, res) => {
  try {
    db.transaction(() => {
      ALL_TABLES.reverse().forEach(t => db.prepare(`DELETE FROM ${t}`).run());
      ALL_TABLES.reverse().forEach(t => {
        const rows = req.body.data[t];
        if (rows && rows.length > 0) {
          const keys = Object.keys(rows[0]);
          const stmt = db.prepare(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`);
          rows.forEach(r => stmt.run(Object.values(r)));
        }
      });
    })();
    res.json({ message: 'Restored' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/settings/delete-all', (req, res) => {
  if (req.body.confirm !== 'DELETE') return res.status(400).json({ error: 'Invalid' });
  try { db.transaction(() => ALL_TABLES.reverse().forEach(t => db.prepare(`DELETE FROM ${t}`).run()))(); res.json({ message: 'Deleted' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GALLERY ENDPOINTS ---

const galleryStorage = multer.memoryStorage();
const galleryUpload = multer({ 
  storage: galleryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.get('/api/gallery/albums', (req, res) => {
  const { type, search, sort, date_from, date_to } = req.query;
  try {
    let sql = `
      SELECT a.*, 
        (SELECT COUNT(*) FROM gallery_photos WHERE album_id = a.id) as photo_count,
        (SELECT file_path FROM gallery_photos WHERE id = a.cover_photo_id) as cover_photo_path
      FROM gallery_albums a
      WHERE 1=1
    `;
    const params = [];
    if (type && type !== 'all') { sql += ` AND a.album_type = ?`; params.push(type); }
    if (search) { sql += ` AND (a.name LIKE ? OR a.booking_id LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
    if (date_from) { sql += ` AND a.created_at >= ?`; params.push(date_from); }
    if (date_to) { sql += ` AND a.created_at <= ?`; params.push(date_to); }

    if (sort === 'oldest') sql += ` ORDER BY a.created_at ASC`;
    else if (sort === 'name_asc') sql += ` ORDER BY a.name ASC`;
    else if (sort === 'most_photos') sql += ` ORDER BY photo_count DESC`;
    else sql += ` ORDER BY a.created_at DESC`;

    const albums = db.prepare(sql).all(...params);
    res.json(albums);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gallery/albums', (req, res) => {
  const { name, album_type, booking_id, inventory_item_id } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO gallery_albums (name, album_type, booking_id, inventory_item_id)
      VALUES (?, ?, ?, ?)
    `).run(name, album_type, booking_id, inventory_item_id);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/gallery/albums/:id', (req, res) => {
  const { id } = req.params;
  const { name, cover_photo_id } = req.body;
  try {
    db.prepare(`
      UPDATE gallery_albums SET name = COALESCE(?, name), cover_photo_id = COALESCE(?, cover_photo_id), updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(name, cover_photo_id, id);
    res.json({ message: 'Album updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/gallery/albums/:id', (req, res) => {
  const { id } = req.params;
  try {
    const photos = db.prepare('SELECT file_path FROM gallery_photos WHERE album_id = ?').all(id);
    db.prepare('DELETE FROM gallery_albums WHERE id = ?').run(id);
    photos.forEach(p => {
      const fullPath = path.join(__dirname, p.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });
    const albumDir = path.join(galleryDir, id.toString());
    if (fs.existsSync(albumDir)) fs.rmdirSync(albumDir, { recursive: true });
    res.json({ message: 'Album deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gallery/albums/:id/photos', (req, res) => {
  const { id } = req.params;
  try {
    const photos = db.prepare(`
      SELECT p.*, (SELECT GROUP_CONCAT(tag) FROM gallery_photo_tags WHERE photo_id = p.id) as tags
      FROM gallery_photos p WHERE p.album_id = ? ORDER BY p.created_at DESC
    `).all(id);
    res.json(photos.map(p => ({ ...p, tags: p.tags ? p.tags.split(',') : [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gallery/albums/:id/photos', galleryUpload.array('photos'), async (req, res) => {
  const { id } = req.params;
  const { caption, tags, date_taken } = req.body;
  const files = req.files;
  if (!files || files.length === 0) return res.status(400).json({ error: 'No photos uploaded' });
  try {
    const results = [];
    const albumDir = path.join(galleryDir, id.toString());
    if (!fs.existsSync(albumDir)) fs.mkdirSync(albumDir, { recursive: true });
    for (const file of files) {
      const storedFilename = `${uuidv4()}${path.extname(file.originalname)}`;
      const relativePath = `uploads/gallery/${id}/${storedFilename}`;
      const fullPath = path.join(__dirname, relativePath);
      await sharp(file.buffer).resize({ width: 1920, withoutEnlargement: true }).toFile(fullPath);
      const info = db.prepare(`
        INSERT INTO gallery_photos (album_id, original_filename, stored_filename, file_path, file_size, caption, date_taken)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, file.originalname, storedFilename, relativePath, file.size, caption, date_taken || new Date().toISOString().slice(0, 10));
      const photoId = info.lastInsertRowid;
      if (tags) {
        tags.split(',').map(t => t.trim()).forEach(t => db.prepare('INSERT INTO gallery_photo_tags (photo_id, tag) VALUES (?, ?)').run(photoId, t));
      }
      results.push({ id: photoId, stored_filename: storedFilename, file_path: relativePath });
    }
    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/gallery/photos/:id', (req, res) => {
  const { id } = req.params;
  const { caption, date_taken, tags } = req.body;
  try {
    const transaction = db.transaction(() => {
      db.prepare('UPDATE gallery_photos SET caption = COALESCE(?, caption), date_taken = COALESCE(?, date_taken) WHERE id = ?').run(caption, date_taken, id);
      if (tags !== undefined) {
        db.prepare('DELETE FROM gallery_photo_tags WHERE photo_id = ?').run(id);
        (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())).forEach(t => db.prepare('INSERT INTO gallery_photo_tags (photo_id, tag) VALUES (?, ?)').run(id, t));
      }
    });
    transaction();
    res.json({ message: 'Photo updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/gallery/photos/:id', (req, res) => {
  const { id } = req.params;
  try {
    const photo = db.prepare('SELECT file_path FROM gallery_photos WHERE id = ?').get(id);
    if (photo) {
      const fullPath = path.join(__dirname, photo.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(id);
    }
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/gallery/photos/bulk', (req, res) => {
  const { photo_ids } = req.body;
  try {
    const transaction = db.transaction(() => {
      photo_ids.forEach(id => {
        const photo = db.prepare('SELECT file_path FROM gallery_photos WHERE id = ?').get(id);
        if (photo) {
          const fullPath = path.join(__dirname, photo.file_path);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(id);
        }
      });
    });
    transaction();
    res.json({ message: 'Photos deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/gallery/photos/move', (req, res) => {
  const { photo_ids, target_album_id } = req.body;
  try {
    db.transaction(() => photo_ids.forEach(id => db.prepare('UPDATE gallery_photos SET album_id = ? WHERE id = ?').run(target_album_id, id)))();
    res.json({ message: 'Photos moved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gallery/photos/:id/download', (req, res) => {
  const { id } = req.params;
  try {
    const photo = db.prepare('SELECT file_path, original_filename FROM gallery_photos WHERE id = ?').get(id);
    if (!photo) return res.status(404).send('Photo not found');
    res.download(path.join(__dirname, photo.file_path), photo.original_filename);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/gallery/booking/:bookingId/album', (req, res) => {
  const { bookingId } = req.params;
  try {
    let album = db.prepare('SELECT * FROM gallery_albums WHERE booking_id = ?').get(bookingId);
    if (!album) {
      const booking = db.prepare('SELECT (SELECT name FROM customers WHERE customer_id = b.customer_id) as customer_name FROM bookings b WHERE booking_id = ?').get(bookingId);
      const name = `${booking ? booking.customer_name : 'Customer'} - ${bookingId}`;
      const info = db.prepare('INSERT INTO gallery_albums (name, album_type, booking_id) VALUES (?, ?, ?)').run(name, 'booking', bookingId);
      album = { id: info.lastInsertRowid, name, album_type: 'booking', booking_id: bookingId };
    }
    const photos = db.prepare('SELECT * FROM gallery_photos WHERE album_id = ?').all(album.id);
    res.json({ album, photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gallery/inventory/:itemId/album', (req, res) => {
  const { itemId } = req.params;
  try {
    let album = db.prepare('SELECT * FROM gallery_albums WHERE inventory_item_id = ?').get(itemId);
    if (!album) {
      const item = db.prepare('SELECT name FROM inventory_items WHERE id = ?').get(itemId);
      const name = `${item ? item.name : 'Item'} - Photos`;
      const info = db.prepare('INSERT INTO gallery_albums (name, album_type, inventory_item_id) VALUES (?, ?, ?)').run(name, 'inventory', itemId);
      album = { id: info.lastInsertRowid, name, album_type: 'inventory', inventory_item_id: itemId };
    }
    const photos = db.prepare('SELECT * FROM gallery_photos WHERE album_id = ?').all(album.id);
    res.json({ album, photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REST OF ENDPOINTS ---
// --- BUSINESS PROFILE ---

app.get('/api/settings/business-profile', (req, res) => {
  try {
    const profile = db.prepare('SELECT * FROM business_profile WHERE id = 1').get();
    res.json(profile || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/business-profile', settingsUpload.fields([{ name: 'deity_image', maxCount: 1 }, { name: 'static_qr_image', maxCount: 1 }]), (req, res) => {
  const { name_kn, blessing_kn, phone1, phone2, phone3, address1_kn, address2_kn, address3_kn, upi_id, upi_name } = req.body;
  const deity_image_path = req.files && req.files['deity_image'] ? `uploads/settings/${req.files['deity_image'][0].filename}` : req.body.deity_image_path;
  const static_qr_path = req.files && req.files['static_qr_image'] ? `uploads/settings/${req.files['static_qr_image'][0].filename}` : req.body.static_qr_path;

  try {
    const existing = db.prepare('SELECT id FROM business_profile WHERE id = 1').get();
    if (existing) {
      db.prepare(`
        UPDATE business_profile SET 
          name_kn = ?, blessing_kn = ?, phone1 = ?, phone2 = ?, phone3 = ?, 
          address1_kn = ?, address2_kn = ?, address3_kn = ?, 
          deity_image_path = ?, upi_id = ?, upi_name = ?, static_qr_path = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = 1
      `).run(name_kn, blessing_kn, phone1, phone2, phone3, address1_kn, address2_kn, address3_kn, deity_image_path, upi_id, upi_name, static_qr_path);
    } else {
      db.prepare(`
        INSERT INTO business_profile (
          id, name_kn, blessing_kn, phone1, phone2, phone3, 
          address1_kn, address2_kn, address3_kn, deity_image_path, upi_id, upi_name, static_qr_path
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name_kn, blessing_kn, phone1, phone2, phone3, address1_kn, address2_kn, address3_kn, deity_image_path, upi_id, upi_name, static_qr_path);
    }
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REPORTS ---

app.get('/api/reports/monthly', (req, res) => {
  const { month, year } = req.query; // format: MM, YYYY
  try {
    const bookings = db.prepare(`
      SELECT b.*, c.name as customer_name
      FROM bookings b
      JOIN customers c ON b.customer_id = c.customer_id
      WHERE strftime('%m', b.booking_date) = ? AND strftime('%Y', b.booking_date) = ?
      ORDER BY b.booking_date DESC
    `).all(month, year);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/daily', (req, res) => {
  const { date } = req.query; // format: YYYY-MM-DD
  try {
    const bookings = db.prepare(`
      SELECT b.*, c.name as customer_name
      FROM bookings b
      JOIN customers c ON b.customer_id = c.customer_id
      WHERE date(b.booking_date) = date(?)
      ORDER BY b.booking_date DESC
    `).all(date);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/pending-payments', (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.*, c.name as customer_name, c.phone as phone_number
      FROM bookings b
      JOIN customers c ON b.customer_id = c.customer_id
      WHERE b.payment_status = 'pending'
      ORDER BY b.booking_date ASC
    `).all();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/booking-status', (req, res) => {
  const { from, to, status } = req.query;
  try {
    let sql = `
      SELECT b.*, c.name as customer_name
      FROM bookings b
      JOIN customers c ON b.customer_id = c.customer_id
      WHERE date(b.booking_date) BETWEEN date(?) AND date(?)
    `;
    const params = [from, to];
    if (status && status !== 'all') {
      sql += ' AND b.order_status = ?';
      params.push(status);
    }
    sql += ' ORDER BY b.booking_date DESC';
    const bookings = db.prepare(sql).all(...params);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/vendor-borrows', (req, res) => {
  const { vendor_id, from, to } = req.query;
  try {
    let sql = `
      SELECT vb.*, v.name as vendor_name, b.booking_id
      FROM vendor_borrows vb
      JOIN vendors v ON vb.vendor_id = v.id
      JOIN bookings b ON vb.booking_id = b.booking_id
      WHERE date(vb.borrowed_at) BETWEEN date(?) AND date(?)
    `;
    const params = [from, to];
    if (vendor_id && vendor_id !== 'all') {
      sql += ' AND vb.vendor_id = ?';
      params.push(vendor_id);
    }
    sql += ' ORDER BY vb.borrowed_at DESC';
    const borrows = db.prepare(sql).all(...params);
    res.json(borrows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
