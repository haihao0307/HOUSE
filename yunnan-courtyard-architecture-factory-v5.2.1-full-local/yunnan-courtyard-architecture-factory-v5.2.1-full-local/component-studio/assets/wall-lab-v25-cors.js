const nativeFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  if (!url.startsWith('https://api.github.com/')) return nativeFetch(input, init);

  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.delete('X-GitHub-Api-Version');
  const response = await nativeFetch(input, { ...init, headers });

  const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method === 'GET' && /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/?#]+(?:[?#].*)?$/.test(url) && response.ok) {
    try {
      const data = await response.clone().json();
      if (data?.permissions?.push === false) {
        data.permissions.push = null;
        return new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }
    } catch {
      return response;
    }
  }
  return response;
};

window.__YUNNAN_WALL_GITHUB_CORS_PATCH__ = {
  version: '1.1.0',
  policy: 'strip-browser-preflight-version-header-and-defer-write-proof-to-write-endpoints'
};
