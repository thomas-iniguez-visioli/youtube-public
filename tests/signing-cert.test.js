import assert from 'node:assert';
import { test } from 'node:test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CERTS_DIR,
  TRUSTED_CERTS_FILE,
  SIGNING_CERT_SUBJECT,
  certThumbprint,
  ensureSigningCertTrusted,
  readTrustedCerts,
} from '../src/trustSigningCert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certsDir = path.join(__dirname, '..', CERTS_DIR);

test('trusted certificate list is shipped with the app', () => {
  const list = readTrustedCerts(path.join(__dirname, '..'));
  assert.ok(Array.isArray(list), `${CERTS_DIR}/${TRUSTED_CERTS_FILE} must be a JSON array`);
  assert.ok(list.length > 0, 'at least one trusted certificate is required');
});

test('every shipped certificate matches its pinned thumbprint', () => {
  const list = readTrustedCerts(path.join(__dirname, '..'));
  for (const entry of list) {
    assert.strictEqual(path.basename(entry.file), entry.file, `${entry.file} must be a plain file name`);
    const certPath = path.join(certsDir, entry.file);
    assert.ok(fs.existsSync(certPath), `${entry.file} must exist in ${CERTS_DIR}`);
    assert.strictEqual(certThumbprint(fs.readFileSync(certPath)), entry.thumbprint);
    assert.strictEqual(entry.subject, SIGNING_CERT_SUBJECT);
    assert.match(entry.addedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('certificate trust is skipped when the list is missing', async () => {
  const messages = [];
  const logger = { info: (m) => messages.push(m), warn: (m) => messages.push(m) };
  const result = await ensureSigningCertTrusted(path.join(__dirname, 'does-not-exist'), logger);
  assert.deepStrictEqual(result, { trusted: [], reason: 'trusted-list-missing' });
  assert.ok(messages.length > 0);
});
