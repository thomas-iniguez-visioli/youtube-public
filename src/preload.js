const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (parameter) => ipcRenderer.send('execute-command', parameter),
  setFullscreen: (flag) => ipcRenderer.send('set-fullscreen', flag),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  onBootStatus: (callback) => ipcRenderer.on('boot-status', (event, status) => callback(status)),
  getFeatureFlag: (key, defaultValue) => ipcRenderer.invoke('get-feature-flag', key, defaultValue),
  getAllFlags: () => ipcRenderer.invoke('get-all-flags')
});
