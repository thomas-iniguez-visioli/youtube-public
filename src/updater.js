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

async function updateFile(url, dest, force = false) {
  const fileName = path.basename(dest);
  
  // If not forced and file exists, skip download
  if (!force && fs.existsSync(dest)) {
    return;
  }

  const tempDest = `${dest}.tmp`;
  try {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (fs.existsSync(tempDest)) {
      try { fs.unlinkSync(tempDest); } catch (e) {}
    }

    log.info(`Starting download: ${url} -> ${dest}`);
    await get(url, tempDest);

    if (!fs.existsSync(tempDest)) {
      throw new Error(`Temp file ${tempDest} not found after download`);
    }

    // Comparison logic: use file size as a quick check instead of reading everything to memory
    if (fs.existsSync(dest)) {
      const oldStat = fs.statSync(dest);
      const newStat = fs.statSync(tempDest);
      
      if (oldStat.size === newStat.size) {
        log.info(`${fileName} is already up to date (same size).`);
        fs.unlinkSync(tempDest);
        return;
      }
      
      fs.unlinkSync(dest);
    }

    fs.renameSync(tempDest, dest);
    log.info(`Successfully updated ${fileName}`);
  } catch (err) {
    log.error(`Failed to update ${fileName}: ${err.message}`);
    if (fs.existsSync(tempDest)) {
      try { fs.unlinkSync(tempDest); } catch (e) {}
    }
    throw err;
  }
}

module.exports = {
  get,
  updateFile
};
