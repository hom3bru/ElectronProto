const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'local.db');
console.log('Testing better-sqlite3 at', dbPath);
try {
  const db = new Database(dbPath);
  console.log('Success!');
  db.close();
} catch (e) {
  console.error('Failed:', e);
}
