/**
 * proxyFetch - routes requests through Electron's main process via IPC.
 *
 * In the Electron context there are no CORS restrictions, so the main process
 * makes HTTP calls directly to your local services and returns the parsed JSON.
 *
 * Returns the parsed JSON response, or throws an Error on failure.
 */
export async function proxyFetch(targetUrl, options = {}) {
  const data = await window.electronAPI.fetch(targetUrl, {
    method:  options.method  || 'GET',
    body:    options.body    || null,
    headers: options.headers || {},
  });

  if (data && data._proxyError) {
    throw new Error(data._proxyError);
  }

  return data;
}
