<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSitesStore } from '@/stores/sites';

const props = defineProps<{
  siteData: Record<string, any>;
}>();

const sitesStore = useSitesStore();
const preview = ref('');
const loading = ref(false);
const error = ref('');

async function loadPreview() {
  if (!props.siteData.domain || !props.siteData.type) return;

  loading.value = true;
  error.value = '';
  try {
    preview.value = await sitesStore.previewConfig(props.siteData);
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Nepodarilo se vygenerovat nahled.';
    preview.value = '';
  } finally {
    loading.value = false;
  }
}

// Debounce
let timer: ReturnType<typeof setTimeout>;
watch(() => props.siteData, () => {
  clearTimeout(timer);
  timer = setTimeout(loadPreview, 500);
}, { deep: true, immediate: true });
</script>

<template>
  <div class="bg-gray-900 rounded-lg overflow-hidden">
    <div class="flex justify-between items-center px-4 py-2 bg-gray-800">
      <span class="text-sm text-gray-300">Nahled Nginx konfigurace</span>
      <button
        @click="loadPreview"
        class="text-xs text-indigo-400 hover:text-indigo-300"
      >
        Obnovit
      </button>
    </div>

    <div v-if="loading" class="p-4 text-gray-400 text-sm">
      Generuji...
    </div>
    <div v-else-if="error" class="p-4 text-red-400 text-sm">
      {{ error }}
    </div>
    <pre v-else class="p-4 text-sm text-green-300 overflow-x-auto max-h-96 overflow-y-auto"><code>{{ preview || '# Vyplnte formular pro vygenerovani nahledu' }}</code></pre>
  </div>
</template>
