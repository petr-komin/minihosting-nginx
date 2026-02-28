import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { getNginxStatus, testNginxConfig, reloadNginx } from './nginx.service';
import { scanExistingConfigs, importSites } from './nginx.import';

const router = Router();
router.use(authMiddleware);

router.get('/status', async (_req: Request, res: Response) => {
  const status = await getNginxStatus();
  res.json(status);
});

router.post('/test', async (_req: Request, res: Response) => {
  const result = await testNginxConfig();
  res.json(result);
});

router.post('/reload', async (_req: Request, res: Response) => {
  const result = await reloadNginx();
  res.json(result);
});

// Skenovat existující Nginx konfigurace v sites-available
router.get('/scan', (_req: Request, res: Response) => {
  try {
    const scanned = scanExistingConfigs();
    res.json(scanned);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chyba při skenování.' });
  }
});

// Importovat vybrané weby do DB
router.post('/import', (req: Request, res: Response) => {
  const { domains } = req.body;
  if (!Array.isArray(domains) || domains.length === 0) {
    res.status(400).json({ error: 'Zadejte pole domén k importu.' });
    return;
  }

  try {
    // Znovu naskenovat aby data byla čerstvá
    const scanned = scanExistingConfigs();
    const results = importSites(domains, scanned);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chyba při importu.' });
  }
});

export default router;
