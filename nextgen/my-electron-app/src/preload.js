const { contextBridge, ipcRenderer,ipcMain } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (parameter) => ipcRenderer.send('execute-command', parameter)
})