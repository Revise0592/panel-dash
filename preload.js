/**
 * Preload script — context bridge between renderer and main process.
 *
 * Exposes window.electronAPI with three methods:
 *   fetch(url, options) — makes an HTTP request via the main process (no CORS)
 *   getConfig()         — reads saved config from userData/config.json
 *   setConfig(config)   — writes config to userData/config.json
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetch: (url, options) =>
    ipcRenderer.invoke('api:fetch', url, options),

  getConfig: () =>
    ipcRenderer.invoke('config:get'),

  setConfig: (config) =>
    ipcRenderer.invoke('config:set', config),
});
