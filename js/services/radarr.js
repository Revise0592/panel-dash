// Radarr Service Module

import * as Modal from '../modal.js';

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/radarr.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

let _config    = null;
let _container = null;

function header(statusCls, badge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="Radarr" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">radarr</h2>
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open Radarr">${EXT_LINK}</a>`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function fetchRadarr(endpoint) {
  const r = await fetch(`${_config.url}${endpoint}`, {
    headers: { 'X-Api-Key': _config.apiKey }
  });
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

function renderData(container, movies, queue, calendar, version) {
  const totalMovies = movies.length;
  const onDisk      = movies.filter(m => m.hasFile).length;
  const queueCount  = queue.totalRecords !== undefined ? queue.totalRecords : (queue.records ? queue.records.length : 0);

  const upcomingItems = calendar.slice(0, 3).map(movie => {
    const title       = movie.title || 'Unknown';
    const year        = movie.year || '';
    const releaseDate = movie.physicalRelease || movie.inCinemas || movie.digitalRelease;
    const dateStr     = releaseDate ? formatDate(releaseDate) : '?';
    return `
      <div class="list-item">
        <div class="list-item-title">${title} <span class="year-badge">${year}</span></div>
        <div class="list-item-meta">${dateStr}</div>
      </div>
    `;
  }).join('');

  const versionBadge = version ? `<span class="version-badge">v${version}</span>` : '';

  container.innerHTML = `
    <div class="card-header">${header('online', versionBadge)}</div>
    <div class="stats-grid">
      <div class="stat-item"><div class="stat-value">${totalMovies}</div><div class="stat-label">total movies</div></div>
      <div class="stat-item"><div class="stat-value">${onDisk}</div><div class="stat-label">on disk</div></div>
      <div class="stat-item"><div class="stat-value">${totalMovies - onDisk}</div><div class="stat-label">missing</div></div>
      <div class="stat-item"><div class="stat-value">${queueCount}</div><div class="stat-label">in queue</div></div>
    </div>
    <div class="section-label">upcoming movies</div>
    <div class="list-items">
      ${upcomingItems || '<div class="empty-state">no upcoming movies</div>'}
    </div>
  `;
}

// ── Detail modal ──────────────────────────────────────────────────────────────

async function openDetail() {
  Modal.setTitle(`
    <img class="modal-icon" src="${ICON_URL}" alt="Radarr" />
    <span class="modal-title">radarr</span>
    <span class="modal-title-sep">|</span>
    <span class="modal-title-sub">movie library</span>
  `);
  Modal.setLoading();
  Modal.open();

  try {
    const today = new Date();
    const ahead = new Date(); ahead.setDate(today.getDate() + 60);

    const [movies, queue, calendar] = await Promise.all([
      fetchRadarr('/api/v3/movie'),
      fetchRadarr('/api/v3/queue?pageSize=100&includeMovie=true'),
      fetchRadarr(`/api/v3/calendar?start=${today.toISOString().split('T')[0]}&end=${ahead.toISOString().split('T')[0]}`),
    ]);

    const records  = queue.records || [];
    const onDisk   = movies.filter(m => m.hasFile).length;
    const missing  = movies.length - onDisk;

    // Recently added — sorted by added date, last 24
    const recentMovies = [...movies]
      .sort((a, b) => new Date(b.added) - new Date(a.added))
      .slice(0, 24);

    const posterGrid = recentMovies.map(m => {
      const img    = m.images && m.images.find(i => i.coverType === 'poster');
      const src    = img ? `${_config.url}${img.url.split('?')[0]}` : '';
      const imdbHref = m.imdbId ? `https://www.imdb.com/title/${m.imdbId}` : null;
      const hasFile  = m.hasFile;
      return `
        <div class="modal-poster-item">
          ${imdbHref ? `<a href="${imdbHref}" target="_blank" rel="noopener">` : '<div>'}
          ${src
            ? `<img class="modal-poster-img" src="${src}" alt="${m.title}" loading="lazy" onerror="this.style.opacity='0'">`
            : `<div class="modal-poster-img modal-poster-placeholder"></div>`}
          <div class="modal-poster-info">
            <div class="modal-poster-title">${m.title}</div>
            <div class="modal-poster-meta" style="color:${hasFile ? 'var(--online)' : 'var(--text-dim)'}">${m.year || ''}${hasFile ? '' : ' · missing'}</div>
          </div>
          ${imdbHref ? '</a>' : '</div>'}
        </div>
      `;
    }).join('');

    // Queue
    const queueHtml = records.length === 0
      ? '<div class="empty-state">queue is empty</div>'
      : records.map(item => {
          const title   = (item.movie && item.movie.title) || item.title || 'Unknown';
          const year    = item.movie && item.movie.year ? `(${item.movie.year})` : '';
          const pct     = item.size && item.sizeleft ? ((1 - item.sizeleft / item.size) * 100).toFixed(1) : 0;
          const quality = item.quality && item.quality.quality ? item.quality.quality.name : '';
          return `
            <div class="list-item">
              <div class="list-item-header">
                <div class="list-item-title">${title} <span class="year-badge">${year}</span></div>
                ${quality ? `<span class="version-badge">${quality}</span>` : ''}
              </div>
              <div class="progress-track"><div class="progress-bar" style="width:${pct}%"></div></div>
              <div class="list-item-meta">${pct}%</div>
            </div>
          `;
        }).join('');

    // Calendar
    const calHtml = calendar.length === 0
      ? '<div class="empty-state">no upcoming releases in the next 60 days</div>'
      : calendar.map(m => {
          const releaseDate = m.physicalRelease || m.inCinemas || m.digitalRelease;
          const type = m.physicalRelease ? 'physical' : m.inCinemas ? 'cinema' : 'digital';
          const imdbLink = m.imdbId
            ? `<a href="https://www.imdb.com/title/${m.imdbId}" target="_blank" rel="noopener" class="modal-external-link">imdb ↗</a>`
            : '';
          return `
            <div class="list-item">
              <div class="list-item-header">
                <div class="list-item-title">${m.title} <span class="year-badge">${m.year || ''}</span></div>
                <span class="list-item-meta">${formatDate(releaseDate)}</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px;">
                <span class="list-item-meta">${type}</span>
                ${imdbLink}
              </div>
            </div>
          `;
        }).join('');

    Modal.setContent(`
      <div class="modal-stats">
        <div class="modal-stat"><div class="modal-stat-value">${movies.length}</div><div class="modal-stat-label">movies</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${onDisk}</div><div class="modal-stat-label">on disk</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${missing}</div><div class="modal-stat-label">missing</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${records.length}</div><div class="modal-stat-label">in queue</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">recently added · last 24</div>
        <div class="modal-poster-grid">${posterGrid}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">download queue</div>
        <div class="list-items">${queueHtml}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">upcoming releases · next 60 days</div>
        <div class="list-items">${calHtml}</div>
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
    const today = new Date();
    const ahead = new Date(); ahead.setDate(today.getDate() + 7);
    const [movies, queue, calendar, status] = await Promise.all([
      fetchRadarr('/api/v3/movie'),
      fetchRadarr('/api/v3/queue?pageSize=100'),
      fetchRadarr(`/api/v3/calendar?start=${today.toISOString().split('T')[0]}&end=${ahead.toISOString().split('T')[0]}`),
      fetchRadarr('/api/v3/system/status').catch(() => null),
    ]);
    renderData(_container, movies, queue, calendar, status && status.version);
  } catch (err) {
    renderOffline(_container, err.message);
  }
}
