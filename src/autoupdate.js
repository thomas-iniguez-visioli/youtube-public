import { app, autoUpdater, dialog } from 'electron';
import os from 'os';
import path from 'path';
import url from 'url';
import fs from 'fs';
import https from 'https';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// AdmZip is likely a dependency that needs to be imported, but if it's not in package.json
// it might fail. I'll use require for it for now if it's actually there.
let AdmZip;
try {
  AdmZip = require('adm-zip');
} catch (e) {
  console.warn('adm-zip not found, portable updates might fail');
}

let updateFeed = 'https://your-update-server.com/update';
let isPortable = false;

if (fs.existsSync(path.join(app.getPath('exe'), '..', 'portable.txt'))) {
  isPortable = true;
}

autoUpdater.setFeedURL(updateFeed);

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  if (isPortable && AdmZip) {
    const zip = new AdmZip(event.path);
    zip.extractAllTo(path.join(app.getPath('exe'), '..'), true);
  } else {
    const dialogOpts = {
      type: 'info',
      buttons: ['Réinstaller', 'Plus tard'],
      title: 'Mise à jour disponible',
      message: process.platform === 'win32' ? releaseNotes : releaseName,
      detail: 'Une nouvelle version est disponible. Voulez-vous la réinstaller maintenant ?'
    };

    dialog.showMessageBox(dialogOpts).then((returnValue) => {
      if (returnValue.response === 0) autoUpdater.quitAndInstall();
    });
  }
});

autoUpdater.on('error', (message) => {
  console.error('Erreur de mise à jour : ' + message);
});

app.on('ready', () => {
  autoUpdater.checkForUpdates();
});

console.log(autoUpdater);
export default autoUpdater;
