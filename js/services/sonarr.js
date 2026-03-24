// Sonarr Service Module

import * as Modal from '../modal.js';

const ICON_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/sonarr.svg';
const EXT_LINK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

let _config    = null;
let _container = null;

function header(statusCls, badge = '') {
  return `<img class="card-icon" src="${ICON_URL}" alt="Sonarr" />
      <span class="status-dot ${statusCls}"></span>
      <h2 class="card-title">sonarr</h2>
      ${badge}
      <a class="card-link" href="${_config && _config.url}" target="_blank" rel="noopener noreferrer" title="Open Sonarr">${EXT_LINK}</a>`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function fetchSonarr(endpoint) {
  const r = await fetch(`${_config.url}${endpoint}`, {
    headers: { 'X-Api-Key': _config.apiKey }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── Card render ─────────────────────────────────────────────────────────────

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

function renderData(container, series, queue, calendar, version) {
  const totalSeries          = series.length;
  const monitoredSeries      = series.filter(s => s.monitored).length;
  const totalEpisodesOnDisk  = series.reduce((a, s) => a + (s.statistics ? s.statistics.episodeFileCount : 0), 0);
  const queueCount           = queue.totalRecords !== undefined ? queue.totalRecords : (queue.records ? queue.records.length : 0);

  const upcomingItems = calendar.slice(0, 3).map(ep => {
    const showTitle = ep.series ? ep.series.title : 'Unknown';
    const epTitle   = ep.title || 'TBA';
    const airDate   = ep.airDate ? formatDate(ep.airDate) : '?';
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
    <div class="card-header">${header('online', versionBadge)}</div>
    <div class="stats-grid">
      <div class="stat-item"><div class="stat-value">${totalSeries}</div><div class="stat-label">total series</div></div>
      <div class="stat-item"><div class="stat-value">${monitoredSeries}</div><div class="stat-label">monitored</div></div>
      <div class="stat-item"><div class="stat-value">${totalEpisodesOnDisk}</div><div class="stat-label">eps on disk</div></div>
      <div class="stat-item"><div class="stat-value">${queueCount}</div><div class="stat-label">in queue</div></div>
    </div>
    <div class="section-label">upcoming episodes</div>
    <div class="list-items">
      ${upcomingItems || '<div class="empty-state">no upcoming episodes</div>'}
    </div>
  `;
}

// ── Detail modal ─────────────────────────────────────────────────────────────

async function openDetail() {
  Modal.setTitle(`
    <img class="modal-icon" src="${ICON_URL}" alt="Sonarr" />
    <span class="modal-title">sonarr</span>
    <span class="modal-title-sep">|</span>
    <span class="modal-title-sub">tv library</span>
  `);
  Modal.setLoading();
  Modal.open();

  try {
    const today  = new Date();
    const ahead  = new Date(); ahead.setDate(today.getDate() + 14);
    const start  = today.toISOString().split('T')[0];
    const end    = ahead.toISOString().split('T')[0];

    const [series, queue, calendar] = await Promise.all([
      fetchSonarr('/api/v3/series'),
      fetchSonarr('/api/v3/queue?pageSize=100&includeEpisode=true&includeSeries=true'),
      fetchSonarr(`/api/v3/calendar?start=${start}&end=${end}&includeSeries=true`),
    ]);

    const records   = queue.records || [];
    const monitored = series.filter(s => s.monitored).length;
    const complete  = series.filter(s => s.statistics && s.statistics.percentOfEpisodes === 100).length;
    const missing   = series.reduce((a, s) => a + (s.statistics ? Math.max(0, s.statistics.episodeCount - s.statistics.episodeFileCount) : 0), 0);

    // Poster grid
    const posterGrid = series
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(s => {
        const img  = s.images && s.images.find(i => i.coverType === 'poster');
        const src  = img ? `${_config.url}${img.url.split('?')[0]}` : '';
        const pct  = s.statistics ? Math.round(s.statistics.percentOfEpisodes) : 0;
        const col  = pct === 100 ? 'var(--online)' : pct > 0 ? 'var(--warning)' : 'var(--text-dim)';
        const href = s.tvdbId ? `https://www.thetvdb.com/dereferrer/series/${s.tvdbId}` : null;
        return `
          <div class="modal-poster-item">
            ${href ? `<a href="${href}" target="_blank" rel="noopener">` : '<div>'}
            ${src
              ? `<img class="modal-poster-img" src="${src}" alt="${s.title}" loading="lazy" onerror="this.style.opacity='0'">`
              : `<div class="modal-poster-img modal-poster-placeholder"></div>`}
            <div class="modal-poster-info">
              <div class="modal-poster-title">${s.title}</div>
              <div class="modal-poster-meta" style="color:${col}">${pct}%</div>
            </div>
            ${href ? '</a>' : '</div>'}
          </div>
        `;
      }).join('');

    // Queue
    const queueHtml = records.length === 0
      ? '<div class="empty-state">queue is empty</div>'
      : records.map(item => {
          const title   = (item.series && item.series.title) || item.title || 'Unknown';
          const ep      = item.episode ? `S${String(item.episode.seasonNumber).padStart(2,'0')}E${String(item.episode.episodeNumber).padStart(2,'0')}` : '';
          const pct     = item.size && item.sizeleft ? ((1 - item.sizeleft / item.size) * 100).toFixed(1) : 0;
          const quality = item.quality && item.quality.quality ? item.quality.quality.name : '';
          return `
            <div class="list-item">
              <div class="list-item-header">
                <div class="list-item-title">${title}${ep ? ' · ' + ep : ''}</div>
                ${quality ? `<span class="version-badge">${quality}</span>` : ''}
              </div>
              <div class="progress-track"><div class="progress-bar" style="width:${pct}%"></div></div>
              <div class="list-item-meta">${pct}%</div>
            </div>
          `;
        }).join('');

    // Calendar
    const calHtml = calendar.length === 0
      ? '<div class="empty-state">no upcoming episodes in the next 14 days</div>'
      : calendar.map(ep => {
          const show = ep.series ? ep.series.title : 'Unknown';
          const epCode = `S${String(ep.seasonNumber).padStart(2,'0')}E${String(ep.episodeNumber).padStart(2,'0')}`;
          return `
            <div class="list-item">
              <div class="list-item-header">
                <div class="list-item-title">${show}</div>
                <span class="list-item-meta">${formatDate(ep.airDate)}</span>
              </div>
              <div class="list-item-sub">${epCode} · ${ep.title || 'TBA'}</div>
            </div>
          `;
        }).join('');

    Modal.setContent(`
      <div class="modal-stats">
        <div class="modal-stat"><div class="modal-stat-value">${series.length}</div><div class="modal-stat-label">series</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${monitored}</div><div class="modal-stat-label">monitored</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${complete}</div><div class="modal-stat-label">complete</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${missing}</div><div class="modal-stat-label">missing eps</div></div>
        <div class="modal-stat"><div class="modal-stat-value">${records.length}</div><div class="modal-stat-label">in queue</div></div>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">series collection</div>
        <div class="modal-poster-grid">${posterGrid}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">download queue</div>
        <div class="list-items">${queueHtml}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-label">upcoming · next 14 days</div>
        <div class="list-items">${calHtml}</div>
      </div>
    `);
  } catch (err) {
    Modal.setError(err.message);
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

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
    const [series, queue, calendar, status] = await Promise.all([
      fetchSonarr('/api/v3/series'),
      fetchSonarr('/api/v3/queue?pageSize=100'),
      fetchSonarr(`/api/v3/calendar?start=${today.toISOString().split('T')[0]}&end=${ahead.toISOString().split('T')[0]}&includeSeries=true`),
      fetchSonarr('/api/v3/system/status').catch(() => null),
    ]);
    renderData(_container, series, queue, calendar, status && status.version);
  } catch (err) {
    renderOffline(_container, err.message);
  }
}
