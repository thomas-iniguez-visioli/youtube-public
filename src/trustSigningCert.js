import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const CERTS_DIR = 'signing-certs';
export const TRUSTED_CERTS_FILE = 'trusted.json';
export const SIGNING_CERT_SUBJECT = 'CN=spartan_arbinger';

export const certThumbprint = (der) =>
  crypto.createHash('sha1').update(der).digest('hex').toUpperCase();

export const readTrustedCerts = (appPath) => {
  const listPath = path.join(appPath, CERTS_DIR, TRUSTED_CERTS_FILE);
  if (!fs.existsSync(listPath)) return null;
  try {
    const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    return Array.isArray(list) ? list : null;
  } catch (err) {
    return null;
  }
};

const addCertToRootStore = (cerPath) =>
  new Promise((resolve) => {
    execFile(
      'certutil.exe',
      ['-f', '-user', '-addstore', 'Root', cerPath],
      { windowsHide: true, timeout: 60000 },
      (error, stdout, stderr) => {
        resolve({ ok: !error, detail: String(stdout || stderr || '').trim() });
      }
    );
  });

export async function ensureSigningCertTrusted(appPath, logger) {
  const log = logger || console;
  if (process.platform !== 'win32') {
    return { trusted: [], reason: 'unsupported-platform' };
  }

  const certs = readTrustedCerts(appPath);
  if (certs == null) {
    log.warn(`Liste des certificats de signature introuvable : ${path.join(appPath, CERTS_DIR, TRUSTED_CERTS_FILE)}`);
    return { trusted: [], reason: 'trusted-list-missing' };
  }

  const trusted = [];
  for (const entry of certs) {
    const fileName = entry && entry.file;
    if (typeof fileName !== 'string' || path.basename(fileName) !== fileName) {
      log.warn('Entree de certificat de signature invalide.');
      continue;
    }

    const sourcePath = path.join(appPath, CERTS_DIR, fileName);
    if (!fs.existsSync(sourcePath)) {
      log.warn(`Certificat de signature introuvable : ${sourcePath}`);
      continue;
    }

    const der = fs.readFileSync(sourcePath);
    const thumbprint = certThumbprint(der);
    if (thumbprint !== entry.thumbprint) {
      log.warn(`Certificat de signature inattendu : ${thumbprint}`);
      continue;
    }

    const tempPath = path.join(os.tmpdir(), `youtube-signing-cert-${thumbprint}.cer`);
    try {
      fs.writeFileSync(tempPath, der);
      const result = await addCertToRootStore(tempPath);
      if (!result.ok) {
        log.warn(`Impossible de faire confiance au certificat ${thumbprint} : ${result.detail}`);
        continue;
      }
      log.info(`Certificat de signature ${entry.subject || SIGNING_CERT_SUBJECT} (${thumbprint}) present dans le magasin racine utilisateur.`);
      trusted.push(thumbprint);
    } catch (err) {
      log.warn(`Erreur lors de la confiance au certificat ${thumbprint} : ${err.message}`);
    } finally {
      fs.rmSync(tempPath, { force: true });
    }
  }

  return { trusted };
}
