const fs = require('fs');
const https = require('https');
const path = require('path');
const log = require('electron-log');

function get(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return get(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`Server responded with ${response.statusCode} for ${url}`));
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastLogTime = Date.now();

      const file = fs.createWriteStream(dest);
      response.pipe(file);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const now = Date.now();
        if (now - lastLogTime > 5000) { // Log progress every 5 seconds
          const percent = totalSize ? Math.round((downloadedSize / totalSize) * 100) : '?';
          log.info(`Downloading ${path.basename(dest)}: ${percent}% (${Math.round(downloadedSize/1024/1024)}MB / ${totalSize ? Math.round(totalSize/1024/1024)+'MB' : '?'})`);
          lastLogTime = now;
        }
      });

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', reject);
  });
}

function getInfo(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return getInfo(res.headers.location).then(resolve).catch(reject);
      }
      resolve({
        size: parseInt(res.headers['content-length'], 10),
        statusCode: res.statusCode
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function updateFile(url, dest, force = false) {
  const fileName = path.basename(dest);
  const exists = fs.existsSync(dest);

  try {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Optimization: Check size via HEAD request before downloading
    if (exists && !force) {
      try {
        const info = await getInfo(url);
        const stats = fs.statSync(dest);
        if (info.size && stats.size === info.size) {
          log.info(`${fileName} is already up to date (size matches). Skipping download.`);
          return;
        }
      } catch (e) {
        log.warn(`Could not perform HEAD request for ${fileName}, falling back to download check.`);
      }
    }

    const tempDest = `${dest}.tmp`;
    if (fs.existsSync(tempDest)) {
      try { fs.unlinkSync(tempDest); } catch (e) {}
    }

    log.info(`Starting download: ${url} -> ${dest}`);
    await get(url, tempDest);

    if (!fs.existsSync(tempDest)) {
      throw new Error(`Temp file ${tempDest} not found after download`);
    }

    if (exists) {
      const oldStat = fs.statSync(dest);
      const newStat = fs.statSync(tempDest);
      
      if (oldStat.size === newStat.size) {
        log.info(`${fileName} is already up to date (content size matches).`);
        fs.unlinkSync(tempDest);
        return;
      }
      
      try { fs.unlinkSync(dest); } catch (e) {}
    }

    fs.renameSync(tempDest, dest);
    log.info(`Successfully updated ${fileName}`);
  } catch (err) {
    log.error(`Failed to update ${fileName}: ${err.message}`);
    const tempDest = `${dest}.tmp`;
    if (fs.existsSync(tempDest)) {
      try { fs.unlinkSync(tempDest); } catch (e) {}
    }
    // Don't throw if we already have a file, just log error
    if (!exists) throw err;
  }
}

module.exports = {
  get,
  updateFile
};
