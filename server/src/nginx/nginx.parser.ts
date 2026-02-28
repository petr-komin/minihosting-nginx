import { CreateSiteInput } from '../sites/sites.types';

/**
 * Parsuje Nginx konfigurační soubor a extrahuje server bloky.
 * Vrací pole naparsovaných site objektů připravených k importu.
 */

interface ParsedServerBlock {
  raw: string;
  serverNames: string[];
  listenDirectives: string[];
  isHttpRedirect: boolean;
  isSsl: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;
  sslInclude?: string;
  sslDhparam?: string;
  root?: string;
  index?: string;
  proxyPass?: string;
  websocket: boolean;
  fastcgiPass?: string;
  fastcgiRoot?: string;
  fastcgiReadTimeout?: number;
  fastcgiConnectTimeout?: number;
  fastcgiSendTimeout?: number;
  clientMaxBodySize?: string;
  accessLog?: string;
  errorLog?: string;
  customLocations: { path: string; directives: string }[];
  unrecognizedDirectives: string[];
}

export interface ScannedSite {
  fileName: string;
  domain: string;
  aliases: string[];
  type: 'proxy' | 'static' | 'php';
  ssl_enabled: boolean;
  ssl_cert_path?: string;
  ssl_key_path?: string;
  config: CreateSiteInput['config'];
  alreadyExists: boolean;
  isHostingyManaged: boolean;
  /** Kde byl config nalezen: 'sites-available', 'sites-enabled', nebo 'oba' */
  source: 'sites-available' | 'sites-enabled' | 'oba';
}

/**
 * Extrahuje server {} bloky z Nginx config souboru.
 * Zvládá vnořené {} (location bloky uvnitř server bloku).
 */
function extractServerBlocks(content: string): string[] {
  const blocks: string[] = [];
  let i = 0;

  while (i < content.length) {
    // Najít 'server' keyword následovaný '{'
    const serverMatch = content.indexOf('server', i);
    if (serverMatch === -1) break;

    // Ověřit, že je to skutečně 'server {' a ne 'server_name' apod.
    const afterServer = content.substring(serverMatch + 6).trimStart();
    if (!afterServer.startsWith('{')) {
      i = serverMatch + 6;
      continue;
    }

    // Najít odpovídající uzavírací závorku
    const openBrace = content.indexOf('{', serverMatch + 6);
    if (openBrace === -1) break;

    let depth = 1;
    let j = openBrace + 1;
    while (j < content.length && depth > 0) {
      if (content[j] === '{') depth++;
      if (content[j] === '}') depth--;
      j++;
    }

    if (depth === 0) {
      blocks.push(content.substring(openBrace + 1, j - 1));
    }

    i = j;
  }

  return blocks;
}

/**
 * Parsuje jeden server {} blok.
 */
function parseServerBlock(blockContent: string): ParsedServerBlock {
  const result: ParsedServerBlock = {
    raw: blockContent,
    serverNames: [],
    listenDirectives: [],
    isHttpRedirect: false,
    isSsl: false,
    websocket: false,
    customLocations: [],
    unrecognizedDirectives: [],
  };

  // Detekce HTTP redirect bloků (Certbot managed)
  if (blockContent.includes('return 301 https://') || blockContent.includes('return 404')) {
    const hasIf = blockContent.includes('if ($host');
    const hasListen80 = /listen\s+(\[::\]:)?80/.test(blockContent);
    if (hasIf && hasListen80) {
      result.isHttpRedirect = true;
    }
  }

  // Extrahovat location bloky zvlášť, parsovat zbytek jako top-level direktivy
  const locations: { path: string; content: string }[] = [];
  let processed = blockContent;

  // Extrahovat location bloky
  const locationRegex = /location\s+([^\{]+)\{/g;
  let match;
  while ((match = locationRegex.exec(blockContent)) !== null) {
    const locPath = match[1].trim();
    const locStart = match.index + match[0].length;
    let depth = 1;
    let k = locStart;
    while (k < blockContent.length && depth > 0) {
      if (blockContent[k] === '{') depth++;
      if (blockContent[k] === '}') depth--;
      k++;
    }
    const locContent = blockContent.substring(locStart, k - 1).trim();
    locations.push({ path: locPath, content: locContent });

    // Nahradit location blok v processed řetězci placeholder textem
    const fullLoc = blockContent.substring(match.index, k);
    processed = processed.replace(fullLoc, '');
  }

  // Parsovat top-level direktivy
  const lines = processed.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  for (const line of lines) {
    const clean = line.replace(/#.*$/, '').trim(); // Odstranit komentáře
    if (!clean || clean === '}' || clean === '{') continue;

    // server_name
    const snMatch = clean.match(/^server_name\s+(.+);$/);
    if (snMatch) {
      result.serverNames = snMatch[1].split(/\s+/).filter(n => n !== '_');
      continue;
    }

    // listen
    const listenMatch = clean.match(/^listen\s+(.+);$/);
    if (listenMatch) {
      result.listenDirectives.push(listenMatch[1]);
      if (listenMatch[1].includes('ssl')) {
        result.isSsl = true;
      }
      continue;
    }

    // ssl_certificate
    const certMatch = clean.match(/^ssl_certificate\s+(.+);$/);
    if (certMatch) {
      result.sslCertPath = certMatch[1];
      result.isSsl = true;
      continue;
    }

    // ssl_certificate_key
    const keyMatch = clean.match(/^ssl_certificate_key\s+(.+);$/);
    if (keyMatch) {
      result.sslKeyPath = keyMatch[1];
      continue;
    }

    // include (SSL options)
    const includeMatch = clean.match(/^include\s+(.+);$/);
    if (includeMatch) {
      if (includeMatch[1].includes('ssl')) {
        result.sslInclude = includeMatch[1];
      }
      // include fastcgi_params se zpracuje v location bloku
      continue;
    }

    // ssl_dhparam
    const dhMatch = clean.match(/^ssl_dhparam\s+(.+);$/);
    if (dhMatch) {
      result.sslDhparam = dhMatch[1];
      continue;
    }

    // root
    const rootMatch = clean.match(/^root\s+(.+);$/);
    if (rootMatch) {
      result.root = rootMatch[1];
      continue;
    }

    // index
    const indexMatch = clean.match(/^index\s+(.+);$/);
    if (indexMatch) {
      result.index = indexMatch[1];
      continue;
    }

    // client_max_body_size
    const cmbsMatch = clean.match(/^client_max_body_size\s+(.+);$/);
    if (cmbsMatch) {
      result.clientMaxBodySize = cmbsMatch[1];
      continue;
    }

    // access_log
    const alMatch = clean.match(/^access_log\s+(.+);$/);
    if (alMatch) {
      result.accessLog = alMatch[1];
      continue;
    }

    // error_log
    const elMatch = clean.match(/^error_log\s+(.+);$/);
    if (elMatch) {
      result.errorLog = elMatch[1];
      continue;
    }

    // if bloky ($host redirect) — přeskočit
    if (clean.startsWith('if (') || clean === 'return 301' || clean.startsWith('return ')) {
      continue;
    }

    // Cokoliv nerozpoznaného
    if (clean !== ';') {
      result.unrecognizedDirectives.push(clean);
    }
  }

  // Parsovat location bloky
  for (const loc of locations) {
    // location / s proxy_pass => proxy konfigurace
    if (loc.path === '/') {
      const ppMatch = loc.content.match(/proxy_pass\s+([^;]+);/);
      if (ppMatch) {
        result.proxyPass = ppMatch[1].trim();
        // Detekce WebSocket
        if (loc.content.includes('Upgrade') && loc.content.includes("'upgrade'")) {
          result.websocket = true;
        }
        continue;
      }

      // location / s try_files => statický nebo PHP (zpracuje se později)
      if (loc.content.includes('try_files')) {
        continue; // Standardní try_files, neukládáme jako custom location
      }
    }

    // location ~ \.php$ => PHP FastCGI
    if (loc.path.includes('\\.php')) {
      const fpMatch = loc.content.match(/fastcgi_pass\s+([^;]+);/);
      if (fpMatch) {
        result.fastcgiPass = fpMatch[1].trim();
      }
      const frMatch = loc.content.match(/^\s*root\s+([^;]+);/m);
      if (frMatch) {
        result.fastcgiRoot = frMatch[1].trim();
      }
      const frtMatch = loc.content.match(/fastcgi_read_timeout\s+(\d+)/);
      if (frtMatch) {
        result.fastcgiReadTimeout = parseInt(frtMatch[1]);
      }
      const fctMatch = loc.content.match(/fastcgi_connect_timeout\s+(\d+)/);
      if (fctMatch) {
        result.fastcgiConnectTimeout = parseInt(fctMatch[1]);
      }
      const fstMatch = loc.content.match(/fastcgi_send_timeout\s+(\d+)/);
      if (fstMatch) {
        result.fastcgiSendTimeout = parseInt(fstMatch[1]);
      }
      continue;
    }

    // Ostatní location bloky => custom locations
    // Ale ne location / (ty už byly zpracovány výše)
    if (loc.path !== '/') {
      // Zkontrolovat jestli to má fastcgi_pass (custom PHP endpoint)
      result.customLocations.push({
        path: loc.path,
        directives: loc.content
          .split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'))
          .join('\n'),
      });
    }
  }

  return result;
}

/**
 * Detekuje typ webu z naparsovaného server bloku.
 */
function detectSiteType(block: ParsedServerBlock): 'proxy' | 'static' | 'php' {
  if (block.proxyPass) return 'proxy';
  if (block.fastcgiPass) return 'php';
  return 'static';
}

/**
 * Převede naparsovaný server blok na CreateSiteInput konfiguraci.
 */
function blockToSiteConfig(block: ParsedServerBlock): CreateSiteInput['config'] {
  const type = detectSiteType(block);

  const common: CreateSiteInput['config']['common'] = {
    client_max_body_size: block.clientMaxBodySize || '50m',
    gzip_enabled: false,
    custom_headers: [],
    custom_locations: block.customLocations,
    custom_directives: block.unrecognizedDirectives.join('\n'),
    rate_limiting: false,
    rate_limit_zone: '10r/s',
    ssl_include: block.sslInclude || '/etc/letsencrypt/options-ssl-nginx.conf',
    ssl_dhparam: block.sslDhparam || '/etc/letsencrypt/ssl-dhparams.pem',
  };

  if (block.accessLog) {
    common.access_log = block.accessLog;
  }
  if (block.errorLog) {
    common.error_log = block.errorLog;
  }

  const config: CreateSiteInput['config'] = { common };

  if (type === 'proxy' && block.proxyPass) {
    config.proxy = {
      proxy_url: block.proxyPass,
      websocket_support: block.websocket,
      proxy_buffering: true,
      proxy_read_timeout: 60,
      proxy_connect_timeout: 60,
      proxy_send_timeout: 60,
    };
  }

  if (type === 'static') {
    config.static = {
      root_path: block.root || '/var/www/html',
      index_files: block.index || 'index.html index.htm',
      spa_mode: false,
      directory_listing: false,
    };
  }

  if (type === 'php') {
    config.php = {
      root_path: block.root || '/var/www/html',
      php_fpm_socket: block.fastcgiPass || '127.0.0.1:9000',
      index_files: block.index || 'index.php index.html',
      fastcgi_root: block.fastcgiRoot && block.fastcgiRoot !== block.root ? block.fastcgiRoot : undefined,
      fastcgi_read_timeout: block.fastcgiReadTimeout || 300,
      fastcgi_connect_timeout: block.fastcgiConnectTimeout || 60,
      fastcgi_send_timeout: block.fastcgiSendTimeout || 300,
    };
  }

  return config;
}

/**
 * Hlavní funkce: parsuje celý Nginx config soubor a vrací pole ScannedSite.
 */
export function parseNginxConfig(content: string, fileName: string): Omit<ScannedSite, 'alreadyExists' | 'source'>[] {
  const serverBlocks = extractServerBlocks(content);
  const parsedBlocks = serverBlocks.map(parseServerBlock);

  // Filtrovat — vzít jen hlavní server bloky (ne HTTP redirect bloky)
  const mainBlocks = parsedBlocks.filter(b => !b.isHttpRedirect && b.serverNames.length > 0);

  const isHostingyManaged = fileName.startsWith('hostingy_');

  return mainBlocks.map(block => {
    const domain = block.serverNames[0];
    const aliases = block.serverNames.slice(1);
    const type = detectSiteType(block);

    return {
      fileName,
      domain,
      aliases,
      type,
      ssl_enabled: block.isSsl,
      ssl_cert_path: block.sslCertPath,
      ssl_key_path: block.sslKeyPath,
      config: blockToSiteConfig(block),
      isHostingyManaged,
    };
  });
}
