// Sonarr Service Module

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/sonarr.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

function header(statusCls, badge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="Sonarr" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">SONARR</h2>
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open Sonarr">${EXT_LINK}</a>`;
}

let _config = null;
let _container = null;

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function fetchSonarr(endpoint) {
  const url = `${_config.url}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'X-Api-Key': _config.apiKey }
  });
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

function renderData(container, series, queue, calendar, version) {
  const totalSeries = series.length;
  const seriesOnDisk = series.filter(s => s.statistics && s.statistics.percentOfEpisodes === 100).length;
  const monitoredSeries = series.filter(s => s.monitored).length;
  const totalEpisodesOnDisk = series.reduce((acc, s) => acc + (s.statistics ? s.statistics.episodeFileCount : 0), 0);
  const totalMonitoredEpisodes = series.reduce((acc, s) => acc + (s.statistics ? s.statistics.episodeCount : 0), 0);
  const queueCount = queue.totalRecords !== undefined ? queue.totalRecords : (queue.records ? queue.records.length : 0);

  const upcomingItems = calendar.slice(0, 3).map(ep => {
    const showTitle = ep.series ? ep.series.title : 'Unknown';
    const epTitle = ep.title || 'TBA';
    const airDate = ep.airDate ? formatDate(ep.airDate) : '?';
    return `
      <div class="list-item">
        <div class="list-item-title">${showTitle}</div>
        <div class="list-item-sub">S${String(ep.seasonNumber).padStart(2,'0')}E${String(ep.episodeNumber).padStart(2,'0')} · ${epTitle}</div>
        <div class="list-item-meta">${airDate}</div>
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
        <div class="stat-value">${totalSeries}</div>
        <div class="stat-label">TOTAL SERIES</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${monitoredSeries}</div>
        <div class="stat-label">MONITORED</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${totalEpisodesOnDisk}</div>
        <div class="stat-label">EPS ON DISK</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${queueCount}</div>
        <div class="stat-label">IN QUEUE</div>
      </div>
    </div>
    <div class="section-label">UPCOMING EPISODES</div>
    <div class="list-items">
      ${upcomingItems || '<div class="empty-state">No upcoming episodes</div>'}
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
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 7);
    const startStr = today.toISOString().split('T')[0];
    const endStr = futureDate.toISOString().split('T')[0];

    const [series, queue, calendar, status] = await Promise.all([
      fetchSonarr('/api/v3/series'),
      fetchSonarr('/api/v3/queue?pageSize=100'),
      fetchSonarr(`/api/v3/calendar?start=${startStr}&end=${endStr}`),
      fetchSonarr('/api/v3/system/status').catch(() => null),
    ]);

    renderData(_container, series, queue, calendar, status && status.version);
  } catch (err) {
    renderOffline(_container, err.message);
  }
}
