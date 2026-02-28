<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import api from '@/api/client';

interface DiskInfo {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  usedPercent: number;
  mountpoint: string;
}

interface CpuInfo {
  model: string;
  cores: number;
  usagePercent: number;
}

interface MemoryInfo {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  usedPercent: number;
  swapTotalMB: number;
  swapUsedMB: number;
  swapPercent: number;
}

interface LoadInfo {
  load1: number;
  load5: number;
  load15: number;
  cores: number;
}

interface NetworkInterface {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxFormatted: string;
  txFormatted: string;
}

interface ProcessInfo {
  name: string;
  pid: number;
  cpuPercent: number;
  memPercent: number;
}

interface ServerStats {
  hostname: string;
  platform: string;
  kernel: string;
  uptime: { seconds: number; formatted: string };
  cpu: CpuInfo;
  memory: MemoryInfo;
  load: LoadInfo;
  disks: DiskInfo[];
  network: NetworkInterface[];
  topProcesses: ProcessInfo[];
  timestamp: number;
}

const stats = ref<ServerStats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const loadColor = computed(() => {
  if (!stats.value) return 'text-gray-500';
  const ratio = stats.value.load.load1 / stats.value.load.cores;
  if (ratio < 0.7) return 'text-green-600';
  if (ratio < 1.0) return 'text-yellow-600';
  return 'text-red-600';
});

function barColor(percent: number): string {
  if (percent < 60) return 'bg-green-500';
  if (percent < 85) return 'bg-yellow-500';
  return 'bg-red-500';
}

function barBgColor(percent: number): string {
  if (percent < 60) return 'bg-green-100';
  if (percent < 85) return 'bg-yellow-100';
  return 'bg-red-100';
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

async function fetchStats() {
  try {
    const { data } = await api.get('/monitor/stats');
    stats.value = data;
    error.value = null;
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Chyba pri nacitani stavu serveru.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchStats();
  // Auto-refresh kazdych 5 sekund
  refreshInterval = setInterval(fetchStats, 5000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Monitoring serveru</h1>
        <p v-if="stats" class="mt-1 text-sm text-gray-500">
          {{ stats.hostname }} &middot; {{ stats.platform }} &middot; kernel {{ stats.kernel }}
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <span class="text-xs text-gray-400">Auto-refresh 5s</span>
        <button
          @click="fetchStats"
          :disabled="loading"
          class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Obnovit
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && !stats" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Chyba -->
    <div v-if="error" class="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
    </div>

    <div v-if="stats">
      <!-- Uptime + Load - top cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <!-- Uptime -->
        <div class="bg-white shadow rounded-lg p-5">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-xs font-medium text-gray-500 uppercase">Uptime</p>
              <p class="text-lg font-semibold text-gray-900">{{ stats.uptime.formatted }}</p>
            </div>
          </div>
        </div>

        <!-- CPU -->
        <div class="bg-white shadow rounded-lg p-5">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-xs font-medium text-gray-500 uppercase">CPU</p>
              <p class="text-lg font-semibold" :class="stats.cpu.usagePercent > 80 ? 'text-red-600' : 'text-gray-900'">{{ stats.cpu.usagePercent }}%</p>
              <p class="text-xs text-gray-400">{{ stats.cpu.cores }} jader</p>
            </div>
          </div>
        </div>

        <!-- Load -->
        <div class="bg-white shadow rounded-lg p-5">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-xs font-medium text-gray-500 uppercase">Load</p>
              <p class="text-lg font-semibold" :class="loadColor">{{ stats.load.load1 }}</p>
              <p class="text-xs text-gray-400">{{ stats.load.load5 }} / {{ stats.load.load15 }}</p>
            </div>
          </div>
        </div>

        <!-- RAM -->
        <div class="bg-white shadow rounded-lg p-5">
          <div class="flex items-center">
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-xs font-medium text-gray-500 uppercase">RAM</p>
              <p class="text-lg font-semibold" :class="stats.memory.usedPercent > 85 ? 'text-red-600' : 'text-gray-900'">{{ stats.memory.usedPercent }}%</p>
              <p class="text-xs text-gray-400">{{ formatMB(stats.memory.usedMB) }} / {{ formatMB(stats.memory.totalMB) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailni sekce -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Pamet -->
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-sm font-medium text-gray-900 mb-4 uppercase tracking-wider">Pamet</h2>

          <div class="space-y-4">
            <!-- RAM bar -->
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">RAM</span>
                <span class="text-gray-900 font-medium">{{ formatMB(stats.memory.usedMB) }} / {{ formatMB(stats.memory.totalMB) }}</span>
              </div>
              <div class="w-full h-3 rounded-full" :class="barBgColor(stats.memory.usedPercent)">
                <div
                  class="h-3 rounded-full transition-all duration-500"
                  :class="barColor(stats.memory.usedPercent)"
                  :style="{ width: stats.memory.usedPercent + '%' }"
                ></div>
              </div>
              <p class="text-xs text-gray-400 mt-1">Volne: {{ formatMB(stats.memory.freeMB) }}</p>
            </div>

            <!-- Swap bar -->
            <div v-if="stats.memory.swapTotalMB > 0">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">Swap</span>
                <span class="text-gray-900 font-medium">{{ formatMB(stats.memory.swapUsedMB) }} / {{ formatMB(stats.memory.swapTotalMB) }}</span>
              </div>
              <div class="w-full h-3 rounded-full" :class="barBgColor(stats.memory.swapPercent)">
                <div
                  class="h-3 rounded-full transition-all duration-500"
                  :class="barColor(stats.memory.swapPercent)"
                  :style="{ width: stats.memory.swapPercent + '%' }"
                ></div>
              </div>
            </div>
            <div v-else class="text-xs text-gray-400">Swap neni nakonfigurovan.</div>
          </div>
        </div>

        <!-- CPU info -->
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-sm font-medium text-gray-900 mb-4 uppercase tracking-wider">CPU</h2>

          <div class="space-y-4">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">Vyuziti</span>
                <span class="text-gray-900 font-medium">{{ stats.cpu.usagePercent }}%</span>
              </div>
              <div class="w-full h-3 rounded-full" :class="barBgColor(stats.cpu.usagePercent)">
                <div
                  class="h-3 rounded-full transition-all duration-500"
                  :class="barColor(stats.cpu.usagePercent)"
                  :style="{ width: stats.cpu.usagePercent + '%' }"
                ></div>
              </div>
            </div>

            <div class="text-sm">
              <p class="text-gray-600">Model: <span class="text-gray-900">{{ stats.cpu.model }}</span></p>
              <p class="text-gray-600">Jader: <span class="text-gray-900">{{ stats.cpu.cores }}</span></p>
            </div>

            <div>
              <p class="text-sm text-gray-600 mb-2">Load average</p>
              <div class="flex space-x-4">
                <div class="text-center">
                  <p class="text-lg font-semibold" :class="loadColor">{{ stats.load.load1 }}</p>
                  <p class="text-xs text-gray-400">1 min</p>
                </div>
                <div class="text-center">
                  <p class="text-lg font-semibold text-gray-700">{{ stats.load.load5 }}</p>
                  <p class="text-xs text-gray-400">5 min</p>
                </div>
                <div class="text-center">
                  <p class="text-lg font-semibold text-gray-700">{{ stats.load.load15 }}</p>
                  <p class="text-xs text-gray-400">15 min</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Disky -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <h2 class="text-sm font-medium text-gray-900 mb-4 uppercase tracking-wider">Disky</h2>

        <div class="space-y-4">
          <div v-for="disk in stats.disks" :key="disk.mountpoint">
            <div class="flex justify-between text-sm mb-1">
              <span class="text-gray-600">
                {{ disk.mountpoint }}
                <span class="text-xs text-gray-400 ml-1">({{ disk.filesystem }})</span>
              </span>
              <span class="text-gray-900 font-medium">{{ disk.used }} / {{ disk.size }}</span>
            </div>
            <div class="w-full h-3 rounded-full" :class="barBgColor(disk.usedPercent)">
              <div
                class="h-3 rounded-full transition-all duration-500"
                :class="barColor(disk.usedPercent)"
                :style="{ width: disk.usedPercent + '%' }"
              ></div>
            </div>
            <p class="text-xs text-gray-400 mt-1">Volne: {{ disk.available }} ({{ 100 - disk.usedPercent }}%)</p>
          </div>
          <div v-if="stats.disks.length === 0" class="text-sm text-gray-400">Zadne disky nenalezeny.</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Sit -->
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-sm font-medium text-gray-900 mb-4 uppercase tracking-wider">Sit (od startu)</h2>

          <div v-if="stats.network.length === 0" class="text-sm text-gray-400">Zadna sitova rozhrani.</div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-500 uppercase">
                  <th class="pb-2 pr-4">Rozhrani</th>
                  <th class="pb-2 pr-4">Prijato (RX)</th>
                  <th class="pb-2">Odeslano (TX)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="iface in stats.network" :key="iface.name" class="border-t border-gray-100">
                  <td class="py-2 pr-4 font-medium text-gray-900">{{ iface.name }}</td>
                  <td class="py-2 pr-4 text-gray-600">{{ iface.rxFormatted }}</td>
                  <td class="py-2 text-gray-600">{{ iface.txFormatted }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top procesy -->
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-sm font-medium text-gray-900 mb-4 uppercase tracking-wider">Top procesy (CPU)</h2>

          <div v-if="stats.topProcesses.length === 0" class="text-sm text-gray-400">Zadne procesy.</div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-500 uppercase">
                  <th class="pb-2 pr-4">PID</th>
                  <th class="pb-2 pr-4">CPU</th>
                  <th class="pb-2 pr-4">RAM</th>
                  <th class="pb-2">Prikaz</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="proc in stats.topProcesses" :key="proc.pid" class="border-t border-gray-100">
                  <td class="py-2 pr-4 text-gray-500 font-mono text-xs">{{ proc.pid }}</td>
                  <td class="py-2 pr-4 font-medium" :class="proc.cpuPercent > 50 ? 'text-red-600' : 'text-gray-900'">{{ proc.cpuPercent }}%</td>
                  <td class="py-2 pr-4 text-gray-600">{{ proc.memPercent }}%</td>
                  <td class="py-2 text-gray-600 font-mono text-xs truncate max-w-[200px]">{{ proc.name }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
