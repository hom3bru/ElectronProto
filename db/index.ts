import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import * as path from 'path';

let dbPath = path.join(process.cwd(), 'local.db');

try {
  const { app } = require('electron');
  if (app) {
    dbPath = path.join(app.getPath('userData'), 'local.db');
  }
} catch (e) {
  // Not running in Electron
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
