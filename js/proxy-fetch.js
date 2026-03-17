/**
 * proxyFetch - routes requests through the local proxy server (server.js)
 * to avoid browser CORS restrictions when calling services directly by IP.
 *
 * Returns the parsed JSON response, or throws an Error on failure.
 */
export async function proxyFetch(targetUrl, options = {}) {
  const response = await fetch('/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetUrl,
      method:     options.method   || 'GET',
      reqBody:    options.body     || null,
      reqHeaders: options.headers  || {},
    }),
  });

  const data = await response.json();

  if (data && data._proxyError) {
    throw new Error(data._proxyError);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return data;
}
