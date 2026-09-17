(() => {
'use strict';
const params = new URLSearchParams(location.search);
const eco = params.get('eco') !== '0' && params.get('quality') !== 'full';
const nativeDpr = Number(window.devicePixelRatio || 1);
if (eco) {
  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => Math.min(nativeDpr, 1)
    });
  } catch (_) {}
}

const OriginalRenderer = window.BrickMotherRendererV2?.BrickRenderer;
if (OriginalRenderer) {
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  class DemandBrickRenderer extends OriginalRenderer {
    constructor(canvas) {
      const ownGetContext = canvas.getContext;
      if (eco) {
        canvas.getContext = function(type, attrs) {
          return ownGetContext.call(this, type, { ...(attrs || {}), powerPreference: 'low-power' });
        };
      }
      super(canvas);
      if (eco) canvas.getContext = ownGetContext;
      this._dirtyR310 = true;
      this._rafR310 = 0;
      this._autoRotateR310 = Boolean(this.autoRotate);
      Object.defineProperty(this, 'autoRotate', {
        configurable: true,
        get: () => this._autoRotateR310,
        set: (value) => {
          this._autoRotateR310 = Boolean(value);
          this.requestDrawR310();
        }
      });
      window.__BRICK_ACTIVE_RENDERER_R3_10__ = this;
    }
    requestDrawR310() {
      this._dirtyR310 = true;
      if (!this._rafR310) this._rafR310 = requestAnimationFrame((t) => this.loop(t));
    }
    bind() {
      const c = this.canvas;
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('pointerdown', (e) => {
        this.drag = true;
        this.pan = e.button === 2 || e.shiftKey;
        this.px = e.clientX;
        this.py = e.clientY;
        c.setPointerCapture(e.pointerId);
        this.requestDrawR310();
      });
      c.addEventListener('pointermove', (e) => {
        if (!this.drag) return;
        const dx = e.clientX - this.px, dy = e.clientY - this.py;
        this.px = e.clientX;
        this.py = e.clientY;
        if (this.pan) {
          const scale = this.camera.distance * 0.0018;
          this.camera.target.x -= dx * scale * Math.cos(this.camera.yaw);
          this.camera.target.z += dx * scale * Math.sin(this.camera.yaw);
          this.camera.target.y += dy * scale;
        } else {
          this.camera.yaw += dx * 0.007;
          this.camera.pitch = clampN(this.camera.pitch + dy * 0.006, -1.15, 1.05);
        }
        this.requestDrawR310();
      });
      const stop = () => {
        this.drag = false;
        this.requestDrawR310();
      };
      c.addEventListener('pointerup', stop);
      c.addEventListener('pointercancel', stop);
      c.addEventListener('lostpointercapture', stop);
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.camera.distance = clampN(this.camera.distance * Math.exp(e.deltaY * 0.001), 3.1, 27);
        this.requestDrawR310();
      }, { passive: false });
    }
    loop(t) {
      this._rafR310 = 0;
      if (this.staticEvidence) {
        return OriginalRenderer.prototype.loop.call(this, t);
      }
      const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0);
      this.lastTime = t;
      if (this._autoRotateR310 && !this.drag) {
        this.camera.yaw += dt * 0.16;
        this._dirtyR310 = true;
      }
      if (this._dirtyR310 || this.drag || this._autoRotateR310) {
        OriginalRenderer.prototype.draw.call(this);
        this._dirtyR310 = false;
      }
      if (this.drag || this._autoRotateR310) this.requestDrawR310();
    }
    setMeshes(items) {
      super.setMeshes(items);
      this.requestDrawR310();
    }
    setDebugMode(mode) {
      super.setDebugMode(mode);
      this.requestDrawR310();
    }
    resetView() {
      super.resetView();
      this.requestDrawR310();
    }
    focus(index) {
      super.focus(index);
      this.requestDrawR310();
    }
    resize() {
      const beforeW = this.canvas.width, beforeH = this.canvas.height;
      OriginalRenderer.prototype.resize.call(this);
      if (this.canvas.width !== beforeW || this.canvas.height !== beforeH) this.requestDrawR310();
    }
  }
  window.BrickMotherRendererV2.BrickRenderer = DemandBrickRenderer;
  const requestAfterUI = () => window.__BRICK_ACTIVE_RENDERER_R3_10__?.requestDrawR310?.();
  document.addEventListener('input', requestAfterUI, true);
  document.addEventListener('change', requestAfterUI, true);
  document.addEventListener('click', requestAfterUI, true);
}

const geometry = window.BrickMotherGeometryV2;
if (!geometry || typeof geometry.buildMesh !== 'function') return;
const originalBuildMesh = geometry.buildMesh.bind(geometry);
const cache = new Map();
const MAX_ENTRIES = 6;
let hits = 0;
let misses = 0;

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
  }
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 1000000) / 1000000
    : value;
}
function cacheKey(profile, seedDNA, controls, level, quality) {
  return JSON.stringify({
    profile: profile?.id || profile?.family || 'unknown',
    seedDNA: stableObject(seedDNA || {}),
    controls: stableObject(controls || {}),
    level: Number(level || 0),
    quality: Number(quality || 0)
  });
}
function touch(key, value) {
  cache.delete(key);
  cache.set(key, value);
}
function publish() {
  const api = window.__BRICK_MESH_CACHE_R3_10__;
  if (!api) return;
  api.hits = hits;
  api.misses = misses;
  api.entries = cache.size;
  document.documentElement.dataset.meshCacheHits = String(hits);
  document.documentElement.dataset.meshCacheMisses = String(misses);
  document.documentElement.dataset.meshCacheEntries = String(cache.size);
  document.documentElement.dataset.brickEco = eco ? 'true' : 'false';
}
geometry.buildMesh = function cachedBuildMesh(profile, seedDNA, controls, level, quality) {
  const requestedQuality = Number.isFinite(Number(quality)) ? Number(quality) : 1;
  const effectiveQuality = eco ? Math.min(requestedQuality, 0.52) : requestedQuality;
  const key = cacheKey(profile, seedDNA, controls, level, effectiveQuality);
  if (cache.has(key)) {
    const mesh = cache.get(key);
    touch(key, mesh);
    hits++;
    publish();
    return mesh;
  }
  const mesh = originalBuildMesh(profile, seedDNA, controls, level, effectiveQuality);
  misses++;
  touch(key, mesh);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  publish();
  return mesh;
};
window.__BRICK_MESH_CACHE_R3_10__ = {
  eco,
  nativeDpr,
  effectiveDpr: eco ? Math.min(nativeDpr, 1) : nativeDpr,
  hits,
  misses,
  entries: 0,
  clear() {
    cache.clear();
    hits = 0;
    misses = 0;
    publish();
  },
  snapshot() {
    return { eco, nativeDpr, hits, misses, entries: cache.size };
  }
};
publish();
})();