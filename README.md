# Selfhosted Dashboard

A lightweight, self-hosted monitoring dashboard for your media and download stack. Displays live status for Sonarr, Radarr, SABnzbd, Deluge, Overseerr, and UnRAID in a single-page view — no frameworks, no build step.

![Dashboard preview](/screenshot/Screenshot_20260324_083253.png)

---

## Features

- **Live service monitoring** — status indicators, version badges, and key metrics for each service
- **Clickable cards** — click any service card to expand a detailed modal with richer data (posters, full queues, Docker containers, disk array, and more)
- **Auto-refresh** — configurable polling interval (default 30s) with a manual refresh button
- **UnRAID system info** — CPU/RAM usage, array state, disk temperatures, Docker container status via the UnRAID GraphQL API
- **Download tracking** — active torrents (Deluge) and Usenet jobs (SABnzbd) with progress bars
- **Media library stats** — series/episode counts (Sonarr), movie counts (Radarr), and upcoming releases
- **Request management** — recent Overseerr requests with TMDB poster art, IMDB/TVDB links, and status badges
- **CORS proxy** — built-in Node.js proxy so the browser never talks directly to your services
- **Docker ready** — single `docker compose up` to deploy

---

## Services

| Service | Card | Detail modal |
|---|---|---|
| **Sonarr** | Total series, monitored count, episodes on disk, queue depth | Full series poster grid, download queue, 14-day upcoming calendar |
| **Radarr** | Total movies, on disk, missing, queue depth | Recently added movies with IMDB links, full queue, upcoming releases |
| **SABnzbd** | Download speed, queue size, remaining data, free disk | Full queue with categories, last 15 completed downloads |
| **Deluge** | Downloading/seeding counts, speeds, active torrent progress | All torrents grouped by state with ratio, size, ETA |
| **Overseerr** | Pending/total requests, recent request list | Last 20 requests with TMDB posters, IMDB/TVDB links |
| **UnRAID** | CPU & RAM usage, array state, uptime, disk temperatures | System info, all Docker containers, full disk array health |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/) **or** Node.js 18+
- API access to each service you want to monitor (see [Configuration](#configuration))
- UnRAID API key — generated at **Settings → Management Access → API Keys**

---

## Setup

### Using Docker (recommended)

```bash
git clone https://github.com/Revise0592/selfhosted-dash.git
cd selfhosted-dashboard

# Copy and fill in your config
cp js/config.example.js js/config.js
nano js/config.js

# Start
docker compose up -d --build
```

Open **http://localhost:3000** in your browser.

### Running locally

```bash
git clone https://github.com/Revise0592/selfhosted-dash.git
cd selfhosted-dashboard

cp js/config.example.js js/config.js
nano js/config.js

node server.js
```

Open **http://localhost:3000** in your browser.

> **Note:** Always open the dashboard via the Node.js server URL, not by opening `index.html` directly. The proxy server is required for CORS and UnRAID TLS handling.

### Deploying on UnRAID

UnRAID's persistent app data lives in `/mnt/user/appdata/`. Clone the repo there so your config and data survive container restarts and UnRAID updates.

**Initial setup (SSH into UnRAID):**

```bash
cd /mnt/user/appdata
git clone https://github.com/Revise0592/selfhosted-dash.git selfhosted-dashboard
cd selfhosted-dashboard

# Create your config (this file is gitignored — you only do this once)
cp js/config.example.js js/config.js
nano js/config.js

# Start the container
docker compose up -d --build
```

Open **http://YOUR_UNRAID_IP:3000** in your browser.

**Updating after a GitHub push:**

```bash
cd /mnt/user/appdata/selfhosted-dashboard
./update.sh
```

The `update.sh` script pulls the latest changes and only restarts the container if `server.js` changed — static file updates (HTML/CSS/JS) are live immediately thanks to the Docker volume mount.

To force a restart regardless:

```bash
./update.sh --restart
```

> **Tip:** UnRAID's Compose Manager plugin (Community Applications) can manage the container via the web UI. Point it at `/mnt/user/appdata/selfhosted-dashboard/docker-compose.yml` for a GUI start/stop/restart experience.

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

You don't need to configure every service — simply omit any block for services you don't run and remove the corresponding card from `index.html`.

---

## Project Structure

```
selfhosted-dashboard/
├── index.html               # Dashboard layout
├── server.js                # Node.js static server + CORS proxy
├── docker-compose.yml
├── Dockerfile
├── css/
│   └── style.css            # Styling
└── js/
    ├── app.js               # Service orchestration & auto-refresh
    ├── modal.js             # Shared detail modal manager
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
- **Backend** — Node.js (`http` module only, no npm dependencies)
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
