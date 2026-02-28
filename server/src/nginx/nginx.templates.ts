import { Site } from '../sites/sites.types';

function buildServerNames(site: Site): string {
  const names = [site.domain, ...site.aliases];
  return names.join(' ');
}

function buildSslBlock(site: Site): string {
  if (!site.ssl_enabled) return '';
  const certPath = site.ssl_cert_path || `/etc/letsencrypt/live/${site.domain}/fullchain.pem`;
  const keyPath = site.ssl_key_path || `/etc/letsencrypt/live/${site.domain}/privkey.pem`;
  const sslInclude = site.config.common.ssl_include || '/etc/letsencrypt/options-ssl-nginx.conf';
  const sslDhparam = site.config.common.ssl_dhparam || '/etc/letsencrypt/ssl-dhparams.pem';

  return `
    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    include ${sslInclude};
    ssl_dhparam ${sslDhparam};`;
}

function buildCommonBlock(site: Site): string {
  const common = site.config.common;
  const lines: string[] = [];

  if (common.client_max_body_size && common.client_max_body_size !== '1m') {
    lines.push(`    client_max_body_size ${common.client_max_body_size};`);
  }

  if (common.gzip_enabled) {
    lines.push(`
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;`);
  }

  if (common.access_log) {
    lines.push(`    access_log ${common.access_log};`);
  }

  if (common.error_log) {
    lines.push(`    error_log ${common.error_log};`);
  }

  for (const header of common.custom_headers) {
    lines.push(`    add_header ${header.name} "${header.value}";`);
  }

  if (common.rate_limiting) {
    lines.push(`    limit_req zone=hostingy_${site.domain.replace(/[.\-]/g, '_')} burst=20 nodelay;`);
  }

  return lines.join('\n');
}

function buildCustomLocations(site: Site): string {
  const locations = site.config.common.custom_locations;
  if (!locations || locations.length === 0) return '';

  return locations.map(loc => {
    const indented = loc.directives
      .split('\n')
      .map(line => `        ${line.trim()}`)
      .join('\n');
    return `
    location ${loc.path} {
${indented}
    }`;
  }).join('\n');
}

function buildHttpRedirect(site: Site): string {
  if (!site.ssl_enabled) return '';
  const serverNames = buildServerNames(site);

  // Generujeme Certbot-style redirect bloky pro každou doménu
  const allDomains = [site.domain, ...site.aliases];
  const ifBlocks = allDomains.map(d => `    if ($host = ${d}) {
        return 301 https://$host$request_uri;
    }`).join('\n\n');

  return `
server {
${ifBlocks}

    server_name ${serverNames};

    listen 80;
    listen [::]:80;
    return 404;
}
`;
}

function buildProxyConfig(site: Site): string {
  const proxy = site.config.proxy!;

  let locationBlock = `
    location / {
        proxy_pass ${proxy.proxy_url};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;`;

  if (proxy.websocket_support) {
    locationBlock += `
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';`;
  } else {
    locationBlock += `
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;`;
  }

  if (!proxy.proxy_buffering) {
    locationBlock += `
        proxy_buffering off;`;
  }

  if (proxy.proxy_read_timeout !== 60) {
    locationBlock += `
        proxy_read_timeout ${proxy.proxy_read_timeout}s;`;
  }
  if (proxy.proxy_connect_timeout !== 60) {
    locationBlock += `
        proxy_connect_timeout ${proxy.proxy_connect_timeout}s;`;
  }
  if (proxy.proxy_send_timeout !== 60) {
    locationBlock += `
        proxy_send_timeout ${proxy.proxy_send_timeout}s;`;
  }

  locationBlock += `
    }`;

  return locationBlock;
}

function buildStaticConfig(site: Site): string {
  const static_ = site.config.static!;

  let block = `
    root ${static_.root_path};
    index ${static_.index_files};`;

  if (static_.spa_mode) {
    block += `

    location / {
        try_files $uri $uri/ /index.html;
    }`;
  } else if (static_.directory_listing) {
    block += `

    location / {
        autoindex on;
        autoindex_exact_size off;
        autoindex_localtime on;
    }`;
  }

  return block;
}

function buildPhpConfig(site: Site): string {
  const php = site.config.php!;

  // Zjistit jestli je to unix socket nebo TCP
  let fastcgiPass: string;
  if (php.php_fpm_socket.startsWith('/') || php.php_fpm_socket.startsWith('unix:')) {
    fastcgiPass = php.php_fpm_socket.startsWith('unix:')
      ? php.php_fpm_socket
      : `unix:${php.php_fpm_socket}`;
  } else {
    fastcgiPass = php.php_fpm_socket; // TCP host:port (např. 172.25.0.2:9000)
  }

  // Root pro fastcgi může být jiný než hlavní root
  const fastcgiRoot = php.fastcgi_root || php.root_path;
  const useCustomFastcgiRoot = php.fastcgi_root && php.fastcgi_root !== php.root_path;

  let block = `
    root ${php.root_path};
    index ${php.index_files};

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        fastcgi_pass ${fastcgiPass};`;

  if (useCustomFastcgiRoot) {
    block += `
        root ${fastcgiRoot};`;
  }

  block += `
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_buffers 16 16k;
        fastcgi_buffer_size 32k;`;

  // Timeouty
  if (php.fastcgi_read_timeout !== 60) {
    block += `
        fastcgi_read_timeout ${php.fastcgi_read_timeout};`;
  }
  if (php.fastcgi_connect_timeout !== 60) {
    block += `
        fastcgi_connect_timeout ${php.fastcgi_connect_timeout};`;
  }
  if (php.fastcgi_send_timeout !== 60) {
    block += `
        fastcgi_send_timeout ${php.fastcgi_send_timeout};`;
  }

  block += `
    }

    location ~ /\\.ht {
        deny all;
    }`;

  return block;
}

export function generateNginxConfig(site: Site): string {
  const serverNames = buildServerNames(site);
  const listenPort = site.ssl_enabled ? '443 ssl' : '80';
  const listenPortV6 = site.ssl_enabled ? '[::]:443 ssl' : '[::]:80';

  let typeBlock = '';
  switch (site.type) {
    case 'proxy':
      typeBlock = buildProxyConfig(site);
      break;
    case 'static':
      typeBlock = buildStaticConfig(site);
      break;
    case 'php':
      typeBlock = buildPhpConfig(site);
      break;
  }

  const rateLimitZone = site.config.common.rate_limiting
    ? `limit_req_zone $binary_remote_addr zone=hostingy_${site.domain.replace(/[.\-]/g, '_')}:10m rate=${site.config.common.rate_limit_zone};\n\n`
    : '';

  const customDirectives = site.config.common.custom_directives
    ? `\n    # Vlastni direktivy\n    ${site.config.common.custom_directives}\n`
    : '';

  const customLocations = buildCustomLocations(site);

  const config = `# Vygenerovano aplikaci Hostingy - ${new Date().toISOString()}
# Web: ${site.name} (${site.domain})
# Typ: ${site.type}
# NEUPRAVUJTE RUCNE - zmeny budou prepsany!

${rateLimitZone}server {
    server_name ${serverNames};

    listen ${listenPort};
    listen ${listenPortV6};
${buildSslBlock(site)}

${buildCommonBlock(site)}
${typeBlock}
${customLocations}
${customDirectives}
}
${buildHttpRedirect(site)}`;

  return config;
}

export function generateConfigFileName(site: Site): string {
  return `hostingy_${site.domain.replace(/[.\-]/g, '_')}.conf`;
}
