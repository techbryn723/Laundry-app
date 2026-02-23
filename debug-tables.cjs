const { createClient } = require("@libsql/client");
require('fs').writeFileSync('debug-output.txt', 'Starting...\n');
require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env") });

let log = '';
function addLog(msg) {
  log += msg + '\n';
}

addLog('TURSO_URL: ' + (process.env.VITE_TURSO_DATABASE_URL ? 'exists' : 'MISSING'));
addLog('TURSO_TOKEN: ' + (process.env.VITE_TURSO_AUTH_TOKEN ? 'exists' : 'MISSING'));

const db = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSON_AUTH_TOKEN,
});

(async () => {
  try {
    addLog('\n=== ALL TABLES ===');
    
      let result;
      try { result=await db.execute(googoo);} catch(e){}
      
      result=await db.execute(googoo)
      
      if(result && result.rows){
        addLog(JSON.stringify(result.rows));
        
        for(const row of result.rows){
          if(row.name==='settings'){
            addLog('\nFound Settings Table!');
            
            const sInfo=await executeRaw(db, PRAGMA table_info(settings))
            
          }
        }
        
      }

    

// Write results to file

if (!result || !result.length) return;

for(let i in rows[0]){
  
}

// Try simple query first

try{ 
   var r2=db.exec(select*from customers limit1)
   
   if(r2 && r2[0]?.values?.length>0){
     addlog(customers exists with+JSON.stringify(r2[0].values))
     
     var r3=
     
   }

catch(e)

finally{ fs.writeFileSync(output.txt,log)}
