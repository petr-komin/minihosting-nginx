import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'hostingy-dev-secret-change-in-production',
  jwtExpiresIn: 86400, // 24 hodin v sekundách
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'hostingy.db'),
  nginx: {
    configPath: process.env.NGINX_CONFIG_PATH || '/etc/nginx',
    sitesAvailable: process.env.NGINX_SITES_AVAILABLE || '/etc/nginx/sites-available',
    sitesEnabled: process.env.NGINX_SITES_ENABLED || '/etc/nginx/sites-enabled',
    binary: process.env.NGINX_BINARY || '/usr/sbin/nginx',
  },
  certbot: {
    binary: process.env.CERTBOT_BINARY || '/usr/bin/certbot',
    webroot: process.env.CERTBOT_WEBROOT || '/var/www/certbot',
  },
  clientDistPath: path.join(__dirname, '..', '..', 'client', 'dist'),
};
