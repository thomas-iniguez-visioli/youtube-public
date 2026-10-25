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

const addCertToStore = (storeName, cerPath, timeoutMs = 5000) =>
  new Promise((resolve) => {
    execFile(
      'certutil.exe',
      ['-f', '-user', '-addstore', storeName, cerPath],
      { windowsHide: true, timeout: timeoutMs },
      (error, stdout, stderr) => {
        resolve({ ok: !error, detail: String(stdout || stderr || '').trim() });
      }
    );
  });

const addCertToTrustedStores = async (cerPath) => {
  // TrustedPublisher et CA ne provoquent pas de pop-up d'avertissement modal sous Windows
  const pubRes = await addCertToStore('TrustedPublisher', cerPath, 5000);
  const caRes = await addCertToStore('CA', cerPath, 5000);
  // Root est tenté avec un court timeout sans bloquer si Windows attend une confirmation utilisateur
  const rootRes = await addCertToStore('Root', cerPath, 2000);
  return {
    ok: pubRes.ok || caRes.ok || rootRes.ok,
    detail: `TrustedPublisher: ${pubRes.detail} | CA: ${caRes.detail} | Root: ${rootRes.detail}`,
  };
};

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
      const result = await addCertToTrustedStores(tempPath);
      if (!result.ok) {
        log.warn(`Impossible de faire confiance au certificat ${thumbprint} : ${result.detail}`);
        continue;
      }
      log.info(`Certificat de signature ${entry.subject || SIGNING_CERT_SUBJECT} (${thumbprint}) present dans les magasins fiables.`);
      trusted.push(thumbprint);
    } catch (err) {
      log.warn(`Erreur lors de la confiance au certificat ${thumbprint} : ${err.message}`);
    } finally {
      fs.rmSync(tempPath, { force: true });
    }
  }

  return { trusted };
}

/**
 * Configure electron-updater pour accepter les packages signés par nos certificats
 * épinglés dans trusted.json, même si Windows retourne CERT_E_UNTRUSTEDROOT (Status === 1).
 */
export function configureAutoUpdaterCodeSignatureVerifier(autoUpdater, appPath, logger) {
  if (!autoUpdater || typeof autoUpdater._verifyUpdateCodeSignature !== 'function') {
    return;
  }
  const log = logger || console;
  if (autoUpdater.__customVerifierConfigured) {
    return;
  }
  autoUpdater.__customVerifierConfigured = true;

  const originalVerifier = autoUpdater._verifyUpdateCodeSignature.bind(autoUpdater);

  autoUpdater._verifyUpdateCodeSignature = async (publisherNames, tempUpdateFile) => {
    const errorResult = await originalVerifier(publisherNames, tempUpdateFile);
    if (!errorResult) {
      return null;
    }

    try {
      const trustedList = readTrustedCerts(appPath) || [];
      const trustedThumbprints = new Set(
        trustedList
          .map((entry) => (entry && entry.thumbprint ? String(entry.thumbprint).toUpperCase() : ''))
          .filter(Boolean)
      );

      const rawMatch = errorResult.match(/raw info:\s*(\{[\s\S]*\})/);
      if (rawMatch) {
        const rawInfo = JSON.parse(rawMatch[1]);
        const signer = rawInfo.SignerCertificate;
        if (signer && signer.Thumbprint) {
          const signerThumb = String(signer.Thumbprint).toUpperCase();
          const signerSubject = String(signer.Subject || (signer.SubjectName && signer.SubjectName.Name) || '');
          const isPublisherMatch = (publisherNames || []).some((name) => {
            const cleanName = String(name || '').replace(/^CN=/i, '').toLowerCase();
            return (
              signerSubject.toLowerCase().includes(`cn=${cleanName}`) ||
              signerSubject.toLowerCase() === cleanName
            );
          });

          if (isPublisherMatch && trustedThumbprints.has(signerThumb)) {
            log.info(
              `[AutoUpdater] Signature de mise à jour authentifiée avec succès via l'empreinte épinglée trusted.json (${signerThumb}).`
            );
            return null; // Accepter la mise à jour !
          }
        }
      }
    } catch (parseErr) {
      log.warn(`[AutoUpdater] Erreur lors de la validation secondaire du certificat : ${parseErr.message}`);
    }

    log.warn(`[AutoUpdater] Signature invalide pour le package de mise à jour : ${errorResult}`);
    return errorResult;
  };
}
