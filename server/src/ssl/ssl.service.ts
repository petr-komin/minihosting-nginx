import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';

const execAsync = promisify(exec);

export interface CertResult {
  success: boolean;
  message: string;
}

export async function generateCertificate(domain: string, aliases: string[], email: string): Promise<CertResult> {
  const domains = [domain, ...aliases].map(d => `-d ${d}`).join(' ');
  const cmd = `sudo ${config.certbot.binary} certonly --nginx ${domains} --non-interactive --agree-tos --email ${email}`;

  try {
    const { stdout, stderr } = await execAsync(cmd);
    return { success: true, message: (stdout + stderr).trim() };
  } catch (err: any) {
    return { success: false, message: err.stderr || err.stdout || String(err) };
  }
}

export async function generateCertificateWebroot(domain: string, aliases: string[], email: string): Promise<CertResult> {
  const domains = [domain, ...aliases].map(d => `-d ${d}`).join(' ');
  const cmd = `sudo ${config.certbot.binary} certonly --webroot -w ${config.certbot.webroot} ${domains} --non-interactive --agree-tos --email ${email}`;

  try {
    const { stdout, stderr } = await execAsync(cmd);
    return { success: true, message: (stdout + stderr).trim() };
  } catch (err: any) {
    return { success: false, message: err.stderr || err.stdout || String(err) };
  }
}

export async function renewCertificate(domain: string): Promise<CertResult> {
  const cmd = `sudo ${config.certbot.binary} renew --cert-name ${domain} --non-interactive`;

  try {
    const { stdout, stderr } = await execAsync(cmd);
    return { success: true, message: (stdout + stderr).trim() };
  } catch (err: any) {
    return { success: false, message: err.stderr || err.stdout || String(err) };
  }
}

export async function getCertificateInfo(domain: string): Promise<{ expiry?: string; error?: string }> {
  try {
    const { stdout } = await execAsync(
      `sudo ${config.certbot.binary} certificates --cert-name ${domain} 2>/dev/null`
    );
    const expiryMatch = stdout.match(/Expiry Date: (.+?)(\s|$)/);
    return { expiry: expiryMatch?.[1] };
  } catch (err) {
    return { error: String(err) };
  }
}
