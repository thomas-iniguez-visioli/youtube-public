const fs = require('fs');
const https = require('https');
const path = require('path');

function get(url, dest) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
        response.pipe(file);
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        get(response.headers.location, dest).then(resolve).catch(reject);
      } else {
        reject(new Error(`Server responded with ${response.statusCode}: ${response.statusMessage} for ${url}`));
      }
    });
    request.on('error', reject);
  });
}

async function updateFile(url, dest) {
  const tempDest = `${dest}.tmp`;
  try {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (fs.existsSync(tempDest)) {
      fs.unlinkSync(tempDest);
    }

    await get(url, tempDest);

    if (!fs.existsSync(tempDest)) {
      throw new Error(`Temp file ${tempDest} not found after download`);
    }

    // If destination exists, check if it's the same
    if (fs.existsSync(dest)) {
      const originalFile = fs.readFileSync(dest);
      const newFile = fs.readFileSync(tempDest);
      if (originalFile.equals(newFile)) {
        fs.unlinkSync(tempDest);
        return; // No update needed
      }
      fs.unlinkSync(dest);
    }

    fs.renameSync(tempDest, dest);
  } catch (err) {
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
