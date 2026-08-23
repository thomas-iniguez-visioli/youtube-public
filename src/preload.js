const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (parameter) => ipcRenderer.send('execute-command', parameter),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  onBootStatus: (callback) => ipcRenderer.on('boot-status', (event, status) => callback(status))
});
