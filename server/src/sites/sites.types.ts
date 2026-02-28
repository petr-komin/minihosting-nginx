import { z } from 'zod';

// === Vlastní location blok ===
export const CustomLocationSchema = z.object({
  path: z.string().min(1),       // např. "= /rur.css" nebo "~ \\.php$"
  directives: z.string().min(1), // raw nginx direktivy uvnitř location {}
});

// === Proxy konfigurace ===
export const ProxyConfigSchema = z.object({
  proxy_url: z.string().min(1),  // celá URL: http://localhost:3009, http://172.26.0.2, atd.
  websocket_support: z.boolean().default(false),
  proxy_buffering: z.boolean().default(true),
  proxy_read_timeout: z.number().min(1).default(60),
  proxy_connect_timeout: z.number().min(1).default(60),
  proxy_send_timeout: z.number().min(1).default(60),
});

// === Static konfigurace ===
export const StaticConfigSchema = z.object({
  root_path: z.string().min(1),
  index_files: z.string().default('index.html index.htm'),
  spa_mode: z.boolean().default(false),
  directory_listing: z.boolean().default(false),
});

// === PHP konfigurace ===
export const PhpConfigSchema = z.object({
  root_path: z.string().min(1),                          // hlavní root webu
  php_fpm_socket: z.string().min(1),                     // unix:/run/php/php8.2-fpm.sock nebo 172.25.0.2:9000
  index_files: z.string().default('index.php index.html'),
  fastcgi_root: z.string().optional(),                   // pokud fastcgi root je jiný než hlavní root
  fastcgi_read_timeout: z.number().min(1).default(300),
  fastcgi_connect_timeout: z.number().min(1).default(60),
  fastcgi_send_timeout: z.number().min(1).default(300),
});

// === Společná konfigurace ===
export const CommonConfigSchema = z.object({
  client_max_body_size: z.string().default('50m'),
  gzip_enabled: z.boolean().default(true),
  custom_headers: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).default([]),
  access_log: z.string().optional(),
  error_log: z.string().optional(),
  custom_locations: z.array(CustomLocationSchema).default([]),
  custom_directives: z.string().default(''),
  rate_limiting: z.boolean().default(false),
  rate_limit_zone: z.string().default('10r/s'),
  ssl_include: z.string().default('/etc/letsencrypt/options-ssl-nginx.conf'),
  ssl_dhparam: z.string().default('/etc/letsencrypt/ssl-dhparams.pem'),
});

// === Site schema ===
export const CreateSiteSchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().min(1).max(255),
  aliases: z.array(z.string()).default([]),
  type: z.enum(['proxy', 'static', 'php']),
  enabled: z.boolean().default(true),
  ssl_enabled: z.boolean().default(false),
  ssl_cert_path: z.string().optional(),
  ssl_key_path: z.string().optional(),
  auto_reload: z.boolean().default(false),
  config: z.object({
    proxy: ProxyConfigSchema.optional(),
    static: StaticConfigSchema.optional(),
    php: PhpConfigSchema.optional(),
    common: CommonConfigSchema.default({}),
  }),
});

export const UpdateSiteSchema = CreateSiteSchema.partial().extend({
  id: z.number().optional(),
});

export type CustomLocation = z.infer<typeof CustomLocationSchema>;
export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;
export type StaticConfig = z.infer<typeof StaticConfigSchema>;
export type PhpConfig = z.infer<typeof PhpConfigSchema>;
export type CommonConfig = z.infer<typeof CommonConfigSchema>;
export type CreateSiteInput = z.infer<typeof CreateSiteSchema>;
export type UpdateSiteInput = z.infer<typeof UpdateSiteSchema>;

export interface Site {
  id: number;
  name: string;
  domain: string;
  aliases: string[];
  type: 'proxy' | 'static' | 'php';
  enabled: boolean;
  ssl_enabled: boolean;
  ssl_cert_path: string | null;
  ssl_key_path: string | null;
  config: {
    proxy?: ProxyConfig;
    static?: StaticConfig;
    php?: PhpConfig;
    common: CommonConfig;
  };
  auto_reload: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteRow {
  id: number;
  name: string;
  domain: string;
  aliases: string;
  type: string;
  enabled: number;
  ssl_enabled: number;
  ssl_cert_path: string | null;
  ssl_key_path: string | null;
  config: string;
  auto_reload: number;
  created_at: string;
  updated_at: string;
}
