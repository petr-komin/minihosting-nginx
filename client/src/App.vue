<script setup lang="ts">
import { RouterView, RouterLink, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNginxStore } from '@/stores/nginx';
import { computed, onMounted, ref } from 'vue';

const auth = useAuthStore();
const nginx = useNginxStore();
const route = useRoute();
const mobileMenuOpen = ref(false);

const showNav = computed(() => auth.isAuthenticated && !['login', 'setup'].includes(route.name as string));

onMounted(async () => {
  await auth.checkStatus();
  if (auth.isAuthenticated) {
    nginx.fetchStatus();
  }
});

async function handleLogout() {
  await auth.logout();
  window.location.href = '/login';
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigace -->
    <nav v-if="showNav" class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <RouterLink to="/" class="text-xl font-bold text-indigo-600">
                Hostingy
              </RouterLink>
            </div>
            <div class="hidden sm:ml-8 sm:flex sm:space-x-4">
              <RouterLink
                to="/"
                class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                :class="route.name === 'dashboard' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
              >
                Dashboard
              </RouterLink>
              <RouterLink
                to="/sites"
                class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                :class="route.path.startsWith('/sites') ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
              >
                Weby
              </RouterLink>
              <RouterLink
                to="/import"
                class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                :class="route.name === 'import' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
              >
                Import
              </RouterLink>
              <RouterLink
                to="/monitor"
                class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                :class="route.name === 'monitor' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
              >
                Server
              </RouterLink>
              <RouterLink
                to="/settings"
                class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md"
                :class="route.name === 'settings' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
              >
                Nastaveni
              </RouterLink>
            </div>
          </div>

          <div class="hidden sm:flex sm:items-center sm:space-x-4">
            <!-- Nginx status -->
            <div class="flex items-center space-x-2 text-sm">
              <span
                class="w-2.5 h-2.5 rounded-full"
                :class="nginx.status?.running ? 'bg-green-500' : 'bg-red-500'"
              ></span>
              <span class="text-gray-500">Nginx</span>
            </div>

            <button
              @click="handleLogout"
              class="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Odhlasit
            </button>
          </div>

          <!-- Mobilni menu tlacitko -->
          <div class="sm:hidden flex items-center">
            <button
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobilni menu -->
      <div v-if="mobileMenuOpen" class="sm:hidden border-t border-gray-200">
        <div class="px-2 pt-2 pb-3 space-y-1">
          <RouterLink to="/" class="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 rounded-md" @click="mobileMenuOpen = false">Dashboard</RouterLink>
          <RouterLink to="/sites" class="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 rounded-md" @click="mobileMenuOpen = false">Weby</RouterLink>
          <RouterLink to="/import" class="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 rounded-md" @click="mobileMenuOpen = false">Import</RouterLink>
          <RouterLink to="/monitor" class="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 rounded-md" @click="mobileMenuOpen = false">Server</RouterLink>
          <RouterLink to="/settings" class="block px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 rounded-md" @click="mobileMenuOpen = false">Nastaveni</RouterLink>
          <button @click="handleLogout" class="block w-full text-left px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 rounded-md">Odhlasit</button>
        </div>
      </div>
    </nav>

    <!-- Obsah -->
    <main>
      <div v-if="auth.loading" class="flex items-center justify-center min-h-screen">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
      <RouterView v-else />
    </main>
  </div>
</template>
