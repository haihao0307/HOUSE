const nativeFetch = window.fetch.bind(window);

window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  if (!url.startsWith('https://api.github.com/')) return nativeFetch(input, init);

  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.delete('X-GitHub-Api-Version');
  return nativeFetch(input, { ...init, headers });
};

window.__YUNNAN_WALL_GITHUB_CORS_PATCH__ = {
  version: '1.0.0',
  policy: 'strip-x-github-api-version-from-browser-cors-preflight'
};
