import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { Site } from '../sites/sites.types';
import { generateNginxConfig, generateConfigFileName } from './nginx.templates';

const execAsync = promisify(exec);

export interface NginxStatus {
  running: boolean;
  version?: string;
  error?: string;
}

export interface NginxTestResult {
  success: boolean;
  output: string;
}

export async function getNginxStatus(): Promise<NginxStatus> {
  try {
    const { stdout } = await execAsync(`${config.nginx.binary} -v 2>&1`);
    // Zkontrolovat jestli běží
    try {
      await execAsync('pgrep -x nginx');
      return { running: true, version: stdout.trim() };
    } catch {
      return { running: false, version: stdout.trim() };
    }
  } catch (err) {
    return { running: false, error: String(err) };
  }
}

export async function testNginxConfig(): Promise<NginxTestResult> {
  try {
    const { stdout, stderr } = await execAsync(`sudo ${config.nginx.binary} -t 2>&1`);
    const output = stdout + stderr;
    return { success: true, output: output.trim() };
  } catch (err: any) {
    return { success: false, output: err.stderr || err.stdout || String(err) };
  }
}

export async function reloadNginx(): Promise<{ success: boolean; message: string }> {
  // Nejdřív test
  const test = await testNginxConfig();
  if (!test.success) {
    return { success: false, message: `Konfigurace obsahuje chyby:\n${test.output}` };
  }

  try {
    await execAsync(`sudo ${config.nginx.binary} -s reload`);
    return { success: true, message: 'Nginx byl úspěšně reloadnutý.' };
  } catch (err: any) {
    return { success: false, message: err.stderr || String(err) };
  }
}

export function writeNginxConfig(site: Site): void {
  const fileName = generateConfigFileName(site);
  const configContent = generateNginxConfig(site);
  const availablePath = path.join(config.nginx.sitesAvailable, fileName);

  // Zapsat konfiguraci
  fs.writeFileSync(availablePath, configContent, 'utf-8');

  // Spravovat symlink v sites-enabled
  const enabledPath = path.join(config.nginx.sitesEnabled, fileName);

  if (site.enabled) {
    // Vytvořit symlink pokud neexistuje
    if (!fs.existsSync(enabledPath)) {
      fs.symlinkSync(availablePath, enabledPath);
    }
  } else {
    // Smazat symlink pokud existuje
    if (fs.existsSync(enabledPath)) {
      fs.unlinkSync(enabledPath);
    }
  }
}

export function isConfigDeployed(site: Site): boolean {
  // 1) Kontrola hostingy_*.conf v sites-enabled
  const fileName = generateConfigFileName(site);
  const enabledPath = path.join(config.nginx.sitesEnabled, fileName);
  if (fs.existsSync(enabledPath)) {
    return true;
  }

  // 2) Kontrola jakéhokoliv config souboru v sites-enabled obsahujícího server_name s touto doménou
  //    Pokrývá importované weby, kde původní config má jiný název
  try {
    const enabledDir = config.nginx.sitesEnabled;
    if (!fs.existsSync(enabledDir)) return false;

    const files = fs.readdirSync(enabledDir);
    for (const f of files) {
      const fullPath = path.join(enabledDir, f);
      try {
        if (!fs.statSync(fullPath).isFile()) continue;
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Hledáme server_name direktivu obsahující naši doménu
        const regex = new RegExp(`server_name\\s+[^;]*\\b${escapeRegex(site.domain)}\\b`, 'm');
        if (regex.test(content)) {
          return true;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Nelze číst sites-enabled — vrátit false
  }

  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function removeNginxConfig(site: Site): void {
  const fileName = generateConfigFileName(site);
  const availablePath = path.join(config.nginx.sitesAvailable, fileName);
  const enabledPath = path.join(config.nginx.sitesEnabled, fileName);

  if (fs.existsSync(enabledPath)) {
    fs.unlinkSync(enabledPath);
  }
  if (fs.existsSync(availablePath)) {
    fs.unlinkSync(availablePath);
  }
}
