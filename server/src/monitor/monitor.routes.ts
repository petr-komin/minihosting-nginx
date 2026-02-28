import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { getServerStats } from './monitor.service';

const router = Router();
router.use(authMiddleware);

// Získat kompletní stav serveru
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getServerStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chyba při získávání stavu serveru.' });
  }
});

export default router;
