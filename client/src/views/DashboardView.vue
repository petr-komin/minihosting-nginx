<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useSitesStore } from '@/stores/sites';
import { useNginxStore } from '@/stores/nginx';

const sites = useSitesStore();
const nginx = useNginxStore();

onMounted(() => {
  sites.fetchSites();
  nginx.fetchStatus();
});

const enabledCount = computed(() => sites.sites.filter(s => s.enabled).length);
const disabledCount = computed(() => sites.sites.filter(s => !s.enabled).length);
const sslCount = computed(() => sites.sites.filter(s => s.ssl_enabled).length);

const typeStats = computed(() => {
  const stats = { proxy: 0, static: 0, php: 0 };
  for (const site of sites.sites) {
    stats[site.type]++;
  }
  return stats;
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
      <RouterLink
        to="/sites/new"
        class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
      >
        + Novy web
      </RouterLink>
    </div>

    <!-- Statistiky -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">Celkem webu</p>
              <p class="text-2xl font-semibold text-gray-900">{{ sites.sites.length }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">Aktivnich</p>
              <p class="text-2xl font-semibold text-gray-900">{{ enabledCount }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">S SSL</p>
              <p class="text-2xl font-semibold text-gray-900">{{ sslCount }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="nginx.status?.running ? 'bg-green-100' : 'bg-red-100'">
                <svg class="w-6 h-6" :class="nginx.status?.running ? 'text-green-600' : 'text-red-600'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500">Nginx</p>
              <p class="text-sm font-semibold" :class="nginx.status?.running ? 'text-green-600' : 'text-red-600'">
                {{ nginx.status?.running ? 'Bezi' : 'Zastaven' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Typy webů -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Podle typu</h2>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">Reverse Proxy</span>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{{ typeStats.proxy }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">Staticky web</span>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{{ typeStats.static }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">PHP (FPM)</span>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{{ typeStats.php }}</span>
          </div>
        </div>
      </div>

      <!-- Posledni weby -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Posledni weby</h2>
        <div v-if="sites.sites.length === 0" class="text-sm text-gray-500">
          Zadne weby. <RouterLink to="/sites/new" class="text-indigo-600 hover:text-indigo-500">Pridat prvni web</RouterLink>
        </div>
        <div v-else class="space-y-2">
          <RouterLink
            v-for="site in sites.sites.slice(0, 5)"
            :key="site.id"
            :to="`/sites/${site.id}/edit`"
            class="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50"
          >
            <div class="flex items-center space-x-3">
              <span class="w-2 h-2 rounded-full" :class="site.enabled ? 'bg-green-500' : 'bg-gray-300'"></span>
              <span class="text-sm font-medium text-gray-900">{{ site.domain }}</span>
            </div>
            <span class="text-xs text-gray-500">{{ site.type }}</span>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
