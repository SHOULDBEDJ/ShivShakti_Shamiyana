const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const crypto = require('crypto');
const sharp = require('sharp');
require('dotenv').config();
const db = require('./database');

const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const app = express();
const PORT = process.env.PORT || 5000;

// Supabase Setup
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Ensure upload directories exist (Local fallback)
const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(dataDir, 'uploads');
const voiceNotesDir = path.join(uploadDir, 'voice_notes');
const galleryDir = path.join(uploadDir, 'gallery');
const settingsDir = path.join(uploadDir, 'settings');
const folders = [dataDir, uploadDir, voiceNotesDir, galleryDir, settingsDir];
folders.forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Static files
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public')));

// Multer Memory Storage (Better for Supabase/Vercel)
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// Helper for Supabase Upload
async function uploadToSupabase(file, bucket, folder = '') {
  if (!supabase) return null;
  const fileName = `${folder}${Date.now()}_${file.originalname}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file.buffer, { contentType: file.mimetype });

  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return publicUrl;
}


// --- UTILS ---
function generateID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

async function getUniqueCustomerID() {
  let id = generateID();
  const result = await db.execute({ sql: 'SELECT id FROM customers WHERE customer_id = ?', args: [id] });
  const existing = result.rows[0];
  if (existing) return await getUniqueCustomerID();
  return id;
}

async function getUniqueBookingID() {
  let id = generateID();
  const result = await db.execute({ sql: 'SELECT id FROM bookings WHERE booking_id = ?', args: [id] });
  const existing = result.rows[0];
  if (existing) return await getUniqueBookingID();
  return id;
}

// --- ENDPOINTS ---

// GET /api/generate/customer-id
app.get('/api/generate/customer-id', async (req, res) => {
  res.json({ customer_id: await getUniqueCustomerID() });
});

// GET /api/generate/booking-id
app.get('/api/generate/booking-id', async (req, res) => {
  res.json({ booking_id: await getUniqueBookingID() });
});

// GET /api/customers/search
app.get('/api/customers/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.json([]);

  const sql = `
    SELECT * FROM customers 
    WHERE customer_id LIKE ? OR phone LIKE ? OR name LIKE ? OR place LIKE ?
    LIMIT 10
  `;
  const pattern = `%${query}%`;
  const result = await db.execute({ sql, args: [pattern, pattern, pattern, pattern] });
  const customers = result.rows;

  const enriched = await Promise.all(customers.map(async (c) => {
    const lbResult = await db.execute({
      sql: `
        SELECT pending_amount, discount_amount 
        FROM bookings 
        WHERE customer_id = ? 
        ORDER BY created_at DESC LIMIT 1
      `,
      args: [c.customer_id]
    });
    const lastBooking = lbResult.rows[0];
    return { ...c, last_booking: lastBooking || null };
  }));

  res.json(enriched);
});

// POST /api/customers
app.post('/api/customers', async (req, res) => {
  const { name, phone, place } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

  const customer_id = await getUniqueCustomerID();
  try {
    const info = await db.execute({
      sql: 'INSERT INTO customers (customer_id, name, phone, place) VALUES (?, ?, ?, ?)',
      args: [customer_id, name, phone, place]
    });
    res.status(201).json({ id: info.lastInsertRowid, customer_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings
app.get('/api/bookings', async (req, res) => {
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
    const result = await db.execute({ sql, args: params });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/:id (booking_id)
app.get('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const bookingResult = await db.execute({
      sql: `
        SELECT b.*, c.name as customer_name, c.phone as phone_number 
        FROM bookings b
        JOIN customers c ON b.customer_id = c.customer_id
        WHERE b.booking_id = ?
      `,
      args: [id]
    });
    const booking = bookingResult.rows[0];

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const itemsResult = await db.execute({ sql: 'SELECT * FROM booking_items WHERE booking_id = ?', args: [id] });
    const paymentsResult = await db.execute({ sql: 'SELECT * FROM payments WHERE booking_id = ? ORDER BY paid_at DESC', args: [id] });

    res.json({ ...booking, items: itemsResult.rows, payments: paymentsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings
app.post('/api/bookings', upload.single('voice_note'), async (req, res) => {
  const {
    booking_id, customer_id, customer_name, phone_number, delivery_takeaway_date, pricing_mode, delivery_charge,
    place, function_type, total_amount, advance_amount, discount_amount,
    payment_method, items, order_status
  } = req.body;
  const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
  let voice_note_path = null;
  if (req.file) {
    if (supabase) {
      voice_note_path = await uploadToSupabase(req.file, 'voice-notes');
    } else {
      const localPath = path.join(uploadDir, 'voice_notes', `voice_${Date.now()}.webm`);
      fs.writeFileSync(localPath, req.file.buffer);
      voice_note_path = `/uploads/voice_notes/${path.basename(localPath)}`;
    }
  }

  const b_id = booking_id || await getUniqueBookingID();
  const pending_amount = total_amount - advance_amount - discount_amount;
  const payment_status = pending_amount <= 0 ? 'paid' : 'pending';

  try {
    const tx = await db.transaction('write');
    try {
      const existingCustomerResult = await tx.execute({ sql: 'SELECT 1 FROM customers WHERE customer_id = ?', args: [customer_id] });
      if (!existingCustomerResult.rows[0]) {
        await tx.execute({
          sql: 'INSERT INTO customers (customer_id, name, phone, place) VALUES (?, ?, ?, ?)',
          args: [customer_id, customer_name || 'Unknown', phone_number || '0000000000', place || '']
        });
      }

      await tx.execute({
        sql: `
          INSERT INTO bookings (
            booking_id, customer_id, delivery_takeaway_date, pricing_mode, delivery_charge,
            place, function_type, total_amount, advance_amount, discount_amount,
            pending_amount, order_status, payment_status, voice_note_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          b_id, customer_id, delivery_takeaway_date, pricing_mode, delivery_charge,
          place, function_type, total_amount, advance_amount, discount_amount,
          pending_amount, order_status || 'confirmed', payment_status, voice_note_path
        ]
      });

      for (const item of parsedItems) {
        await tx.execute({
          sql: 'INSERT INTO booking_items (booking_id, item_id, item_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
          args: [b_id, item.item_id, item.item_name, item.quantity, item.unit_price, item.subtotal]
        });
      }

      if (advance_amount > 0) {
        await tx.execute({
          sql: 'INSERT INTO payments (booking_id, amount, method) VALUES (?, ?, ?)',
          args: [b_id, advance_amount, payment_method]
        });
      }

      for (const item of parsedItems) {
        if (item.vendor_id) {
          const invItemResult = await tx.execute({ sql: 'SELECT available_quantity FROM inventory_items WHERE id = ?', args: [item.item_id] });
          const invItem = invItemResult.rows[0];
          const avail = invItem ? invItem.available_quantity : 0;
          const shortfall = item.quantity - (avail || 0);

          if (shortfall > 0) {
            await tx.execute({
              sql: `
                INSERT INTO vendor_borrows (vendor_id, booking_id, item_id, item_name, borrowed_quantity)
                VALUES (?, ?, ?, ?, ?)
              `,
              args: [item.vendor_id, b_id, item.item_id, item.item_name, shortfall]
            });
          }
        }
      }
      await tx.commit();
      res.status(201).json({ booking_id: b_id });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bookings/:id/payment (Add Installment)
app.post('/api/bookings/:id/payment', async (req, res) => {
  const { id } = req.params;
  const { amount, method } = req.body;
  if (!amount || !method) return res.status(400).json({ error: 'Amount and method required' });

  try {
    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: 'INSERT INTO payments (booking_id, amount, method) VALUES (?, ?, ?)',
        args: [id, amount, method]
      });
      await tx.execute({
        sql: `
          UPDATE bookings 
          SET advance_amount = advance_amount + ?, 
              pending_amount = pending_amount - ?,
              payment_status = CASE WHEN (pending_amount - ?) <= 0 THEN 'paid' ELSE 'pending' END
          WHERE booking_id = ?
        `,
        args: [amount, amount, amount, id]
      });
      await tx.commit();
      res.json({ message: 'Payment added successfully' });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bookings/:id/status
app.put('/api/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE bookings SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?',
      args: [status, id]
    });
    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:id/return
app.post('/api/bookings/:id/return', async (req, res) => {
  const { id } = req.params;
  const { items, payment_amount, payment_method, discount_amount, missing_total, final_payable } = req.body;

  try {
    const tx = await db.transaction('write');
    try {
      let allReturned = true;
      for (const item of items) {
        await tx.execute({
          sql: `UPDATE booking_items SET return_status = ?, missing_quantity = ? WHERE booking_id = ? AND item_id = ?`,
          args: [item.return_status, item.missing_quantity || 0, id, item.item_id]
        });

        if (item.return_status === 'missing' || item.return_status === 'partial') {
          allReturned = false;
        }
      }

      // Update Discount
      if (discount_amount > 0) {
        await tx.execute({
          sql: 'UPDATE bookings SET discount_amount = discount_amount + ? WHERE booking_id = ?',
          args: [discount_amount, id]
        });
      }

      // Process Payment if any
      if (payment_amount > 0) {
        await tx.execute({
          sql: 'INSERT INTO payments (booking_id, amount, method) VALUES (?, ?, ?)',
          args: [id, payment_amount, payment_method]
        });
        await tx.execute({
          sql: 'UPDATE bookings SET advance_amount = advance_amount + ? WHERE booking_id = ?',
          args: [payment_amount, id]
        });
      }

      // Recalculate Pending Amount
      const bResult = await tx.execute({
        sql: 'SELECT total_amount, advance_amount, discount_amount FROM bookings WHERE booking_id = ?',
        args: [id]
      });
      const b = bResult.rows[0];
      const newPending = (b.total_amount + (missing_total || 0)) - (b.advance_amount + b.discount_amount);

      const paymentStatus = newPending <= 0 ? 'paid' : 'pending';
      const orderStatus = (allReturned && newPending <= 0) ? 'complete_returned' : 'returned_partial';

      await tx.execute({
        sql: `
          UPDATE bookings 
          SET pending_amount = ?, 
              payment_status = ?, 
              order_status = ?,
              updated_at = CURRENT_TIMESTAMP 
          WHERE booking_id = ?
        `,
        args: [Math.max(0, newPending), paymentStatus, orderStatus, id]
      });
      await tx.commit();
      res.json({ message: 'Return processed successfully' });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bookings/:id
app.delete('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute({ sql: 'DELETE FROM bookings WHERE booking_id = ?', args: [id] });
    res.json({ message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// (Legacy routes removed)



// --- INVENTORY ---

app.get('/api/inventory/categories', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory/categories', async (req, res) => {
  const { name, name_kn, parent_id } = req.body;
  try {
    const info = await db.execute({
      sql: 'INSERT INTO categories (name, name_kn, parent_id) VALUES (?, ?, ?)',
      args: [name, name_kn || null, parent_id || null]
    });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/inventory/categories/:id', async (req, res) => {
  const { name, name_kn, parent_id } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE categories SET name = ?, name_kn = ?, parent_id = ? WHERE id = ?',
      args: [name, name_kn || null, parent_id || null, req.params.id]
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/inventory/categories/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/items', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM inventory_items ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/items/non-category', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM inventory_items WHERE category_id IS NULL ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/inventory/items', async (req, res) => {
  const { name, category_id, takeaway_price, delivery_price, available_quantity } = req.body;
  try {
    const info = await db.execute({
      sql: 'INSERT INTO inventory_items (name, category_id, takeaway_price, delivery_price, available_quantity) VALUES (?, ?, ?, ?, ?)',
      args: [name, category_id || null, takeaway_price, delivery_price, available_quantity]
    });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/inventory/items/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category_id, takeaway_price, delivery_price, available_quantity } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE inventory_items SET name = ?, category_id = ?, takeaway_price = ?, delivery_price = ?, available_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [name, category_id || null, takeaway_price, delivery_price, available_quantity, id]
    });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/inventory/items/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM inventory_items WHERE id = ?', args: [req.params.id] });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- VENDORS ---

app.get('/api/vendors', async (req, res) => {
  try {
    const result = await db.execute("SELECT v.*, (SELECT COUNT(*) FROM vendor_borrows WHERE vendor_id = v.id AND return_status != 'returned') as pending_count FROM vendors v ORDER BY name");
    res.json(result.rows || []);
  } catch (err) {
    console.error("GET vendors error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  const { name, phone, notes } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone are required" });
  try {
    const result = await db.execute({
      sql: 'INSERT INTO vendors (name, phone, notes) VALUES (?, ?, ?)',
      args: [name, phone, notes || ""]
    });
    res.status(201).json({ id: result.lastInsertRowid, success: true });
  } catch (err) {
    console.error("POST vendors error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vendors/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, notes } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE vendors SET name = ?, phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [name, phone, notes, id]
    });
    res.json({ success: true });
  } catch (err) {
    console.error("PUT vendors error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vendors/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM vendors WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE vendors error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/vendors/:id/borrows', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT vb.*, b.delivery_takeaway_date as borrowed_at_date FROM vendor_borrows vb LEFT JOIN bookings b ON vb.booking_id = b.booking_id WHERE vb.vendor_id = ? ORDER BY vb.borrowed_at DESC',
      args: [req.params.id]
    });
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vendors/borrows', async (req, res) => {
  const { vendor_id, item_name, item_id, quantity } = req.body;
  try {
    // Check if a manual borrow (booking_id IS NULL) already exists for this item
    const existing = await db.execute({
      sql: 'SELECT id FROM vendor_borrows WHERE vendor_id = ? AND item_name = ? AND booking_id IS NULL',
      args: [vendor_id, item_name]
    });

    if (existing.rows && existing.rows.length > 0) {
      // Update existing record
      await db.execute({
        sql: 'UPDATE vendor_borrows SET borrowed_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [quantity, existing.rows[0].id]
      });
      res.json({ success: true, updated: true });
    } else {
      // Insert new record
      const result = await db.execute({
        sql: 'INSERT INTO vendor_borrows (vendor_id, item_name, item_id, borrowed_quantity) VALUES (?, ?, ?, ?)',
        args: [vendor_id, item_name, item_id || null, quantity]
      });
      res.status(201).json({ id: result.lastInsertRowid, success: true });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.delete('/api/vendors/borrows/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM vendor_borrows WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.put('/api/vendors/borrows/:id', async (req, res) => {
  const { id } = req.params;
  const { return_quantity, amount_paid } = req.body;
  try {
    const borrowResult = await db.execute({ sql: 'SELECT * FROM vendor_borrows WHERE id = ?', args: [id] });
    const borrow = borrowResult.rows[0];
    const total_returned = (borrow.return_quantity || 0) + Number(return_quantity);
    const total_paid = (borrow.amount_paid || 0) + Number(amount_paid || 0);
    const status = total_returned >= borrow.borrowed_quantity ? 'returned' : 'partial';

    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: `UPDATE vendor_borrows SET return_quantity = ?, amount_paid = ?, return_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [total_returned, total_paid, status, id]
      });
      if (Number(return_quantity) > 0 || Number(amount_paid) > 0) {
        await tx.execute({
          sql: `INSERT INTO vendor_payments (vendor_id, vendor_borrow_id, item_name, quantity_returned, amount_paid) VALUES (?, ?, ?, ?, ?)`,
          args: [borrow.vendor_id, id, borrow.item_name, return_quantity, amount_paid]
        });
      }
      await tx.commit();
      res.json({ message: 'Updated' });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/vendors/:id/payments', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM vendor_payments WHERE vendor_id = ? ORDER BY paid_at DESC',
      args: [req.params.id]
    });
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/inventory/items/:id/availability', async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.query;
  try {
    const itemResult = await db.execute({ sql: 'SELECT available_quantity FROM inventory_items WHERE id = ?', args: [id] });
    const item = itemResult.rows[0];
    const avail = item ? item.available_quantity : 0;
    res.json({ sufficient: avail !== null ? avail >= Number(quantity) : false, available: avail, shortfall: avail !== null ? Math.max(0, Number(quantity) - avail) : Number(quantity) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SETTINGS ---

app.get('/api/settings/function-types', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM function_types ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/function-types', async (req, res) => {
  const { name } = req.body;
  try {
    const existingResult = await db.execute({ sql: 'SELECT id FROM function_types WHERE LOWER(name) = LOWER(?)', args: [name] });
    if (existingResult.rows[0]) return res.status(400).json({ error: 'Exists' });
    await db.execute({ sql: 'INSERT INTO function_types (name) VALUES (?)', args: [name] });
    res.status(201).json({ message: 'Added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings/function-types/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'UPDATE function_types SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [req.body.name, req.params.id]
    });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/settings/function-types/:id', async (req, res) => {
  try {
    const typeResult = await db.execute({ sql: 'SELECT name FROM function_types WHERE id = ?', args: [req.params.id] });
    const type = typeResult.rows[0];
    const countResult = await db.execute({ sql: 'SELECT COUNT(*) as count FROM bookings WHERE function_type = ?', args: [type.name] });
    await db.execute({ sql: 'DELETE FROM function_types WHERE id = ?', args: [req.params.id] });
    res.json({ count: countResult.rows[0].count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const ALL_TABLES = [
  'customers', 'order_links', 'categories', 'inventory_items', 'bookings',
  'booking_items', 'payments', 'vendors', 'vendor_borrows', 'vendor_payments',
  'function_types', 'gallery_albums', 'gallery_photos',
  'workers', 'expenses', 'expense_types', 'business_profile'
];

app.get('/api/settings/backup', async (req, res) => {
  try {
    const dump = {};
    for (const t of ALL_TABLES) {
      const result = await db.execute(`SELECT * FROM ${t}`);
      dump[t] = result.rows;
    }
    res.json({ data: dump });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/restore', async (req, res) => {
  try {
    const tx = await db.transaction('write');
    try {
      const reversedTables = [...ALL_TABLES].reverse();
      for (const t of reversedTables) {
        await tx.execute(`DELETE FROM ${t}`);
      }
      for (const t of ALL_TABLES) {
        const rows = req.body.data[t];
        if (rows && rows.length > 0) {
          const keys = Object.keys(rows[0]);
          for (const r of rows) {
            await tx.execute({
              sql: `INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
              args: Object.values(r)
            });
          }
        }
      }
      await tx.commit();
      res.json({ message: 'Restored' });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/settings/delete-all', async (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'DELETE') return res.status(400).json({ error: 'Invalid confirmation' });

  try {
    const tx = await db.transaction('write');
    try {
      // Delete in reverse order to handle FKs
      const reversedTables = [...ALL_TABLES].reverse();
      for (const t of reversedTables) {
        try {
          await tx.execute(`DELETE FROM ${t}`);
        } catch (e) {
          console.warn(`Could not wipe table ${t}: ${e.message}`);
        }
      }

      // Reset auto-increment sequences
      for (const t of ALL_TABLES) {
        try {
          await tx.execute({ sql: 'DELETE FROM sqlite_sequence WHERE name = ?', args: [t] });
        } catch (e) { }
      }

      await tx.commit();

      // Physically delete files in uploads (optional but recommended for "Fresh Start")
      const clearDirectory = (directory) => {
        if (!fs.existsSync(directory)) return;
        const files = fs.readdirSync(directory);
        for (const file of files) {
          const filePath = path.join(directory, file);
          if (fs.lstatSync(filePath).isDirectory()) {
            clearDirectory(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        }
      };

      try {
        clearDirectory(uploadDir);
        // Re-create necessary subdirs
        [voiceNotesDir, galleryDir, settingsDir].forEach(dir => {
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });
      } catch (err) {
        console.error("File cleanup error:", err);
      }

      res.json({ success: true, message: 'All data wiped and sequences reset' });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    console.error("Wipe data error:", err);
    res.status(500).json({ error: err.message });
  }
});


// --- GALLERY ENDPOINTS ---

const galleryStorage = multer.memoryStorage();
const galleryUpload = multer({
  storage: galleryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.get('/api/gallery/albums', async (req, res) => {
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

    const result = await db.execute({ sql, args: params });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gallery/albums', async (req, res) => {
  const { name, album_type, booking_id, inventory_item_id } = req.body;
  try {
    const info = await db.execute({
      sql: `
        INSERT INTO gallery_albums (name, album_type, booking_id, inventory_item_id)
        VALUES (?, ?, ?, ?)
      `,
      args: [name, album_type || 'general', booking_id || null, inventory_item_id || null]
    });
    res.status(201).json({ id: info.lastInsertRowid });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/gallery/albums/:id', async (req, res) => {
  const { id } = req.params;
  const { name, cover_photo_id } = req.body;
  try {
    await db.execute({
      sql: `
        UPDATE gallery_albums SET name = COALESCE(?, name), cover_photo_id = COALESCE(?, cover_photo_id), updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `,
      args: [name, cover_photo_id, id]
    });
    res.json({ message: 'Album updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/gallery/albums/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.execute({ sql: 'SELECT file_path FROM gallery_photos WHERE album_id = ?', args: [id] });
    const photos = result.rows;
    await db.execute({ sql: 'DELETE FROM gallery_albums WHERE id = ?', args: [id] });
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

app.get('/api/gallery/albums/:id/photos', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Album ID is required' });

  try {
    const result = await db.execute({
      sql: `
        SELECT p.*, (SELECT GROUP_CONCAT(tag) FROM gallery_photo_tags WHERE photo_id = p.id) as tags
        FROM gallery_photos p WHERE p.album_id = ? ORDER BY p.created_at DESC
      `,
      args: [id]
    });

    const photos = result.rows || [];
    // Ensure each photo has a valid path and tags are parsed correctly
    const formattedPhotos = photos.map(p => ({
      ...p,
      file_path: p.file_path && !p.file_path.startsWith('http') && !p.file_path.startsWith('/') 
                 ? `/uploads/${p.file_path}` 
                 : p.file_path,
      tags: p.tags ? p.tags.split(',') : []
    }));

    res.json(formattedPhotos);
  } catch (err) {
    console.error("!!! GALLERY FETCH ERROR !!!", err);
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
      const storedFilename = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
      let finalUrl = '';
      
      if (supabase) {
        finalUrl = await uploadToSupabase(file, 'gallery', `album_${id}/`);
      } else {
        const fullPath = path.join(albumDir, storedFilename);
        await sharp(file.buffer).resize({ width: 1920, withoutEnlargement: true }).toFile(fullPath);
        finalUrl = `/uploads/gallery/${id}/${storedFilename}`;
      }

      const info = await db.execute({
        sql: `
          INSERT INTO gallery_photos (album_id, original_filename, stored_filename, file_path, file_size, caption, date_taken)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [id, file.originalname, storedFilename, finalUrl, file.size, caption, date_taken || new Date().toISOString().slice(0, 10)]
      });
      const photoId = info.lastInsertRowid;

      if (tags) {
        const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
        for (const t of tagList) {
          await db.execute({ sql: 'INSERT INTO gallery_photo_tags (photo_id, tag) VALUES (?, ?)', args: [photoId, t] });
        }
      }
      results.push({ id: photoId, stored_filename: storedFilename, file_path: finalUrl });
    }
    res.status(201).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/gallery/photos/:id', async (req, res) => {
  const { id } = req.params;
  const { caption, date_taken, tags } = req.body;
  try {
    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: 'UPDATE gallery_photos SET caption = COALESCE(?, caption), date_taken = COALESCE(?, date_taken) WHERE id = ?',
        args: [caption, date_taken, id]
      });
      if (tags !== undefined) {
        await tx.execute({ sql: 'DELETE FROM gallery_photo_tags WHERE photo_id = ?', args: [id] });
        const tagList = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
        for (const t of tagList) {
          await tx.execute({ sql: 'INSERT INTO gallery_photo_tags (photo_id, tag) VALUES (?, ?)', args: [id, t] });
        }
      }
      await tx.commit();
      res.json({ message: 'Photo updated' });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/gallery/photos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const photoResult = await db.execute({ sql: 'SELECT file_path FROM gallery_photos WHERE id = ?', args: [id] });
    const photo = photoResult.rows[0];
    if (photo) {
      const fullPath = path.join(__dirname, photo.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      await db.execute({ sql: 'DELETE FROM gallery_photos WHERE id = ?', args: [id] });
    }
    res.json({ message: 'Photo deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/gallery/photos/bulk', async (req, res) => {
  const { photo_ids } = req.body;
  try {
    const tx = await db.transaction('write');
    try {
      for (const id of photo_ids) {
        const photoResult = await tx.execute({ sql: 'SELECT file_path FROM gallery_photos WHERE id = ?', args: [id] });
        const photo = photoResult.rows[0];
        if (photo) {
          const fullPath = path.join(__dirname, photo.file_path);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          await tx.execute({ sql: 'DELETE FROM gallery_photos WHERE id = ?', args: [id] });
        }
      }
      await tx.commit();
      res.json({ message: 'Photos deleted' });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/gallery/photos/move', async (req, res) => {
  const { photo_ids, target_album_id } = req.body;
  try {
    const tx = await db.transaction('write');
    try {
      for (const id of photo_ids) {
        await tx.execute({ sql: 'UPDATE gallery_photos SET album_id = ? WHERE id = ?', args: [target_album_id, id] });
      }
      await tx.commit();
      res.json({ message: 'Photos moved' });
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gallery/photos/:id/download', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.execute({ sql: 'SELECT file_path, original_filename FROM gallery_photos WHERE id = ?', args: [id] });
    const photo = result.rows[0];
    if (!photo) return res.status(404).send('Photo not found');
    res.download(path.join(__dirname, photo.file_path), photo.original_filename);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/gallery/booking/:bookingId/album', async (req, res) => {
  const { bookingId } = req.params;
  try {
    const albumResult = await db.execute({ sql: 'SELECT * FROM gallery_albums WHERE booking_id = ?', args: [bookingId] });
    let album = albumResult.rows[0];
    if (!album) {
      const bookingResult = await db.execute({
        sql: 'SELECT (SELECT name FROM customers WHERE customer_id = b.customer_id) as customer_name FROM bookings b WHERE booking_id = ?',
        args: [bookingId]
      });
      const booking = bookingResult.rows[0];
      const name = `${booking ? booking.customer_name : 'Customer'} - ${bookingId}`;
      const info = await db.execute({
        sql: 'INSERT INTO gallery_albums (name, album_type, booking_id) VALUES (?, ?, ?)',
        args: [name, 'booking', bookingId]
      });
      album = { id: info.lastInsertRowid, name, album_type: 'booking', booking_id: bookingId };
    }
    const photosResult = await db.execute({ sql: 'SELECT * FROM gallery_photos WHERE album_id = ?', args: [album.id] });
    res.json({ album, photos: photosResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gallery/inventory/:itemId/album', async (req, res) => {
  const { itemId } = req.params;
  try {
    const albumResult = await db.execute({ sql: 'SELECT * FROM gallery_albums WHERE inventory_item_id = ?', args: [itemId] });
    let album = albumResult.rows[0];
    if (!album) {
      const itemResult = await db.execute({ sql: 'SELECT name FROM inventory_items WHERE id = ?', args: [itemId] });
      const item = itemResult.rows[0];
      const name = `${item ? item.name : 'Item'} - Photos`;
      const info = await db.execute({
        sql: 'INSERT INTO gallery_albums (name, album_type, inventory_item_id) VALUES (?, ?, ?)',
        args: [name, 'inventory', itemId]
      });
      album = { id: info.lastInsertRowid, name, album_type: 'inventory', inventory_item_id: itemId };
    }
    const photosResult = await db.execute({ sql: 'SELECT * FROM gallery_photos WHERE album_id = ?', args: [album.id] });
    res.json({ album, photos: photosResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REST OF ENDPOINTS ---

// --- REPORTS ---

app.get('/api/reports/monthly', async (req, res) => {
  const { month, year } = req.query; // format: MM, YYYY
  try {
    const result = await db.execute({
      sql: `
        SELECT b.*, c.name as customer_name
        FROM bookings b
        JOIN customers c ON b.customer_id = c.customer_id
        WHERE strftime('%m', b.booking_date) = ? AND strftime('%Y', b.booking_date) = ?
        ORDER BY b.booking_date DESC
      `,
      args: [month, year]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/daily', async (req, res) => {
  const { date } = req.query; // format: YYYY-MM-DD
  try {
    const result = await db.execute({
      sql: `
        SELECT b.*, c.name as customer_name
        FROM bookings b
        JOIN customers c ON b.customer_id = c.customer_id
        WHERE date(b.booking_date) = date(?)
        ORDER BY b.booking_date DESC
      `,
      args: [date]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/pending-payments', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT b.*, c.name as customer_name, c.phone as phone_number
      FROM bookings b
      JOIN customers c ON b.customer_id = c.customer_id
      WHERE b.payment_status = 'pending'
      ORDER BY b.booking_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/monthly', async (req, res) => {
  const { month, year } = req.query; // format: MM, YYYY
  try {
    const result = await db.execute({
      sql: `
        SELECT b.*, c.name as customer_name
        FROM bookings b
        JOIN customers c ON b.customer_id = c.customer_id
        WHERE strftime('%m', b.booking_date) = ? AND strftime('%Y', b.booking_date) = ?
        ORDER BY b.booking_date DESC
      `,
      args: [month, year]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/daily', async (req, res) => {
  const { date } = req.query; // format: YYYY-MM-DD
  try {
    const result = await db.execute({
      sql: `
        SELECT b.*, c.name as customer_name
        FROM bookings b
        JOIN customers c ON b.customer_id = c.customer_id
        WHERE date(b.booking_date) = date(?)
        ORDER BY b.booking_date DESC
      `,
      args: [date]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/pending-payments', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT b.*, c.name as customer_name, c.phone as phone_number
      FROM bookings b
      JOIN customers c ON b.customer_id = c.customer_id
      WHERE b.payment_status = 'pending'
      ORDER BY b.booking_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/booking-status', async (req, res) => {

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
    const result = await db.execute({ sql, args: params });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT p.*, c.name as customer_name, b.booking_id
      FROM payments p
      JOIN bookings b ON p.booking_id = b.booking_id
      JOIN customers c ON b.customer_id = c.customer_id
      ORDER BY p.paid_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/vendor-borrows', async (req, res) => {
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
    const result = await db.execute({ sql, args: params });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- STAFF (WORKERS) ---
app.get('/api/workers', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM workers ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/workers', async (req, res) => {
  const { name, role, phone, salary, address, join_date } = req.body;
  try {
    await db.execute({
      sql: 'INSERT INTO workers (name, role, phone, salary, address, join_date) VALUES (?, ?, ?, ?, ?, ?)',
      args: [name, role, phone, salary, address, join_date]
    });
    res.status(201).json({ message: 'Added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/workers/:id', async (req, res) => {
  const { name, role, phone, salary, address, join_date } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE workers SET name = ?, role = ?, phone = ?, salary = ?, address = ?, join_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [name, role, phone, salary, address, join_date, req.params.id]
    });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/workers/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM workers WHERE id = ?', args: [req.params.id] });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- EXPENSES ---
app.get('/api/expenses', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM expenses ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/expenses', async (req, res) => {
  const { date, amount, category, description, payment_method } = req.body;
  try {
    await db.execute({
      sql: 'INSERT INTO expenses (date, amount, category, description, payment_method) VALUES (?, ?, ?, ?, ?)',
      args: [date, amount, category, description, payment_method]
    });
    res.status(201).json({ message: 'Added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM expenses WHERE id = ?', args: [req.params.id] });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/settings/expense-types', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM expense_types ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/expense-types', async (req, res) => {
  const { name } = req.body;
  try {
    await db.execute({ sql: 'INSERT INTO expense_types (name) VALUES (?)', args: [name] });
    res.status(201).json({ message: 'Added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});



// --- BUSINESS PROFILE ---
app.get('/api/profile', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM business_profile WHERE id = 1');
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/profile', upload.fields([{ name: 'photo_url', maxCount: 1 }, { name: 'deity_image', maxCount: 1 }, { name: 'static_qr', maxCount: 1 }]), async (req, res) => {
  const { business_name, name_kn, owner_name, blessing_kn, phone, phone1, phone2, phone3, address, address1_kn, address2_kn, address3_kn, upi_id, upi_name } = req.body;
  let photo_url = req.body.photo_url, deity_image_path = req.body.deity_image_path, static_qr_path = req.body.static_qr_path;
  try {
    if (req.files?.['photo_url']) photo_url = supabase ? await uploadToSupabase(req.files['photo_url'][0], 'settings') : `/uploads/settings/${Date.now()}_${req.files['photo_url'][0].originalname}`;
    if (req.files?.['deity_image']) deity_image_path = supabase ? await uploadToSupabase(req.files['deity_image'][0], 'settings') : `/uploads/settings/${Date.now()}_${req.files['deity_image'][0].originalname}`;
    if (req.files?.['static_qr']) static_qr_path = supabase ? await uploadToSupabase(req.files['static_qr'][0], 'settings') : `/uploads/settings/${Date.now()}_${req.files['static_qr'][0].originalname}`;
    const existing = await db.execute('SELECT id FROM business_profile WHERE id = 1');
    const sql = existing.rows.length > 0 ? `UPDATE business_profile SET business_name=?, name_kn=?, owner_name=?, blessing_kn=?, phone=?, phone1=?, phone2=?, phone3=?, address=?, address1_kn=?, address2_kn=?, address3_kn=?, photo_url=?, deity_image_path=?, upi_id=?, upi_name=?, static_qr_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=1` : `INSERT INTO business_profile (id, business_name, name_kn, owner_name, blessing_kn, phone, phone1, phone2, phone3, address, address1_kn, address2_kn, address3_kn, photo_url, deity_image_path, upi_id, upi_name, static_qr_path) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    await db.execute({ sql, args: [business_name, name_kn, owner_name, blessing_kn, phone, phone1, phone2, phone3, address, address1_kn, address2_kn, address3_kn, photo_url, deity_image_path, upi_id, upi_name, static_qr_path] });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- ORDER LINKS & PUBLIC ORDERS ---
app.post('/api/order-links', async (req, res) => {
  const token = crypto.randomBytes(8).toString('hex').toUpperCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  try {
    await db.execute({
      sql: 'INSERT INTO order_links (token, expires_at) VALUES (?, ?)',
      args: [token, expiresAt.toISOString()]
    });
    res.json({ token, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/order-links', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM order_links ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/public-orders/validate/:token', async (req, res) => {
  const { token } = req.params;
  console.log("Validating token:", token);
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM order_links WHERE token = ?',
      args: [token]
    });
    console.log("Match found:", result.rows.length > 0);
    if (result.rows.length === 0) return res.json({ valid: false });

    const link = result.rows[0];
    // Check status if column exists, otherwise assume active
    if (link.status && link.status !== 'active') return res.json({ valid: false });

    console.log("Expires at:", link.expires_at);
    if (new Date(link.expires_at) < new Date()) {
      console.log("Token expired!");
      await db.execute({ sql: 'UPDATE order_links SET status = "expired" WHERE token = ?', args: [token] });
      return res.json({ valid: false });
    }

    res.json({ valid: true });
  } catch (err) {
    console.error("Validation error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/public-orders/status/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await db.execute({
      sql: 'SELECT booking_id, order_status, total_amount, created_at FROM bookings WHERE voice_note_path = ? OR booking_id = ?',
      args: [`token:${token}`, token]
    });
    if (result.rows.length === 0) return res.json({ found: false });
    res.json({ found: true, booking: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/public-orders/:token', async (req, res) => {
  const { token } = req.params;
  const { customer_name, phone_number, place, pricing_mode, delivery_takeaway_date, function_type, items, total_amount } = req.body;

  try {
    let customer_id;
    const custSearch = await db.execute({ sql: 'SELECT customer_id FROM customers WHERE phone = ?', args: [phone_number] });
    if (custSearch.rows.length > 0) {
      customer_id = custSearch.rows[0].customer_id;
    } else {
      customer_id = 'C' + Math.floor(1000 + Math.random() * 9000);
      await db.execute({
        sql: 'INSERT INTO customers (customer_id, name, phone, place) VALUES (?, ?, ?, ?)',
        args: [customer_id, customer_name, phone_number, place]
      });
    }

    const booking_id = 'T' + Math.floor(100000 + Math.random() * 900000);
    await db.execute({
      sql: `INSERT INTO bookings (
              booking_id, customer_id, pricing_mode, total_amount, order_status, 
              delivery_takeaway_date, place, function_type, voice_note_path
            ) VALUES (?, ?, ?, ?, 'pending_request', ?, ?, ?, ?)`,
      args: [booking_id, customer_id, pricing_mode, total_amount, delivery_takeaway_date, place, function_type, `token:${token}`]
    });


    for (const item of items) {
      await db.execute({
        sql: 'INSERT INTO booking_items (booking_id, item_id, item_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        args: [booking_id, item.item_id, item.item_name, item.quantity, item.unit_price, item.subtotal]
      });
    }

    res.json({ success: true, booking_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- UPLOAD ---
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url });
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error("!!! SERVER ERROR !!!", err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// --- SPA WILDCARD ---
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
