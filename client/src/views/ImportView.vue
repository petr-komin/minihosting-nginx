<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/client';

interface ScannedSite {
  fileName: string;
  domain: string;
  aliases: string[];
  type: 'proxy' | 'static' | 'php';
  ssl_enabled: boolean;
  ssl_cert_path?: string;
  ssl_key_path?: string;
  alreadyExists: boolean;
  isHostingyManaged: boolean;
  source: 'sites-available' | 'sites-enabled' | 'oba';
}

interface ImportResult {
  domain: string;
  success: boolean;
  error?: string;
  siteId?: number;
}

const router = useRouter();

const scannedSites = ref<ScannedSite[]>([]);
const selectedDomains = ref<Set<string>>(new Set());
const scanning = ref(false);
const importing = ref(false);
const scanned = ref(false);
const scanError = ref<string | null>(null);
const importResults = ref<ImportResult[] | null>(null);
const notification = ref<{ type: string; message: string } | null>(null);

// Weby, které lze importovat (neexistují v DB a nejsou spravovány Hostingy)
const importableSites = computed(() =>
  scannedSites.value.filter(s => !s.alreadyExists && !s.isHostingyManaged)
);

const allImportableSelected = computed(() =>
  importableSites.value.length > 0 && importableSites.value.every(s => selectedDomains.value.has(s.domain))
);

const someSelected = computed(() => selectedDomains.value.size > 0);

async function handleScan() {
  scanning.value = true;
  scanError.value = null;
  importResults.value = null;
  selectedDomains.value = new Set();

  try {
    const { data } = await api.get('/nginx/scan');
    scannedSites.value = data;
    scanned.value = true;
  } catch (err: any) {
    scanError.value = err.response?.data?.error || 'Chyba pri skenovani.';
  } finally {
    scanning.value = false;
  }
}

function toggleSelect(domain: string) {
  const newSet = new Set(selectedDomains.value);
  if (newSet.has(domain)) {
    newSet.delete(domain);
  } else {
    newSet.add(domain);
  }
  selectedDomains.value = newSet;
}

function toggleSelectAll() {
  if (allImportableSelected.value) {
    selectedDomains.value = new Set();
  } else {
    selectedDomains.value = new Set(importableSites.value.map(s => s.domain));
  }
}

async function handleImport() {
  if (selectedDomains.value.size === 0) return;

  importing.value = true;
  importResults.value = null;

  try {
    const { data } = await api.post('/nginx/import', {
      domains: Array.from(selectedDomains.value),
    });
    importResults.value = data.results;

    const successCount = data.results.filter((r: ImportResult) => r.success).length;
    const failCount = data.results.filter((r: ImportResult) => !r.success).length;

    if (successCount > 0 && failCount === 0) {
      showNotification('success', `Uspesne importovano ${successCount} webu.`);
    } else if (successCount > 0) {
      showNotification('warning', `Importovano ${successCount} webu, ${failCount} selhalo.`);
    } else {
      showNotification('error', `Import selhal pro vsech ${failCount} webu.`);
    }

    // Znovu naskenovat pro aktualizaci stavu
    selectedDomains.value = new Set();
    const { data: refreshed } = await api.get('/nginx/scan');
    scannedSites.value = refreshed;
  } catch (err: any) {
    showNotification('error', err.response?.data?.error || 'Chyba pri importu.');
  } finally {
    importing.value = false;
  }
}

function showNotification(type: string, message: string) {
  notification.value = { type, message };
  setTimeout(() => { notification.value = null; }, 5000);
}

function typeLabel(type: string): string {
  switch (type) {
    case 'proxy': return 'Proxy';
    case 'static': return 'Staticky';
    case 'php': return 'PHP';
    default: return type;
  }
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'proxy': return 'bg-blue-100 text-blue-800';
    case 'static': return 'bg-green-100 text-green-800';
    case 'php': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function statusBadge(site: ScannedSite): { label: string; class: string } {
  if (site.isHostingyManaged) {
    return { label: 'Spravuje Hostingy', class: 'bg-indigo-100 text-indigo-800' };
  }
  if (site.alreadyExists) {
    return { label: 'Jiz v databazi', class: 'bg-yellow-100 text-yellow-800' };
  }
  return { label: 'K importu', class: 'bg-gray-100 text-gray-600' };
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Notifikace -->
    <div
      v-if="notification"
      class="mb-4 rounded-md p-4"
      :class="{
        'bg-green-50 text-green-800': notification.type === 'success',
        'bg-yellow-50 text-yellow-800': notification.type === 'warning',
        'bg-red-50 text-red-800': notification.type === 'error',
      }"
    >
      {{ notification.message }}
    </div>

    <!-- Hlavicka -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Import webu</h1>
        <p class="mt-1 text-sm text-gray-500">
          Naskenujte existujici Nginx konfigurace a importujte je do Hostingy.
        </p>
      </div>
      <div class="flex space-x-3">
        <button
          @click="router.push('/sites')"
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Zpet na weby
        </button>
        <button
          @click="handleScan"
          :disabled="scanning"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg v-if="scanning" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ scanning ? 'Skenuji...' : 'Skenovat konfigurace' }}
        </button>
      </div>
    </div>

    <!-- Chyba skenovani -->
    <div v-if="scanError" class="mb-6 rounded-md bg-red-50 p-4">
      <div class="flex">
        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="ml-3">
          <p class="text-sm text-red-700">{{ scanError }}</p>
        </div>
      </div>
    </div>

    <!-- Pred skenovanim -->
    <div v-if="!scanned && !scanning" class="text-center py-16">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
      <h3 class="mt-4 text-sm font-medium text-gray-900">Zadne naskenovane konfigurace</h3>
      <p class="mt-1 text-sm text-gray-500">
        Kliknete na "Skenovat konfigurace" pro prohledani /etc/nginx/sites-available.
      </p>
    </div>

    <!-- Spinner pri skenovani -->
    <div v-if="scanning" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Vysledky skenovani -->
    <div v-if="scanned && !scanning">
      <!-- Prazdny stav -->
      <div v-if="scannedSites.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="mt-4 text-gray-500">Zadne konfigurace nebyly nalezeny v sites-available.</p>
      </div>

      <!-- Tabulka -->
      <div v-else>
        <!-- Toolbar -->
        <div class="flex items-center justify-between mb-4">
          <p class="text-sm text-gray-500">
            Nalezeno <strong>{{ scannedSites.length }}</strong> webu,
            <strong>{{ importableSites.length }}</strong> k importu
          </p>
          <button
            v-if="someSelected"
            @click="handleImport"
            :disabled="importing"
            class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg v-if="importing" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ importing ? 'Importuji...' : `Importovat (${selectedDomains.size})` }}
          </button>
        </div>

        <!-- Import vysledky -->
        <div v-if="importResults" class="mb-4 space-y-2">
          <div
            v-for="result in importResults"
            :key="result.domain"
            class="rounded-md p-3 text-sm"
            :class="result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'"
          >
            <strong>{{ result.domain }}</strong>:
            {{ result.success ? 'Uspesne importovano' : result.error }}
            <router-link
              v-if="result.success && result.siteId"
              :to="`/sites/${result.siteId}/edit`"
              class="ml-2 underline"
            >
              Upravit
            </router-link>
          </div>
        </div>

        <!-- Tabulka webu -->
        <div class="bg-white shadow overflow-hidden rounded-lg">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    :checked="allImportableSelected"
                    :disabled="importableSites.length === 0"
                    @change="toggleSelectAll"
                    class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domena</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Soubor / Zdroj</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Typ</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SSL</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stav</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="site in scannedSites"
                :key="site.domain"
                class="hover:bg-gray-50"
                :class="{ 'opacity-50': site.alreadyExists || site.isHostingyManaged }"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    :checked="selectedDomains.has(site.domain)"
                    :disabled="site.alreadyExists || site.isHostingyManaged"
                    @change="toggleSelect(site.domain)"
                    class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-medium text-gray-900">{{ site.domain }}</div>
                    <div v-if="site.aliases.length" class="text-xs text-gray-400">
                      {{ site.aliases.join(', ') }}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">{{ site.fileName }}</div>
                  <div class="text-xs text-gray-400">{{ site.source }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="typeBadgeClass(site.type)"
                  >
                    {{ typeLabel(site.type) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span v-if="site.ssl_enabled" class="text-green-600 text-sm">Ano</span>
                  <span v-else class="text-gray-400 text-sm">Ne</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="statusBadge(site).class"
                  >
                    {{ statusBadge(site).label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Info box -->
        <div class="mt-6 rounded-md bg-blue-50 p-4">
          <div class="flex">
            <svg class="h-5 w-5 text-blue-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <div class="ml-3 text-sm text-blue-700">
              <p>
                Import vytvori nove zaznamy v databazi a vygeneruje Hostingy verzi konfiguracniho souboru
                (<code>hostingy_*.conf</code>). Puvodni soubory zustanou nezmeneny — muzete je smazat rucne.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
