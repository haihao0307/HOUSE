const nativeFetch = window.fetch.bind(window);
const TOKEN_PATTERN = /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/;

function stripInvisible(value) {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ');
}

function normalizeGithubToken(value) {
  const cleaned = stripInvisible(value)
    .replace(/^[\s"'`“”‘’]+|[\s"'`“”‘’]+$/g, '')
    .trim();
  const matched = cleaned.match(TOKEN_PATTERN);
  const token = matched?.[0] || cleaned.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw new TypeError('请粘贴以 github_pat_ 开头的 GitHub 令牌');
  }
  if (!/^[\x21-\x7E]+$/.test(token)) {
    throw new TypeError('GitHub 令牌中含有中文、全角符号或不可见字符。请只粘贴 github_pat_ 开头的令牌');
  }
  if (!/^(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]+)$/.test(token)) {
    throw new TypeError('GitHub 令牌格式无法识别。请复制完整的 github_pat_ 开头令牌');
  }
  return token;
}

function safeHeaderValue(name, value) {
  if (String(name).toLowerCase() === 'authorization') {
    return `Bearer ${normalizeGithubToken(value)}`;
  }
  const text = stripInvisible(value);
  if (/[^\x09\x20-\x7E\x80-\xFF]/.test(text)) {
    throw new TypeError(`请求头 ${name} 含有浏览器无法发送的字符`);
  }
  return text;
}

function buildSafeHeaders(source) {
  const headers = new Headers();
  if (!source) return headers;

  if (source instanceof Headers) {
    for (const [name, value] of source.entries()) headers.set(name, safeHeaderValue(name, value));
    return headers;
  }
  if (Array.isArray(source)) {
    for (const [name, value] of source) headers.set(name, safeHeaderValue(name, value));
    return headers;
  }
  for (const [name, value] of Object.entries(source)) {
    if (value == null) continue;
    headers.set(name, safeHeaderValue(name, value));
  }
  return headers;
}

function showTokenMessage(text, tone = '') {
  const state = document.getElementById('githubBridgeState');
  const status = document.getElementById('githubBridgeStatus');
  if (state) {
    state.textContent = tone === 'error' ? '令牌格式有误' : '令牌格式已整理';
    state.dataset.tone = tone;
  }
  if (status) {
    status.textContent = text;
    status.dataset.tone = tone;
  }
}

function normalizeTokenInput({ report = false } = {}) {
  const input = document.getElementById('githubToken');
  if (!input || !input.value) return null;
  try {
    const token = normalizeGithubToken(input.value);
    input.value = token;
    if (report) showTokenMessage('已识别 GitHub 令牌。现在可以点击“测试 GitHub 连接”。', 'success');
    return token;
  } catch (error) {
    if (report) showTokenMessage(error.message || String(error), 'error');
    return null;
  }
}

const tokenInput = document.getElementById('githubToken');
if (tokenInput) {
  tokenInput.addEventListener('paste', () => setTimeout(() => normalizeTokenInput({ report: true }), 0));
  tokenInput.addEventListener('change', () => normalizeTokenInput({ report: true }));
  tokenInput.addEventListener('blur', () => normalizeTokenInput({ report: false }));
}

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  if (!url.startsWith('https://api.github.com/')) return nativeFetch(input, init);

  const headers = buildSafeHeaders(init.headers || (input instanceof Request ? input.headers : undefined));
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

const selfTestToken = `github_pat_${'A'.repeat(40)}`;
const selfTestHeaders = buildSafeHeaders({ Authorization: `Bearer 中文说明 ${selfTestToken}` });
const selfTestPassed = selfTestHeaders.get('Authorization') === `Bearer ${selfTestToken}`;
if (!selfTestPassed) throw new Error('GitHub 令牌请求头整理自检失败');

window.__YUNNAN_WALL_GITHUB_CORS_PATCH__ = {
  version: '1.2.0',
  policy: 'normalize-token-and-strip-browser-preflight-version-header',
  selfTestPassed,
  normalizeToken: normalizeGithubToken,
  normalizeInput: normalizeTokenInput
};

import('./wall-lab-v28-evidence.js?v=2.8.0').catch((error) => {
  console.error('35 图证据融合模块加载失败', error);
});
