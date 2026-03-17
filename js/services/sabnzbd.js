// Sabnzbd Service Module

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/sabnzbd.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

function header(statusCls, badge = '', versionBadge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="SABnzbd" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">SABNZBD</h2>
      ${versionBadge}
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open SABnzbd">${EXT_LINK}</a>`;
}

let _config = null;
let _container = null;

function formatSpeed(kbps) {
  if (!kbps || kbps === 0) return '0 KB/s';
  const num = parseFloat(kbps);
  if (num >= 1024 * 1024) return (num / (1024 * 1024)).toFixed(2) + ' GB/s';
  if (num >= 1024) return (num / 1024).toFixed(2) + ' MB/s';
  return num.toFixed(1) + ' KB/s';
}

function formatMB(mb) {
  const num = parseFloat(mb);
  if (isNaN(num)) return '0 MB';
  if (num >= 1024) return (num / 1024).toFixed(2) + ' GB';
  return num.toFixed(1) + ' MB';
}

function formatBytes(bytes) {
  const num = parseFloat(bytes);
  if (isNaN(num)) return '0 B';
  if (num >= 1024 * 1024 * 1024) return (num / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (num >= 1024 * 1024) return (num / (1024 * 1024)).toFixed(2) + ' MB';
  if (num >= 1024) return (num / 1024).toFixed(2) + ' KB';
  return num.toFixed(0) + ' B';
}

async function fetchSabnzbd(mode) {
  const url = `${_config.url}/api?mode=${mode}&output=json&apikey=${_config.apiKey}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
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
  container.innerHTML = `
    <div class="card-header">
      ${header('offline')}
    </div>
    <div class="offline-message">
      <span class="offline-icon">⚠</span>
      <span>SERVICE OFFLINE</span>
    </div>
    <div class="error-detail">${error}</div>
  `;
}

function renderData(container, queueData, diskData, version) {
  const queue = queueData.queue || {};
  const speed = queue.speed || '0';
  const mbLeft = queue.mbleft || '0';
  const slots = queue.noofslots || 0;
  const status = queue.status || 'Unknown';

  // Parse speed - SABnzbd returns speed as string like "1.2 MB/s" or raw KB/s
  let speedDisplay = '0 KB/s';
  if (queue.kbpersec !== undefined) {
    speedDisplay = formatSpeed(queue.kbpersec);
  } else if (speed && speed !== '0') {
    speedDisplay = speed;
  }

  // Disk space
  let freeSpaceDisplay = 'N/A';
  if (diskData && diskData.diskspace1_norm) {
    freeSpaceDisplay = diskData.diskspace1_norm;
  } else if (diskData && diskData.diskspace1) {
    freeSpaceDisplay = formatBytes(parseFloat(diskData.diskspace1) * 1024 * 1024 * 1024);
  }

  // Active downloads
  const activeSlots = (queue.slots || []).slice(0, 3);
  const downloadItems = activeSlots.map(slot => {
    const name = slot.filename || slot.name || 'Unknown';
    const pct = parseFloat(slot.percentage || 0);
    const sizeMB = slot.mbleft !== undefined ? formatMB(parseFloat(slot.mb || 0) - parseFloat(slot.mbleft || 0)) + ' / ' + formatMB(slot.mb || 0) : '';
    return `
      <div class="list-item">
        <div class="list-item-title">${name.length > 40 ? name.substring(0, 40) + '…' : name}</div>
        ${sizeMB ? `<div class="list-item-sub">${sizeMB}</div>` : ''}
        <div class="progress-track">
          <div class="progress-bar" style="width: ${pct}%"></div>
        </div>
        <div class="list-item-meta">${pct.toFixed(1)}%</div>
      </div>
    `;
  }).join('');

  const statusClass = status === 'Downloading' ? 'online' : status === 'Paused' ? 'loading' : 'offline';
  const versionBadge = version ? `<span class="version-badge">v${version}</span>` : '';

  container.innerHTML = `
    <div class="card-header">
      ${header('online', `<span class="service-status-badge ${statusClass}">${status.toUpperCase()}</span>`, versionBadge)}
    </div>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">${speedDisplay}</div>
        <div class="stat-label">SPEED</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${slots}</div>
        <div class="stat-label">QUEUED</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${formatMB(mbLeft)}</div>
        <div class="stat-label">REMAINING</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${freeSpaceDisplay}</div>
        <div class="stat-label">FREE DISK</div>
      </div>
    </div>
    <div class="section-label">ACTIVE DOWNLOADS</div>
    <div class="list-items">
      ${downloadItems || '<div class="empty-state">No active downloads</div>'}
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
