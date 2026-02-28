<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useNginxStore } from '@/stores/nginx';
import api from '@/api/client';

const auth = useAuthStore();
const nginx = useNginxStore();

const settings = ref({
  certbot_email: '',
  nginx_config_path: '/etc/nginx',
  nginx_sites_available: '/etc/nginx/sites-available',
  nginx_sites_enabled: '/etc/nginx/sites-enabled',
  auto_reload_default: 'false',
});

const passwords = ref({
  current_password: '',
  new_password: '',
  new_password_confirm: '',
});

const notification = ref<{ type: string; message: string } | null>(null);
const savingSettings = ref(false);
const savingPassword = ref(false);
const testResult = ref<{ success: boolean; output: string } | null>(null);

onMounted(async () => {
  try {
    const { data } = await api.get('/settings');
    settings.value = { ...settings.value, ...data };
  } catch {
    // Použít defaults
  }
  nginx.fetchStatus();
});

async function saveSettings() {
  savingSettings.value = true;
  try {
    await api.put('/settings', settings.value);
    showNotification('success', 'Nastaveni ulozeno.');
  } catch (err: any) {
    showNotification('error', err.response?.data?.error || 'Chyba pri ukladani.');
  } finally {
    savingSettings.value = false;
  }
}

async function changePassword() {
  if (passwords.value.new_password !== passwords.value.new_password_confirm) {
    showNotification('error', 'Nova hesla se neshoduji.');
    return;
  }

  savingPassword.value = true;
  try {
    await auth.changePassword(passwords.value.current_password, passwords.value.new_password);
    showNotification('success', 'Heslo zmeneno.');
    passwords.value = { current_password: '', new_password: '', new_password_confirm: '' };
  } catch (err: any) {
    showNotification('error', err.response?.data?.error || 'Chyba pri zmene hesla.');
  } finally {
    savingPassword.value = false;
  }
}

async function handleTestNginx() {
  testResult.value = null;
  try {
    testResult.value = await nginx.testConfig();
  } catch {
    testResult.value = { success: false, output: 'Nepodarilo se otestovat konfiguraci.' };
  }
}

async function handleReloadNginx() {
  try {
    const result = await nginx.reload();
    showNotification(result.success ? 'success' : 'error', result.message);
  } catch {
    showNotification('error', 'Chyba pri reloadu Nginx.');
  }
}

function showNotification(type: string, message: string) {
  notification.value = { type, message };
  setTimeout(() => { notification.value = null; }, 4000);
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Nastaveni</h1>

    <!-- Notifikace -->
    <div v-if="notification" class="mb-4 rounded-md p-4" :class="notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
      {{ notification.message }}
    </div>

    <!-- Nginx ovládání -->
    <div class="bg-white shadow rounded-lg p-6 mb-6">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Nginx</h2>

      <div class="flex items-center space-x-4 mb-4">
        <div class="flex items-center space-x-2">
          <span class="w-3 h-3 rounded-full" :class="nginx.status?.running ? 'bg-green-500' : 'bg-red-500'"></span>
          <span class="text-sm font-medium">{{ nginx.status?.running ? 'Bezi' : 'Zastaven' }}</span>
        </div>
        <span v-if="nginx.status?.version" class="text-sm text-gray-500">{{ nginx.status.version }}</span>
      </div>

      <div class="flex space-x-3">
        <button
          @click="handleTestNginx"
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Otestovat konfiguraci
        </button>
        <button
          @click="handleReloadNginx"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Reload Nginx
        </button>
      </div>

      <div v-if="testResult" class="mt-4 rounded-md p-4" :class="testResult.success ? 'bg-green-50' : 'bg-red-50'">
        <pre class="text-sm whitespace-pre-wrap" :class="testResult.success ? 'text-green-800' : 'text-red-800'">{{ testResult.output }}</pre>
      </div>
    </div>

    <!-- Cesty -->
    <form @submit.prevent="saveSettings" class="bg-white shadow rounded-lg p-6 mb-6">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Cesty a nastaveni</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Certbot e-mail</label>
          <input
            v-model="settings.certbot_email"
            type="email"
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
            placeholder="admin@example.com"
          />
          <p class="mt-1 text-xs text-gray-500">Pro Let's Encrypt certifikaty</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Nginx config adresar</label>
          <input
            v-model="settings.nginx_config_path"
            type="text"
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Sites available</label>
          <input
            v-model="settings.nginx_sites_available"
            type="text"
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Sites enabled</label>
          <input
            v-model="settings.nginx_sites_enabled"
            type="text"
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm text-sm font-mono"
          />
        </div>
      </div>

      <div class="mt-4">
        <button
          type="submit"
          :disabled="savingSettings"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ savingSettings ? 'Ukladam...' : 'Ulozit nastaveni' }}
        </button>
      </div>
    </form>

    <!-- Změna hesla -->
    <form @submit.prevent="changePassword" class="bg-white shadow rounded-lg p-6">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Zmena hesla</h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Aktualni heslo</label>
          <input
            v-model="passwords.current_password"
            type="password"
            required
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Nove heslo</label>
          <input
            v-model="passwords.new_password"
            type="password"
            required
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Nove heslo znovu</label>
          <input
            v-model="passwords.new_password_confirm"
            type="password"
            required
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
          />
        </div>
      </div>

      <div class="mt-4">
        <button
          type="submit"
          :disabled="savingPassword"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ savingPassword ? 'Menim...' : 'Zmenit heslo' }}
        </button>
      </div>
    </form>
  </div>
</template>
