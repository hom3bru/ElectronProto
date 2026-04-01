import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import * as path from 'path';

// In a real packaged app, this would use app.getPath('userData')
const dbPath = path.join(process.cwd(), 'local.db');

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
