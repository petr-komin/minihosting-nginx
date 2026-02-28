import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api/client';

export interface CustomLocation {
  path: string;
  directives: string;
}

export interface SiteConfig {
  proxy?: {
    proxy_url: string;
    websocket_support: boolean;
    proxy_buffering: boolean;
    proxy_read_timeout: number;
    proxy_connect_timeout: number;
    proxy_send_timeout: number;
  };
  static?: {
    root_path: string;
    index_files: string;
    spa_mode: boolean;
    directory_listing: boolean;
  };
  php?: {
    root_path: string;
    php_fpm_socket: string;
    index_files: string;
    fastcgi_root?: string;
    fastcgi_read_timeout: number;
    fastcgi_connect_timeout: number;
    fastcgi_send_timeout: number;
  };
  common: {
    client_max_body_size: string;
    gzip_enabled: boolean;
    custom_headers: { name: string; value: string }[];
    access_log?: string;
    error_log?: string;
    custom_locations: CustomLocation[];
    custom_directives: string;
    rate_limiting: boolean;
    rate_limit_zone: string;
    ssl_include: string;
    ssl_dhparam: string;
  };
}

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
  config: SiteConfig;
  auto_reload: boolean;
  created_at: string;
  updated_at: string;
}

export function getDefaultConfig(type: 'proxy' | 'static' | 'php'): SiteConfig {
  const common = {
    client_max_body_size: '50m',
    gzip_enabled: true,
    custom_headers: [],
    custom_locations: [],
    custom_directives: '',
    rate_limiting: false,
    rate_limit_zone: '10r/s',
    ssl_include: '/etc/letsencrypt/options-ssl-nginx.conf',
    ssl_dhparam: '/etc/letsencrypt/ssl-dhparams.pem',
  };

  switch (type) {
    case 'proxy':
      return {
        proxy: {
          proxy_url: 'http://localhost:3000',
          websocket_support: false,
          proxy_buffering: true,
          proxy_read_timeout: 60,
          proxy_connect_timeout: 60,
          proxy_send_timeout: 60,
        },
        common,
      };
    case 'static':
      return {
        static: {
          root_path: '/var/www/html',
          index_files: 'index.html index.htm',
          spa_mode: false,
          directory_listing: false,
        },
        common,
      };
    case 'php':
      return {
        php: {
          root_path: '/var/www/html',
          php_fpm_socket: '127.0.0.1:9000',
          index_files: 'index.php index.html',
          fastcgi_root: '',
          fastcgi_read_timeout: 300,
          fastcgi_connect_timeout: 60,
          fastcgi_send_timeout: 300,
        },
        common,
      };
  }
}

export const useSitesStore = defineStore('sites', () => {
  const sites = ref<Site[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchSites() {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.get('/sites');
      sites.value = data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Nepodarilo se nacist weby.';
    } finally {
      loading.value = false;
    }
  }

  async function fetchSite(id: number): Promise<Site> {
    const { data } = await api.get(`/sites/${id}`);
    return data;
  }

  async function createSite(site: Partial<Site>): Promise<Site> {
    const { data } = await api.post('/sites', site);
    await fetchSites();
    return data;
  }

  async function updateSite(id: number, site: Partial<Site>): Promise<Site> {
    const { data } = await api.put(`/sites/${id}`, site);
    await fetchSites();
    return data;
  }

  async function deleteSite(id: number): Promise<void> {
    await api.delete(`/sites/${id}`);
    await fetchSites();
  }

  async function toggleSite(id: number, enabled: boolean): Promise<void> {
    await api.post(`/sites/${id}/${enabled ? 'enable' : 'disable'}`);
    await fetchSites();
  }

  async function previewConfig(site: Partial<Site>): Promise<string> {
    const { data } = await api.post('/sites/preview', site);
    return data.config;
  }

  async function previewExistingConfig(id: number): Promise<string> {
    const { data } = await api.get(`/sites/${id}/preview`);
    return data.config;
  }

  async function generateSsl(id: number, method: string = 'nginx'): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post(`/ssl/${id}/generate`, { method });
    return data;
  }

  async function fetchSiteStatus(id: number): Promise<{ config_deployed: boolean; enabled: boolean; ssl_enabled: boolean }> {
    const { data } = await api.get(`/sites/${id}/status`);
    return data;
  }

  return {
    sites,
    loading,
    error,
    fetchSites,
    fetchSite,
    createSite,
    updateSite,
    deleteSite,
    toggleSite,
    previewConfig,
    previewExistingConfig,
    generateSsl,
    fetchSiteStatus,
  };
});
