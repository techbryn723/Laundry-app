const { createClient } = require("@libsql/client");
const fs = require('fs');
require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env") });

let log = '';
function addLog(msg) {
  log += msg + '\n';
  console.log(msg);
}

const db = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN,
});

(async () => {
  try {
    // First, check current settings table structure
    const tableInfo = await db.execute("PRAGMA table_info(settings)");
    addLog('Current settings table structure:');
    addLog(JSON.stringify(tableInfo.rows, null, 2));
    
    // Check if it has key-value structure (wrong)
    const hasKeyColumn = tableInfo.rows.some(r => r.name === 'key');
    const hasBusinessNameColumn = tableInfo.rows.some(r => r.name === 'business_name');
    
    addLog('\nHas key column: ' + hasKeyColumn);
    addLog('Has business_name column: ' + hasBusinessNameColumn);
    
    if (hasKeyColumn && !hasBusinessNameColumn) {
      addLog('\nMigrating settings table from key-value to columns structure...');
      
      // Rename old table
      await db.execute("ALTER TABLE settings RENAME TO settings_old");
      
      // Create new table with correct structure
      await db.execute(`
        CREATE TABLE settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          business_name TEXT,
          address TEXT,
          phone TEXT,
          logo TEXT,
          favicon TEXT
        )
      `);
      
      // Migrate data from old table
      const oldSettings = await db.execute("SELECT * FROM settings_old");
      if (oldSettings.rows.length > 0) {
        const old = oldSettings.rows[0];
        const businessName = old.key === 'business_name' ? old.value : null;
        const address = old.key === 'address' ? old.value : null;
        const phone = old.key === 'phone' ? old.value : null;
        
        await db.execute({
          sql: "INSERT INTO settings (business_name, address, phone, logo, favicon) VALUES (?, ?, ?, ?, ?)",
          args: [businessName, address, phone, null, null]
        });
        addLog('Data migrated successfully');
      }
      
      // Drop old table
      await db.execute("DROP TABLE settings_old");
      addLog('Old table dropped');
    }
    
    // Verify new structure
    const newTableInfo = await db.execute("PRAGMA table_info(settings)");
    addLog('\nNew settings table structure:');
    addLog(JSON.stringify(newTableInfo.rows, null, 2));
    
    // Get current settings
    const settings = await db.execute("SELECT * FROM settings LIMIT 1");
    addLog('\nCurrent settings:');
    addLog(JSON.stringify(settings.rows, null, 2));
    
  } catch (e) {
    addLog('ERROR: ' + e.message);
    addLog(e.stack);
  }
  
  fs.writeFileSync('fix-log.txt', log);
  addLog('\nDone! Written to fix-log.txt');
})();
