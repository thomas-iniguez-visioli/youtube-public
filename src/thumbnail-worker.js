import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import https from 'https';

const fetchHtmlWithRedirects = (targetUrl, headers = {}, maxRedirects = 5) => {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error("Too many redirects"));
    }
    https.get(targetUrl, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtmlWithRedirects(res.headers.location, headers, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Status ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
      res.on('error', reject);
    }).on('error', reject);
  });
};

const downloadImageWithRedirects = (imageUrl, cachePath, maxRedirects = 5) => {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error("Too many redirects"));
    }
    https.get(imageUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImageWithRedirects(res.headers.location, cachePath, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Status ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(cachePath, buf);
        resolve();
      });
      res.on('error', reject);
    }).on('error', reject);
  });
};

async function run() {
  const { dbEntries, thumbCacheDir } = workerData;
  let downloadedThumbnails = 0;
  let downloadedLogos = 0;
  
  if (!fs.existsSync(thumbCacheDir)) {
    fs.mkdirSync(thumbCacheDir, { recursive: true });
  }

  // Purge the old channel logos to force fetching high-res versions
  try {
    const files = fs.readdirSync(thumbCacheDir);
    for (const file of files) {
      if (file.startsWith('channel_') && file.endsWith('.jpg')) {
        fs.unlinkSync(path.join(thumbCacheDir, file));
      }
    }
  } catch (e) {
    parentPort.postMessage({ type: 'log', level: 'warn', message: `Échec du nettoyage de l'ancien cache des logos : ${e.message}` });
  }

  // 1. Download thumbnails
  for (const entry of dbEntries) {
    if (entry.yid) {
      const cachePath = path.join(thumbCacheDir, `${entry.yid}.jpg`);
      if (!fs.existsSync(cachePath)) {
        const url = `https://img.youtube.com/vi/${entry.yid}/hqdefault.jpg`;
        try {
          await downloadImageWithRedirects(url, cachePath);
          downloadedThumbnails++;
        } catch (e) {
          // ignore or debug
        }
      }
    }
  }

  // 2. Download channel logos
  const channels = [...new Set(dbEntries.map(v => v.uploader).filter(Boolean))];
  for (const channelName of channels) {
    const safeUploader = channelName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const cachePath = path.join(thumbCacheDir, `channel_${safeUploader}.jpg`);
    if (!fs.existsSync(cachePath)) {
      const video = dbEntries.find(v => v.uploader === channelName && v.channel_url);
      if (video && video.channel_url) {
        try {
          const html = await fetchHtmlWithRedirects(video.channel_url, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
          });
          let avatarUrl;
          const matchOg = html.match(/<meta property="og:image" content="([^"]+)"/);
          if (matchOg && matchOg[1]) {
            avatarUrl = matchOg[1];
          } else {
            const matchAvatar = html.match(/"avatar":{"thumbnails":\[{"url":"([^"]+)"/);
            if (matchAvatar && matchAvatar[1]) {
              avatarUrl = matchAvatar[1];
            } else {
              const matchYt3 = html.match(/https:\/\/yt3\.googleusercontent\.com\/[a-zA-Z0-9_\-]+=s[0-9]+-c-k-c0x[0-9a-fA-F]+-no-rj/);
              if (matchYt3) {
                avatarUrl = matchYt3[0];
              }
            }
          }

          if (avatarUrl) {
            const cleanAvatarUrl = avatarUrl.replace(/&amp;/g, '&');
            await downloadImageWithRedirects(cleanAvatarUrl, cachePath);
            downloadedLogos++;
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  parentPort.postMessage({ type: 'done', downloadedThumbnails, downloadedLogos });
}

run().catch(err => {
  parentPort.postMessage({ type: 'error', message: err.message });
});
