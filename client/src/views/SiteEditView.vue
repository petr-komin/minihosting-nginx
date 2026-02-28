<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSitesStore, getDefaultConfig } from '@/stores/sites';
import type { Site, SiteConfig, CustomLocation } from '@/stores/sites';
import NginxPreview from '@/components/NginxPreview.vue';

const route = useRoute();
const router = useRouter();
const sitesStore = useSitesStore();

const isEdit = computed(() => !!route.params.id);
const siteId = computed(() => Number(route.params.id));

const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const showPreview = ref(false);
const configDeployed = ref(false);
const generatingSsl = ref(false);

// Form data
const form = ref({
  name: '',
  domain: '',
  aliases: '' as string, // comma-separated pro input
  type: 'proxy' as 'proxy' | 'static' | 'php',
  enabled: true,
  ssl_enabled: false,
  ssl_cert_path: '',
  ssl_key_path: '',
  auto_reload: false,
  config: getDefaultConfig('proxy'),
});

// Při změně typu webu nastavit default config
watch(() => form.value.type, (newType, oldType) => {
  if (newType !== oldType) {
    const defaults = getDefaultConfig(newType);
    // Zachovat common nastavení
    form.value.config = {
      ...defaults,
      common: form.value.config.common,
    };
  }
});

// SSL je již aktivní (importovaný web nebo dříve vygenerovaný certifikát)
const sslAlreadyActive = computed(() => {
  return isEdit.value && form.value.ssl_enabled && !!(form.value.ssl_cert_path && form.value.ssl_key_path);
});

// SSL generování je povoleno jen pokud: je to existující site, je enabled, má nasazený config, a SSL ještě není aktivní
const canGenerateSsl = computed(() => {
  return isEdit.value && form.value.enabled && configDeployed.value && !form.value.ssl_enabled;
});

const sslBlockedReason = computed(() => {
  if (!isEdit.value) return 'Nejdriv ulozte web.';
  if (form.value.ssl_enabled) return ''; // SSL je aktivní — žádný warning
  if (!form.value.enabled) return 'Web musi byt aktivni (zapnuty).';
  if (!configDeployed.value) return 'Nginx konfigurace neni nasazena. Ulozte web a provedte reload Nginx, aby web bezel na HTTP.';
  return '';
});

onMounted(async () => {
  if (isEdit.value) {
    loading.value = true;
    try {
      const [site, status] = await Promise.all([
        sitesStore.fetchSite(siteId.value),
        sitesStore.fetchSiteStatus(siteId.value),
      ]);
      form.value = {
        name: site.name,
        domain: site.domain,
        aliases: site.aliases.join(', '),
        type: site.type,
        enabled: site.enabled,
        ssl_enabled: site.ssl_enabled,
        ssl_cert_path: site.ssl_cert_path || '',
        ssl_key_path: site.ssl_key_path || '',
        auto_reload: site.auto_reload,
        config: site.config,
      };
      configDeployed.value = status.config_deployed;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Nepodarilo se nacist web.';
    } finally {
      loading.value = false;
    }
  }
});

function buildSitePayload() {
  const aliases = form.value.aliases
    .split(',')
    .map(a => a.trim())
    .filter(a => a.length > 0);

  return {
    name: form.value.name,
    domain: form.value.domain,
    aliases,
    type: form.value.type,
    enabled: form.value.enabled,
    ssl_enabled: form.value.ssl_enabled,
    ssl_cert_path: form.value.ssl_cert_path || undefined,
    ssl_key_path: form.value.ssl_key_path || undefined,
    auto_reload: form.value.auto_reload,
    config: form.value.config,
  };
}

async function handleSubmit() {
  error.value = '';
  success.value = '';
  saving.value = true;

  try {
    const payload = buildSitePayload();

    if (isEdit.value) {
      await sitesStore.updateSite(siteId.value, payload);
      success.value = 'Web byl ulozen.';
      // Aktualizovat stav nasazení
      const status = await sitesStore.fetchSiteStatus(siteId.value);
      configDeployed.value = status.config_deployed;
    } else {
      const site = await sitesStore.createSite(payload);
      success.value = 'Web byl vytvoren.';
      router.push(`/sites/${site.id}/edit`);
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Chyba pri ukladani.';
  } finally {
    saving.value = false;
  }
}

function addCustomHeader() {
  form.value.config.common.custom_headers.push({ name: '', value: '' });
}

function removeCustomHeader(index: number) {
  form.value.config.common.custom_headers.splice(index, 1);
}

function addCustomLocation() {
  form.value.config.common.custom_locations.push({ path: '', directives: '' });
}

function removeCustomLocation(index: number) {
  form.value.config.common.custom_locations.splice(index, 1);
}

async function handleGenerateSsl() {
  if (!isEdit.value || !canGenerateSsl.value) return;
  error.value = '';
  generatingSsl.value = true;
  try {
    const result = await sitesStore.generateSsl(siteId.value);
    if (result.success) {
      success.value = 'SSL certifikat byl vygenerovan. Nginx konfigurace byla aktualizovana na HTTPS.';
      form.value.ssl_enabled = true;
      // Reload data
      const [site, status] = await Promise.all([
        sitesStore.fetchSite(siteId.value),
        sitesStore.fetchSiteStatus(siteId.value),
      ]);
      form.value.ssl_cert_path = site.ssl_cert_path || '';
      form.value.ssl_key_path = site.ssl_key_path || '';
      configDeployed.value = status.config_deployed;
    } else {
      error.value = result.message;
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Chyba pri generovani certifikatu.';
  } finally {
    generatingSsl.value = false;
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-900">
        {{ isEdit ? 'Upravit web' : 'Novy web' }}
      </h1>
      <button
        @click="showPreview = !showPreview"
        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      >
        {{ showPreview ? 'Skryt nahled' : 'Nahled Nginx' }}
      </button>
    </div>

    <!-- Notifikace -->
    <div v-if="error" class="mb-4 rounded-md bg-red-50 p-4 text-red-800 text-sm">{{ error }}</div>
    <div v-if="success" class="mb-4 rounded-md bg-green-50 p-4 text-green-800 text-sm">{{ success }}</div>

    <!-- Nginx Preview -->
    <NginxPreview v-if="showPreview" :site-data="buildSitePayload()" class="mb-6" />

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Formulář -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-8">

      <!-- === Základní info === -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Zakladni informace</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Nazev webu</label>
            <input
              v-model="form.name"
              type="text"
              required
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
              placeholder="Muj web"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Typ webu</label>
            <select
              v-model="form.type"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
            >
              <option value="proxy">Reverse Proxy</option>
              <option value="static">Staticky web</option>
              <option value="php">PHP (FPM)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Hlavni domena</label>
            <input
              v-model="form.domain"
              type="text"
              required
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
              placeholder="example.com"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Aliasy (dalsi domeny)</label>
            <input
              v-model="form.aliases"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
              placeholder="www.example.com, alias.example.com"
            />
            <p class="mt-1 text-xs text-gray-500">Oddelene carkami</p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-6">
          <label class="flex items-center space-x-2">
            <input v-model="form.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="text-sm text-gray-700">Aktivni</span>
          </label>

          <label class="flex items-center space-x-2">
            <input v-model="form.auto_reload" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="text-sm text-gray-700">Automaticky reload Nginx</span>
          </label>
        </div>
      </div>

      <!-- === Konfigurace dle typu === -->

      <!-- PROXY -->
      <div v-if="form.type === 'proxy' && form.config.proxy" class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Reverse Proxy</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700">Cilova URL</label>
            <input
              v-model="form.config.proxy.proxy_url"
              type="text"
              required
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
              placeholder="http://localhost:3000 nebo http://172.26.0.2"
            />
            <p class="mt-1 text-xs text-gray-500">Napr. http://localhost:3009, http://172.26.0.2, http://localhost:9002</p>
          </div>

          <label class="flex items-center space-x-2">
            <input v-model="form.config.proxy.websocket_support" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="text-sm text-gray-700">WebSocket podpora</span>
          </label>

          <label class="flex items-center space-x-2">
            <input v-model="form.config.proxy.proxy_buffering" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="text-sm text-gray-700">Proxy buffering</span>
          </label>
        </div>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Read timeout (s)</label>
            <input v-model.number="form.config.proxy.proxy_read_timeout" type="number" min="1" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Connect timeout (s)</label>
            <input v-model.number="form.config.proxy.proxy_connect_timeout" type="number" min="1" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Send timeout (s)</label>
            <input v-model.number="form.config.proxy.proxy_send_timeout" type="number" min="1" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm" />
          </div>
        </div>
      </div>

      <!-- STATIC -->
      <div v-if="form.type === 'static' && form.config.static" class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Staticky web</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700">Root adresar</label>
            <input
              v-model="form.config.static.root_path"
              type="text"
              required
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
              placeholder="/var/www/html"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Index soubory</label>
            <input
              v-model="form.config.static.index_files"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm"
              placeholder="index.html index.htm"
            />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-6">
          <label class="flex items-center space-x-2">
            <input v-model="form.config.static.spa_mode" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="text-sm text-gray-700">SPA mode (fallback na index.html)</span>
          </label>

          <label class="flex items-center space-x-2">
            <input v-model="form.config.static.directory_listing" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="text-sm text-gray-700">Vypis adresare</span>
          </label>
        </div>
      </div>

      <!-- PHP -->
      <div v-if="form.type === 'php' && form.config.php" class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">PHP (FastCGI / FPM)</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Root adresar webu</label>
            <input
              v-model="form.config.php.root_path"
              type="text"
              required
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
              placeholder="/var/www/chutny-ck/pikoshop"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">PHP-FPM socket/adresa</label>
            <input
              v-model="form.config.php.php_fpm_socket"
              type="text"
              required
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
              placeholder="172.25.0.2:9000 nebo /run/php/php8.2-fpm.sock"
            />
            <p class="mt-1 text-xs text-gray-500">TCP (172.25.0.2:9000) nebo Unix socket (/run/php/php8.2-fpm.sock)</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Index soubory</label>
            <input
              v-model="form.config.php.index_files"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm"
              placeholder="index.php index.html"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">FastCGI root (nepovinne)</label>
            <input
              v-model="form.config.php.fastcgi_root"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
              placeholder="/var/www/html"
            />
            <p class="mt-1 text-xs text-gray-500">Pokud se lisi od hlavniho rootu (napr. Docker mount)</p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Read timeout (s)</label>
            <input v-model.number="form.config.php.fastcgi_read_timeout" type="number" min="1" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Connect timeout (s)</label>
            <input v-model.number="form.config.php.fastcgi_connect_timeout" type="number" min="1" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Send timeout (s)</label>
            <input v-model.number="form.config.php.fastcgi_send_timeout" type="number" min="1" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm" />
          </div>
        </div>
      </div>

      <!-- === SSL === -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">SSL / HTTPS</h2>

        <label class="flex items-center space-x-2 mb-4">
          <input v-model="form.ssl_enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <span class="text-sm text-gray-700">Povolit SSL (HTTPS)</span>
        </label>

        <div v-if="form.ssl_enabled" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Cesta k certifikatu</label>
            <input
              v-model="form.ssl_cert_path"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
              :placeholder="`/etc/letsencrypt/live/${form.domain || 'example.com'}/fullchain.pem`"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Cesta ke klici</label>
            <input
              v-model="form.ssl_key_path"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
              :placeholder="`/etc/letsencrypt/live/${form.domain || 'example.com'}/privkey.pem`"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">SSL include (nginx options)</label>
            <input
              v-model="form.config.common.ssl_include"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">SSL DH parametry</label>
            <input
              v-model="form.config.common.ssl_dhparam"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
            />
          </div>
        </div>

        <div v-if="isEdit" class="mt-4 pt-4 border-t border-gray-200">
          <!-- SSL je již aktivní -->
          <div v-if="sslAlreadyActive" class="rounded-md bg-green-50 border border-green-200 p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-green-800">SSL je aktivni</h3>
                <p class="mt-1 text-xs text-green-700">Certifikat: {{ form.ssl_cert_path }}</p>
              </div>
            </div>
          </div>

          <!-- Upozornění pokud SSL generování není možné -->
          <div v-else-if="!canGenerateSsl && sslBlockedReason" class="mb-3 rounded-md bg-amber-50 border border-amber-200 p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-amber-800">Generovani certifikatu neni mozne</h3>
                <p class="mt-1 text-sm text-amber-700">{{ sslBlockedReason }}</p>
                <p v-if="!configDeployed && form.enabled" class="mt-1 text-xs text-amber-600">
                  Postup: 1) Ulozte web bez SSL &rarr; 2) Provedte reload Nginx &rarr; 3) Ovezte ze http://{{ form.domain || 'domena' }} odpovida &rarr; 4) Vygenerujte certifikat
                </p>
              </div>
            </div>
          </div>

          <!-- Tlačítko pro generování certifikátu (jen pokud SSL není aktivní) -->
          <div v-if="!sslAlreadyActive">
            <button
              type="button"
              @click="handleGenerateSsl"
              :disabled="!canGenerateSsl || generatingSsl"
              class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="generatingSsl">Generuji certifikat...</span>
              <span v-else>Vygenerovat Let's Encrypt certifikat</span>
            </button>
            <p v-if="canGenerateSsl" class="mt-1 text-xs text-gray-500">Pozadavek na Certbot. Domena musi byt nasmerovana na tento server.</p>
          </div>
        </div>
      </div>

      <!-- === Společná konfigurace === -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Spolecna konfigurace</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Max velikost uploadu</label>
            <input
              v-model="form.config.common.client_max_body_size"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm"
              placeholder="50m"
            />
            <p class="mt-1 text-xs text-gray-500">Napr. 50m, 100m, 1g</p>
          </div>

          <div class="flex items-end pb-1">
            <label class="flex items-center space-x-2">
              <input v-model="form.config.common.gzip_enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <span class="text-sm text-gray-700">Gzip komprese</span>
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Access log (nepovinne)</label>
            <input
              v-model="form.config.common.access_log"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
              :placeholder="`/var/log/nginx/${form.domain || 'example'}_access.log`"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Error log (nepovinne)</label>
            <input
              v-model="form.config.common.error_log"
              type="text"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
              :placeholder="`/var/log/nginx/${form.domain || 'example'}_error.log`"
            />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-6">
          <label class="flex items-center space-x-2">
            <input v-model="form.config.common.rate_limiting" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="text-sm text-gray-700">Rate limiting</span>
          </label>
          <div v-if="form.config.common.rate_limiting" class="flex items-center space-x-2">
            <input
              v-model="form.config.common.rate_limit_zone"
              type="text"
              class="rounded-md border border-gray-300 px-3 py-1 shadow-sm text-sm w-32"
              placeholder="10r/s"
            />
          </div>
        </div>
      </div>

      <!-- === Custom HTTP Hlavičky === -->
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-medium text-gray-900">Vlastni HTTP hlavicky</h2>
          <button
            type="button"
            @click="addCustomHeader"
            class="text-sm text-indigo-600 hover:text-indigo-500"
          >
            + Pridat hlavicku
          </button>
        </div>

        <div v-if="form.config.common.custom_headers.length === 0" class="text-sm text-gray-500">
          Zadne vlastni hlavicky.
        </div>
        <div v-else class="space-y-3">
          <div v-for="(header, i) in form.config.common.custom_headers" :key="i" class="flex gap-3 items-start">
            <input
              v-model="header.name"
              type="text"
              class="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm"
              placeholder="X-Frame-Options"
            />
            <input
              v-model="header.value"
              type="text"
              class="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm"
              placeholder="DENY"
            />
            <button type="button" @click="removeCustomHeader(i)" class="text-red-500 hover:text-red-700 px-2 py-2">
              &times;
            </button>
          </div>
        </div>
      </div>

      <!-- === Vlastní location bloky === -->
      <div class="bg-white shadow rounded-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-medium text-gray-900">Vlastni location bloky</h2>
          <button
            type="button"
            @click="addCustomLocation"
            class="text-sm text-indigo-600 hover:text-indigo-500"
          >
            + Pridat location
          </button>
        </div>

        <div v-if="form.config.common.custom_locations.length === 0" class="text-sm text-gray-500">
          Zadne vlastni location bloky.
        </div>
        <div v-else class="space-y-4">
          <div v-for="(loc, i) in form.config.common.custom_locations" :key="i" class="border border-gray-200 rounded-md p-4">
            <div class="flex justify-between items-center mb-2">
              <label class="text-sm font-medium text-gray-700">Location path</label>
              <button type="button" @click="removeCustomLocation(i)" class="text-red-500 hover:text-red-700 text-sm">
                Odebrat
              </button>
            </div>
            <input
              v-model="loc.path"
              type="text"
              class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono mb-2"
              placeholder="= /rur.css  nebo  ~ \.php$"
            />
            <label class="text-sm font-medium text-gray-700">Direktivy</label>
            <textarea
              v-model="loc.directives"
              rows="4"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
              placeholder="fastcgi_pass 172.25.0.2:9000;&#10;root /var/www/html;&#10;fastcgi_param SCRIPT_FILENAME $document_root/rur_css.php;&#10;include fastcgi_params;"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- === Vlastní direktivy (raw) === -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Vlastni direktivy (raw Nginx)</h2>
        <textarea
          v-model="form.config.common.custom_directives"
          rows="4"
          class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
          placeholder="# Vlozeno primo do server {} bloku&#10;# napr. add_header X-Custom &quot;value&quot;;"
        ></textarea>
        <p class="mt-1 text-xs text-gray-500">Bude vlozeno primo do server {} bloku. Pouzivejte opatrne.</p>
      </div>

      <!-- === Tlačítka === -->
      <div class="flex justify-between">
        <button
          type="button"
          @click="router.push('/sites')"
          class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Zpet
        </button>
        <button
          type="submit"
          :disabled="saving"
          class="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          <span v-if="saving">Ukladam...</span>
          <span v-else>{{ isEdit ? 'Ulozit zmeny' : 'Vytvorit web' }}</span>
        </button>
      </div>
    </form>
  </div>
</template>
