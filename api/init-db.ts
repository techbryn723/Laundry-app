import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const db = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL!,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN!,
});

async function initDatabase() {
  console.log('Menginisialisasi database...');
  
  try {
    // Create customers table
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
    console.log('✓ Tabel customers dibuat');

    // Create transactions table
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
    console.log('✓ Tabel transactions dibuat');

    // Create transaction_items table
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
    console.log('✓ Tabel transaction_items dibuat');

    // Create settings table
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
    console.log('✓ Tabel settings dibuat');

    // Insert default settings if not exist
    const settings = await db.execute("SELECT * FROM settings LIMIT 1");
    if (settings.rows.length === 0) {
      await db.execute({
        sql: "INSERT INTO settings (business_name, address, phone) VALUES (?, ?, ?)",
        args: ['Laundry Saya', '', '']
      });
      console.log('✓ Default settings ditambahkan');
    }

    console.log('\n✅ Database berhasil diinisialisasi!');
  } catch (error) {
    console.error('❌ Error menginisialisasi database:', error);
  }
}

initDatabase();
