import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDb } from '../db/database';
import { authMiddleware, AuthRequest } from './auth.middleware';

const router = Router();

function getAdminPassword(): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").get() as { value: string } | undefined;
  return row?.value || null;
}

function setAdminPassword(hash: string): void {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password_hash', ?)").run(hash);
}

function isSetupComplete(): boolean {
  return getAdminPassword() !== null;
}

// Kontrola jestli je potřeba setup
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    setup_complete: isSetupComplete(),
  });
});

// Prvotní nastavení hesla
router.post('/setup', async (req: Request, res: Response) => {
  if (isSetupComplete()) {
    res.status(400).json({ error: 'Setup již byl proveden.' });
    return;
  }

  const { password } = req.body;
  if (!password || password.length < 6) {
    res.status(400).json({ error: 'Heslo musí mít alespoň 6 znaků.' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  setAdminPassword(hash);

  const token = jwt.sign({ sub: 'admin' }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, token });
});

// Přihlášení
router.post('/login', async (req: Request, res: Response) => {
  if (!isSetupComplete()) {
    res.status(400).json({ error: 'Je nutné nejprve provést setup.' });
    return;
  }

  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: 'Zadejte heslo.' });
    return;
  }

  const hash = getAdminPassword()!;
  const match = await bcrypt.compare(password, hash);
  if (!match) {
    res.status(401).json({ error: 'Nesprávné heslo.' });
    return;
  }

  const token = jwt.sign({ sub: 'admin' }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({ success: true, token });
});

// Odhlášení
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Ověření přihlášení
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.userId });
});

// Změna hesla
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Vyplňte obě hesla.' });
    return;
  }

  if (new_password.length < 6) {
    res.status(400).json({ error: 'Nové heslo musí mít alespoň 6 znaků.' });
    return;
  }

  const hash = getAdminPassword()!;
  const match = await bcrypt.compare(current_password, hash);
  if (!match) {
    res.status(401).json({ error: 'Aktuální heslo je nesprávné.' });
    return;
  }

  const newHash = await bcrypt.hash(new_password, 12);
  setAdminPassword(newHash);

  res.json({ success: true });
});

export default router;
