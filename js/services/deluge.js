// Deluge Service Module
// Uses JSON-RPC API via the local proxy server (server.js).
// The proxy handles session cookie management between auth.login and RPC calls.

import { proxyFetch } from '../proxy-fetch.js';

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/deluge.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

function header(statusCls, badge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="Deluge" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">DELUGE</h2>
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open Deluge">${EXT_LINK}</a>`;
}

let _config = null;
let _container = null;

function formatSpeed(bytesPerSec) {
  const num = parseFloat(bytesPerSec) || 0;
  if (num >= 1024 * 1024) return (num / (1024 * 1024)).toFixed(2) + ' MB/s';
  if (num >= 1024) return (num / 1024).toFixed(2) + ' KB/s';
  return num.toFixed(0) + ' B/s';
}

async function delugeRpc(method, params, id) {
  return proxyFetch(`${_config.url}/json`, {
    method: 'POST',
    body: JSON.stringify({ method, params, id }),
  });
}

function renderSkeleton(container) {
  container.innerHTML = `
    <div class="card-header">
      ${header('loading')}
    </div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
  `;
}

function renderOffline(container, error) {
  const isProxyMissing = error.includes('Failed to fetch') || error.includes('NetworkError') || error.includes('/proxy');
  const hint = isProxyMissing
    ? `<div class="cors-note">Dashboard must be served via <strong>node server.js</strong> for Deluge to work. Open http://localhost:3000 instead of the file directly.</div>`
    : '';
  container.innerHTML = `
    <div class="card-header">
      ${header('offline')}
    </div>
    <div class="offline-message">
      <span class="offline-icon">⚠</span>
      <span>SERVICE OFFLINE</span>
    </div>
    <div class="error-detail">${error}</div>
    ${hint}
  `;
}

function renderData(container, torrents, version) {
  const torrentList = Object.values(torrents);
  const downloading = torrentList.filter(t => t.state === 'Downloading');
  const seeding = torrentList.filter(t => t.state === 'Seeding');
  const active = torrentList.filter(t => t.state === 'Downloading' || t.state === 'Seeding');

  const totalDown = torrentList.reduce((acc, t) => acc + (t.download_payload_rate || 0), 0);
  const totalUp = torrentList.reduce((acc, t) => acc + (t.upload_payload_rate || 0), 0);

  const activeSorted = [...downloading, ...seeding].slice(0, 3);

  const torrentItems = activeSorted.map(t => {
    const name = t.name || 'Unknown';
    const progress = parseFloat(t.progress || 0);
    const state = t.state || 'Unknown';
    const stateClass = state === 'Downloading' ? 'online' : state === 'Seeding' ? 'seeding' : 'loading';
    return `
      <div class="list-item">
        <div class="list-item-header">
          <div class="list-item-title">${name.length > 38 ? name.substring(0, 38) + '…' : name}</div>
          <span class="torrent-state ${stateClass}">${state.toUpperCase()}</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" style="width: ${progress.toFixed(1)}%"></div>
        </div>
        <div class="list-item-meta">${progress.toFixed(1)}%</div>
      </div>
    `;
  }).join('');

  const versionBadge = version ? `<span class="version-badge">v${version}</span>` : '';

  container.innerHTML = `
    <div class="card-header">
      ${header('online', versionBadge)}
    </div>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">${downloading.length}</div>
        <div class="stat-label">DOWNLOADING</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${seeding.length}</div>
        <div class="stat-label">SEEDING</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${formatSpeed(totalDown)}</div>
        <div class="stat-label">DOWN SPEED</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${formatSpeed(totalUp)}</div>
        <div class="stat-label">UP SPEED</div>
      </div>
    </div>
    <div class="section-label">ACTIVE TORRENTS</div>
    <div class="list-items">
      ${torrentItems || '<div class="empty-state">No active torrents</div>'}
    </div>
  `;
}

export function init(config, container) {
  _config = config;
  _container = container;
  return refresh();
}

export async function refresh() {
  if (!_container) return;
  renderSkeleton(_container);

  try {
    // Step 1: Login
    const loginResp = await delugeRpc('auth.login', [_config.password], 1);
    if (!loginResp.result) {
      throw new Error('Authentication failed');
    }

    // Step 2: Get torrents and version in parallel
    const [torrentResp, versionResp] = await Promise.all([
      delugeRpc('core.get_torrents_status', [null, ['name', 'state', 'progress', 'download_payload_rate', 'upload_payload_rate']], 2),
      delugeRpc('daemon.info', [], 3).catch(() => null),
    ]);

    if (torrentResp.error) {
      throw new Error(torrentResp.error.message || 'RPC error');
    }

    const version = versionResp && versionResp.result && versionResp.result.version;
    renderData(_container, torrentResp.result || {}, version);
  } catch (err) {
    renderOffline(_container, err.message);
  }
}
