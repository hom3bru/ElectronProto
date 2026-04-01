import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import * as path from 'path';

let dbPath = path.join(process.cwd(), 'local.db');

try {
  const electron = require('electron');
  // Only use userData in production or if explicitly told
  if (electron.app && electron.app.isPackaged) {
    dbPath = path.join(electron.app.getPath('userData'), 'local.db');
  }
} catch (e) {
  // Not running in Electron or app not ready
}

console.log(`[DB] Using database at: ${dbPath}`);

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
