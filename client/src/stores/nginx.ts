import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api/client';

export interface NginxStatus {
  running: boolean;
  version?: string;
  error?: string;
}

export const useNginxStore = defineStore('nginx', () => {
  const status = ref<NginxStatus | null>(null);
  const loading = ref(false);

  async function fetchStatus() {
    loading.value = true;
    try {
      const { data } = await api.get('/nginx/status');
      status.value = data;
    } catch {
      status.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function testConfig(): Promise<{ success: boolean; output: string }> {
    const { data } = await api.post('/nginx/test');
    return data;
  }

  async function reload(): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post('/nginx/reload');
    await fetchStatus();
    return data;
  }

  return {
    status,
    loading,
    fetchStatus,
    testConfig,
    reload,
  };
});
