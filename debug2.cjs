const { createClient } = require("@libsql/client");
const fs = require('fs');
require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env") });

let log = '';
function addLog(msg) {
  log += msg + '\n';
  console.log(msg);
}

addLog('TURSO_URL: ' + (process.env.VITE_TURSO_DATABASE_URL ? 'exists' : 'MISSING'));
addLog('TURSO_TOKEN: ' + (process.env.VITE_TURSO_AUTH_TOKEN ? 'exists' : 'MISSING'));

const db = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN,
});

(async () => {
  try {
    // Get all tables
    const tablesResult = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
    addLog('\n=== ALL TABLES ===');
    addLog(JSON.stringify(tablesResult.rows, null, 2));
    
    // Get settings table info
    try {
      const settingsInfo = await db.execute("PRAGMA table_info(settings)");
      addLog('\n=== SETTINGS TABLE STRUCTURE ===');
      addLog(JSON.stringify(settingsInfo.rows, null, 2));
    } catch(e) {
      addLog('Error getting settings info: ' + e.message);
    }
    
    // Get settings data
    try {
      const settingsData = await db.execute("SELECT * FROM settings LIMIT 1");
      addLog('\n=== SETTINGS DATA ===');
      addLog(JSON.stringify(settingsData.rows, null, 2));
    } catch(e) {
      addLog('Error getting settings data: ' + e.message);
    }
    
  } catch (e) {
    addLog('ERROR: ' + e.message);
    addLog(e.stack);
  }
  
  // Write to file
  fs.writeFileSync('debug-output.txt', log);
  addLog('\nWritten to debug-output.txt');
})();
