import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(config.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initializeDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      domain TEXT NOT NULL UNIQUE,
      aliases TEXT DEFAULT '[]',
      type TEXT NOT NULL CHECK(type IN ('proxy', 'static', 'php')),
      enabled INTEGER NOT NULL DEFAULT 1,
      ssl_enabled INTEGER NOT NULL DEFAULT 0,
      ssl_cert_path TEXT,
      ssl_key_path TEXT,
      config TEXT NOT NULL DEFAULT '{}',
      auto_reload INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
