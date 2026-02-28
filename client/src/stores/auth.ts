import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api/client';

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false);
  const setupComplete = ref(true);
  const loading = ref(true);

  async function checkStatus() {
    try {
      const { data } = await api.get('/auth/status');
      setupComplete.value = data.setup_complete;

      if (data.setup_complete) {
        try {
          await api.get('/auth/me');
          isAuthenticated.value = true;
        } catch {
          isAuthenticated.value = false;
        }
      }
    } catch {
      // Server nedostupný
    } finally {
      loading.value = false;
    }
  }

  async function login(password: string) {
    const { data } = await api.post('/auth/login', { password });
    isAuthenticated.value = true;
    return data;
  }

  async function setup(password: string) {
    const { data } = await api.post('/auth/setup', { password });
    isAuthenticated.value = true;
    setupComplete.value = true;
    return data;
  }

  async function logout() {
    await api.post('/auth/logout');
    isAuthenticated.value = false;
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  return {
    isAuthenticated,
    setupComplete,
    loading,
    checkStatus,
    login,
    setup,
    logout,
    changePassword,
  };
});
