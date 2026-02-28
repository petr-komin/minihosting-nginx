import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import * as sslService from './ssl.service';
import * as sitesService from '../sites/sites.service';
import { getDb } from '../db/database';

const router = Router();
router.use(authMiddleware);

function getCertbotEmail(): string {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'certbot_email'").get() as { value: string } | undefined;
  return row?.value || '';
}

// Vygenerovat SSL certifikát
router.post('/:id/generate', async (req: Request, res: Response) => {
  const site = sitesService.getSiteById(Number(req.params.id));
  if (!site) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }

  const email = getCertbotEmail();
  if (!email) {
    res.status(400).json({ error: 'Není nastaven e-mail pro Certbot. Nastavte ho v Nastavení.' });
    return;
  }

  const method = req.body.method || 'nginx'; // 'nginx' nebo 'webroot'

  let result;
  if (method === 'webroot') {
    result = await sslService.generateCertificateWebroot(site.domain, site.aliases, email);
  } else {
    result = await sslService.generateCertificate(site.domain, site.aliases, email);
  }

  if (result.success) {
    // Aktualizovat site s SSL cestami
    sitesService.updateSite(site.id, {
      ssl_enabled: true,
      ssl_cert_path: `/etc/letsencrypt/live/${site.domain}/fullchain.pem`,
      ssl_key_path: `/etc/letsencrypt/live/${site.domain}/privkey.pem`,
    });
  }

  res.json(result);
});

// Obnovit certifikát
router.post('/:id/renew', async (req: Request, res: Response) => {
  const site = sitesService.getSiteById(Number(req.params.id));
  if (!site) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }

  const result = await sslService.renewCertificate(site.domain);
  res.json(result);
});

// Info o certifikátu
router.get('/:id/info', async (req: Request, res: Response) => {
  const site = sitesService.getSiteById(Number(req.params.id));
  if (!site) {
    res.status(404).json({ error: 'Web nenalezen.' });
    return;
  }

  const info = await sslService.getCertificateInfo(site.domain);
  res.json(info);
});

export default router;
