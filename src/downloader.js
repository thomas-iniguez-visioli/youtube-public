const child = require('child_process');
const path = require('path');
const fs = require('fs');
const binval=require("./binaryResolver")
binval.validateBinaries().then((data)=>{
  console.log(data)
})
console.log(binval.ffmpeg)
function getBrowserForCookies() {
  // Priorité Firefox, sinon Chrome
  // Sur Windows, on peut vérifier les chemins par défaut
  const firefoxPath = path.join(process.env.APPDATA, 'Mozilla', 'Firefox', 'Profiles');
  if (fs.existsSync(firefoxPath)) {
    return 'firefox';
  }
  return 'chrome';
}

function createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat, denoPath) {
  const args = [
    '--merge-output-format', 'mp4',
    '--write-info-json',
    '--cookies-from-browser', getBrowserForCookies(),
    '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b',
    '--write-playlist-metafiles',
    '--parse-metadata', 'playlist_title:.+ - (?P<folder_name>Videos|Shorts|Live)$',
    '-o', path.join(storagePath, outputFileFormat),
    parameter
  ];
  if (ffmpegDir) {
    args.push('--ffmpeg-location', ffmpegDir);
  }
  if (denoPath && fs.existsSync(denoPath)) {
    args.push('--js-runtimes', 'deno');
  }
  return args;
}

function runDownload(ytdlpPath, args, logger, onVideoFinished) {
  return new Promise((resolve, reject) => {
    // Quote all arguments to handle spaces
    const quotedArgs = args.map((arg) => {
      const argStr = String(arg);
      return argStr.includes(' ') ? `"${argStr}"` : argStr;
    });
    
    if (logger) logger.info(`Executing: "${ytdlpPath}" ${quotedArgs.join(' ')}`);

    // Add ytdlp directory to PATH so it can find deno.exe
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
      const output = data.toString();
      if (logger) logger.info(`stdout: ${output}`);

      // Detect video completion (merging format or finished downloading)
      // Example: [ffmpeg] Merging formats into "C:\Users\alpha\Downloads\Video [ID].mp4"
      if (onVideoFinished) {
        const mergeMatch = output.match(/Merging formats into "(.+)"/);
        const alreadyMatch = output.match(/\[download\] (.+) has already been downloaded/);
        const finishedMatch = output.match(/\[download\] 100% of .+/); // This might be too broad
        
        if (mergeMatch) {
          onVideoFinished(mergeMatch[1]);
        } else if (alreadyMatch) {
          onVideoFinished(alreadyMatch[1]);
        }
      }
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

function createMetadataArgs(parameter, ffmpegDir, storagePath, outputFileFormat, denoPath) {
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
  if (ffmpegDir) {
    args.push('--ffmpeg-location', ffmpegDir);
  }
  if (denoPath && fs.existsSync(denoPath)) {
    args.push('--js-runtimes', 'deno');
  }
  return args;
}

module.exports = {
  createDownloadArgs,
  createMetadataArgs,
  runDownload
};
