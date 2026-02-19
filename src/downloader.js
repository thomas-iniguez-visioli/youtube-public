const child = require('child_process');
const path = require('path');
const fs = require('fs');

function getBrowserForCookies() {
  // Priorité Firefox, sinon Chrome
  // Sur Windows, on peut vérifier les chemins par défaut
  const firefoxPath = path.join(process.env.APPDATA, 'Mozilla', 'Firefox', 'Profiles');
  if (fs.existsSync(firefoxPath)) {
    return 'firefox';
  }
  return 'chrome';
}

function createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat, bunPath) {
  const args = [
    '--merge-output-format', 'mp4',
    '--ffmpeg-location', ffmpegDir,
    '--write-info-json',
    '--cookies-from-browser', getBrowserForCookies(),
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b',
    '--write-playlist-metafiles',
    '--parse-metadata', 'playlist_title:.+ - (?P<folder_name>Videos|Shorts|Live)$',
    '-o', path.join(storagePath, outputFileFormat),
    parameter
  ];
  if (bunPath && fs.existsSync(bunPath)) {
    args.push('--js-runtimes', 'bun');
  }
  return args;
}

function runDownload(ytdlpPath, args, logger) {
  return new Promise((resolve, reject) => {
    // Quote all arguments to handle spaces
    const quotedArgs = args.map(arg => arg.includes(' ') ? `"${arg}"` : arg);
    
    if (logger) logger.info(`Executing: "${ytdlpPath}" ${quotedArgs.join(' ')}`);

    // Add ytdlp directory to PATH so it can find bun.exe
    const env = { ...process.env };
    const ytdlpDir = path.dirname(ytdlpPath);
    if (process.platform === 'win32') {
      env.Path = `${ytdlpDir};${env.Path || ''}`;
    } else {
      env.PATH = `${ytdlpDir}:${env.PATH || ''}`;
    }

    const childProcess = child.spawn(ytdlpPath, args, { env });

    childProcess.on('error', (err) => {
      if (logger) logger.info(`Erreur de spawn yt-dlp: ${err.message}`);
      reject(err);
    });

    childProcess.stdout.on('data', (data) => {
      if (logger) logger.info(`stdout: ${data}`);
    });

    childProcess.stderr.on('data', (data) => {
      if (logger) logger.info(`stderr: ${data}`);
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ytdlp a quitté avec le code ${code}`));
      }
    });
  });
}

function createMetadataArgs(parameter, storagePath, outputFileFormat, bunPath) {
  const args = [
    '--write-info-json',
    '--simulate',
    '--no-clean-info-json',
    '--cookies-from-browser', getBrowserForCookies(),
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b',
    '--write-playlist-metafiles',
    '--parse-metadata', 'playlist_title:.+ - (?P<folder_name>Videos|Shorts|Live)$',
    '-o', path.join(storagePath, outputFileFormat),
    '-J',
    parameter
  ];
  if (bunPath && fs.existsSync(bunPath)) {
    args.push('--js-runtimes', 'bun');
  }
  return args;
}

module.exports = {
  createDownloadArgs,
  createMetadataArgs,
  runDownload
};
