// UnRAID Service Module

import { proxyFetch } from '../proxy-fetch.js';

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/unraid.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

let _config = null;
let _container = null;

function header(statusCls, badge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="UnRAID" onerror="this.style.display='none'" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">UNRAID</h2>
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open UnRAID">${EXT_LINK}</a>`;
}

function formatUptime(seconds) {
  if (!seconds) return 'N/A';
  const s = parseInt(seconds, 10);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(kilobytes) {
  const kb = parseInt(kilobytes, 10);
  if (isNaN(kb)) return 'N/A';
  const gb = kb / (1024 * 1024);
  if (gb >= 1) return gb.toFixed(1) + ' TB' // unraid returns kilobytes, 1TB = 1024^3 KB
  // actually: 1 GB = 1024*1024 KB, 1 TB = 1024*1024*1024 KB
  // let's redo this properly
  return kb + ' KB';
}

function formatKB(kb) {
  const n = parseInt(kb, 10);
  if (isNaN(n)) return 'N/A';
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(1) + ' TB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' GB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' MB';
  return n + ' KB';
}

function formatMemBytes(bytes) {
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return 'N/A';
  if (n >= 1024 * 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024 * 1024)).toFixed(1) + ' TB';
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  return n + ' B';
}

function tempColor(temp) {
  if (temp == null) return '#888';
  if (temp >= 55) return '#ff3366';
  if (temp >= 45) return '#ffaa00';
  return '#00ff88';
}

async function fetchUnraid(query) {
  return proxyFetch(`${_config.url}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': _config.apiKey,
    },
    body: JSON.stringify({ query }),
  });
}

const SYSTEM_QUERY = `{
  vars { version name }
  info {
    os { uptime hostname }
    cpu { manufacturer brand cores threads }
  }
  metrics {
    cpu { percentTotal }
    memory { total used percentTotal }
  }
  array {
    state
    capacity { kilobytes { free used total } }
    parities { name status temp numErrors isSpinning }
    disks { name status temp numErrors isSpinning }
    caches { name status temp numErrors isSpinning }
  }
}`;

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

function renderData(container, data) {
  const d = data.data || data;
  const vars = d.vars || {};
  const info = d.info || {};
  const cpu = info.cpu || {};
  const os = info.os || {};
  const metrics = d.metrics || {};
  const cpuMetrics = metrics.cpu || {};
  const memMetrics = metrics.memory || {};
  const array = d.array || {};
  const capacity = (array.capacity && array.capacity.kilobytes) || {};

  const version = vars.version || 'N/A';
  const hostname = os.hostname || vars.name || 'N/A';
  const uptime = formatUptime(os.uptime);
  const cpuLabel = cpu.brand
    ? `${cpu.brand}`
    : (cpu.manufacturer ? `${cpu.manufacturer} CPU` : 'N/A');
  const cpuCores = cpu.cores ? `${cpu.cores}C / ${cpu.threads || '?'}T` : 'N/A';
  const cpuPct = cpuMetrics.percentTotal != null ? parseFloat(cpuMetrics.percentTotal).toFixed(1) : 'N/A';
  const memPct = memMetrics.percentTotal != null ? parseFloat(memMetrics.percentTotal).toFixed(1) : 'N/A';
  const memUsed = memMetrics.used ? formatMemBytes(memMetrics.used) : 'N/A';
  const memTotal = memMetrics.total ? formatMemBytes(memMetrics.total) : 'N/A';

  const arrayState = array.state || 'Unknown';
  const arrayStateClass = arrayState === 'STARTED' ? 'online' : arrayState === 'STOPPED' ? 'offline' : 'loading';
  const arrayUsed = capacity.used ? formatKB(capacity.used) : 'N/A';
  const arrayTotal = capacity.total ? formatKB(capacity.total) : 'N/A';
  const arrayFree = capacity.free ? formatKB(capacity.free) : 'N/A';
  const arrayPct = (capacity.used && capacity.total)
    ? ((parseInt(capacity.used) / parseInt(capacity.total)) * 100).toFixed(1)
    : null;

  // Disk temperatures
  const allDisks = [
    ...(array.parities || []).map(d => ({ ...d, _type: 'P' })),
    ...(array.disks || []).map(d => ({ ...d, _type: 'D' })),
    ...(array.caches || []).map(d => ({ ...d, _type: 'C' })),
  ].filter(d => d.status && d.status !== 'DISK_NP');

  const diskRows = allDisks.slice(0, 8).map(disk => {
    const temp = disk.temp != null ? disk.temp : null;
    const tempStr = temp != null ? `${temp}°C` : '—';
    const color = tempColor(temp);
    const spinning = disk.isSpinning === false ? '💤' : '';
    const typeLabel = disk._type === 'P' ? 'Parity' : disk._type === 'C' ? 'Cache' : disk.name || 'Disk';
    const errors = disk.numErrors > 0 ? `<span style="color:#ff3366"> ✕${disk.numErrors}</span>` : '';
    return `
      <div class="list-item" style="display:flex; align-items:center; gap:8px; padding:4px 0;">
        <span class="list-item-title" style="flex:1; font-size:0.78rem;">${typeLabel}${spinning}</span>
        ${errors}
        <span class="list-item-meta" style="font-size:0.82rem; color:${color}; font-weight:600;">${tempStr}</span>
      </div>
    `;
  }).join('');

  const versionBadge = version ? `<span class="version-badge">v${version}</span>` : '';

  container.innerHTML = `
    <div class="card-header">
      ${header('online', `<span class="service-status-badge ${arrayStateClass}">${arrayState}</span>${versionBadge}`)}
    </div>

    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">${cpuPct !== 'N/A' ? cpuPct + '%' : 'N/A'}</div>
        <div class="stat-label">CPU</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${memPct !== 'N/A' ? memPct + '%' : 'N/A'}</div>
        <div class="stat-label">MEMORY</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${arrayUsed}</div>
        <div class="stat-label">ARRAY USED</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${uptime}</div>
        <div class="stat-label">UPTIME</div>
      </div>
    </div>

    <div class="list-item" style="display:flex; gap:8px; align-items:baseline; margin-bottom:4px;">
      <span class="list-item-title" style="font-size:0.75rem; color:var(--text-dim);">CPU</span>
      <span class="list-item-sub" style="font-size:0.78rem; color:var(--text-secondary); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cpuLabel}</span>
      <span class="list-item-meta" style="font-size:0.75rem;">${cpuCores}</span>
    </div>
    <div class="list-item" style="display:flex; gap:8px; align-items:baseline; margin-bottom:6px;">
      <span class="list-item-title" style="font-size:0.75rem; color:var(--text-dim);">RAM</span>
      <span class="list-item-sub" style="font-size:0.78rem; color:var(--text-secondary);">${memUsed} / ${memTotal}</span>
      ${arrayPct != null ? `
      <span class="list-item-title" style="font-size:0.75rem; color:var(--text-dim); margin-left:auto;">ARRAY</span>
      <span class="list-item-sub" style="font-size:0.78rem; color:var(--text-secondary);">${arrayUsed} / ${arrayTotal}</span>
      ` : ''}
    </div>

    ${diskRows ? `
    <div class="section-label">DISK TEMPERATURES</div>
    <div class="list-items">${diskRows}</div>
    ` : ''}

    <div style="margin-top:6px; font-size:0.72rem; color:var(--text-dim);">
      <span>${hostname}</span>
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
    const result = await fetchUnraid(SYSTEM_QUERY);
    if (result.errors && result.errors.length) {
      throw new Error(result.errors[0].message);
    }
    renderData(_container, result);
  } catch (err) {
    renderOffline(_container, err.message);
  }
}
