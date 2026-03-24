// Overseerr/Jellyseerr Service Module
// Uses proxyFetch so requests go server-side, bypassing browser CORS restrictions.

import { proxyFetch } from '../proxy-fetch.js';
import * as Modal from '../modal.js';

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/overseerr.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

let _config    = null;
let _container = null;

function header(statusCls, badge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="Overseerr" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">overseerr</h2>
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open Overseerr">${EXT_LINK}</a>`;
}

async function fetchOverseerr(endpoint) {
  return proxyFetch(`${_config.url}${endpoint}`, {
    headers: { 'X-Api-Key': _config.apiKey },
  });
}

function getStatusInfo(status) {
  const map = {
    1: { label: 'pending',    cls: 'pending'    },
    2: { label: 'approved',   cls: 'approved'   },
    3: { label: 'declined',   cls: 'declined'   },
    4: { label: 'available',  cls: 'available'  },
    5: { label: 'processing', cls: 'processing' },
  };
  return map[status] || { label: 'unknown', cls: 'unknown' };
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
    ? `<div class="cors-note">Dashboard must be served via <strong>node server.js</strong>. Open http://localhost:3000 instead of the file directly.</div>`
    : '';
  container.innerHTML = `
    <div class="card-header">${header('offline')}</div>
    <div class="offline-message"><span class="offline-icon">⚠</span><span>service offline</span></div>
    <div class="error-detail">${error}</div>
    ${hint}
  `;
}

function renderData(container, statusData, requestData, enrichedRequests) {
  const allRequests   = requestData.results || [];
  const totalRequests = requestData.pageInfo
    ? (requestData.pageInfo.total ?? requestData.pageInfo.results ?? allRequests.length)
    : allRequests.length;
  const pendingRequests = allRequests.filter(r => r.status === 1).length;

  const recentItems = enrichedRequests.map(req => {
    const mediaType  = req.type === 'tv' ? 'tv' : req.type === 'movie' ? 'movie' : (req.type || '?');
    const statusInfo = getStatusInfo(req.status);
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
    <div class="card-header">${header('online', `<span class="version-badge">v${version}</span>`)}</div>
    <div class="stats-grid">
      <div class="stat-item"><div class="stat-value">${pendingRequests}</div><div class="stat-label">pending</div></div>
      <div class="stat-item"><div class="stat-value">${totalRequests}</div><div class="stat-label">total reqs</div></div>
    </div>
    <div class="section-label">recent requests</div>
    <div class="list-items">
      ${recentItems || '<div class="empty-state">no recent requests</div>'}
    </div>
  `;
}

// ── Detail modal ──────────────────────────────────────────────────────────────

async function openDetail() {
  Modal.setTitle(`
    <img class="modal-icon" src="${ICON_URL}" alt="Overseerr" />
    <span class="modal-title">overseerr</span>
    <span class="modal-title-sep">|</span>
    <span class="modal-title-sub">media requests</span>
  `);
  Modal.setLoading();
  Modal.open();

  try {
    const [statusData, requestData] = await Promise.all([
      fetchOverseerr('/api/v1/status'),
      fetchOverseerr('/api/v1/request?take=20&sort=added'),
    ]);

    const allRequests = requestData.results || [];
    const pending     = allRequests.filter(r => r.status === 1).length;
    const approved    = allRequests.filter(r => r.status === 2).length;
    const available   = allRequests.filter(r => r.status === 4).length;

    const totalRequests = requestData.pageInfo
      ? (requestData.pageInfo.total ?? allRequests.length)
      : allRequests.length;

    // Enrich top 20 with title, poster, and external IDs
    const enriched = await Promise.all(allRequests.slice(0, 20).map(async req => {
      const mediaType = req.type || (req.media && req.media.mediaType);
      const tmdbId    = req.media && req.media.tmdbId;
      let title = 'Unknown', posterPath = null, imdbId = null, tvdbId = null;
      if (tmdbId && mediaType) {
        try {
          const endpoint = mediaType === 'movie' ? `/api/v1/movie/${tmdbId}` : `/api/v1/tv/${tmdbId}`;
          const detail   = await fetchOverseerr(endpoint);
          title      = detail.title || detail.originalTitle || detail.name || detail.originalName || 'Unknown';
          posterPath = detail.posterPath || null;
          imdbId     = detail.externalIds && detail.externalIds.imdbId;
          tvdbId     = detail.externalIds && detail.externalIds.tvdbId;
        } catch { /* leave as Unknown */ }
      }
      return { ...req, _title: title, _poster: posterPath, _imdbId: imdbId, _tvdbId: tvdbId };
    }));

    const TMDB_IMG = 'https://image.tmdb.org/t/p/w154';

    const requestCards = enriched.map(req => {
      const mediaType  = req.type === 'tv' ? 'tv' : 'movie';
      const statusInfo = getStatusInfo(req.status);
      const poster     = req._poster ? `${TMDB_IMG}${req._poster}` : null;
      const requester  = req.requestedBy && (req.requestedBy.displayName || req.requestedBy.username || req.requestedBy.email) || '';

      let externalLinks = '';
      if (req._imdbId) {
        externalLinks += `<a href="https://www.imdb.com/title/${req._imdbId}" target="_blank" rel="noopener" class="modal-external-link">imdb ↗</a>`;
      }
      if (req._tvdbId && mediaType === 'tv') {
        externalLinks += `<a href="https://www.thetvdb.com/dereferrer/series/${req._tvdbId}" target="_blank" rel="noopener" class="modal-external-link">tvdb ↗</a>`;
      }

      return `
        <div class="modal-request-card">
          ${poster
            ? `<img class="modal-request-poster" src="${poster}" alt="${req._title}" loading="lazy" onerror="this.style.opacity='0'">`
            : `<div class="modal-request-poster modal-poster-placeholder"></div>`}
          <div class="modal-request-details">
            <div class="modal-request-title">${req._title}</div>
            <div class="modal-request-meta">${mediaType}${requester ? ' · ' + requester : ''}</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <span class="status-badge ${statusInfo.cls}">${statusInfo.label}</span>
              ${externalLinks}
            </div>
          </div>
        </div>
      `;
    }).join('');

    Modal.setContent(`
      <div class="modal-stats">
        <div class="modal-stat"><div class="modal-stat-value">${totalRequests}</div><div class="modal-stat-label">total</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${pending}</div><div class="modal-stat-label">pending</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${approved}</div><div class="modal-stat-label">approved</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${available}</div><div class="modal-stat-label">available</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">recent requests · last 20</div>
        <div class="modal-request-list">
          ${requestCards || '<div class="empty-state">no requests</div>'}
        </div>
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
    const [statusData, requestData] = await Promise.all([
      fetchOverseerr('/api/v1/status'),
      fetchOverseerr('/api/v1/request?take=10&sort=added'),
    ]);

    const recent   = (requestData.results || []).slice(0, 3);
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
