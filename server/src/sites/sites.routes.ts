import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { CreateSiteSchema, UpdateSiteSchema } from './sites.types';
import * as sitesService from './sites.service';
import { generateNginxConfig } from '../nginx/nginx.templates';
import { writeNginxConfig, removeNginxConfig, reloadNginx, isConfigDeployed } from '../nginx/nginx.service';

const router = Router();
router.use(authMiddleware);

// Seznam všech webů
router.get('/', (_req: Request, res: Response) => {
  const sites = sitesService.getAllSites();
  res.json(sites);
});

// Detail webu
router.get('/:id', (req: Request, res: Response) => {
  const site = sitesService.getSiteById(Number(req.params.id));
  if (!site) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }
  res.json(site);
});

// Náhled Nginx konfigurace
router.get('/:id/preview', (req: Request, res: Response) => {
  const site = sitesService.getSiteById(Number(req.params.id));
  if (!site) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }
  const config = generateNginxConfig(site);
  res.json({ config });
});

// Náhled Nginx konfigurace bez uložení (z formuláře)
router.post('/preview', (req: Request, res: Response) => {
  const parsed = CreateSiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Neplatná data.', details: parsed.error.flatten() });
    return;
  }

  // Vytvořit fake site objekt pro generování
  const fakeSite = {
    id: 0,
    ...parsed.data,
    ssl_cert_path: parsed.data.ssl_cert_path || null,
    ssl_key_path: parsed.data.ssl_key_path || null,
    auto_reload: parsed.data.auto_reload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const config = generateNginxConfig(fakeSite);
  res.json({ config });
});

// Stav nasazení Nginx konfigurace pro web
router.get('/:id/status', (req: Request, res: Response) => {
  const site = sitesService.getSiteById(Number(req.params.id));
  if (!site) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }
  res.json({
    config_deployed: isConfigDeployed(site),
    enabled: site.enabled,
    ssl_enabled: site.ssl_enabled,
  });
});

// Vytvořit web
router.post('/', async (req: Request, res: Response) => {
  const parsed = CreateSiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Neplatná data.', details: parsed.error.flatten() });
    return;
  }

  // Zkontrolovat unikátní doménu
  const existing = sitesService.getSiteByDomain(parsed.data.domain);
  if (existing) {
    res.status(409).json({ error: `Doména ${parsed.data.domain} je již zaregistrována.` });
    return;
  }

  const site = sitesService.createSite(parsed.data);

  try {
    writeNginxConfig(site);
    if (site.auto_reload) {
      await reloadNginx();
    }
  } catch (err) {
    // Nginx zápis selhal, ale web je vytvořen v DB
    console.error('Chyba při zápisu Nginx konfigurace:', err);
  }

  res.status(201).json(site);
});

// Upravit web
router.put('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = sitesService.getSiteById(id);
  if (!existing) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }

  const parsed = UpdateSiteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Neplatná data.', details: parsed.error.flatten() });
    return;
  }

  // Pokud se mění doména, zkontrolovat unikátnost
  if (parsed.data.domain && parsed.data.domain !== existing.domain) {
    const domainExists = sitesService.getSiteByDomain(parsed.data.domain);
    if (domainExists) {
      res.status(409).json({ error: `Doména ${parsed.data.domain} je již zaregistrována.` });
      return;
    }
  }

  const site = sitesService.updateSite(id, parsed.data);
  if (!site) {
    res.status(500).json({ error: 'Nepodařilo se aktualizovat web.' });
    return;
  }

  try {
    // Pokud se změnila doména, smazat starý config
    if (parsed.data.domain && parsed.data.domain !== existing.domain) {
      removeNginxConfig(existing);
    }
    writeNginxConfig(site);
    if (site.auto_reload) {
      await reloadNginx();
    }
  } catch (err) {
    console.error('Chyba při zápisu Nginx konfigurace:', err);
  }

  res.json(site);
});

// Smazat web
router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = sitesService.getSiteById(id);
  if (!existing) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }

  try {
    removeNginxConfig(existing);
  } catch (err) {
    console.error('Chyba při mazání Nginx konfigurace:', err);
  }

  sitesService.deleteSite(id);

  if (existing.auto_reload) {
    await reloadNginx();
  }

  res.json({ success: true });
});

// Aktivovat web
router.post('/:id/enable', async (req: Request, res: Response) => {
  const site = sitesService.toggleSite(Number(req.params.id), true);
  if (!site) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }

  try {
    writeNginxConfig(site);
    if (site.auto_reload) {
      await reloadNginx();
    }
  } catch (err) {
    console.error('Chyba při aktivaci Nginx konfigurace:', err);
  }

  res.json(site);
});

// Deaktivovat web
router.post('/:id/disable', async (req: Request, res: Response) => {
  const site = sitesService.toggleSite(Number(req.params.id), false);
  if (!site) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }

  try {
    writeNginxConfig(site);
    if (site.auto_reload) {
      await reloadNginx();
    }
  } catch (err) {
    console.error('Chyba při deaktivaci Nginx konfigurace:', err);
  }

  res.json(site);
});

export default router;
