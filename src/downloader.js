import child from 'child_process';
import path from 'path';
import fs from 'fs';
import binval from "./binaryResolver.js";

function getBrowserForCookies() {
  // Priorité Firefox, sinon Chrome
  // Sur Windows, on peut vérifier les chemins par défaut
  const firefoxPath = path.join(process.env.APPDATA || '', 'Mozilla', 'Firefox', 'Profiles');
  if (fs.existsSync(firefoxPath)) {
    return 'firefox';
  }
  return 'chrome';
}

function createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat, denoPath) {
  const args = [
    '--merge-output-format', 'mp4',
    '--newline',
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
    args.push('--js-runtimes', `deno:${denoPath}`);
  }
  return args;
}

function runDownload(ytdlpPath, args, logger, onVideoFinished, onProgress) {
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

      // Detect download progress
      if (onProgress) {
        const progressMatch = output.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
        if (progressMatch) {
          const percent = parseFloat(progressMatch[1]);
          const etaMatch = output.match(/ETA\s+(\d+:\d+)/);
          const speedMatch = output.match(/at\s+(\d+(?:\.\d+)?\w+\/s)/);
          onProgress({
            percent,
            eta: etaMatch ? etaMatch[1] : null,
            speed: speedMatch ? speedMatch[1] : null
          });
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
    '--newline',
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
    args.push('--js-runtimes', `deno:${denoPath}`);
  }
  return args;
}

function fetchSuggestions(ytdlpPath, query, denoPath) {
  return new Promise((resolve, reject) => {
    if (!ytdlpPath || (!fs.existsSync(ytdlpPath) && !ytdlpPath.includes('/') && !ytdlpPath.includes('\\'))) {
      // Si le binaire n'existe pas et n'est pas un chemin absolu/relatif, on rejette directement
      return reject(new Error(`ytdlp binary not found: ${ytdlpPath}`));
    }
    const args = [
      '--flat-playlist',
      '--dump-single-json',
      `ytsearch24:${query}`
    ];
    if (denoPath && fs.existsSync(denoPath)) {
      args.push('--js-runtimes', `deno:${denoPath}`);
    }

    const env = { ...process.env };
    const ytdlpDir = path.dirname(ytdlpPath);
    if (process.platform === 'win32') {
      env.Path = `${ytdlpDir};${env.Path || ''}`;
    } else {
      env.PATH = `${ytdlpDir}:${env.PATH || ''}`;
    }

    let childProcess;
    try {
      childProcess = child.spawn(ytdlpPath, args, { env });
    } catch (err) {
      return reject(err);
    }
    let stdoutData = '';
    let stderrData = '';

    childProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdoutData);
          const entries = parsed.entries || [];
          resolve(entries);
        } catch (e) {
          reject(new Error(`Failed to parse suggestions JSON: ${e.message}`));
        }
      } else {
        reject(new Error(`ytdlp search exited with code ${code}. Stderr: ${stderrData}`));
      }
    });
  });
}

function compressVideo(ffmpegPath, inputPath, logger) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      return reject(new Error("Binaire ffmpeg introuvable pour la compression"));
    }
    const ext = path.extname(inputPath);
    const tempOutputPath = inputPath.replace(ext, `.tmp-compressed${ext}`);
    
    // Compression x264 CRF 28 veryfast + audio AAC 128k pour optimiser l'espace disque
    // -vf force des dimensions paires et le format yuv420p compatible avec tous les lecteurs
    const args = [
      '-y',
      '-i', inputPath,
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
      '-vcodec', 'libx264',
      '-crf', '28',
      '-preset', 'veryfast',
      '-acodec', 'aac',
      '-b:a', '128k',
      tempOutputPath
    ];
    
    if (logger) logger.info(`Début de compression de la vidéo : "${inputPath}"`);
    
    const cp = child.spawn(ffmpegPath, args);
    
    cp.on('error', (err) => {
      if (logger) logger.info(`Erreur d'exécution de ffmpeg : ${err.message}`);
      reject(err);
    });

    cp.on('close', (code) => {
      if (code === 0) {
        try {
          const originalStats = fs.statSync(inputPath);
          const compressedStats = fs.statSync(tempOutputPath);
          
          if (compressedStats.size < originalStats.size) {
            fs.unlinkSync(inputPath);
            fs.renameSync(tempOutputPath, inputPath);
            const savedBytes = originalStats.size - compressedStats.size;
            const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);
            const ratio = Math.round((savedBytes / originalStats.size) * 100);
            if (logger) logger.info(`Compression réussie ! Économie de ${savedMB} Mo (${ratio}%)`);
          } else {
            fs.unlinkSync(tempOutputPath);
            if (logger) logger.info(`La compression n'a pas réduit la taille du fichier. Conservation de l'original.`);
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      } else {
        if (fs.existsSync(tempOutputPath)) {
          fs.unlinkSync(tempOutputPath);
        }
        reject(new Error(`La compression ffmpeg a échoué avec le code ${code}`));
      }
    });
  });
}

export {
  createDownloadArgs,
  createMetadataArgs,
  runDownload,
  fetchSuggestions,
  compressVideo
};
