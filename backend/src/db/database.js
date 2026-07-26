import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_URL || './data/inventory.db';
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(backendRoot, dbPath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

export const db = new Database(resolvedPath);
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
db.exec(schema);
