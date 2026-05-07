import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (parameter) => ipcRenderer.send('execute-command', parameter)
});
