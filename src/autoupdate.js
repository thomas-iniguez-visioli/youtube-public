const { app, autoUpdater, dialog } = require('electron');
const os = require('os');
const path = require('path');
const url = require('url');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');

let updateFeed = 'https://your-update-server.com/update';
let isPortable = false;

if (fs.existsSync(path.join(app.getPath('exe'), '..', 'portable.txt'))) {
  isPortable = true;
}

autoUpdater.setFeedURL(updateFeed);

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  if (isPortable) {
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
module.exports=autoUpdater
/*! Bundled license information:

sax/lib/sax.js:
  (*! http://mths.be/fromcodepoint v0.1.0 by @mathias *)
*/
