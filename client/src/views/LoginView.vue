<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(password.value);
    router.push('/');
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Chyba pri prihlaseni.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h1 class="text-center text-3xl font-bold text-indigo-600">Hostingy</h1>
        <h2 class="mt-2 text-center text-lg text-gray-600">Sprava webhostingu</h2>
      </div>

      <form @submit.prevent="handleLogin" class="mt-8 bg-white shadow-md rounded-lg p-8 space-y-6">
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Heslo</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autofocus
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Zadejte heslo"
          />
        </div>

        <div v-if="error" class="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Prihlasovani...
          </span>
          <span v-else>Prihlasit se</span>
        </button>
      </form>
    </div>
  </div>
</template>
