// UnRAID Service Module

import { proxyFetch } from '../proxy-fetch.js';
import * as Modal from '../modal.js';

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/unraid.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

let _config    = null;
let _container = null;

function header(statusCls, badge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="UnRAID" onerror="this.style.display='none'" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">unraid</h2>
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open UnRAID">${EXT_LINK}</a>`;
}

function formatUptime(value) {
  if (!value) return 'N/A';
  // UnRAID returns os.uptime as an ISO 8601 boot timestamp, not elapsed seconds.
  // Calculate duration from that boot time to now.
  let s;
  if (typeof value === 'string' && value.includes('T')) {
    s = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  } else {
    s = parseInt(value, 10);
  }
  if (isNaN(s) || s < 0) return 'N/A';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatKB(kb) {
  const n = parseInt(kb, 10);
  if (isNaN(n)) return 'N/A';
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(1) + ' TB';
  if (n >= 1024 * 1024)        return (n / (1024 * 1024)).toFixed(1) + ' GB';
  if (n >= 1024)               return (n / 1024).toFixed(1) + ' MB';
  return n + ' KB';
}

function formatMemBytes(bytes) {
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return 'N/A';
  if (n >= 1024 * 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024 * 1024)).toFixed(1) + ' TB';
  if (n >= 1024 * 1024 * 1024)        return (n / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (n >= 1024 * 1024)               return (n / (1024 * 1024)).toFixed(1) + ' MB';
  return n + ' B';
}

function tempColor(temp) {
  if (temp == null) return 'var(--text-dim)';
  if (temp >= 55)   return 'var(--offline)';
  if (temp >= 45)   return 'var(--warning)';
  return 'var(--online)';
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

const DOCKER_QUERY = `{
  docker {
    containers {
      names
      state
      status
      image
      autoStart
    }
  }
}`;

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

function renderData(container, data) {
  const d          = data.data || data;
  const vars       = d.vars || {};
  const info       = d.info || {};
  const cpu        = info.cpu || {};
  const os         = info.os || {};
  const metrics    = d.metrics || {};
  const cpuMetrics = metrics.cpu || {};
  const memMetrics = metrics.memory || {};
  const array      = d.array || {};
  const capacity   = (array.capacity && array.capacity.kilobytes) || {};

  const version  = vars.version || 'N/A';
  const hostname = os.hostname || vars.name || 'N/A';
  const uptime   = formatUptime(os.uptime);
  const cpuLabel = cpu.brand || (cpu.manufacturer ? `${cpu.manufacturer} CPU` : 'N/A');
  const cpuCores = cpu.cores ? `${cpu.cores}C / ${cpu.threads || '?'}T` : 'N/A';
  const cpuPct   = cpuMetrics.percentTotal != null ? parseFloat(cpuMetrics.percentTotal).toFixed(1) : 'N/A';
  const memPct   = memMetrics.percentTotal != null ? parseFloat(memMetrics.percentTotal).toFixed(1) : 'N/A';
  const memUsed  = memMetrics.used  ? formatMemBytes(memMetrics.used)  : 'N/A';
  const memTotal = memMetrics.total ? formatMemBytes(memMetrics.total) : 'N/A';
  const arrayState      = array.state || 'Unknown';
  const arrayStateClass = arrayState === 'STARTED' ? 'online' : arrayState === 'STOPPED' ? 'offline' : 'loading';
  const arrayUsed       = capacity.used  ? formatKB(capacity.used)  : 'N/A';
  const arrayTotal      = capacity.total ? formatKB(capacity.total) : 'N/A';
  const arrayPct        = (capacity.used && capacity.total)
    ? ((parseInt(capacity.used) / parseInt(capacity.total)) * 100).toFixed(1) : null;

  const allDisks = [
    ...(array.parities || []).map(d => ({ ...d, _type: 'P' })),
    ...(array.disks    || []).map(d => ({ ...d, _type: 'D' })),
    ...(array.caches   || []).map(d => ({ ...d, _type: 'C' })),
  ].filter(d => d.status && d.status !== 'DISK_NP');

  const diskRows = allDisks.slice(0, 8).map(disk => {
    const temp    = disk.temp != null ? disk.temp : null;
    const tempStr = temp != null ? `${temp}°C` : '—';
    const color   = tempColor(temp);
    const spinning = disk.isSpinning === false ? '💤' : '';
    const typeLabel = disk._type === 'P' ? 'Parity' : disk._type === 'C' ? 'Cache' : disk.name || 'Disk';
    const errors = disk.numErrors > 0
      ? `<span style="color:var(--offline); font-size:0.54rem; letter-spacing:0.08em; padding:2px 6px; border:1px solid var(--offline); color:var(--offline);">✕${disk.numErrors}</span>`
      : '';
    const tempBadge = `<span style="font-size:0.54rem; letter-spacing:0.08em; padding:2px 6px; border:1px solid ${color}; color:${color};">${tempStr}</span>`;
    return `
      <div class="list-item" style="display:flex; align-items:center; gap:6px;">
        <span class="list-item-title" style="flex:1;">${typeLabel}${spinning}</span>
        ${errors}
        ${tempBadge}
      </div>
    `;
  }).join('');

  const versionBadge = version ? `<span class="version-badge">v${version}</span>` : '';

  container.innerHTML = `
    <div class="card-header">
      ${header('online', `<span class="service-status-badge ${arrayStateClass}">${arrayState}</span>${versionBadge}`)}
    </div>
    <div class="stats-grid">
      <div class="stat-item"><div class="stat-value">${cpuPct !== 'N/A' ? cpuPct + '%' : 'N/A'}</div><div class="stat-label">cpu</div></div>
      <div class="stat-item"><div class="stat-value">${memPct !== 'N/A' ? memPct + '%' : 'N/A'}</div><div class="stat-label">memory</div></div>
      <div class="stat-item"><div class="stat-value">${arrayUsed}</div><div class="stat-label">array used</div></div>
      <div class="stat-item"><div class="stat-value">${uptime}</div><div class="stat-label">uptime</div></div>
    </div>
    <div class="list-item" style="display:flex; gap:8px; align-items:baseline; margin-bottom:4px;">
      <span class="list-item-meta">cpu</span>
      <span class="list-item-sub" style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cpuLabel}</span>
      <span class="list-item-meta">${cpuCores}</span>
    </div>
    <div class="list-item" style="display:flex; gap:8px; align-items:baseline; margin-bottom:6px;">
      <span class="list-item-meta">ram</span>
      <span class="list-item-sub">${memUsed} / ${memTotal}</span>
      ${arrayPct != null ? `
      <span class="list-item-meta" style="margin-left:auto;">array</span>
      <span class="list-item-sub">${arrayUsed} / ${arrayTotal}</span>
      ` : ''}
    </div>
    ${diskRows ? `
    <div class="section-label">disk temperatures</div>
    <div class="list-items">${diskRows}</div>
    ` : ''}
    <div style="margin-top:6px; font-size:0.72rem; color:var(--text-dim);">${hostname}</div>
  `;
}

// ── Detail modal ──────────────────────────────────────────────────────────────

async function openDetail() {
  Modal.setTitle(`
    <img class="modal-icon" src="${ICON_URL}" alt="UnRAID" />
    <span class="modal-title">unraid</span>
    <span class="modal-title-sep">|</span>
    <span class="modal-title-sub">system overview</span>
  `);
  Modal.setLoading();
  Modal.open();

  try {
    const [sysResult, dockerResult] = await Promise.all([
      fetchUnraid(SYSTEM_QUERY),
      fetchUnraid(DOCKER_QUERY).catch(() => null),
    ]);

    if (sysResult.errors && sysResult.errors.length) throw new Error(sysResult.errors[0].message);

    const d          = sysResult.data || sysResult;
    const vars       = d.vars || {};
    const info       = d.info || {};
    const cpu        = info.cpu || {};
    const os         = info.os || {};
    const metrics    = d.metrics || {};
    const cpuMetrics = metrics.cpu || {};
    const memMetrics = metrics.memory || {};
    const array      = d.array || {};
    const capacity   = (array.capacity && array.capacity.kilobytes) || {};

    const hostname = os.hostname || vars.name || 'N/A';
    const uptime   = formatUptime(os.uptime);
    const cpuLabel = cpu.brand || (cpu.manufacturer ? `${cpu.manufacturer} CPU` : 'N/A');
    const cpuCores = cpu.cores ? `${cpu.cores}C / ${cpu.threads || '?'}T` : 'N/A';
    const cpuPct   = cpuMetrics.percentTotal != null ? parseFloat(cpuMetrics.percentTotal).toFixed(1) : 'N/A';
    const memPct   = memMetrics.percentTotal != null ? parseFloat(memMetrics.percentTotal).toFixed(1) : 'N/A';
    const memUsed  = memMetrics.used  ? formatMemBytes(memMetrics.used)  : 'N/A';
    const memTotal = memMetrics.total ? formatMemBytes(memMetrics.total) : 'N/A';
    const arrayUsed  = capacity.used  ? formatKB(capacity.used)  : 'N/A';
    const arrayTotal = capacity.total ? formatKB(capacity.total) : 'N/A';
    const arrayFree  = capacity.free  ? formatKB(capacity.free)  : 'N/A';
    const arrayState = array.state || 'Unknown';
    const arrayStateCls = arrayState === 'STARTED' ? 'approved' : arrayState === 'STOPPED' ? 'declined' : 'unknown';

    // Full disk list
    const allDisks = [
      ...(array.parities || []).map(d => ({ ...d, _type: 'P' })),
      ...(array.disks    || []).map(d => ({ ...d, _type: 'D' })),
      ...(array.caches   || []).map(d => ({ ...d, _type: 'C' })),
    ].filter(d => d.status && d.status !== 'DISK_NP');

    const diskRowsFull = allDisks.map(disk => {
      const temp     = disk.temp != null ? disk.temp : null;
      const tempStr  = temp != null ? `${temp}°C` : '—';
      const color    = tempColor(temp);
      const spinning = disk.isSpinning === false ? '💤' : '';
      const typeLabel = disk._type === 'P' ? 'Parity' : disk._type === 'C' ? 'Cache' : disk.name || 'Disk';
      const statusCls = disk.status === 'DISK_OK' ? 'approved' : 'declined';
      const errors = disk.numErrors > 0
        ? `<span style="font-size:0.54rem;letter-spacing:0.08em;padding:2px 6px;border:1px solid var(--offline);color:var(--offline);">✕${disk.numErrors}</span>`
        : '';
      const tempBadge = `<span style="font-size:0.54rem;letter-spacing:0.08em;padding:2px 6px;border:1px solid ${color};color:${color};">${tempStr}</span>`;
      return `
        <div class="list-item" style="display:flex;align-items:center;gap:6px;">
          <span class="list-item-meta" style="width:3rem;flex-shrink:0;">${disk._type === 'P' ? 'parity' : disk._type === 'C' ? 'cache' : ''}</span>
          <span class="list-item-title" style="flex:1;">${typeLabel}${spinning}</span>
          <span class="status-badge ${statusCls}" style="font-size:0.5rem;">${(disk.status || '').toLowerCase().replace('disk_','')}</span>
          ${errors}
          ${tempBadge}
        </div>
      `;
    }).join('');

    // Docker containers
    let dockerHtml = '';
    if (dockerResult && dockerResult.data && dockerResult.data.docker) {
      const containers = dockerResult.data.docker.containers || [];
      const isRunning = c => c.state === 'running' || c.state === 'started' || (c.status && c.status.toLowerCase().startsWith('up'));
      const running  = containers.filter(isRunning);
      const stopped  = containers.filter(c => !isRunning(c));

      function containerRow(c) {
        const name  = (c.names && c.names[0]) || c.image || 'Unknown';
        const clean = name.replace(/^\//, '');
        const running = isRunning(c);
        return `
          <div class="modal-docker-item ${running ? 'running' : 'stopped'}">
            <span class="status-dot ${running ? 'online' : 'offline'}" style="flex-shrink:0;"></span>
            <span class="modal-docker-name">${clean}</span>
            <span class="modal-docker-status">${(c.status || c.state || '').toLowerCase()}</span>
          </div>
        `;
      }

      dockerHtml = `
        <div class="modal-section">
          <div class="modal-section-label">docker containers · ${running.length} running / ${stopped.length} stopped</div>
          <div class="modal-docker-grid">
            ${[...running, ...stopped].map(containerRow).join('')}
          </div>
        </div>
      `;
    }

    Modal.setContent(`
      <div class="modal-stats">
        <div class="modal-stat"><div class="modal-stat-value">${cpuPct !== 'N/A' ? cpuPct + '%' : 'N/A'}</div><div class="modal-stat-label">cpu</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${memPct !== 'N/A' ? memPct + '%' : 'N/A'}</div><div class="modal-stat-label">ram</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${arrayUsed}</div><div class="modal-stat-label">array used</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${arrayFree}</div><div class="modal-stat-label">array free</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${uptime}</div><div class="modal-stat-label">uptime</div></div>
      </div>

      <div class="modal-section">
        <div class="modal-section-label">system</div>
        <div class="list-items">
          <div class="list-item" style="display:flex;gap:8px;align-items:baseline;">
            <span class="list-item-meta" style="width:3.5rem;flex-shrink:0;">host</span>
            <span class="list-item-sub">${hostname}</span>
          </div>
          <div class="list-item" style="display:flex;gap:8px;align-items:baseline;">
            <span class="list-item-meta" style="width:3.5rem;flex-shrink:0;">cpu</span>
            <span class="list-item-sub" style="flex:1;">${cpuLabel}</span>
            <span class="list-item-meta">${cpuCores}</span>
          </div>
          <div class="list-item" style="display:flex;gap:8px;align-items:baseline;">
            <span class="list-item-meta" style="width:3.5rem;flex-shrink:0;">ram</span>
            <span class="list-item-sub">${memUsed} / ${memTotal}</span>
          </div>
          <div class="list-item" style="display:flex;gap:8px;align-items:baseline;">
            <span class="list-item-meta" style="width:3.5rem;flex-shrink:0;">array</span>
            <span class="list-item-sub">${arrayUsed} / ${arrayTotal}</span>
            <span class="status-badge ${arrayStateCls}" style="font-size:0.5rem;">${arrayState.toLowerCase()}</span>
          </div>
        </div>
      </div>

      ${dockerHtml}

      <div class="modal-section">
        <div class="modal-section-label">disk array · ${allDisks.length} drives</div>
        <div class="list-items">${diskRowsFull || '<div class="empty-state">no disks</div>'}</div>
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
    const result = await fetchUnraid(SYSTEM_QUERY);
    if (result.errors && result.errors.length) throw new Error(result.errors[0].message);
    renderData(_container, result);
  } catch (err) {
    renderOffline(_container, err.message);
  }
}
