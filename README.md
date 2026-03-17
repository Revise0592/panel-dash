# Selfhosted Dashboard

A self-hosted media & download monitoring dashboard with a cyberpunk aesthetic. Displays live status for your Sonarr, Radarr, SABnzbd, Deluge, Overseerr, and UnRAID services in a single-page view — no frameworks, no build step.

![Dashboard preview](preview.png)

---

## Features

- **Live service monitoring** — status indicators, version badges, and key metrics for each service
- **Auto-refresh** — configurable polling interval (default 30s) with a manual refresh button
- **UnRAID system info** — CPU/RAM usage, array state, disk temperatures via the UnRAID GraphQL API
- **Download tracking** — active torrents (Deluge) and Usenet jobs (SABnzbd) with progress bars
- **Media library stats** — series/episode counts (Sonarr), movie counts (Radarr), and upcoming releases
- **Request management** — recent Overseerr requests with status badges
- **CORS proxy** — built-in Node.js proxy so the browser never talks directly to your services
- **Docker ready** — single `docker compose up` to deploy

---

## Services

| Service | What's shown |
|---|---|
| **Sonarr** | Total series, monitored count, episodes on disk, queue depth, upcoming episodes |
| **Radarr** | Total movies, on disk, missing, queue depth, upcoming releases |
| **SABnzbd** | Download speed, queue size, remaining data, free disk, active downloads |
| **Deluge** | Downloading/seeding counts, speeds, active torrent progress |
| **Overseerr** | Pending/total requests, recent request list with status |
| **UnRAID** | CPU & RAM usage, array state & capacity, uptime, disk temperatures |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/) **or** Node.js 18+
- API access to each service you want to monitor (see [Configuration](#configuration))
- UnRAID API key — generated at **Settings → Management Access → API Keys**

---

## Setup

### Using Docker (recommended)

```bash
git clone git@github.com:Revise0592/selfhosted-dash.git
cd SelfhostDashboard

# Copy and fill in your config
cp js/config.example.js js/config.js
nano js/config.js

# Start
docker compose up -d --build
```

Open **http://localhost:3000** in your browser.

### Running locally

```bash
git clone git@github.com:Revise0592/selfhosted-dash.git
cd SelfhostDashboard

cp js/config.example.js js/config.js
nano js/config.js

node server.js
```

Open **http://localhost:3000** in your browser.

> **Note:** Always open the dashboard via the Node.js server URL, not by opening `index.html` directly. The proxy server is required for CORS and UnRAID TLS handling.

---

## Configuration

Copy the example config and fill in your details:

```bash
cp js/config.example.js js/config.js
```

```js
// js/config.js
const CONFIG = {
  sonarr: {
    url: 'http://YOUR_SERVER_IP:8989',
    apiKey: 'YOUR_SONARR_API_KEY'        // Settings → General → API Key
  },
  radarr: {
    url: 'http://YOUR_SERVER_IP:7878',
    apiKey: 'YOUR_RADARR_API_KEY'
  },
  sabnzbd: {
    url: 'http://YOUR_SERVER_IP:8080',
    apiKey: 'YOUR_SABNZBD_API_KEY'       // Config → General → API Key
  },
  deluge: {
    url: 'http://YOUR_SERVER_IP:8112',
    password: 'YOUR_DELUGE_PASSWORD'
  },
  overseerr: {
    url: 'http://YOUR_SERVER_IP:5055',
    apiKey: 'YOUR_OVERSEERR_API_KEY'     // Settings → General → API Key
  },
  unraid: {
    url: 'https://YOUR_UNRAID_IP',       // Use https:// — UnRAID uses a self-signed cert
    apiKey: 'YOUR_UNRAID_API_KEY'        // Settings → Management Access → API Keys
  },
  refreshInterval: 30                    // Auto-refresh interval in seconds
};
```

> `js/config.js` is listed in `.gitignore` and will never be committed. `js/config.example.js` is the safe template that gets committed instead.

---

## Project Structure

```
SelfhostDashboard/
├── index.html               # Dashboard layout
├── server.js                # Node.js static server + CORS proxy
├── docker-compose.yml
├── Dockerfile
├── css/
│   └── style.css            # Cyberpunk styling
└── js/
    ├── app.js               # Service orchestration & auto-refresh
    ├── config.js            # Your credentials (gitignored)
    ├── config.example.js    # Placeholder config (committed)
    ├── proxy-fetch.js       # Proxy helper for CORS-restricted services
    └── services/
        ├── sonarr.js
        ├── radarr.js
        ├── sabnzbd.js
        ├── deluge.js
        ├── overseerr.js
        └── unraid.js
```

---

## Tech Stack

- **Frontend** — Vanilla JS (ES6 modules), no framework, no build step
- **Backend** — Node.js (`http` module only, no dependencies)
- **Styling** — Pure CSS with variables, grid layout, glassmorphism effects
- **APIs** — REST (Sonarr/Radarr/SABnzbd/Overseerr), JSON-RPC (Deluge), GraphQL (UnRAID)

---

## Updating

Because the volume mount maps the project folder directly into the container, updates are live — just upload your changed files and refresh the browser. No rebuild required.

If you change `server.js` or `docker-compose.yml`, restart the container:

```bash
docker compose restart
```

---

## License

MIT
