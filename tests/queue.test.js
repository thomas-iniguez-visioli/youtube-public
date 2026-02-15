const assert = require('node:assert');
const { test } = require('node:test');

// Mock of the queue logic from src/index.js
class DownloadQueue {
  constructor(downloadFunc) {
    this.backlog = [];
    this.isDownloading = false;
    this.downloadFunc = downloadFunc;
  }

  download(url) {
    if (!this.backlog.includes(url)) {
      this.backlog.push(url);
    }
  }

  async processBacklog() {
    if (this.backlog.length > 0 && !this.isDownloading) {
      this.isDownloading = true;
      const url = this.backlog[0];
      try {
        await this.downloadFunc(url);
      } catch (err) {
        // console.error(`Error: ${err.message}`);
      } finally {
        this.backlog.shift();
        this.isDownloading = false;
      }
    }
  }
}

test('Download queue should process items one by one', async (t) => {
  let callCount = 0;
  const processedUrls = [];
  
  const mockDownload = async (url) => {
    callCount++;
    processedUrls.push(url);
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 50));
  };

  const queue = new DownloadQueue(mockDownload);

  queue.download('url1');
  queue.download('url2');
  queue.download('url1'); // Should not add duplicate

  assert.strictEqual(queue.backlog.length, 2);

  await queue.processBacklog();
  assert.strictEqual(callCount, 1);
  assert.strictEqual(queue.isDownloading, false);
  assert.strictEqual(queue.backlog.length, 1);

  await queue.processBacklog();
  assert.strictEqual(callCount, 2);
  assert.strictEqual(processedUrls[0], 'url1');
  assert.strictEqual(processedUrls[1], 'url2');
  assert.strictEqual(queue.backlog.length, 0);
});
