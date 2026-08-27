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
      zip.writeZip(outputPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      parentPort.postMessage({ success: true });
    } else if (action === 'unzip') {
      await new Promise((resolve, reject) => {
        let extracted = false;
        fs.createReadStream(filePath)
          .pipe(unzipper.Parse())
          .on('entry', (entry) => {
            if (entry.type === 'File' && !extracted) {
              extracted = true;
              const ws = fs.createWriteStream(outputPath);
              entry.pipe(ws)
                .on('finish', resolve)
                .on('error', reject);
            } else {
              entry.autodrain();
            }
          })
          .on('error', reject)
          .on('close', () => {
            if (!extracted) reject(new Error("Aucun fichier trouvé dans l'archive."));
          });
      });
      parentPort.postMessage({ success: true });
    } else {
      parentPort.postMessage({ success: false, error: `Action inconnue : ${action}` });
    }
  } catch (err) {
    if (action === 'zip' && outputPath && fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {
        // Ignorer
      }
    }
    parentPort.postMessage({ success: false, error: err.message });
  }
}

run();
