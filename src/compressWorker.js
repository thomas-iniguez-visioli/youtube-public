import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import AdmZip from 'adm-zip';

const { action, filePath, outputPath } = workerData;

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
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    if (zipEntries.length > 0) {
      const entry = zipEntries[0];
      const buffer = zip.readFile(entry);
      fs.writeFileSync(outputPath, buffer);
    }
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
