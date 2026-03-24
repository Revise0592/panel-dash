// Modal Manager
// Lazily creates a single modal overlay and exposes open/close/content helpers.

let _overlay = null;
let _body    = null;
let _title   = null;

function _init() {
  if (_overlay) return;

  _overlay = document.createElement('div');
  _overlay.className = 'modal-overlay';
  _overlay.setAttribute('aria-hidden', 'true');
  _overlay.innerHTML = `
    <div class="modal-panel">
      <div class="modal-header">
        <div class="modal-title-row" id="modal-title-row"></div>
        <button class="modal-close" id="modal-close">close</button>
      </div>
      <div class="modal-body" id="modal-body"></div>
    </div>
  `;
  document.body.appendChild(_overlay);

  _body  = _overlay.querySelector('#modal-body');
  _title = _overlay.querySelector('#modal-title-row');

  _overlay.querySelector('#modal-close').addEventListener('click', close);
  _overlay.addEventListener('click', e => { if (e.target === _overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

export function open() {
  _init();
  _overlay.classList.add('is-open');
  _overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

export function close() {
  if (!_overlay) return;
  _overlay.classList.remove('is-open');
  _overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export function setTitle(html) {
  _init();
  _title.innerHTML = html;
}

export function setContent(html) {
  _init();
  _body.innerHTML = html;
}

export function setLoading() {
  setContent('<div class="modal-loading">loading...</div>');
}

export function setError(msg) {
  setContent(`<div class="modal-error">⚠ &nbsp;${msg}</div>`);
}
