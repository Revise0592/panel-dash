/**
 * Selfhosted Dashboard - Local Proxy Server
 *
 * Serves the dashboard and proxies API calls to bypass browser CORS restrictions.
 * Requires Node.js 18+ (uses built-in fetch).
 *
 * Usage: node server.js
 * Then open: http://localhost:3000
 */

// Allow self-signed TLS certificates on local network services (e.g. UnRAID)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

// In-memory cookie jar keyed by host (e.g. "192.168.86.75:8112")
// Used to maintain Deluge's session across RPC calls
const cookieJar = {};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// ── Static file server ────────────────────────────────────────────────────────

function serveStatic(req, res) {
  // Strip query string before resolving file path
  const urlPath = req.url.split('?')[0];
  const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  // Prevent path traversal outside ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not found: ${urlPath}`);
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ── Proxy handler ─────────────────────────────────────────────────────────────

async function handleProxy(req, res) {
  let rawBody = '';
  req.on('data', chunk => { rawBody += chunk; });
  req.on('end', async () => {
    const sendError = (status, message) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ _proxyError: message }));
    };

    let targetUrl, method, reqBody;
    try {
      ({ targetUrl, method = 'GET', reqBody = null, reqHeaders = {} } = JSON.parse(rawBody));
    } catch {
      return sendError(400, 'Invalid proxy request body');
    }

    if (!targetUrl) return sendError(400, 'Missing targetUrl');

    let host;
    try {
      host = new URL(targetUrl).host;
    } catch {
      return sendError(400, `Invalid targetUrl: ${targetUrl}`);
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...reqHeaders,
    };
    if (cookieJar[host]) headers['Cookie'] = cookieJar[host];

    const fetchOptions = { method, headers };
    if (reqBody) fetchOptions.body = reqBody;

    try {
      const upstream = await fetch(targetUrl, fetchOptions);

      // Capture and store session cookies (needed for Deluge auth)
      const setCookie = upstream.headers.get('set-cookie');
      if (setCookie) cookieJar[host] = setCookie.split(';')[0];

      let data;
      const ct = upstream.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await upstream.json();
      } else {
        const text = await upstream.text();
        try { data = JSON.parse(text); } catch { data = { _rawResponse: text }; }
      }

      res.writeHead(upstream.ok ? 200 : upstream.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      sendError(502, `Could not reach ${host}: ${err.message}`);
    }
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.url.startsWith('/proxy') && req.method === 'POST') {
    return handleProxy(req, res);
  }

  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Selfhosted Dashboard`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://<your-ip>:${PORT}`);
  console.log(`  Press Ctrl+C to stop\n`);
});
