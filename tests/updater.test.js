const assert = require('node:assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');
const { updateFile } = require('../src/updater');

test('updateFile should handle non-existent URLs', async (t) => {
  const url = 'https://this-url-does-not-exist.commmmm/file.exe';
  const dest = './test-file.exe';
  
  try {
    await updateFile(url, dest);
    assert.fail('Should have thrown an error');
  } catch (err) {
    assert.ok(err instanceof Error);
  } finally {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    if (fs.existsSync(`${dest}.tmp`)) fs.unlinkSync(`${dest}.tmp`);
  }
});

test('updateFile should correctly rename temp file on success', async (t) => {
  // We'll use a real but small URL for testing if possible, or mock https
  // For simplicity, let's just use a known stable small file
  const url = 'https://raw.githubusercontent.com/thomas-iniguez-visioli/youtube-public/main/README.md';
  const dest = path.resolve('./TEST_README.md');
  
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  
  await updateFile(url, dest);
  
  assert.ok(fs.existsSync(dest), 'File should exist');
  const content = fs.readFileSync(dest, 'utf8');
  assert.ok(content.length > 0);
  
  // Clean up
  fs.unlinkSync(dest);
});
