// Sabnzbd Service Module

import * as Modal from '../modal.js';

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/sabnzbd.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

let _config    = null;
let _container = null;

function header(statusCls, badge = '', versionBadge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="SABnzbd" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">sabnzbd</h2>
      ${versionBadge}
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open SABnzbd">${EXT_LINK}</a>`;
}

function formatSpeed(kbps) {
  if (!kbps || kbps === 0) return '0 KB/s';
  const n = parseFloat(kbps);
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' GB/s';
  if (n >= 1024)        return (n / 1024).toFixed(2) + ' MB/s';
  return n.toFixed(1) + ' KB/s';
}

function formatMB(mb) {
  const n = parseFloat(mb);
  if (isNaN(n)) return '0 MB';
  if (n >= 1024) return (n / 1024).toFixed(2) + ' GB';
  return n.toFixed(1) + ' MB';
}

function formatBytes(bytes) {
  const n = parseFloat(bytes);
  if (isNaN(n)) return '0 B';
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (n >= 1024 * 1024)        return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n >= 1024)               return (n / 1024).toFixed(2) + ' KB';
  return n.toFixed(0) + ' B';
}

async function fetchSabnzbd(mode) {
  const r = await fetch(`${_config.url}/api?mode=${mode}&output=json&apikey=${_config.apiKey}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
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
  container.innerHTML = `
    <div class="card-header">${header('offline')}</div>
    <div class="offline-message"><span class="offline-icon">⚠</span><span>service offline</span></div>
    <div class="error-detail">${error}</div>
  `;
}

function renderData(container, queueData, diskData, version) {
  const queue  = queueData.queue || {};
  const speed  = queue.kbpersec !== undefined ? formatSpeed(queue.kbpersec) : (queue.speed || '0 KB/s');
  const mbLeft = queue.mbleft || '0';
  const slots  = queue.noofslots || 0;
  const status = queue.status || 'Unknown';

  let freeSpaceDisplay = 'N/A';
  if (diskData && diskData.diskspace1_norm) {
    freeSpaceDisplay = diskData.diskspace1_norm;
  } else if (diskData && diskData.diskspace1) {
    freeSpaceDisplay = formatBytes(parseFloat(diskData.diskspace1) * 1024 * 1024 * 1024);
  }

  const activeSlots   = (queue.slots || []).slice(0, 3);
  const downloadItems = activeSlots.map(slot => {
    const name = slot.filename || slot.name || 'Unknown';
    const pct  = parseFloat(slot.percentage || 0);
    const size = slot.mb !== undefined ? formatMB(parseFloat(slot.mb || 0) - parseFloat(slot.mbleft || 0)) + ' / ' + formatMB(slot.mb || 0) : '';
    return `
      <div class="list-item">
        <div class="list-item-title">${name.length > 40 ? name.substring(0, 40) + '…' : name}</div>
        ${size ? `<div class="list-item-sub">${size}</div>` : ''}
        <div class="progress-track"><div class="progress-bar" style="width:${pct}%"></div></div>
        <div class="list-item-meta">${pct.toFixed(1)}%</div>
      </div>
    `;
  }).join('');

  const statusClass  = status === 'Downloading' ? 'online' : status === 'Paused' ? 'loading' : 'offline';
  const versionBadge = version ? `<span class="version-badge">v${version}</span>` : '';

  container.innerHTML = `
    <div class="card-header">${header('online', `<span class="service-status-badge ${statusClass}">${status.toLowerCase()}</span>`, versionBadge)}</div>
    <div class="stats-grid">
      <div class="stat-item"><div class="stat-value">${speed}</div><div class="stat-label">speed</div></div>
      <div class="stat-item"><div class="stat-value">${slots}</div><div class="stat-label">queued</div></div>
      <div class="stat-item"><div class="stat-value">${formatMB(mbLeft)}</div><div class="stat-label">remaining</div></div>
      <div class="stat-item"><div class="stat-value">${freeSpaceDisplay}</div><div class="stat-label">free disk</div></div>
    </div>
    <div class="section-label">active downloads</div>
    <div class="list-items">
      ${downloadItems || '<div class="empty-state">no active downloads</div>'}
    </div>
  `;
}

// ── Detail modal ──────────────────────────────────────────────────────────────

async function openDetail() {
  Modal.setTitle(`
    <img class="modal-icon" src="${ICON_URL}" alt="SABnzbd" />
    <span class="modal-title">sabnzbd</span>
    <span class="modal-title-sep">|</span>
    <span class="modal-title-sub">download queue</span>
  `);
  Modal.setLoading();
  Modal.open();

  try {
    const [queueData, historyData, diskData] = await Promise.all([
      fetchSabnzbd('queue'),
      fetchSabnzbd('history&limit=15'),
      fetchSabnzbd('diskspace'),
    ]);

    const queue   = queueData.queue || {};
    const history = historyData.history || {};
    const speed   = queue.kbpersec !== undefined ? formatSpeed(queue.kbpersec) : (queue.speed || '0 KB/s');
    const slots   = queue.slots || [];
    const status  = queue.status || 'Unknown';

    let freeSpace = 'N/A';
    if (diskData && diskData.diskspace1_norm) freeSpace = diskData.diskspace1_norm;

    // Full queue
    const queueHtml = slots.length === 0
      ? '<div class="empty-state">queue is empty</div>'
      : slots.map(slot => {
          const name = slot.filename || slot.name || 'Unknown';
          const pct  = parseFloat(slot.percentage || 0);
          const size = slot.mb !== undefined
            ? formatMB(parseFloat(slot.mb || 0) - parseFloat(slot.mbleft || 0)) + ' / ' + formatMB(slot.mb || 0)
            : '';
          const cat  = slot.cat && slot.cat !== 'Default' ? slot.cat : '';
          return `
            <div class="list-item">
              <div class="list-item-header">
                <div class="list-item-title">${name.length > 55 ? name.substring(0, 55) + '…' : name}</div>
                ${cat ? `<span class="version-badge">${cat}</span>` : ''}
              </div>
              ${size ? `<div class="list-item-sub">${size}</div>` : ''}
              <div class="progress-track"><div class="progress-bar" style="width:${pct}%"></div></div>
              <div class="list-item-meta">${pct.toFixed(1)}%</div>
            </div>
          `;
        }).join('');

    // History
    const histSlots  = (history.slots || []);
    const historyHtml = histSlots.length === 0
      ? '<div class="empty-state">no completed downloads</div>'
      : histSlots.map(item => {
          const name   = item.name || 'Unknown';
          const size   = item.size || '';
          const status = item.status || '';
          const cat    = item.category && item.category !== 'Default' ? item.category : '';
          const statusCls = status === 'Completed' ? 'approved' : status === 'Failed' ? 'declined' : 'unknown';
          return `
            <div class="list-item">
              <div class="list-item-header">
                <div class="list-item-title">${name.length > 55 ? name.substring(0, 55) + '…' : name}</div>
                <span class="status-badge ${statusCls}">${status.toLowerCase()}</span>
              </div>
              <div style="display:flex;gap:8px;margin-top:3px;">
                ${size ? `<span class="list-item-meta">${size}</span>` : ''}
                ${cat  ? `<span class="list-item-meta">${cat}</span>`  : ''}
              </div>
            </div>
          `;
        }).join('');

    const statusCls = status === 'Downloading' ? 'online' : status === 'Paused' ? 'loading' : 'offline';

    Modal.setContent(`
      <div class="modal-stats">
        <div class="modal-stat"><div class="modal-stat-value">${speed}</div><div class="modal-stat-label">speed</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${slots.length}</div><div class="modal-stat-label">queued</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${freeSpace}</div><div class="modal-stat-label">free disk</div></div>
        <div class="modal-stat">
          <div class="modal-stat-value">
            <span class="service-status-badge ${statusCls}" style="font-size:0.7rem;">${status.toLowerCase()}</span>
          </div>
          <div class="modal-stat-label">status</div>
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">full queue · ${slots.length} item${slots.length !== 1 ? 's' : ''}</div>
        <div class="list-items">${queueHtml}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">recently completed · last 15</div>
        <div class="list-items">${historyHtml}</div>
      </div>
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
    const [queueData, diskData, versionData] = await Promise.all([
      fetchSabnzbd('queue'),
      fetchSabnzbd('diskspace'),
      fetchSabnzbd('version').catch(() => null),
    ]);
    renderData(_container, queueData, diskData, versionData && versionData.version);
  } catch (err) {
    renderOffline(_container, err.message);
  }
}
