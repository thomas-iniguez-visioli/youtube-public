const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (parameter) => ipcRenderer.send('execute-command', parameter),
  setFullscreen: (flag) => ipcRenderer.send('set-fullscreen', flag),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  onBootStatus: (callback) => ipcRenderer.on('boot-status', (event, status) => callback(status)),
  getFeatureFlag: (key, defaultValue) => ipcRenderer.invoke('get-feature-flag', key, defaultValue),
  getAllFlags: () => ipcRenderer.invoke('get-all-flags'),
  isFeatureInRollout: (key, defaultPercent, defaultValue) => ipcRenderer.invoke('is-feature-in-rollout', key, defaultPercent, defaultValue),
  getRolloutStatus: () => ipcRenderer.invoke('get-rollout-status'),
  trackEvent: (eventName, data, metricValue) => ipcRenderer.invoke('ld-track-event', eventName, data, metricValue),
  getExperimentVariation: (flagKey, defaultValue) => ipcRenderer.invoke('get-experiment-variation', flagKey, defaultValue),
  getUserContext: () => ipcRenderer.invoke('get-user-context')
});
