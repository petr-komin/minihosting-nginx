import { getDb } from '../db/database';
import { Site, SiteRow, CreateSiteInput, UpdateSiteInput } from './sites.types';

function rowToSite(row: SiteRow): Site {
  return {
    ...row,
    aliases: JSON.parse(row.aliases),
    type: row.type as Site['type'],
    enabled: !!row.enabled,
    ssl_enabled: !!row.ssl_enabled,
    auto_reload: !!row.auto_reload,
    config: JSON.parse(row.config),
  };
}

export function getAllSites(): Site[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM sites ORDER BY name ASC').all() as SiteRow[];
  return rows.map(rowToSite);
}

export function getSiteById(id: number): Site | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as SiteRow | undefined;
  return row ? rowToSite(row) : null;
}

export function getSiteByDomain(domain: string): Site | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sites WHERE domain = ?').get(domain) as SiteRow | undefined;
  return row ? rowToSite(row) : null;
}

export function createSite(input: CreateSiteInput): Site {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sites (name, domain, aliases, type, enabled, ssl_enabled, ssl_cert_path, ssl_key_path, config, auto_reload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.name,
    input.domain,
    JSON.stringify(input.aliases),
    input.type,
    input.enabled ? 1 : 0,
    input.ssl_enabled ? 1 : 0,
    input.ssl_cert_path || null,
    input.ssl_key_path || null,
    JSON.stringify(input.config),
    input.auto_reload ? 1 : 0,
  );

  return getSiteById(result.lastInsertRowid as number)!;
}

export function updateSite(id: number, input: UpdateSiteInput): Site | null {
  const db = getDb();
  const existing = getSiteById(id);
  if (!existing) return null;

  const merged = {
    name: input.name ?? existing.name,
    domain: input.domain ?? existing.domain,
    aliases: input.aliases ?? existing.aliases,
    type: input.type ?? existing.type,
    enabled: input.enabled ?? existing.enabled,
    ssl_enabled: input.ssl_enabled ?? existing.ssl_enabled,
    ssl_cert_path: input.ssl_cert_path ?? existing.ssl_cert_path,
    ssl_key_path: input.ssl_key_path ?? existing.ssl_key_path,
    config: input.config ? { ...existing.config, ...input.config } : existing.config,
    auto_reload: input.auto_reload ?? existing.auto_reload,
  };

  const stmt = db.prepare(`
    UPDATE sites SET
      name = ?, domain = ?, aliases = ?, type = ?, enabled = ?,
      ssl_enabled = ?, ssl_cert_path = ?, ssl_key_path = ?, config = ?,
      auto_reload = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(
    merged.name,
    merged.domain,
    JSON.stringify(merged.aliases),
    merged.type,
    merged.enabled ? 1 : 0,
    merged.ssl_enabled ? 1 : 0,
    merged.ssl_cert_path || null,
    merged.ssl_key_path || null,
    JSON.stringify(merged.config),
    merged.auto_reload ? 1 : 0,
    id,
  );

  return getSiteById(id);
}

export function deleteSite(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM sites WHERE id = ?').run(id);
  return result.changes > 0;
}

export function toggleSite(id: number, enabled: boolean): Site | null {
  const db = getDb();
  db.prepare('UPDATE sites SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?').run(enabled ? 1 : 0, id);
  return getSiteById(id);
}
