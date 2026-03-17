const CONFIG = {
  sonarr: {
    url: 'http://YOUR_SERVER_IP:8989',
    apiKey: 'YOUR_SONARR_API_KEY'
  },
  radarr: {
    url: 'http://YOUR_SERVER_IP:7878',
    apiKey: 'YOUR_RADARR_API_KEY'
  },
  sabnzbd: {
    url: 'http://YOUR_SERVER_IP:8080',
    apiKey: 'YOUR_SABNZBD_API_KEY'
  },
  deluge: {
    url: 'http://YOUR_SERVER_IP:8112',
    password: 'YOUR_DELUGE_PASSWORD'
  },
  overseerr: {
    url: 'http://YOUR_SERVER_IP:5055',
    apiKey: 'YOUR_OVERSEERR_API_KEY'
  },
  unraid: {
    url: 'https://YOUR_SERVER_IP',
    apiKey: 'YOUR_UNRAID_API_KEY'  // Settings → Management Access → API Keys
  },
  refreshInterval: 30  // seconds
};

export default CONFIG;
