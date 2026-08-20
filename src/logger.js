import log from 'electron-log';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let app;
try {
  app = require('electron').app;
} catch (e) {
  // Hors du processus principal Electron
}

const userDataPath = app ? app.getPath('userData') : process.cwd();

log.transports.file.level = 'silly';
log.transports.console.level = 'silly';
log.transports.file.resolvePathFn = () => path.join(userDataPath, 'log', 'app.log');

export default log;
