<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useSitesStore } from '@/stores/sites';
import { useNginxStore } from '@/stores/nginx';
import type { Site } from '@/stores/sites';

const sites = useSitesStore();
const nginx = useNginxStore();
const searchQuery = ref('');
const filterType = ref<string>('all');
const deleteConfirm = ref<number | null>(null);
const notification = ref<{ type: string; message: string } | null>(null);

onMounted(() => {
  sites.fetchSites();
});

const filteredSites = computed(() => {
  let result = sites.sites;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.domain.toLowerCase().includes(q)
    );
  }

  if (filterType.value !== 'all') {
    result = result.filter(s => s.type === filterType.value);
  }

  return result;
});

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

async function toggleSite(site: Site) {
  try {
    await sites.toggleSite(site.id, !site.enabled);
    showNotification('success', `Web ${site.domain} ${site.enabled ? 'deaktivovan' : 'aktivovan'}.`);
  } catch (err: any) {
    showNotification('error', err.response?.data?.error || 'Chyba.');
  }
}

async function handleDelete(id: number) {
  try {
    await sites.deleteSite(id);
    deleteConfirm.value = null;
    showNotification('success', 'Web byl smazan.');
  } catch (err: any) {
    showNotification('error', err.response?.data?.error || 'Chyba pri mazani.');
  }
}

async function handleReload() {
  try {
    const result = await nginx.reload();
    showNotification(result.success ? 'success' : 'error', result.message);
  } catch (err: any) {
    showNotification('error', 'Chyba pri reloadu Nginx.');
  }
}

function showNotification(type: string, message: string) {
  notification.value = { type, message };
  setTimeout(() => { notification.value = null; }, 4000);
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Notifikace -->
    <div v-if="notification" class="mb-4 rounded-md p-4" :class="notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
      {{ notification.message }}
    </div>

    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <h1 class="text-2xl font-bold text-gray-900">Weby</h1>
      <div class="flex space-x-3">
        <button
          @click="handleReload"
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Reload Nginx
        </button>
        <RouterLink
          to="/sites/new"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          + Novy web
        </RouterLink>
      </div>
    </div>

    <!-- Filtry -->
    <div class="flex flex-col sm:flex-row gap-4 mb-6">
      <div class="flex-1">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Hledat podle nazvu nebo domeny..."
          class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
        />
      </div>
      <select
        v-model="filterType"
        class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
      >
        <option value="all">Vsechny typy</option>
        <option value="proxy">Proxy</option>
        <option value="static">Staticky</option>
        <option value="php">PHP</option>
      </select>
    </div>

    <!-- Seznam -->
    <div v-if="sites.loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="filteredSites.length === 0" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
      <p class="mt-4 text-gray-500">Zatim zadne weby.</p>
      <RouterLink to="/sites/new" class="mt-2 inline-block text-indigo-600 hover:text-indigo-500">Pridat prvni web</RouterLink>
    </div>

    <div v-else class="bg-white shadow overflow-hidden rounded-lg">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Web</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Typ</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stav</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SSL</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akce</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="site in filteredSites" :key="site.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
              <div>
                <div class="text-sm font-medium text-gray-900">{{ site.name }}</div>
                <div class="text-sm text-gray-500">{{ site.domain }}</div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="typeBadgeClass(site.type)">
                {{ typeLabel(site.type) }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <button @click="toggleSite(site)" class="flex items-center space-x-2 group">
                <span class="w-2.5 h-2.5 rounded-full" :class="site.enabled ? 'bg-green-500' : 'bg-gray-300'"></span>
                <span class="text-sm" :class="site.enabled ? 'text-green-700' : 'text-gray-500'">
                  {{ site.enabled ? 'Aktivni' : 'Neaktivni' }}
                </span>
              </button>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span v-if="site.ssl_enabled" class="text-green-600 text-sm">Ano</span>
              <span v-else class="text-gray-400 text-sm">Ne</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
              <RouterLink
                :to="`/sites/${site.id}/edit`"
                class="text-indigo-600 hover:text-indigo-900"
              >
                Upravit
              </RouterLink>
              <button
                v-if="deleteConfirm !== site.id"
                @click="deleteConfirm = site.id"
                class="text-red-600 hover:text-red-900"
              >
                Smazat
              </button>
              <span v-else class="inline-flex space-x-1">
                <button @click="handleDelete(site.id)" class="text-red-700 font-medium">Potvrdit</button>
                <button @click="deleteConfirm = null" class="text-gray-500">Zrusit</button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
