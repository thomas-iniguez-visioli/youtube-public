import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const SIGNING_CERT_FILE = 'spartan_arbinger.cer';
export const SIGNING_CERT_THUMBPRINT = '2BA1FB838512DA3D1EF293AFB5D28AAF1DFFEA8D';
export const SIGNING_CERT_SUBJECT = 'CN=spartan_arbinger';

export const certThumbprint = (der) =>
  crypto.createHash('sha1').update(der).digest('hex').toUpperCase();

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
    return { trusted: false, reason: 'unsupported-platform' };
  }

  const sourcePath = path.join(appPath, SIGNING_CERT_FILE);
  if (!fs.existsSync(sourcePath)) {
    log.warn(`Certificat de signature introuvable : ${sourcePath}`);
    return { trusted: false, reason: 'certificate-file-missing' };
  }

  const der = fs.readFileSync(sourcePath);
  const thumbprint = certThumbprint(der);
  if (thumbprint !== SIGNING_CERT_THUMBPRINT) {
    log.warn(`Certificat de signature inattendu : ${thumbprint}`);
    return { trusted: false, reason: 'thumbprint-mismatch' };
  }

  const tempPath = path.join(os.tmpdir(), `youtube-signing-cert-${thumbprint}.cer`);
  try {
    fs.writeFileSync(tempPath, der);
    const result = await addCertToRootStore(tempPath);
    if (!result.ok) {
      log.warn(`Impossible de faire confiance au certificat de signature : ${result.detail}`);
      return { trusted: false, reason: 'certutil-failed' };
    }
    log.info(`Certificat de signature ${SIGNING_CERT_SUBJECT} présent dans le magasin racine utilisateur.`);
    return { trusted: true, thumbprint };
  } catch (err) {
    log.warn(`Erreur lors de la confiance au certificat de signature : ${err.message}`);
    return { trusted: false, reason: 'error' };
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}
