// Main App Orchestration
import CONFIG from './config.js';
import * as Sonarr from './services/sonarr.js';
import * as Radarr from './services/radarr.js';
import * as Sabnzbd from './services/sabnzbd.js';
import * as Deluge from './services/deluge.js';
import * as Overseerr from './services/overseerr.js';
import * as Unraid from './services/unraid.js';

// Clock and date display
function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('current-time');
  const dateEl = document.getElementById('current-date');

  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).toUpperCase();
  }
}

function updateLastRefreshed() {
  const el = document.getElementById('last-updated');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
}

// Service definitions: maps service name to module and config
const services = [
  { id: 'sonarr-card',    module: Sonarr,    config: CONFIG.sonarr    },
  { id: 'radarr-card',    module: Radarr,    config: CONFIG.radarr    },
  { id: 'sabnzbd-card',   module: Sabnzbd,   config: CONFIG.sabnzbd   },
  { id: 'deluge-card',    module: Deluge,    config: CONFIG.deluge    },
  { id: 'overseerr-card', module: Overseerr, config: CONFIG.overseerr },
  { id: 'unraid-card',    module: Unraid,    config: CONFIG.unraid    }
];

async function refreshAll() {
  const btn = document.getElementById('refresh-btn');
  if (btn) {
    btn.classList.add('spinning');
    btn.disabled = true;
  }

  await Promise.allSettled(
    services.map(svc => svc.module.refresh())
  );

  updateLastRefreshed();

  if (btn) {
    btn.classList.remove('spinning');
    btn.disabled = false;
  }
}

function initServices() {
  services.forEach(svc => {
    const container = document.getElementById(svc.id);
    if (container) {
      svc.module.init(svc.config, container);
    }
  });
}

function setupAutoRefresh() {
  const intervalMs = (CONFIG.refreshInterval || 30) * 1000;
  setInterval(refreshAll, intervalMs);
}

function setupRefreshButton() {
  const btn = document.getElementById('refresh-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      refreshAll();
    });
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  updateLastRefreshed();

  initServices();
  setupAutoRefresh();
  setupRefreshButton();
});
