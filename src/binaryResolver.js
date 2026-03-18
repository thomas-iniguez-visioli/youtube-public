const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
let app;
try {
  app = require('electron').app;
} catch (e) {
  // Not in Electron
}

const isWin = process.platform === 'win32';
console.log(isWin)
const BINARIES = {
  ytdlp: isWin ? 'ytdlp.exe' : 'ytdlp',
  ffmpeg: isWin ? 'ffmpeg.exe' : 'ffmpeg',
  deno: isWin ? 'deno.exe' : 'deno'
};

function resolvePath(name) {
  const binaryName = BINARIES[name];
  if (!binaryName) return null;

  // 1. Check userData
  if (app) {
    const userDataPath = path.join(app.getPath('userData'), binaryName);
    if (fs.existsSync(userDataPath)) return userDataPath;

    // 2. Special case for ffmpeg folder if it wasn't copied yet
    if (name === 'ffmpeg') {
      const ffmpegDeepPath = path.join(app.getPath('userData'), 'ffmpeg', 'ffmpeg-master-latest-win64-gpl', 'bin', binaryName);
      if (fs.existsSync(ffmpegDeepPath)) return ffmpegDeepPath;
    }
  }

  // 3. Check process.resourcesPath (Electron resources)
  if (process.resourcesPath) {
    const resourcesPath = path.join(process.resourcesPath, binaryName);
    if (fs.existsSync(resourcesPath)) return resourcesPath;
  }

  // 4. Fallback to system PATH
  try {
    const command = isWin ? 'where' : 'which';
    const result = child_process.execSync(`${command} ${binaryName}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/)[0];
    if (result && fs.existsSync(result)) return result;
  } catch (e) {
    // Not found in PATH
  }

  return null;
}

const binaryResolver = {
  get ytdlp() {
    return resolvePath('ytdlp');
  },
  get ffmpeg() {
    return resolvePath('ffmpeg');
  },
  get deno() {
    return resolvePath('deno');
  },
  get ffmpegDir() {
    const fPath = this.ffmpeg;
    return fPath ? path.dirname(fPath) : null;
  },
  async validateBinaries() {
    const validate = (binaryPath) => {
      if (!binaryPath) return Promise.resolve(false);
      return new Promise((resolve) => {
        const cp = child_process.spawn(binaryPath, ['--version']);
        cp.on('error', () => resolve(false));
        cp.on('close', (code) => resolve(code === 0));
        // Some binaries might wait for input or take too long, set a timeout
        setTimeout(() => {
          cp.kill();
          resolve(false);
        }, 5000);
      });
    };

    return {
      ytdlp: await validate(this.ytdlp),
      ffmpeg: await validate(this.ffmpeg),
      deno: await validate(this.deno)
    };
  }
};

module.exports = binaryResolver;
