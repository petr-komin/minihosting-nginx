import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';

const execAsync = promisify(exec);

// === Typy ===

export interface DiskInfo {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  usedPercent: number;
  mountpoint: string;
}

export interface CpuInfo {
  model: string;
  cores: number;
  usagePercent: number;
}

export interface MemoryInfo {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  usedPercent: number;
  swapTotalMB: number;
  swapUsedMB: number;
  swapPercent: number;
}

export interface LoadInfo {
  load1: number;
  load5: number;
  load15: number;
  cores: number;
}

export interface NetworkInterface {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxFormatted: string;
  txFormatted: string;
}

export interface ProcessInfo {
  name: string;
  pid: number;
  cpuPercent: number;
  memPercent: number;
}

export interface UptimeInfo {
  seconds: number;
  formatted: string;
}

export interface ServerStats {
  hostname: string;
  platform: string;
  kernel: string;
  uptime: UptimeInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  load: LoadInfo;
  disks: DiskInfo[];
  network: NetworkInterface[];
  topProcesses: ProcessInfo[];
  timestamp: number;
}

// === Helpery ===

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

// === Sběr dat ===

async function getDiskInfo(): Promise<DiskInfo[]> {
  try {
    const { stdout } = await execAsync('df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs -x squashfs 2>/dev/null');
    const lines = stdout.trim().split('\n').slice(1); // Přeskočit hlavičku

    return lines
      .map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6) return null;
        return {
          filesystem: parts[0],
          size: parts[1],
          used: parts[2],
          available: parts[3],
          usedPercent: parseInt(parts[4].replace('%', '')) || 0,
          mountpoint: parts[5],
        };
      })
      .filter((d): d is DiskInfo => d !== null);
  } catch {
    return [];
  }
}

async function getCpuUsage(): Promise<CpuInfo> {
  const cpus = os.cpus();
  const model = cpus[0]?.model || 'Neznámý';
  const cores = cpus.length;

  // Získat CPU usage z /proc/stat — snapshot za ~1s interval
  try {
    const { stdout } = await execAsync(
      "grep 'cpu ' /proc/stat && sleep 0.5 && grep 'cpu ' /proc/stat"
    );
    const lines = stdout.trim().split('\n');
    if (lines.length === 2) {
      const parse = (line: string) => {
        const parts = line.split(/\s+/).slice(1).map(Number);
        const idle = parts[3] + (parts[4] || 0); // idle + iowait
        const total = parts.reduce((a, b) => a + b, 0);
        return { idle, total };
      };
      const first = parse(lines[0]);
      const second = parse(lines[1]);
      const idleDiff = second.idle - first.idle;
      const totalDiff = second.total - first.total;
      const usagePercent = totalDiff > 0 ? Math.round(((totalDiff - idleDiff) / totalDiff) * 100) : 0;
      return { model, cores, usagePercent };
    }
  } catch {
    // Fallback
  }

  return { model, cores, usagePercent: 0 };
}

function getMemoryInfo(): MemoryInfo {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
    const getValue = (key: string): number => {
      const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
      return match ? parseInt(match[1]) : 0; // v kB
    };

    const totalKB = getValue('MemTotal');
    const freeKB = getValue('MemFree');
    const buffersKB = getValue('Buffers');
    const cachedKB = getValue('Cached');
    const sReclaimableKB = getValue('SReclaimable');
    const availableKB = getValue('MemAvailable');

    const usedKB = totalKB - availableKB;
    const swapTotalKB = getValue('SwapTotal');
    const swapFreeKB = getValue('SwapFree');
    const swapUsedKB = swapTotalKB - swapFreeKB;

    return {
      totalMB: Math.round(totalKB / 1024),
      usedMB: Math.round(usedKB / 1024),
      freeMB: Math.round(availableKB / 1024),
      usedPercent: totalKB > 0 ? Math.round((usedKB / totalKB) * 100) : 0,
      swapTotalMB: Math.round(swapTotalKB / 1024),
      swapUsedMB: Math.round(swapUsedKB / 1024),
      swapPercent: swapTotalKB > 0 ? Math.round((swapUsedKB / swapTotalKB) * 100) : 0,
    };
  } catch {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return {
      totalMB: Math.round(totalMem / 1024 / 1024),
      usedMB: Math.round(usedMem / 1024 / 1024),
      freeMB: Math.round(freeMem / 1024 / 1024),
      usedPercent: Math.round((usedMem / totalMem) * 100),
      swapTotalMB: 0,
      swapUsedMB: 0,
      swapPercent: 0,
    };
  }
}

function getLoadInfo(): LoadInfo {
  const [load1, load5, load15] = os.loadavg();
  return {
    load1: Math.round(load1 * 100) / 100,
    load5: Math.round(load5 * 100) / 100,
    load15: Math.round(load15 * 100) / 100,
    cores: os.cpus().length,
  };
}

async function getNetworkInfo(): Promise<NetworkInterface[]> {
  try {
    const content = fs.readFileSync('/proc/net/dev', 'utf-8');
    const lines = content.trim().split('\n').slice(2); // Přeskočit 2 hlavičky

    return lines
      .map(line => {
        const parts = line.trim().split(/[\s:]+/);
        const name = parts[0];
        if (name === 'lo') return null; // Přeskočit loopback

        const rxBytes = parseInt(parts[1]) || 0;
        const txBytes = parseInt(parts[9]) || 0;

        return {
          name,
          rxBytes,
          txBytes,
          rxFormatted: formatBytes(rxBytes),
          txFormatted: formatBytes(txBytes),
        };
      })
      .filter((n): n is NetworkInterface => n !== null);
  } catch {
    return [];
  }
}

async function getTopProcesses(): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await execAsync('ps aux --sort=-%cpu | head -6');
    const lines = stdout.trim().split('\n').slice(1); // Přeskočit hlavičku

    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        pid: parseInt(parts[1]) || 0,
        cpuPercent: parseFloat(parts[2]) || 0,
        memPercent: parseFloat(parts[3]) || 0,
        name: parts.slice(10).join(' ').substring(0, 60),
      };
    });
  } catch {
    return [];
  }
}

async function getKernelVersion(): Promise<string> {
  try {
    const { stdout } = await execAsync('uname -r');
    return stdout.trim();
  } catch {
    return os.release();
  }
}

// === Hlavní export ===

export async function getServerStats(): Promise<ServerStats> {
  const uptimeSeconds = os.uptime();

  // Paralelní sběr dat
  const [cpu, disks, network, topProcesses, kernel] = await Promise.all([
    getCpuUsage(),
    getDiskInfo(),
    getNetworkInfo(),
    getTopProcesses(),
    getKernelVersion(),
  ]);

  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.arch()}`,
    kernel,
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    cpu,
    memory: getMemoryInfo(),
    load: getLoadInfo(),
    disks,
    network,
    topProcesses,
    timestamp: Date.now(),
  };
}
