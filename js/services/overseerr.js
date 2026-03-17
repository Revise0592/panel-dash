// Overseerr/Jellyseerr Service Module
// Uses proxyFetch so requests go server-side, bypassing browser CORS restrictions.

import { proxyFetch } from '../proxy-fetch.js';

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/overseerr.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

function header(statusCls, badge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="Overseerr" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">OVERSEERR</h2>
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open Overseerr">${EXT_LINK}</a>`;
}

let _config = null;
let _container = null;

async function fetchOverseerr(endpoint) {
  return proxyFetch(`${_config.url}${endpoint}`, {
    headers: { 'X-Api-Key': _config.apiKey },
  });
}

function getStatusLabel(status) {
  // Overseerr status: 1=pending, 2=approved, 3=declined, 4=available, 5=processing
  const map = {
    1: { label: 'PENDING', cls: 'pending' },
    2: { label: 'APPROVED', cls: 'approved' },
    3: { label: 'DECLINED', cls: 'declined' },
    4: { label: 'AVAILABLE', cls: 'available' },
    5: { label: 'PROCESSING', cls: 'processing' }
  };
  return map[status] || { label: 'UNKNOWN', cls: 'unknown' };
}

function getMediaTypeLabel(type) {
  if (type === 'tv') return 'TV';
  if (type === 'movie') return 'MOVIE';
  return type ? type.toUpperCase() : '?';
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
    ? `<div class="cors-note">Dashboard must be served via <strong>node server.js</strong>. Open http://localhost:3000 instead of the file directly.</div>`
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

function renderData(container, statusData, requestData, enrichedRequests) {
  const allRequests = requestData.results || [];
  const totalRequests = requestData.pageInfo
    ? (requestData.pageInfo.total ?? requestData.pageInfo.results ?? allRequests.length)
    : allRequests.length;
  const pendingRequests = allRequests.filter(r => r.status === 1).length;

  const recentItems = enrichedRequests.map(req => {
    const mediaType = getMediaTypeLabel(req.type || (req.media && req.media.mediaType));
    const statusInfo = getStatusLabel(req.status);
    return `
      <div class="list-item">
        <div class="list-item-header">
          <div class="list-item-title">${req._title}</div>
          <span class="status-badge ${statusInfo.cls}">${statusInfo.label}</span>
        </div>
        <div class="list-item-meta">${mediaType}</div>
      </div>
    `;
  }).join('');

  const version = statusData.version || 'N/A';

  container.innerHTML = `
    <div class="card-header">
      ${header('online', `<span class="version-badge">v${version}</span>`)}
    </div>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">${pendingRequests}</div>
        <div class="stat-label">PENDING</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${totalRequests}</div>
        <div class="stat-label">TOTAL REQS</div>
      </div>
    </div>
    <div class="section-label">RECENT REQUESTS</div>
    <div class="list-items">
      ${recentItems || '<div class="empty-state">No recent requests</div>'}
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
    const [statusData, requestData] = await Promise.all([
      fetchOverseerr('/api/v1/status'),
      fetchOverseerr('/api/v1/request?take=10&sort=added'),
    ]);

    // The request list only contains DB IDs, not TMDB titles.
    // Fetch the individual media record for each of the top 3 to get the title.
    const recent = (requestData.results || []).slice(0, 3);
    const enriched = await Promise.all(recent.map(async req => {
      const mediaType = req.type || (req.media && req.media.mediaType);
      const tmdbId    = req.media && req.media.tmdbId;
      let title = 'Unknown';
      if (tmdbId && mediaType) {
        try {
          const endpoint = mediaType === 'movie' ? `/api/v1/movie/${tmdbId}` : `/api/v1/tv/${tmdbId}`;
          const detail   = await fetchOverseerr(endpoint);
          title = detail.title || detail.originalTitle || detail.name || detail.originalName || 'Unknown';
        } catch { /* leave as Unknown */ }
      }
      return { ...req, _title: title };
    }));

    renderData(_container, statusData, requestData, enriched);
  } catch (err) {
    renderOffline(_container, err.message);
  }
}
