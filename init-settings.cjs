const { createClient } = require("@libsql/client");
require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env") });

const db = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN,
});

(async () => {
  try {
    // Insert default settings
    await db.execute({
      sql: "INSERT INTO settings (business_name, address, phone) VALUES (?, ?, ?)",
      args: ['Laundry Toko Saya', '', '']
    });
    console.log('Default settings created!');
    
    // Verify
    const result = await db.execute("SELECT * FROM settings LIMIT 1");
    console.log('Current settings:', JSON.stringify(result.rows, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
