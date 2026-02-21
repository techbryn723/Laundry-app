import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');

// Database setup - support both Turso (production) and local SQLite (development)
let db: any;
let useTurso = false;

async function initDatabase() {
  // Support both VITE_ prefix (from .env) and direct TURSO_ (for Vercel)
  const dbUrl = process.env.TURSO_DATABASE_URL || process.env.VITE_TURSO_DATABASE_URL;
  const dbToken = process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN;
  
  if (!dbUrl || !dbToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required. Please set them in your .env file or Vercel environment variables.');
  }
  
  // Use Turso cloud database
  const { createClient } = await import('@libsql/client');
  const client = createClient({
    url: dbUrl,
    authToken: dbToken,
  });
  
  useTurso = true;
  
  // Create async wrapper that matches better-sqlite3 API
  db = {
    prepare: (sql: string) => {
      return {
        all: async (...params: any[]) => {
          const result = await client.execute({ sql, args: params.length ? params : [] });
          return result.rows;
        },
        get: async (...params: any[]) => {
          const result = await client.execute({ sql, args: params.length ? params : [] });
          return result.rows[0];
        },
        run: async (...params: any[]) => {
          const result = await client.execute({ sql, args: params.length ? params : [] });
          return { lastInsertRowid: result.rowsAffected };
        },
      };
    },
    exec: async (sql: string) => {
      await client.execute({ sql });
    },
    transaction: (fn: any) => {
      return async () => {
        return fn();
      };
    },
  };
  
  console.log('✅ Connected to Turso database (cloud)');
}

// Initialize Database Tables - execute one statement at a time for Turso compatibility
async function initTables() {
  // Use TEXT instead of DATETIME for better Turso compatibility
  const createTableSQL = [
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE,
      customer_id INTEGER,
      total_amount INTEGER,
      status TEXT DEFAULT 'pending',
      pickup_date TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER,
      item_type TEXT,
      service_type TEXT,
      quantity INTEGER,
      unit TEXT,
      amount INTEGER,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`
  ];

  for (const sql of createTableSQL) {
    await db.exec(sql);
  }

  // Migration check - use try/catch for Turso compatibility
  let columnNames: string[] = [];
  try {
    const columns: any[] = await db.prepare("PRAGMA table_info(transactions)").all();
    columnNames = columns.map((c: any) => c.name);
  } catch (e) {
    console.log("PRAGMA not supported, skipping migration check");
  }

  if (!columnNames.includes('ticket_number')) {
    try { await db.exec("ALTER TABLE transactions ADD COLUMN ticket_number TEXT"); } catch (e: any) { console.error("Migration error (ticket_number):", e); }
  }
  if (!columnNames.includes('pickup_date')) {
    try { await db.exec("ALTER TABLE transactions ADD COLUMN pickup_date DATETIME"); } catch (e: any) { console.error("Migration error (pickup_date):", e); }
  }
  if (!columnNames.includes('total_amount')) {
    try { await db.exec("ALTER TABLE transactions ADD COLUMN total_amount INTEGER"); } catch (e: any) { console.error("Migration error (total_amount):", e); }
  }
  if (!columnNames.includes('note')) {
    try { await db.exec("ALTER TABLE transactions ADD COLUMN note TEXT"); } catch (e: any) { console.error("Migration error (note):", e); }
  }
}

const app = express();
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Configure Multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// API Routes
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const result = await db.prepare('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)').run(name, phone, email, address);
    res.json({ id: result.lastInsertRowid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, email, address } = req.body;
    await db.prepare('UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?').run(name, phone, email, address, id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await db.prepare(`
      SELECT t.*, c.name as customer_name 
      FROM transactions t 
      LEFT JOIN customers c ON t.customer_id = c.id 
      ORDER BY t.created_at DESC
    `).all();
    
    const transactionsWithItems = await Promise.all(transactions.map(async (t: any) => {
      const items = await db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(t.id);
      return { ...t, items };
    }));
    
    res.json(transactionsWithItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { customer_id, items, total_amount, status, pickup_date } = req.body;
    
    if (!customer_id || isNaN(customer_id)) {
      return res.status(400).json({ error: 'Konsumen harus dipilih' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Minimal harus ada 1 item' });
    }
    
    // Generate Ticket Number: INV-YYYYMMDD-RAND
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const ticket_number = `INV-${date}-${random}`;

    const insertTransaction = db.prepare('INSERT INTO transactions (ticket_number, customer_id, total_amount, status, pickup_date) VALUES (?, ?, ?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO transaction_items (transaction_id, item_type, service_type, quantity, unit, amount) VALUES (?, ?, ?, ?, ?, ?)');

    // Execute transaction
    const result = await insertTransaction.run(ticket_number, Number(customer_id), total_amount, status, pickup_date);
    const transactionId = result.lastInsertRowid;
    
    for (const item of items) {
      await insertItem.run(transactionId, item.item_type, item.service_type, item.quantity, item.unit, item.amount);
    }

    res.json({ id: transactionId, ticket_number });
  } catch (error: any) {
    console.error("Transaction error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, pickup_date, note } = req.body;
    
    // Get current transaction
    const current = await db.prepare('SELECT status FROM transactions WHERE id = ?').get(id);
    
    // If status is 'diambil' (taken), don't allow changes to status
    if (current && current.status === 'diambil' && status !== 'diambil') {
      return res.status(400).json({ error: 'Transaksi sudah diambil, tidak dapat diubah' });
    }
    
    if (note !== undefined && note !== null && note !== '') {
      await db.prepare('UPDATE transactions SET status = ?, pickup_date = ?, note = ? WHERE id = ?').run(status, pickup_date, note, id);
    } else {
      await db.prepare('UPDATE transactions SET status = ?, pickup_date = ? WHERE id = ?').run(status, pickup_date, id);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.prepare('SELECT * FROM settings').all();
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settingsObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/upload', upload.single('file'), async (req, res) => {
  const { key } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const filePath = `/uploads/${req.file.filename}`;
  await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, filePath);
  res.json({ path: filePath });
});

app.patch('/api/settings', async (req, res) => {
  try {
    const { business_name, address, phone } = req.body;
    
    if (business_name !== undefined) {
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('business_name', business_name);
    }
    if (address !== undefined) {
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('address', address);
    }
    if (phone !== undefined) {
      await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('phone', phone);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Backup Database - only works with local SQLite
app.get('/api/backup', (req, res) => {
  if (useTurso) {
    return res.status(400).json({ error: 'Backup not available with cloud database' });
  }
  
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `laundry-backup-${timestamp}.db`);
    fs.copyFileSync(path.join(__dirname, 'laundry.db'), backupPath);
    res.download(backupPath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Restore Database - only works with local SQLite
app.post('/api/restore', upload.single('backup'), (req, res) => {
  if (useTurso) {
    return res.status(400).json({ error: 'Restore not available with cloud database' });
  }
  
  try {
    if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });
    const currentDbPath = path.join(__dirname, 'laundry.db');
    const backupPath = req.file.path;
    fs.copyFileSync(backupPath, currentDbPath);
    res.json({ success: true, message: 'Database restored. Please restart server.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Print Preview API
app.get('/api/print/:ticket_number', async (req, res) => {
  try {
    const { ticket_number } = req.params;
    
    const transaction = await db.prepare(`
      SELECT t.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM transactions t 
      LEFT JOIN customers c ON t.customer_id = c.id 
      WHERE t.ticket_number = ?
    `).get(ticket_number);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }
    
    const items = await db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(transaction.id);
    const settings = await db.prepare('SELECT * FROM settings').all();
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    
    res.json({
      transaction: { ...transaction, items },
      settings: settingsObj
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Print preview page
app.get('/print/:ticket_number', (req, res) => {
  const { ticket_number } = req.params;
  res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cetak Struk - Laundry</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div id="loading" class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p class="text-gray-600">Memuat data...</p>
    </div>
  </div>

  <div id="content" class="hidden">
    <div class="max-w-md mx-auto my-8">
      <div id="receipt" class="bg-white rounded-3xl overflow-hidden shadow-2xl">
        <div id="header" class="bg-gradient-to-r p-6 text-white">
          <div class="flex justify-between items-start">
            <div>
              <h2 id="business-name" class="text-2xl font-bold">Laundry</h2>
              <p id="business-address" class="text-white/80 text-sm">-</p>
              <p id="business-phone" class="text-white/80 text-sm">-</p>
            </div>
            <div class="text-right">
              <p class="text-xs uppercase tracking-wider opacity-80">Status</p>
              <p id="status" class="font-bold text-lg">-</p>
            </div>
          </div>
        </div>

        <div class="p-6 space-y-4">
          <div class="text-center border-b border-gray-200 pb-4">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Nomor Ticket</p>
            <p id="ticket-number" class="text-2xl font-bold text-indigo-600">-</p>
          </div>

          <div class="flex justify-between items-center">
            <div>
              <p class="text-xs text-gray-500 uppercase">Konsumen</p>
              <p id="customer-name" class="font-semibold">-</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500 uppercase">Tanggal</p>
              <p id="created-at" class="font-semibold">-</p>
            </div>
          </div>

          <div class="border-t border-b border-gray-200 py-4">
            <p class="text-xs text-gray-500 uppercase mb-2">Detail Item</p>
            <div id="items"></div>
          </div>

          <div class="flex justify-between items-center text-xl">
            <span class="font-bold">TOTAL</span>
            <span id="total-amount" class="font-bold text-indigo-600">Rp 0</span>
          </div>

          <div class="bg-gray-100 rounded-xl p-4">
            <p class="text-xs text-gray-500 uppercase">Tanggal Pengambilan</p>
            <p id="pickup-date" class="font-semibold">-</p>
          </div>

          <div id="note-container" class="hidden bg-amber-50 rounded-xl p-3">
            <p class="text-xs text-amber-600 uppercase">Catatan</p>
            <p id="note" class="text-sm">-</p>
          </div>

          <p class="text-center text-gray-400 text-sm pt-4">
            Terima kasih telah menggunakan layanan kami
          </p>
        </div>

        <div class="p-4 bg-gray-50 flex gap-2">
          <button onclick="window.print()" class="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Cetak
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const statusLabels = {
      'proses': 'Proses',
      'cicilan': 'Cicilan',
      'lunas': 'Lunas',
      'diambil': 'Diambil'
    };

    const statusColors = {
      'proses': 'from-amber-400 to-orange-500',
      'cicilan': 'from-blue-400 to-indigo-500',
      'lunas': 'from-emerald-400 to-teal-500',
      'diambil': 'from-purple-400 to-pink-500'
    };

    async function loadTransaction() {
      const ticketNumber = window.location.pathname.split('/').pop();
      
      try {
        const response = await fetch('/api/print/' + ticketNumber);
        const data = await response.json();
        
        if (!response.ok) {
          document.getElementById('loading').innerHTML = '<p class="text-red-600">' + data.error + '</p>';
          return;
        }
        
        const { transaction, settings } = data;
        
        document.getElementById('business-name').textContent = settings.business_name || 'Laundry';
        document.getElementById('business-address').textContent = settings.address || '-';
        document.getElementById('business-phone').textContent = settings.phone || '-';
        
        document.getElementById('ticket-number').textContent = transaction.ticket_number;
        document.getElementById('customer-name').textContent = transaction.customer_name || '-';
        document.getElementById('created-at').textContent = new Date(transaction.created_at).toLocaleDateString('id-ID');
        document.getElementById('total-amount').textContent = 'Rp ' + (transaction.total_amount || 0).toLocaleString();
        document.getElementById('pickup-date').textContent = transaction.pickup_date ? new Date(transaction.pickup_date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-';
        
        const status = transaction.status;
        document.getElementById('status').textContent = statusLabels[status] || status;
        
        const header = document.getElementById('header');
        header.className = 'bg-gradient-to-r p-6 text-white ' + (statusColors[status] || 'from-indigo-500 to-purple-600');
        
        const itemsContainer = document.getElementById('items');
        if (transaction.items && transaction.items.length > 0) {
          itemsContainer.innerHTML = transaction.items.map(item => '
            <div class="flex justify-between py-1">
              <span>' + item.quantity + ' ' + item.unit + ' ' + (item.item_type === 'shoe' ? 'Sepatu' : 'Tas') + ' - ' + item.service_type + '</span>
              <span class="font-semibold">Rp ' + item.amount.toLocaleString() + '</span>
            </div>
          ').join('');
        }
        
        if (transaction.note) {
          document.getElementById('note-container').classList.remove('hidden');
          document.getElementById('note').textContent = transaction.note;
        }
        
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
        
      } catch (error) {
        console.error('Error:', error);
        document.getElementById('loading').innerHTML = '<p class="text-red-600">Gagal memuat data</p>';
      }
    }
    
    loadTransaction();
  </script>
  
  <style>
    @media print {
      body { background: white; }
      button { display: none !important; }
    }
  </style>
</body>
</html>
  `);
});

async function startServer() {
  // Initialize database
  await initDatabase();
  await initTables();
  
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  }

const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
