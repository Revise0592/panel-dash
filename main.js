/**
 * Selfhosted Dashboard - Electron Main Process
 *
 * Handles:
 *  - Window creation
 *  - Config persistence (userData/config.json)
 *  - API proxy via IPC (replaces server.js CORS proxy)
 *  - Session cookie management (Deluge auth)
 *  - Self-signed TLS bypass for local network services
 */

// Allow self-signed TLS certificates (e.g. UnRAID)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

let configPath;

// In-memory cookie jar keyed by host — maintains Deluge session across RPC calls
const cookieJar = {};

// ── Config helpers ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  sonarr:          { url: '', apiKey: '' },
  radarr:          { url: '', apiKey: '' },
  sabnzbd:         { url: '', apiKey: '' },
  deluge:          { url: '', password: '' },
  overseerr:       { url: '', apiKey: '' },
  unraid:          { url: '', apiKey: '' },
  refreshInterval: 30,
  theme:           'forest',
  displayTitle:    'panel',
};

function getConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  ipcMain.handle('config:get', () => getConfig());

  ipcMain.handle('config:set', (_, config) => {
    saveConfig(config);
    return true;
  });

  ipcMain.handle('api:fetch', async (_, targetUrl, options = {}) => {
    const { method = 'GET', body = null, headers: reqHeaders = {} } = options;

    let host;
    try {
      host = new URL(targetUrl).host;
    } catch {
      return { _proxyError: `Invalid URL: ${targetUrl}` };
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...reqHeaders,
    };
    if (cookieJar[host]) headers['Cookie'] = cookieJar[host];

    const fetchOptions = { method, headers };
    if (body) fetchOptions.body = body;

    try {
      const upstream = await fetch(targetUrl, fetchOptions);

      // Capture session cookies (critical for Deluge auth)
      const setCookie = upstream.headers.get('set-cookie');
      if (setCookie) cookieJar[host] = setCookie.split(';')[0];

      const ct = upstream.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return upstream.json();
      } else {
        const text = await upstream.text();
        try { return JSON.parse(text); } catch { return { _rawResponse: text }; }
      }
    } catch (err) {
      return { _proxyError: `Could not reach ${host}: ${err.message}` };
    }
  });
}

// ── Window ─────────────────────────────────────────────────────────────────────

// Background colours per theme — used so the window chrome matches before the
// renderer has painted, avoiding a white flash on startup.
const THEME_BG = {
  forest:   '#6e9482',
  midnight: '#3a4a6b',
  ember:    '#8a6040',
  slate:    '#4a5568',
  crimson:  '#7a3a3a',
};

function createWindow() {
  const config = getConfig();
  const theme  = config.theme || 'forest';

  const win = new BrowserWindow({
    width:  1280,
    height: 820,
    minWidth:  800,
    minHeight: 500,
    backgroundColor: THEME_BG[theme] || THEME_BG.forest,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Pass the theme as a query param so the renderer can apply it synchronously
  // via an inline <script> before any CSS is parsed — zero flash.
  win.loadFile('index.html', { query: { theme } });
}

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  configPath = path.join(app.getPath('userData'), 'config.json');
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
