// Main App Orchestration
import { applyTheme } from './theme.js';
import * as Sonarr    from './services/sonarr.js';
import * as Radarr    from './services/radarr.js';
import * as Sabnzbd   from './services/sabnzbd.js';
import * as Deluge    from './services/deluge.js';
import * as Overseerr from './services/overseerr.js';
import * as Unraid    from './services/unraid.js';

let CONFIG = {};
let autoRefreshTimer = null;

// Maps card element IDs to service modules and config keys
const services = [
  { id: 'sonarr-card',    module: Sonarr,    configKey: 'sonarr'    },
  { id: 'radarr-card',    module: Radarr,    configKey: 'radarr'    },
  { id: 'sabnzbd-card',   module: Sabnzbd,   configKey: 'sabnzbd'   },
  { id: 'deluge-card',    module: Deluge,    configKey: 'deluge'    },
  { id: 'overseerr-card', module: Overseerr, configKey: 'overseerr' },
  { id: 'unraid-card',    module: Unraid,    configKey: 'unraid'    },
];

// Clock and date display
function updateClock() {
  const now    = new Date();
  const timeEl = document.getElementById('current-time');
  const dateEl = document.getElementById('current-date');

  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    }).toUpperCase();
  }
}

function updateLastRefreshed() {
  const el = document.getElementById('last-updated');
  if (el) {
    el.textContent = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }
}

async function refreshAll() {
  const btn = document.getElementById('refresh-btn');
  if (btn) { btn.classList.add('spinning'); btn.disabled = true; }

  await Promise.allSettled(services.map(svc => svc.module.refresh()));
  updateLastRefreshed();

  if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
}

function initServices() {
  services.forEach(svc => {
    const container = document.getElementById(svc.id);
    if (container) svc.module.init(CONFIG[svc.configKey], container);
  });
}

function setupAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  const intervalMs = (CONFIG.refreshInterval || 30) * 1000;
  autoRefreshTimer = setInterval(refreshAll, intervalMs);
}

function setupRefreshButton() {
  const btn = document.getElementById('refresh-btn');
  if (btn) btn.addEventListener('click', () => refreshAll());
}

function applyDisplayTitle(title) {
  const el = document.getElementById('app-display-title');
  if (!el) return;
  // Render | as a styled separator, matching the app aesthetic
  const parts = (title || 'panel').split('|').map(s => s.trim());
  el.innerHTML = parts
    .map((part, i) => i < parts.length - 1
      ? `${part}<span class="sep">|</span>`
      : part)
    .join('');
}

// Re-initialise everything when settings are saved
window.addEventListener('config-updated', async () => {
  CONFIG = await window.electronAPI.getConfig();
  applyTheme(CONFIG.theme);
  applyDisplayTitle(CONFIG.displayTitle);
  initServices();
  setupAutoRefresh();
  refreshAll();
});

// Init
document.addEventListener('DOMContentLoaded', async () => {
  updateClock();
  setInterval(updateClock, 1000);
  updateLastRefreshed();

  CONFIG = await window.electronAPI.getConfig();
  applyTheme(CONFIG.theme);
  applyDisplayTitle(CONFIG.displayTitle);
  initServices();
  setupAutoRefresh();
  setupRefreshButton();
});
