import express from 'express';
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import path from "path";
import multer from "multer";
import fs from "fs";

// Memastikan .env terbaca dari root (karena server.ts di dalam /api)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();

// CORS middleware untuk mengizinkan request dari frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Static file serving untuk uploads (favicon, logo, dll) - mendukung lokal dan Vercel
const localUploads = path.join(process.cwd(), 'public', 'uploads');
if (fs.existsSync(localUploads)) {
  app.use('/uploads', express.static(localUploads));
}
if (fs.existsSync('/tmp/uploads')) {
  app.use('/uploads', express.static('/tmp/uploads'));
}

// PENTING: Middleware agar Express bisa membaca data JSON yang dikirim React
app.use(express.json());

// Konfigurasi Client Turso
const db = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL!,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN!,
});

// Konfigurasi Multer untuk upload file - menggunakan /tmp untuk Vercel
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVercel = process.env.VERCEL === '1' || !fs.existsSync(path.join(process.cwd(), 'public'));
    const uploadDir = isVercel 
      ? '/tmp/uploads' 
      : path.join(process.cwd(), 'public', 'uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Helper function untuk mengkonversi BigInt ke number/string (Turso returns BigInt)
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = serializeBigInt(obj[key]);
    }
    return result;
  }
  return obj;
};

// Helper function to ensure tables exist
async function ensureTables() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        ticket_number TEXT NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'proses',
        pickup_date TEXT,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        service_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_name TEXT,
        address TEXT,
        phone TEXT,
        logo TEXT,
        favicon TEXT
      )
    `);
    
    console.log("✓ Semua tabel sudah ada/dibuat");
  } catch (error: any) {
    console.error("Error creating tables:", error.message);
  }
}

// Initialize tables on startup
ensureTables();

// ==================== CUSTOMERS API ====================

// GET all customers
app.get('/api/customers', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM customers ORDER BY id DESC");
    res.status(200).json(serializeBigInt(result.rows));
  } catch (error: any) {
    console.error("Error getting customers:", error.message);
    res.status(500).json({ error: "Gagal mengambil data konsumen: " + error.message });
  }
});

// POST new customer
app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Nama wajib diisi" });
    }
    
    const result = await db.execute({
      sql: "INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)",
      args: [name, phone || null, email || null, address || null]
    });
    res.status(201).json(serializeBigInt({ success: true, id: result.lastInsertRowid }));
  } catch (error: any) {
    console.error("Error adding customer:", error.message);
    res.status(500).json({ error: "Gagal menambah konsumen: " + error.message });
  }
});

// PUT update customer
app.put('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    await db.execute({
      sql: "UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?",
      args: [name, phone || null, email || null, address || null, id]
    });
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error updating customer:", error.message);
    res.status(500).json({ error: "Gagal mengupdate konsumen: " + error.message });
  }
});

// DELETE customer
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: "DELETE FROM customers WHERE id = ?",
      args: [id]
    });
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error deleting customer:", error.message);
    res.status(500).json({ error: "Gagal menghapus konsumen: " + error.message });
  }
});

// ==================== TRANSACTIONS API ====================

// GET all transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT t.*, c.name as customer_name, c.phone as customer_phone
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      ORDER BY t.id DESC
    `);
    
    const transactions = await Promise.all(result.rows.map(async (t) => {
      const itemsResult = await db.execute({
        sql: "SELECT * FROM transaction_items WHERE transaction_id = ?",
        args: [t.id]
      });
      return { ...t, items: itemsResult.rows };
    }));
    
    res.status(200).json(serializeBigInt(transactions));
  } catch (error: any) {
    console.error("Error getting transactions:", error.message);
    res.status(500).json({ error: "Gagal mengambil data transaksi: " + error.message });
  }
});

// POST new transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { customer_id, items, total_amount, status, pickup_date, note } = req.body;
    
    const ticketNumber = 'LW' + Date.now();
    
    const result = await db.execute({
      sql: `INSERT INTO transactions (customer_id, ticket_number, total_amount, status, pickup_date, note, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
      args: [customer_id, ticketNumber, total_amount, status || 'proses', pickup_date, note || null]
    });
    
    const transactionId = result.lastInsertRowid;
    
    if (items && items.length > 0) {
      for (const item of items) {
        await db.execute({
          sql: `INSERT INTO transaction_items (transaction_id, item_type, service_type, quantity, unit, amount) 
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [transactionId, item.item_type, item.service_type, item.quantity, item.unit, item.amount]
        });
      }
    }
    
    res.status(201).json(serializeBigInt({ success: true, id: transactionId, ticket_number: ticketNumber }));
  } catch (error: any) {
    console.error("Error adding transaction:", error.message);
    res.status(500).json({ error: "Gagal menambah transaksi: " + error.message });
  }
});

// PUT update transaction
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, pickup_date, note } = req.body;
    
    await db.execute({
      sql: "UPDATE transactions SET status = ?, pickup_date = ?, note = ? WHERE id = ?",
      args: [status, pickup_date, note || null, id]
    });
    
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error updating transaction:", error.message);
    res.status(500).json({ error: "Gagal mengupdate transaksi: " + error.message });
  }
});

// DELETE transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.execute({
      sql: "DELETE FROM transaction_items WHERE transaction_id = ?",
      args: [id]
    });
    
    await db.execute({
      sql: "DELETE FROM transactions WHERE id = ?",
      args: [id]
    });
    
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error deleting transaction:", error.message);
    res.status(500).json({ error: "Gagal menghapus transaksi: " + error.message });
  }
});

// ==================== SETTINGS API ====================

// GET settings
app.get('/api/settings', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM settings LIMIT 1");
    if (result.rows.length > 0) {
      res.status(200).json(serializeBigInt(result.rows[0]));
    } else {
      await db.execute({
        sql: "INSERT INTO settings (business_name, address, phone) VALUES (?, ?, ?)",
        args: ['Laundry', '', '']
      });
      const newResult = await db.execute("SELECT * FROM settings LIMIT 1");
      res.status(200).json(serializeBigInt(newResult.rows[0]));
    }
  } catch (error: any) {
    console.error("Error getting settings:", error.message);
    res.status(500).json({ error: "Gagal mengambil pengaturan: " + error.message });
  }
});

// PATCH settings
app.patch('/api/settings', async (req, res) => {
  try {
    const { business_name, address, phone } = req.body;
    
    const result = await db.execute("SELECT id FROM settings LIMIT 1");
    
    if (result.rows.length > 0) {
      await db.execute({
        sql: "UPDATE settings SET business_name = ?, address = ?, phone = ? WHERE id = ?",
        args: [business_name, address, phone, result.rows[0].id]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO settings (business_name, address, phone) VALUES (?, ?, ?)",
        args: [business_name, address, phone]
      });
    }
    
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error saving settings:", error.message);
    res.status(500).json({ error: "Gagal menyimpan pengaturan: " + error.message });
  }
});

// ==================== FILE UPLOAD API ====================

// POST upload file (logo/favicon)
app.post('/api/settings/upload', upload.single('file'), async (req, res) => {
  try {
    const { key } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: "Tidak ada file yang diupload" });
    }
    
    const result = await db.execute("SELECT id FROM settings LIMIT 1");
    const filePath = `/uploads/${file.filename}`;
    
    if (result.rows.length > 0) {
      await db.execute({
        sql: key === 'logo' 
          ? "UPDATE settings SET logo = ? WHERE id = ?" 
          : "UPDATE settings SET favicon = ? WHERE id = ?",
        args: [filePath, result.rows[0].id]
      });
    } else {
      await db.execute({
        sql: key === 'logo' 
          ? "INSERT INTO settings (logo) VALUES (?)" 
          : "INSERT INTO settings (favicon) VALUES (?)",
        args: [filePath]
      });
    }
    
    res.status(200).json({ success: true, path: filePath });
  } catch (error: any) {
    console.error("Error uploading file:", error.message);
    res.status(500).json({ error: "Gagal mengupload file: " + error.message });
  }
});

// ==================== BACKUP & RESTORE API ====================

// GET backup
app.get('/api/backup', async (req, res) => {
  try {
    const customers = await db.execute("SELECT * FROM customers");
    const transactions = await db.execute("SELECT * FROM transactions");
    const transactionItems = await db.execute("SELECT * FROM transaction_items");
    const settings = await db.execute("SELECT * FROM settings");
    
    const backup = {
      customers: serializeBigInt(customers.rows),
      transactions: serializeBigInt(transactions.rows),
      transactionItems: serializeBigInt(transactionItems.rows),
      settings: serializeBigInt(settings.rows),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const jsonStr = JSON.stringify(backup, null, 2);
    const fileName = `laundry-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-Length', Buffer.byteLength(jsonStr));
    res.send(jsonStr);
  } catch (error: any) {
    console.error("Error creating backup:", error.message);
    res.status(500).json({ error: "Gagal membuat backup: " + error.message });
  }
});

// POST restore
app.post('/api/restore', async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';
    let backup: any;
    
    if (contentType.includes('multipart/form-data')) {
      const { backup: backupFile } = req.body;
    } else {
      backup = req.body;
    }
    
    if (!backup) {
      return res.status(400).json({ error: "Data backup tidak ditemukan. Pastikan file JSON valid." });
    }
    
    if (!backup.customers && !backup.transactions && !backup.settings) {
      return res.status(400).json({ error: "Format backup tidak valid" });
    }
    
    await db.execute("DELETE FROM transaction_items");
    await db.execute("DELETE FROM transactions");
    await db.execute("DELETE FROM customers");
    
    if (backup.customers && Array.isArray(backup.customers)) {
      for (const c of backup.customers) {
        await db.execute({
          sql: "INSERT INTO customers (id, name, phone, email, address) VALUES (?, ?, ?, ?, ?)",
          args: [c.id, c.name, c.phone, c.email, c.address]
        });
      }
    }
    
    if (backup.transactions && Array.isArray(backup.transactions)) {
      for (const t of backup.transactions) {
        await db.execute({
          sql: "INSERT INTO transactions (id, customer_id, ticket_number, total_amount, status, pickup_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          args: [t.id, t.customer_id, t.ticket_number, t.total_amount, t.status, t.pickup_date, t.note, t.created_at]
        });
      }
    }
    
    if (backup.transactionItems && Array.isArray(backup.transactionItems)) {
      for (const item of backup.transactionItems) {
        await db.execute({
          sql: "INSERT INTO transaction_items (id, transaction_id, item_type, service_type, quantity, unit, amount) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [item.id, item.transaction_id, item.item_type, item.service_type, item.quantity, item.unit, item.amount]
        });
      }
    }
    
    if (backup.settings && Array.isArray(backup.settings) && backup.settings.length > 0) {
      const s = backup.settings[0];
      await db.execute({
        sql: "UPDATE settings SET business_name = ?, address = ?, phone = ?, logo = ?, favicon = ?",
        args: [s.business_name, s.address, s.phone, s.logo, s.favicon]
      });
    }
    
    res.status(200).json({ success: true, message: "Database berhasil direstore" });
  } catch (error: any) {
    console.error("Error restoring backup:", error.message);
    res.status(500).json({ error: "Gagal merestore backup: " + error.message });
  }
});

// ==================== TEST ENDPOINT ====================

app.get('/api/test', (req, res) => {
  res.json({ message: "Backend aman!" });
});

// Endpoint untuk Simpan Data (contoh lama)
app.post('/api/save', async (req, res) => {
  try {
    const data = req.body; 
    console.log("Data masuk:", data);

    await db.execute({
      sql: "INSERT INTO users (name, email) VALUES (?, ?)",
      args: [data.name, data.email],
    });

    res.status(200).json({ success: true, message: "Berhasil simpan ke Turso" });
  } catch (error: any) {
    console.error("Error Simpan:", error.message);
    res.status(500).json({ error: "Gagal simpan ke database: " + error.message });
  }
});

// WAJIB: Export default untuk Vercel
export default app;

// Jalankan di lokal
if (process.env.NODE_ENV !== 'production') {
  const PORT = 3001;
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}
