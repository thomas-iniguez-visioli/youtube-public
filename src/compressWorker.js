import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import unzipper from 'unzipper';

const { action, filePath, outputPath } = workerData;

async function run() {
  try {
    if (action === 'zip') {
      const zip = new AdmZip();
      zip.addLocalFile(filePath);
      // Écriture atomique : un zip partiel ne doit jamais être visible sous le
      // chemin final (le serveur /video fait existsSync dessus).
      const tmpPath = outputPath + '.tmp';
      zip.writeZip(tmpPath);
      fs.renameSync(tmpPath, outputPath);
      let unlinkWarning = null;
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (unlinkErr) {
        // EBUSY/EPERM : le fichier est lu par le serveur. On garde le zip,
        // le nettoyage au démarrage s'en chargera plus tard.
        unlinkWarning = unlinkErr.message;
      }
      parentPort.postMessage({ success: true, warning: unlinkWarning });
    } else if (action === 'unzip') {
      let fd = null;
      try {
        await new Promise((resolve, reject) => {
          let extracted = false;
          let wsClosed = false;
          let parseClosed = false;
          const maybeDone = () => {
            if (wsClosed && parseClosed) resolve();
          };
          // fd contrôlé + autoClose:false : sous bun, fs.ReadStream ne ferme
          // jamais son fd après un pipe vers unzipper. Le fichier reste alors
          // verrouillé dans le process et tout rmSync/unlink ultérieur bloque
          // (ENOTEMPTY / fichier fantôme). On ferme le fd explicitement.
          fd = fs.openSync(filePath, 'r');
          const rs = fs.createReadStream(filePath, { fd, autoClose: false });
          rs.pipe(unzipper.Parse())
            .on('entry', (entry) => {
              if (entry.type === 'File' && !extracted) {
                extracted = true;
                const ws = fs.createWriteStream(outputPath);
                // Résoudre sur 'close' (fd réellement libéré) et non 'finish' :
                // sinon l'appelant peut supprimer le fichier pendant que le
                // worker le tient encore ouvert.
                entry.pipe(ws)
                  .on('close', () => {
                    wsClosed = true;
                    maybeDone();
                  })
                  .on('error', reject);
              } else {
                entry.autodrain();
              }
            })
            .on('error', reject)
            .on('close', () => {
              if (!extracted) {
                reject(new Error("Aucun fichier trouvé dans l'archive."));
                return;
              }
              parseClosed = true;
              maybeDone();
            });
        });
      } finally {
        if (fd !== null) {
          try {
            fs.closeSync(fd);
          } catch (e) {
            // Déjà fermé
          }
        }
      }
      parentPort.postMessage({ success: true });
    } else {
      parentPort.postMessage({ success: false, error: `Action inconnue : ${action}` });
    }
  } catch (err) {
    if (action === 'zip' && outputPath && fs.existsSync(outputPath + '.tmp')) {
      try {
        fs.unlinkSync(outputPath + '.tmp');
      } catch (e) {
        // Ignorer
      }
    }
    parentPort.postMessage({ success: false, error: err.message });
  }
}

run();
