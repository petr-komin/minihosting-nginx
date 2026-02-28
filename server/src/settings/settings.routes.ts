import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { getDb } from '../db/database';

const router = Router();
router.use(authMiddleware);

interface SettingRow {
  key: string;
  value: string;
}

const ALLOWED_SETTINGS = [
  'certbot_email',
  'nginx_config_path',
  'nginx_sites_available',
  'nginx_sites_enabled',
  'auto_reload_default',
];

// Získat všechna nastavení
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all() as SettingRow[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    if (row.key !== 'admin_password_hash') {
      settings[row.key] = row.value;
    }
  }
  res.json(settings);
});

// Uložit nastavení
router.put('/', (req: Request, res: Response) => {
  const db = getDb();
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  const updates: Record<string, string> = req.body;
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_SETTINGS.includes(key)) {
        stmt.run(key, String(value));
      }
    }
  });

  transaction();
  res.json({ success: true });
});

export default router;
