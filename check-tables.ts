import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const db = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL!,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN!,
});

async function checkTables() {
  try {
    // Check customers table
    console.log("=== CUSTOMERS TABLE ===");
    const customers = await db.execute("PRAGMA table_info(customers)");
    console.log(customers.rows);
    
    // Check transactions table
    console.log("\n=== TRANSACTIONS TABLE ===");
    const transactions = await db.execute("PRAGMA table_info(transactions)");
    console.log(transactions.rows);
    
    // Check settings table
    console.log("\n=== SETTINGS TABLE ===");
    const settings = await db.execute("PRAGMA table_info(settings)");
    console.log(settings.rows);
    
    // Check if there's data in settings
    console.log("\n=== SETTINGS DATA ===");
    const settingsData = await db.execute("SELECT * FROM settings LIMIT 1");
    console.log(settingsData.rows);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

checkTables();
