// Deluge Service Module
// Uses JSON-RPC API via the local proxy server (server.js).

import { proxyFetch } from '../proxy-fetch.js';
import * as Modal from '../modal.js';

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/deluge.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

let _config    = null;
let _container = null;

function header(statusCls, badge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="Deluge" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">deluge</h2>
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open Deluge">${EXT_LINK}</a>`;
}

function formatSpeed(bytesPerSec) {
  const n = parseFloat(bytesPerSec) || 0;
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB/s';
  if (n >= 1024)        return (n / 1024).toFixed(2) + ' KB/s';
  return n.toFixed(0) + ' B/s';
}

function formatSize(bytes) {
  const n = parseFloat(bytes) || 0;
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (n >= 1024 * 1024)        return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n >= 1024)               return (n / 1024).toFixed(2) + ' KB';
  return n.toFixed(0) + ' B';
}

function formatEta(seconds) {
  if (!seconds || seconds < 0) return '—';
  const s = parseInt(seconds, 10);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function delugeRpc(method, params, id) {
  return proxyFetch(`${_config.url}/json`, {
    method: 'POST',
    body: JSON.stringify({ method, params, id }),
  });
}

// ── Card render ──────────────────────────────────────────────────────────────

function renderSkeleton(container) {
  container.innerHTML = `
    <div class="card-header">${header('loading')}</div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
  `;
}

function renderOffline(container, error) {
  const isProxyMissing = error.includes('Failed to fetch') || error.includes('NetworkError') || error.includes('/proxy');
  const hint = isProxyMissing
    ? `<div class="cors-note">Dashboard must be served via <strong>node server.js</strong> for Deluge to work.</div>`
    : '';
  container.innerHTML = `
    <div class="card-header">${header('offline')}</div>
    <div class="offline-message"><span class="offline-icon">⚠</span><span>service offline</span></div>
    <div class="error-detail">${error}</div>
    ${hint}
  `;
}

function renderData(container, torrents, version) {
  const list        = Object.values(torrents);
  const downloading = list.filter(t => t.state === 'Downloading');
  const seeding     = list.filter(t => t.state === 'Seeding');
  const totalDown   = list.reduce((a, t) => a + (t.download_payload_rate || 0), 0);
  const totalUp     = list.reduce((a, t) => a + (t.upload_payload_rate   || 0), 0);

  const activeSorted  = [...downloading, ...seeding].slice(0, 3);
  const torrentItems  = activeSorted.map(t => {
    const name     = t.name || 'Unknown';
    const progress = parseFloat(t.progress || 0);
    const state    = t.state || 'Unknown';
    const cls      = state === 'Downloading' ? 'online' : state === 'Seeding' ? 'seeding' : 'loading';
    return `
      <div class="list-item">
        <div class="list-item-header">
          <div class="list-item-title">${name.length > 38 ? name.substring(0, 38) + '…' : name}</div>
          <span class="torrent-state ${cls}">${state.toLowerCase()}</span>
        </div>
        <div class="progress-track"><div class="progress-bar" style="width:${progress.toFixed(1)}%"></div></div>
        <div class="list-item-meta">${progress.toFixed(1)}%</div>
      </div>
    `;
  }).join('');

  const versionBadge = version ? `<span class="version-badge">v${version}</span>` : '';

  container.innerHTML = `
    <div class="card-header">${header('online', versionBadge)}</div>
    <div class="stats-grid">
      <div class="stat-item"><div class="stat-value">${downloading.length}</div><div class="stat-label">downloading</div></div>
      <div class="stat-item"><div class="stat-value">${seeding.length}</div><div class="stat-label">seeding</div></div>
      <div class="stat-item"><div class="stat-value">${formatSpeed(totalDown)}</div><div class="stat-label">down speed</div></div>
      <div class="stat-item"><div class="stat-value">${formatSpeed(totalUp)}</div><div class="stat-label">up speed</div></div>
    </div>
    <div class="section-label">active torrents</div>
    <div class="list-items">
      ${torrentItems || '<div class="empty-state">no active torrents</div>'}
    </div>
  `;
}

// ── Detail modal ──────────────────────────────────────────────────────────────

async function openDetail() {
  Modal.setTitle(`
    <img class="modal-icon" src="${ICON_URL}" alt="Deluge" />
    <span class="modal-title">deluge</span>
    <span class="modal-title-sep">|</span>
    <span class="modal-title-sub">all torrents</span>
  `);
  Modal.setLoading();
  Modal.open();

  try {
    const loginResp = await delugeRpc('auth.login', [_config.password], 1);
    if (!loginResp.result) throw new Error('Authentication failed');

    const torrentResp = await delugeRpc(
      'core.get_torrents_status',
      [null, ['name', 'state', 'progress', 'ratio', 'total_size', 'download_payload_rate', 'upload_payload_rate', 'eta', 'label', 'save_path']],
      2
    );

    if (torrentResp.error) throw new Error(torrentResp.error.message || 'RPC error');

    const torrents    = Object.values(torrentResp.result || {});
    const downloading = torrents.filter(t => t.state === 'Downloading');
    const seeding     = torrents.filter(t => t.state === 'Seeding');
    const paused      = torrents.filter(t => t.state === 'Paused');
    const other       = torrents.filter(t => !['Downloading','Seeding','Paused'].includes(t.state));

    const totalDown = torrents.reduce((a, t) => a + (t.download_payload_rate || 0), 0);
    const totalUp   = torrents.reduce((a, t) => a + (t.upload_payload_rate   || 0), 0);

    function torrentRow(t) {
      const name     = t.name || 'Unknown';
      const progress = parseFloat(t.progress || 0);
      const state    = t.state || 'Unknown';
      const cls      = state === 'Downloading' ? 'online' : state === 'Seeding' ? 'seeding' : 'loading';
      const ratio    = t.ratio != null ? parseFloat(t.ratio).toFixed(2) : '—';
      const size     = t.total_size ? formatSize(t.total_size) : '';
      const eta      = state === 'Downloading' ? formatEta(t.eta) : '';
      const downSpeed = state === 'Downloading' && t.download_payload_rate ? formatSpeed(t.download_payload_rate) : '';
      return `
        <div class="list-item">
          <div class="list-item-header">
            <div class="list-item-title">${name.length > 52 ? name.substring(0, 52) + '…' : name}</div>
            <span class="torrent-state ${cls}">${state.toLowerCase()}</span>
          </div>
          <div class="progress-track"><div class="progress-bar" style="width:${Math.min(progress,100).toFixed(1)}%"></div></div>
          <div style="display:flex;gap:10px;margin-top:3px;flex-wrap:wrap;">
            <span class="list-item-meta">${progress.toFixed(1)}%</span>
            ${size     ? `<span class="list-item-meta">${size}</span>`              : ''}
            ${ratio    ? `<span class="list-item-meta">ratio ${ratio}</span>`       : ''}
            ${downSpeed? `<span class="list-item-meta">↓ ${downSpeed}</span>`       : ''}
            ${eta      ? `<span class="list-item-meta">eta ${eta}</span>`           : ''}
          </div>
        </div>
      `;
    }

    function group(label, list) {
      if (list.length === 0) return '';
      return `
        <div class="modal-section">
          <div class="modal-section-label">${label} · ${list.length}</div>
          <div class="list-items">${list.map(torrentRow).join('')}</div>
        </div>
      `;
    }

    Modal.setContent(`
      <div class="modal-stats">
        <div class="modal-stat"><div class="modal-stat-value">${torrents.length}</div><div class="modal-stat-label">total</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${downloading.length}</div><div class="modal-stat-label">downloading</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${seeding.length}</div><div class="modal-stat-label">seeding</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${formatSpeed(totalDown)}</div><div class="modal-stat-label">↓ speed</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${formatSpeed(totalUp)}</div><div class="modal-stat-label">↑ speed</div></div>
      </div>
      ${group('downloading', downloading)}
      ${group('seeding', seeding)}
      ${group('paused', paused)}
      ${group('other', other)}
      ${torrents.length === 0 ? '<div class="empty-state">no torrents</div>' : ''}
    `);
  } catch (err) {
    Modal.setError(err.message);
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function init(config, container) {
  _config    = config;
  _container = container;
  container.style.cursor = 'pointer';
  container.addEventListener('click', e => {
    if (!e.target.closest('.card-link')) openDetail();
  });
  return refresh();
}

export async function refresh() {
  if (!_container) return;
  renderSkeleton(_container);
  try {
    const loginResp = await delugeRpc('auth.login', [_config.password], 1);
    if (!loginResp.result) throw new Error('Authentication failed');

    const [torrentResp, versionResp] = await Promise.all([
      delugeRpc('core.get_torrents_status', [null, ['name', 'state', 'progress', 'download_payload_rate', 'upload_payload_rate']], 2),
      delugeRpc('daemon.info', [], 3).catch(() => null),
    ]);

    if (torrentResp.error) throw new Error(torrentResp.error.message || 'RPC error');

    const version = versionResp && versionResp.result && versionResp.result.version;
    renderData(_container, torrentResp.result || {}, version);
  } catch (err) {
    renderOffline(_container, err.message);
  }
}
