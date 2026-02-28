import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { parseNginxConfig, ScannedSite } from './nginx.parser';
import * as sitesService from '../sites/sites.service';
import { CreateSiteInput } from '../sites/sites.types';

/**
 * Naskenuje sites-available i sites-enabled adresáře a vrátí seznam nalezených webů.
 * Deduplikuje podle reálné cesty souboru (symlinky se resolvují).
 * Označí ty, které už v DB existují (podle domény).
 */
export function scanExistingConfigs(): ScannedSite[] {
  const dirs: { dir: string; label: 'sites-available' | 'sites-enabled' }[] = [
    { dir: config.nginx.sitesAvailable, label: 'sites-available' },
    { dir: config.nginx.sitesEnabled, label: 'sites-enabled' },
  ];

  // Mapa: realPath -> { fileName, content, sources[] }
  const fileMap = new Map<string, { fileName: string; content: string; sources: ('sites-available' | 'sites-enabled')[] }>();

  for (const { dir, label } of dirs) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => {
      const fullPath = path.join(dir, f);
      try {
        return fs.statSync(fullPath).isFile();
      } catch {
        return false;
      }
    });

    for (const fileName of files) {
      const fullPath = path.join(dir, fileName);
      try {
        const realPath = fs.realpathSync(fullPath);
        const existing = fileMap.get(realPath);
        if (existing) {
          // Soubor už známe z druhého adresáře — přidat zdroj
          if (!existing.sources.includes(label)) {
            existing.sources.push(label);
          }
        } else {
          const content = fs.readFileSync(realPath, 'utf-8');
          fileMap.set(realPath, { fileName, content, sources: [label] });
        }
      } catch (err) {
        console.error(`Chyba při čtení ${fullPath}:`, err);
      }
    }
  }

  const allScanned: ScannedSite[] = [];

  for (const { fileName, content, sources } of fileMap.values()) {
    try {
      const parsed = parseNginxConfig(content, fileName);
      const source: ScannedSite['source'] = sources.length === 2 ? 'oba' : sources[0];

      for (const site of parsed) {
        const existing = sitesService.getSiteByDomain(site.domain);
        allScanned.push({
          ...site,
          source,
          alreadyExists: !!existing,
        });
      }
    } catch (err) {
      console.error(`Chyba při parsování ${fileName}:`, err);
    }
  }

  return allScanned;
}

/**
 * Importuje vybrané weby do DB.
 * Vrací výsledky importu pro každou doménu.
 */
export function importSites(domains: string[], scannedSites: ScannedSite[]): ImportResult[] {
  const results: ImportResult[] = [];

  for (const domain of domains) {
    const scanned = scannedSites.find(s => s.domain === domain);
    if (!scanned) {
      results.push({ domain, success: false, error: 'Web nebyl nalezen ve výsledcích skenování.' });
      continue;
    }

    if (scanned.alreadyExists) {
      results.push({ domain, success: false, error: 'Web s touto doménou již v databázi existuje.' });
      continue;
    }

    if (scanned.isHostingyManaged) {
      results.push({ domain, success: false, error: 'Tento config je již spravován Hostingy.' });
      continue;
    }

    try {
      const input: CreateSiteInput = {
        name: domain,
        domain: scanned.domain,
        aliases: scanned.aliases,
        type: scanned.type,
        enabled: true,
        ssl_enabled: scanned.ssl_enabled,
        ssl_cert_path: scanned.ssl_cert_path,
        ssl_key_path: scanned.ssl_key_path,
        auto_reload: false,
        config: scanned.config,
      };

      const site = sitesService.createSite(input);

      // Při importu NEZAPISUJEME hostingy_*.conf — původní config je stále aktivní.
      // Uživatel může později přepnout správu na Hostingy přes editaci webu.

      results.push({ domain, success: true, siteId: site.id });
    } catch (err: any) {
      results.push({ domain, success: false, error: err.message || String(err) });
    }
  }

  return results;
}

export interface ImportResult {
  domain: string;
  success: boolean;
  error?: string;
  siteId?: number;
}
