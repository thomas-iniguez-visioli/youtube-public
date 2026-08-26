const { parentPort, workerData } = require('worker_threads');
const child = require('child_process');

async function run() {
  const { ytdlpPath, followedChannels, existingIds } = workerData;
  const existingSet = new Set(existingIds);
  let totalAdded = 0;

  for (let i = 0; i < followedChannels.length; i++) {
    const { name: uploader, url: channelUrl } = followedChannels[i];
    if (!channelUrl) continue;

    parentPort.postMessage({ type: 'progress', current: i + 1, total: followedChannels.length, channelName: uploader });

    try {
      const ids = await new Promise((resolve, reject) => {
        const childProc = child.spawn(ytdlpPath, [
          '--flat-playlist',
          '--playlist-end', '5',
          '--print', 'id',
          channelUrl
        ]);

        let stdout = '';
        let stderr = '';

        childProc.stdout.on('data', data => { stdout += data.toString(); });
        childProc.stderr.on('data', data => { stderr += data.toString(); });

        childProc.on('close', code => {
          if (code === 0) {
            const videoIds = stdout.split('\n')
              .map(line => line.trim())
              .filter(line => /^[a-zA-Z0-9_\-]{11}$/.test(line));
            resolve(videoIds);
          } else {
            reject(new Error(`yt-dlp a quitté avec le code ${code}. Stderr: ${stderr}`));
          }
        });
      });

      parentPort.postMessage({ type: 'log', level: 'info', message: `[Auto Channel Downloader] ${ids.length} vidéo(s) trouvée(s) pour ${uploader}.` });

      let addedCount = 0;
      const newVideoUrls = [];
      for (const id of ids) {
        if (!existingSet.has(id)) {
          const videoUrl = `https://www.youtube.com/watch?v=${id}`;
          newVideoUrls.push(videoUrl);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        totalAdded += addedCount;
        parentPort.postMessage({ type: 'log', level: 'info', message: `[Auto Channel Downloader] ${addedCount} nouvelle(s) vidéo(s) ajoutée(s) au backlog pour ${uploader}.` });
        parentPort.postMessage({ type: 'new_videos', channelName: uploader, count: addedCount, urls: newVideoUrls });
      }

      parentPort.postMessage({ type: 'update_meta', channelName: uploader, addedCount });

    } catch (err) {
      parentPort.postMessage({ type: 'log', level: 'error', message: `[Auto Channel Downloader] Erreur pour la chaîne ${uploader}: ${err.message}` });
    }
  }

  parentPort.postMessage({ type: 'done', totalAdded });
}

run().catch(err => {
  parentPort.postMessage({ type: 'error', message: err.message });
});
