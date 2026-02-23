import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const db = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL!,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN!,
});

async function testSettings() {
  try {
    console.log("Creating settings table...");
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
    console.log("Settings table created!");
    
    console.log("Checking if settings exist...");
    const check = await db.execute("SELECT * FROM settings LIMIT 1");
    console.log("Check result:", check.rows);
    
    if (check.rows.length === 0) {
      console.log("Inserting default settings...");
      await db.execute({
        sql: "INSERT INTO settings (business_name, address, phone) VALUES (?, ?, ?)",
        args: ['Laundry Saya', '', '']
      });
      console.log("Default settings inserted!");
    }
    
    const result = await db.execute("SELECT * FROM settings LIMIT 1");
    console.log("Final settings:", result.rows);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

testSettings();
