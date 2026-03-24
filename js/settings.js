/**
 * Settings Modal
 *
 * Loads current config into the form, handles live theme preview via swatch
 * clicks, and saves everything via electronAPI.setConfig() on submit.
 * Fires 'config-updated' so app.js reinitialises services after save.
 */

import { applyTheme } from './theme.js';

const overlay  = document.getElementById('settings-overlay');
const form     = document.getElementById('settings-form');
const saveBtn  = document.getElementById('settings-save');
const cancelBtn  = document.getElementById('settings-cancel');
const statusEl   = document.getElementById('settings-status');
const swatchBtns = document.querySelectorAll('#theme-swatches .theme-swatch');

let pendingTheme  = 'forest'; // tracks live-preview selection before save
let originalTheme = 'forest'; // restored if user cancels

function field(id) { return document.getElementById(id); }

// ── Swatches ──────────────────────────────────────────────────────────────────

function setActiveSwatchUI(name) {
  swatchBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === name);
  });
}

swatchBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    pendingTheme = btn.dataset.theme;
    setActiveSwatchUI(pendingTheme);
    applyTheme(pendingTheme); // live preview
  });
});

// ── Open / close ──────────────────────────────────────────────────────────────

export function openSettings() {
  window.electronAPI.getConfig().then(cfg => {
    field('cfg-sonarr-url').value    = cfg.sonarr?.url    || '';
    field('cfg-sonarr-key').value    = cfg.sonarr?.apiKey || '';

    field('cfg-radarr-url').value    = cfg.radarr?.url    || '';
    field('cfg-radarr-key').value    = cfg.radarr?.apiKey || '';

    field('cfg-sabnzbd-url').value   = cfg.sabnzbd?.url    || '';
    field('cfg-sabnzbd-key').value   = cfg.sabnzbd?.apiKey || '';

    field('cfg-deluge-url').value    = cfg.deluge?.url      || '';
    field('cfg-deluge-pass').value   = cfg.deluge?.password || '';

    field('cfg-overseerr-url').value = cfg.overseerr?.url    || '';
    field('cfg-overseerr-key').value = cfg.overseerr?.apiKey || '';

    field('cfg-unraid-url').value    = cfg.unraid?.url    || '';
    field('cfg-unraid-key').value    = cfg.unraid?.apiKey || '';

    field('cfg-interval').value = cfg.refreshInterval ?? 30;

    field('cfg-display-title').value = cfg.displayTitle || 'panel';

    originalTheme = cfg.theme || 'forest';
    pendingTheme  = originalTheme;
    setActiveSwatchUI(pendingTheme);

    statusEl.textContent = '';
    statusEl.className   = 'settings-status';
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  });
}

function closeSettings(restoreTheme = false) {
  if (restoreTheme) applyTheme(originalTheme);
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveSettings(e) {
  e.preventDefault();

  const config = {
    sonarr:    { url: field('cfg-sonarr-url').value.trim(),    apiKey:   field('cfg-sonarr-key').value.trim()    },
    radarr:    { url: field('cfg-radarr-url').value.trim(),    apiKey:   field('cfg-radarr-key').value.trim()    },
    sabnzbd:   { url: field('cfg-sabnzbd-url').value.trim(),   apiKey:   field('cfg-sabnzbd-key').value.trim()   },
    deluge:    { url: field('cfg-deluge-url').value.trim(),    password: field('cfg-deluge-pass').value.trim()   },
    overseerr: { url: field('cfg-overseerr-url').value.trim(), apiKey:   field('cfg-overseerr-key').value.trim() },
    unraid:    { url: field('cfg-unraid-url').value.trim(),    apiKey:   field('cfg-unraid-key').value.trim()    },
    refreshInterval: parseInt(field('cfg-interval').value, 10) || 30,
    theme:        pendingTheme,
    displayTitle: field('cfg-display-title').value.trim() || 'panel',
  };

  saveBtn.disabled    = true;
  saveBtn.textContent = 'saving...';

  await window.electronAPI.setConfig(config);

  originalTheme       = pendingTheme;
  statusEl.textContent = 'saved.';
  statusEl.className   = 'settings-status ok';
  saveBtn.disabled     = false;
  saveBtn.textContent  = 'save';

  closeSettings(false);
  window.dispatchEvent(new CustomEvent('config-updated'));
}

// ── Event wiring ──────────────────────────────────────────────────────────────

cancelBtn.addEventListener('click', () => closeSettings(true));
overlay.addEventListener('click', e => { if (e.target === overlay) closeSettings(true); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(true); });
form.addEventListener('submit', saveSettings);

document.getElementById('settings-btn').addEventListener('click', openSettings);
