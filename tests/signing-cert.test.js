import assert from 'node:assert';
import { test } from 'node:test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SIGNING_CERT_FILE,
  SIGNING_CERT_THUMBPRINT,
  SIGNING_CERT_SUBJECT,
  certThumbprint,
  ensureSigningCertTrusted,
} from '../src/trustSigningCert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certPath = path.join(__dirname, '..', SIGNING_CERT_FILE);

test('signing certificate file is shipped with the app', () => {
  assert.ok(fs.existsSync(certPath), `${SIGNING_CERT_FILE} must exist at the project root`);
});

test('shipped certificate matches the pinned thumbprint', () => {
  const thumbprint = certThumbprint(fs.readFileSync(certPath));
  assert.strictEqual(thumbprint, SIGNING_CERT_THUMBPRINT);
  assert.strictEqual(SIGNING_CERT_SUBJECT, 'CN=spartan_arbinger');
});

test('certificate trust is skipped when the file is missing', async () => {
  const messages = [];
  const logger = { info: (m) => messages.push(m), warn: (m) => messages.push(m) };
  const result = await ensureSigningCertTrusted(path.join(__dirname, 'does-not-exist'), logger);
  assert.strictEqual(result.trusted, false);
  assert.strictEqual(result.reason, 'certificate-file-missing');
  assert.ok(messages.length > 0);
});
