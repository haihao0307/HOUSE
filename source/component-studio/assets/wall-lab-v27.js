import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VERSION = '2.7.0';
const PARAMS_KEY = 'yunnan-wall-v27:params';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (value) => value - Math.floor(value);
const hash = (x, y, z = 0, seed = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453123);

class Perlin3 {
  constructor(seed = 1) {
    const random = mulberry32(seed);
    const permutation = Array.from({ length: 256 }, (_, index) => index);
    for (let index = 255; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [permutation[index], permutation[swap]] = [permutation[swap], permutation[index]];
    }
    this.permutation = new Uint16Array(512);
    for (let index = 0; index < 512; index += 1) this.permutation[index] = permutation[index & 255];
  }

  fade(value) {
    return value * value * value * (value * (value * 6 - 15) + 10);
  }

  gradient(code, x, y, z) {
    const value = code & 15;
    const u = value < 8 ? x : y;
    const v = value < 4 ? y : value === 12 || value === 14 ? x : z;
    return ((value & 1) ? -u : u) + ((value & 2) ? -v : v);
  }

  noise(x, y, z = 0) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);
    const p = this.permutation;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;
    return lerp(
      lerp(
        lerp(this.gradient(p[AA], x, y, z), this.gradient(p[BA], x - 1, y, z), u),
        lerp(this.gradient(p[AB], x, y - 1, z), this.gradient(p[BB], x - 1, y - 1, z), u),
        v
      ),
      lerp(
        lerp(this.gradient(p[AA + 1], x, y, z - 1), this.gradient(p[BA + 1], x - 1, y, z - 1), u),
        lerp(this.gradient(p[AB + 1], x, y - 1, z - 1), this.gradient(p[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  }
}

class Simplex2 {
  constructor(seed = 1) {
    const random = mulberry32(seed);
    const permutation = Array.from({ length: 256 }, (_, index) => index);
    for (let index = 255; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [permutation[index], permutation[swap]] = [permutation[swap], permutation[index]];
    }
    this.permutation = new Uint8Array(512);
    for (let index = 0; index < 512; index += 1) this.permutation[index] = permutation[index & 255];
    this.gradients = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  }

  noise(xInput, yInput) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const skew = (xInput + yInput) * F2;
    const i = Math.floor(xInput + skew);
    const j = Math.floor(yInput + skew);
    const unskew = (i + j) * G2;
    const x0 = xInput - (i - unskew);
    const y0 = yInput - (j - unskew);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const g0 = this.permutation[ii + this.permutation[jj]] % 8;
    const g1 = this.permutation[ii + i1 + this.permutation[jj + j1]] % 8;
    const g2 = this.permutation[ii + 1 + this.permutation[jj + 1]] % 8;
    const contribution = (x, y, gradient) => {
      let t = 0.5 - x * x - y * y;
      if (t < 0) return 0;
      t *= t;
      const vector = this.gradients[gradient];
      return t * t * (vector[0] * x + vector[1] * y);
    };
    return 70 * (contribution(x0, y0, g0) + contribution(x1, y1, g1) + contribution(x2, y2, g2));
  }
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = value + 0x6D2B79F5 | 0;
    let output = Math.imul(value ^ value >>> 15, 1 | value);
    output = output + Math.imul(output ^ output >>> 7, 61 | output) ^ output;
    return ((output ^ output >>> 14) >>> 0) / 4294967296;
  };
}

function worley2(x, y, seed) {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  let distance = 9;
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const xIndex = cellX + offsetX;
      const yIndex = cellY + offsetY;
      const pointX = xIndex + hash(xIndex, yIndex, 0, seed);
      const pointY = yIndex + hash(xIndex, yIndex, 1, seed);
      distance = Math.min(distance, Math.hypot(x - pointX, y - pointY));
    }
  }
  return clamp(distance / 1.414, 0, 1);
}

function fbmPerlin(noise, x, y, z, octaves = 5) {
  let sum = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let normalizer = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += noise.noise(x * frequency, y * frequency, z * frequency) * amplitude;
    normalizer += amplitude;
    frequency *= 2.03;
    amplitude *= 0.49;
  }
  return sum / normalizer;
}

function ridgedSimplex(simplex, x, y, octaves = 4) {
  let sum = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let normalizer = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += (1 - Math.abs(simplex.noise(x * frequency, y * frequency))) * amplitude;
    normalizer += amplitude;
    frequency *= 2.1;
    amplitude *= 0.48;
  }
  return sum / normalizer;
}

const defaults = {
  seed: 517,
  waveStrength: 0.26,
  waveScale: 0.22,
  domainWarp: 0.60,
  flow: 0.70,
  erosionCluster: 0.62,
  brickLength: 0.43,
  brickHeight: 0.195,
  edgeWear: 0.68,
  edgeBreak: 0.54,
  pitting: 0.62,
  brickIrregularity: 0.52,
  mortar: 0.018,
  missingBrickRate: 0.018,
  plaster: 0.34,
  plasterLoss: 0.74,
  plasterPatchCount: 5,
  roughness: 0.90,
  damp: 0.64,
  rain: 0.74,
  holeDensity: 0.36,
  holeScale: 0.075,
  strawDensity: 0.52,
  strawLength: 0.12,
  stoneHeight: 1.22,
  stoneProjection: 0.12,
  stoneIrregularity: 0.60,
  stoneWidth: 0.50,
  stoneCourseHeight: 0.27,
  lintelEmbed: 0.40,
  lintelHeight: 0.22
};

const presets = {
  wulong: { ...defaults },
  balanced: {
    ...defaults,
    waveStrength: 0.15,
    domainWarp: 0.34,
    erosionCluster: 0.38,
    edgeWear: 0.42,
    edgeBreak: 0.30,
    pitting: 0.34,
    missingBrickRate: 0.006,
    plaster: 0.58,
    plasterLoss: 0.43,
    plasterPatchCount: 4,
    damp: 0.38,
    rain: 0.42,
    holeDensity: 0.14,
    strawDensity: 0.28,
    stoneIrregularity: 0.38
  },
  plastered: {
    ...defaults,
    waveStrength: 0.10,
    domainWarp: 0.24,
    erosionCluster: 0.24,
    edgeWear: 0.26,
    edgeBreak: 0.18,
    pitting: 0.18,
    missingBrickRate: 0,
    plaster: 0.82,
    plasterLoss: 0.18,
    plasterPatchCount: 7,
    damp: 0.26,
    rain: 0.32,
    holeDensity: 0.05,
    strawDensity: 0.12,
    stoneIrregularity: 0.28
  }
};

const controlDefs = {
  groupWave: [
    { key: 'waveStrength', label: '整墙起伏', min: 0, max: 0.58, step: 0.01 },
    { key: 'waveScale', label: '噪波尺度', min: 0.08, max: 0.55, step: 0.01 },
    { key: 'domainWarp', label: '域扭曲', min: 0, max: 1, step: 0.01 },
    { key: 'flow', label: '纵向侵蚀流', min: 0, max: 1, step: 0.01 },
    { key: 'erosionCluster', label: '成片侵蚀', min: 0, max: 1, step: 0.01 }
  ],
  groupBrick: [
    { key: 'brickLength', label: '土坯长度 m', min: 0.28, max: 0.66, step: 0.01 },
    { key: 'brickHeight', label: '土坯高度 m', min: 0.13, max: 0.30, step: 0.005 },
    { key: 'edgeWear', label: '砖边磨损', min: 0, max: 1, step: 0.01 },
    { key: 'edgeBreak', label: '缺角残边', min: 0, max: 1, step: 0.01 },
    { key: 'pitting', label: '坑蚀强度', min: 0, max: 1, step: 0.01 },
    { key: 'brickIrregularity', label: '砖块随机度', min: 0, max: 1, step: 0.01 },
    { key: 'mortar', label: '灰缝宽度', min: 0.008, max: 0.035, step: 0.001 },
    { key: 'missingBrickRate', label: '局部掉块率', min: 0, max: 0.12, step: 0.002 }
  ],
  groupSurface: [
    { key: 'plaster', label: '抹灰覆盖', min: 0, max: 1, step: 0.01 },
    { key: 'plasterLoss', label: '抹灰脱落', min: 0, max: 1, step: 0.01 },
    { key: 'plasterPatchCount', label: '抹灰片区数', min: 0, max: 10, step: 1, integer: true },
    { key: 'roughness', label: '微观粗糙', min: 0, max: 1, step: 0.01 },
    { key: 'damp', label: '墙脚返潮', min: 0, max: 1, step: 0.01 },
    { key: 'rain', label: '雨痕强度', min: 0, max: 1, step: 0.01 },
    { key: 'holeDensity', label: '小孔洞密度', min: 0, max: 1, step: 0.01 },
    { key: 'holeScale', label: '孔洞尺度 m', min: 0.025, max: 0.16, step: 0.005 },
    { key: 'strawDensity', label: '稻草显露', min: 0, max: 1, step: 0.01 },
    { key: 'strawLength', label: '纤维长度 m', min: 0.035, max: 0.24, step: 0.005 }
  ],
  groupStructure: [
    { key: 'stoneHeight', label: '石基高度 m', min: 0.45, max: 1.65, step: 0.01 },
    { key: 'stoneProjection', label: '石基外凸 m', min: 0.02, max: 0.20, step: 0.01 },
    { key: 'stoneIrregularity', label: '石块随机度', min: 0, max: 1, step: 0.01 },
    { key: 'stoneWidth', label: '石块平均宽 m', min: 0.28, max: 0.82, step: 0.01 },
    { key: 'stoneCourseHeight', label: '石砌层高 m', min: 0.18, max: 0.42, step: 0.01 },
    { key: 'lintelEmbed', label: '过梁嵌入 m', min: 0.18, max: 0.58, step: 0.01 },
    { key: 'lintelHeight', label: '过梁高度 m', min: 0.14, max: 0.36, step: 0.01 }
  ]
};

const definitionMap = new Map(Object.values(controlDefs).flat().map((definition) => [definition.key, definition]));

function loadParameters() {
  try {
    const stored = JSON.parse(localStorage.getItem(PARAMS_KEY) || '{}');
    return normalizeParameters({ ...presets.wulong, ...stored });
  } catch {
    return { ...presets.wulong };
  }
}

function normalizeParameters(source) {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(source || {})) {
    if (key === 'seed') {
      result.seed = Math.max(1, Math.round(Number(value) || defaults.seed));
      continue;
    }
    const definition = definitionMap.get(key);
    if (!definition) continue;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) continue;
    result[key] = definition.integer
      ? Math.round(clamp(numeric, definition.min, definition.max))
      : clamp(numeric, definition.min, definition.max);
  }
  return result;
}

let params = loadParameters();
let rebuildTimer = 0;

function saveParameters() {
  localStorage.setItem(PARAMS_KEY, JSON.stringify(params));
}

function formatControlValue(definition, value) {
  if (definition.integer) return String(Math.round(value));
  if (definition.step < 0.01) return Number(value).toFixed(3);
  return Number(value).toFixed(2);
}

function renderControls() {
  for (const [groupId, definitions] of Object.entries(controlDefs)) {
    const host = document.getElementById(groupId);
    if (!host) continue;
    const controls = definitions.map((definition) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'control';
      wrapper.dataset.parameter = definition.key;
      const label = document.createElement('label');
      const labelText = document.createElement('span');
      labelText.textContent = definition.label;
      const output = document.createElement('output');
      output.textContent = formatControlValue(definition, params[definition.key]);
      label.append(labelText, output);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = definition.min;
      input.max = definition.max;
      input.step = definition.step;
      input.value = params[definition.key];
      input.dataset.param = definition.key;
      input.addEventListener('input', () => {
        const next = definition.integer ? Math.round(Number(input.value)) : Number(input.value);
        params[definition.key] = next;
        output.textContent = formatControlValue(definition, next);
        saveParameters();
        scheduleRebuild();
      });
      wrapper.append(label, input);
      return wrapper;
    });
    host.replaceChildren(...controls);
  }
}

const canvas = document.getElementById('wallCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcbd7d2);
scene.fog = new THREE.Fog(0xcbd7d2, 18, 34);

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
camera.position.set(8.6, 4.6, 9.4);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 2.3, 0);
orbit.enableDamping = true;
orbit.minDistance = 3.5;
orbit.maxDistance = 22;

scene.add(new THREE.HemisphereLight(0xf5fbff, 0x796d58, 2.6));
const sun = new THREE.DirectionalLight(0xffefd0, 4.25);
sun.position.set(-6, 10, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -10;
sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10;
sun.shadow.camera.bottom = -10;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xb8d8ee, 1.4);
fill.position.set(7, 4, -4);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0xaaa794, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const wallRoot = new THREE.Group();
scene.add(wallRoot);

function disposeMaterial(material) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    if (item.map) item.map.dispose();
    if (item.bumpMap) item.bumpMap.dispose();
    item.dispose();
  }
}

function clearRoot() {
  wallRoot.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) disposeMaterial(object.material);
  });
  wallRoot.clear();
}

function noiseStack() {
  return {
    perlin: new Perlin3(params.seed),
    simplex: new Simplex2(params.seed + 77)
  };
}

function warpField(x, y, noise) {
  const scale = params.waveScale;
  const qx = noise.simplex.noise(x * scale * 1.4 + 5.2, y * scale * 1.4 - 3.1);
  const qy = noise.simplex.noise(x * scale * 1.4 - 8.7, y * scale * 1.4 + 4.4);
  const warpedX = x + qx * params.domainWarp * 1.25;
  const warpedY = y + qy * params.domainWarp * 1.25;
  const low = fbmPerlin(noise.perlin, warpedX * scale, warpedY * scale, 0.17, 5);
  const ridge = ridgedSimplex(noise.simplex, warpedX * scale * 0.85 + 2.4, warpedY * scale * 0.85 - 1.2, 4) - 0.5;
  const basin = noise.simplex.noise(warpedX * 0.16 + 4.7, warpedY * 0.13 - 1.8) * params.erosionCluster * 0.12;
  const rain = noise.simplex.noise(warpedX * 0.34 + 11, warpedY * 0.08 - 6) * params.flow * 0.08;
  return params.waveStrength * (low * 0.78 + ridge * 0.36) + basin + rain;
}

function makeTexture(type, noise, offset = 0) {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  const heightCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = heightCanvas.width = heightCanvas.height = size;
  const colorContext = colorCanvas.getContext('2d');
  const heightContext = heightCanvas.getContext('2d');
  const colorData = colorContext.createImageData(size, size);
  const heightData = heightContext.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const qx = noise.simplex.noise(u * 2.2 + offset, v * 2.2 + 9);
      const qy = noise.simplex.noise(u * 2.2 - 5, v * 2.2 + offset);
      const warpedU = u + qx * params.domainWarp * 0.17;
      const warpedV = v + qy * params.domainWarp * 0.17;
      const macro = fbmPerlin(noise.perlin, warpedU * 3, warpedV * 3, offset * 0.01, 5) * 0.5 + 0.5;
      const medium = noise.simplex.noise(warpedU * 10 + offset, warpedV * 9) * 0.5 + 0.5;
      const cell = 1 - worley2(warpedU * 12, warpedV * 12, params.seed + offset);
      const fine = hash(x, y, offset, params.seed);
      const dampness = params.damp * Math.pow(1 - v, 2.2) * (0.55 + 0.45 * macro);
      const rainChannel = Math.pow(clamp(noise.simplex.noise(u * 18 + offset * 0.1, v * 0.45) * 0.5 + 0.5, 0, 1), 4) * params.rain;
      let base;
      let height;

      if (type === 'adobe') {
        base = [148, 98, 63];
        const erosion = params.pitting * (cell * 0.55 + (1 - medium) * 0.45);
        base[0] += (macro - 0.5) * 38 - erosion * 25 - dampness * 42 - rainChannel * 25;
        base[1] += (macro - 0.5) * 28 - erosion * 18 - dampness * 33 - rainChannel * 20;
        base[2] += (macro - 0.5) * 19 - erosion * 10 - dampness * 20 - rainChannel * 12;
        height = 0.54 + (macro - 0.5) * 0.24 + (medium - 0.5) * 0.15 - cell * params.pitting * 0.16 + (fine - 0.5) * 0.05 * params.roughness;
      } else if (type === 'stone') {
        base = [121, 116, 101];
        base[0] += (macro - 0.5) * 38 - dampness * 22;
        base[1] += (macro - 0.5) * 34 - dampness * 20;
        base[2] += (macro - 0.5) * 29 - dampness * 14;
        height = 0.5 + (macro - 0.5) * 0.34 + (cell - 0.5) * 0.18 + (fine - 0.5) * 0.04;
      } else if (type === 'plaster') {
        base = [184, 164, 130];
        base[0] += (macro - 0.5) * 25 - dampness * 30 - rainChannel * 18;
        base[1] += (macro - 0.5) * 23 - dampness * 25 - rainChannel * 15;
        base[2] += (macro - 0.5) * 20 - dampness * 17 - rainChannel * 10;
        height = 0.56 + (macro - 0.5) * 0.17 + (medium - 0.5) * 0.09;
      } else {
        base = [92, 61, 39];
        base[0] += (macro - 0.5) * 28;
        base[1] += (macro - 0.5) * 18;
        base[2] += (macro - 0.5) * 12;
        height = 0.5 + (medium - 0.5) * 0.14;
      }

      const index = (y * size + x) * 4;
      colorData.data[index] = clamp(base[0], 10, 245);
      colorData.data[index + 1] = clamp(base[1], 10, 240);
      colorData.data[index + 2] = clamp(base[2], 8, 230);
      colorData.data[index + 3] = 255;
      const gray = clamp(height * 255, 0, 255);
      heightData.data[index] = heightData.data[index + 1] = heightData.data[index + 2] = gray;
      heightData.data[index + 3] = 255;
    }
  }

  colorContext.putImageData(colorData, 0, 0);
  heightContext.putImageData(heightData, 0, 0);
  const map = new THREE.CanvasTexture(colorCanvas);
  const bump = new THREE.CanvasTexture(heightCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  map.anisotropy = bump.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  return { map, bump };
}

function createMaterial(type, noise, offset = 0, color = 0xffffff) {
  const texture = makeTexture(type, noise, offset);
  return new THREE.MeshStandardMaterial({
    map: texture.map,
    bumpMap: texture.bump,
    bumpScale: type === 'adobe' ? 0.062 : type === 'stone' ? 0.046 : 0.03,
    roughness: type === 'timber' ? 0.82 : 0.97,
    color
  });
}

function irregularShape(width, height, seed, wear, pitting, breakStrength, noise) {
  const points = [];
  const addPoint = (x, y, edge) => {
    const noiseValue = noise.simplex.noise(x * 2.6 + seed * 0.013, y * 2.6 - seed * 0.019);
    const cell = 1 - worley2(x * 3.5 + seed * 0.01, y * 3.5, seed);
    const jitter = (noiseValue * 0.055 + cell * pitting * 0.10) * Math.min(width, height);
    let adjustedX = x;
    let adjustedY = y;
    if (edge === 'bottom') adjustedY += jitter;
    if (edge === 'top') adjustedY -= jitter;
    if (edge === 'left') adjustedX += jitter;
    if (edge === 'right') adjustedX -= jitter;
    points.push(new THREE.Vector2(adjustedX, adjustedY));
  };

  const horizontalSegments = 9;
  const verticalSegments = 5;
  for (let index = 0; index <= horizontalSegments; index += 1) addPoint(-width / 2 + index * width / horizontalSegments, -height / 2, 'bottom');
  for (let index = 1; index <= verticalSegments; index += 1) addPoint(width / 2, -height / 2 + index * height / verticalSegments, 'right');
  for (let index = 1; index <= horizontalSegments; index += 1) addPoint(width / 2 - index * width / horizontalSegments, height / 2, 'top');
  for (let index = 1; index < verticalSegments; index += 1) addPoint(-width / 2, height / 2 - index * height / verticalSegments, 'left');

  const biteCount = Math.max(1, Math.round(breakStrength * 4));
  for (let bite = 0; bite < biteCount; bite += 1) {
    const index = Math.floor(hash(seed, bite, 2, params.seed) * points.length);
    const next = (index + 1) % points.length;
    const depth = Math.min(width, height) * breakStrength * (0.05 + hash(seed, bite, 5, params.seed) * 0.12);
    for (const pointIndex of [index, next]) {
      const point = points[pointIndex];
      const length = Math.max(0.0001, point.length());
      point.multiplyScalar(Math.max(0.55, (length - depth) / length));
    }
  }

  if (wear > 0.25) {
    const corner = Math.floor(hash(seed, 1, 2, params.seed) * points.length);
    points[corner].multiplyScalar(1 - wear * 0.12);
    points[(corner + 1) % points.length].multiplyScalar(1 - wear * 0.08);
  }

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) shape.lineTo(points[index].x, points[index].y);
  shape.closePath();
  return shape;
}

function extrudedBlock(width, height, depth, seed, wear, pitting, breakStrength, noise) {
  const shape = irregularShape(width, height, seed, wear, pitting, breakStrength, noise);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: Math.min(width, height) * (0.04 + 0.075 * wear),
    bevelThickness: Math.min(0.04, depth * 0.12)
  });
  geometry.translate(0, 0, -depth / 2);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const local = noise.perlin.noise(x * 4.2 + seed * 0.01, y * 4.6 - seed * 0.02, z * 5.1) * params.roughness * 0.016;
    positions.setZ(index, z + local);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function irregularPatch(width, height, depth, seed, noise) {
  const count = 40;
  const shape = new THREE.Shape();
  for (let index = 0; index < count; index += 1) {
    const angle = index / count * Math.PI * 2;
    const wave = noise.simplex.noise(Math.cos(angle) * 1.8 + seed * 0.01, Math.sin(angle) * 1.8 - seed * 0.01);
    const bite = 1 - worley2(Math.cos(angle) * 2 + seed * 0.01, Math.sin(angle) * 2, seed);
    const radius = 0.84 + wave * 0.14 - bite * params.plasterLoss * 0.12;
    const x = Math.cos(angle) * width * 0.5 * radius;
    const y = Math.sin(angle) * height * 0.5 * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.028,
    bevelThickness: 0.012
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function addMesh(geometry, material, parent, x, y, z, rotationX = 0, rotationY = 0, rotationZ = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotationX, rotationY, rotationZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCavity(parent, x, y, z, radius, seed, materials) {
  const random = mulberry32(seed);
  const cavity = new THREE.Mesh(materials.holeGeometry, materials.holeMaterial);
  cavity.scale.set(radius, radius * (0.82 + random() * 0.28), radius);
  cavity.position.set(x, y, z + 0.002);
  cavity.rotation.z = (random() - 0.5) * 0.6;
  parent.add(cavity);
  const rim = new THREE.Mesh(materials.rimGeometry, materials.rimMaterial);
  rim.scale.set(radius * 1.14, radius * (0.92 + random() * 0.32), radius * 0.22);
  rim.position.set(x, y, z + 0.007);
  rim.rotation.z = cavity.rotation.z;
  parent.add(rim);
}

function buildWall() {
  clearRoot();
  const noise = noiseStack();
  const wallWidth = 8;
  const wallHeight = 4.8;
  const wallDepth = 0.58;
  const doorWidth = 1.35;
  const doorHeight = 2.55;
  const lintelHeight = params.lintelHeight;
  const lintelTop = doorHeight + lintelHeight;
  const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x795744, roughness: 1 });
  const adobeMaterials = [createMaterial('adobe', noise, 11), createMaterial('adobe', noise, 29), createMaterial('adobe', noise, 47)];
  const stoneMaterials = [createMaterial('stone', noise, 63), createMaterial('stone', noise, 81)];
  const plasterMaterial = createMaterial('plaster', noise, 97);
  const timberMaterial = createMaterial('timber', noise, 113, 0x6f452a);
  const holeGeometry = new THREE.CylinderGeometry(0.72, 1, 0.032, 14, 1, false);
  holeGeometry.rotateX(Math.PI / 2);
  const rimGeometry = new THREE.TorusGeometry(1, 0.16, 6, 16);
  const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x3f2a1d, roughness: 1 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x9b6741, roughness: 1 });
  const cavityMaterials = { holeGeometry, rimGeometry, holeMaterial, rimMaterial };
  const strawPositions = [];

  const coreZ = -wallDepth * 0.14;
  addMesh(new THREE.BoxGeometry((wallWidth - doorWidth) / 2, wallHeight, wallDepth * 0.72), coreMaterial, wallRoot, -(wallWidth + doorWidth) / 4, wallHeight / 2, coreZ);
  addMesh(new THREE.BoxGeometry((wallWidth - doorWidth) / 2, wallHeight, wallDepth * 0.72), coreMaterial, wallRoot, (wallWidth + doorWidth) / 4, wallHeight / 2, coreZ);
  addMesh(new THREE.BoxGeometry(doorWidth, wallHeight - lintelTop, wallDepth * 0.72), coreMaterial, wallRoot, 0, lintelTop + (wallHeight - lintelTop) / 2, coreZ);

  let stoneCount = 0;
  let brickCount = 0;
  let patchCount = 0;
  let holeCount = 0;
  let strawCount = 0;
  let missingBrickCount = 0;
  const random = mulberry32(params.seed + 201);

  let courseY = 0.16;
  while (courseY < params.stoneHeight - 0.04) {
    let x = -wallWidth / 2 + 0.03;
    const courseHeight = clamp(params.stoneCourseHeight + (random() - 0.5) * 0.11, 0.15, 0.45);
    while (x < wallWidth / 2 - 0.03) {
      const width = clamp(params.stoneWidth + (random() - 0.5) * 0.30, 0.24, 0.92);
      const end = Math.min(x + width, wallWidth / 2 - 0.03);
      const centerX = (x + end) / 2;
      if (!(Math.abs(centerX) < doorWidth * 0.53 && courseY < doorHeight)) {
        const wave = warpField(centerX, courseY, noise);
        const depth = wallDepth + params.stoneProjection + (random() - 0.5) * 0.06;
        const geometry = extrudedBlock(end - x - 0.025, courseHeight - 0.022, depth, params.seed + stoneCount * 31, params.stoneIrregularity, 0.45, params.stoneIrregularity * 0.45, noise);
        addMesh(geometry, stoneMaterials[stoneCount % stoneMaterials.length], wallRoot, centerX, courseY, wave + (random() - 0.5) * 0.018, (random() - 0.5) * 0.035, (random() - 0.5) * 0.04, (random() - 0.5) * 0.025);
        stoneCount += 1;
      }
      x = end + 0.015;
    }
    courseY += courseHeight + 0.02;
  }

  const brickHeight = params.brickHeight;
  const brickLength = params.brickLength;
  const mortar = params.mortar;
  let row = 0;
  for (let centerY = params.stoneHeight + brickHeight / 2 + mortar; centerY < wallHeight - brickHeight / 2; centerY += brickHeight + mortar, row += 1) {
    const offset = row % 2 ? (brickLength + mortar) / 2 : 0;
    for (let x = -wallWidth / 2 - brickLength + offset; x < wallWidth / 2; x += brickLength + mortar) {
      const start = Math.max(x, -wallWidth / 2 + 0.025);
      const end = Math.min(x + brickLength, wallWidth / 2 - 0.025);
      if (end - start < 0.14) continue;
      const centerX = (start + end) / 2;
      const belowLintel = centerY < brickHeight / 2 + lintelTop;
      if (belowLintel && Math.abs(centerX) < doorWidth / 2 + 0.04) continue;
      const brickRandom = mulberry32(params.seed + row * 997 + Math.round(centerX * 101));
      if (brickRandom() < params.missingBrickRate) {
        missingBrickCount += 1;
        continue;
      }
      const width = (end - start - mortar * 0.8) * (1 + (brickRandom() - 0.5) * params.brickIrregularity * 0.11);
      const height = brickHeight - mortar * 0.75 + (brickRandom() - 0.5) * params.brickIrregularity * 0.032;
      const depth = wallDepth * (0.96 + (brickRandom() - 0.5) * 0.05);
      const wear = clamp(params.edgeWear * (0.64 + brickRandom() * 0.62), 0, 1);
      const pitting = clamp(params.pitting * (0.55 + brickRandom() * 0.76), 0, 1);
      const breakStrength = clamp(params.edgeBreak * (0.48 + brickRandom() * 0.75), 0, 1);
      const geometry = extrudedBlock(width, height, depth, params.seed + brickCount * 43, wear, pitting, breakStrength, noise);
      const wave = warpField(centerX, centerY, noise);
      const frontZ = wave + depth / 2;
      addMesh(
        geometry,
        adobeMaterials[Math.floor(brickRandom() * adobeMaterials.length)],
        wallRoot,
        centerX + (brickRandom() - 0.5) * mortar * 0.7,
        centerY + (brickRandom() - 0.5) * mortar * 0.5,
        wave + (brickRandom() - 0.5) * 0.018,
        (brickRandom() - 0.5) * 0.018,
        (brickRandom() - 0.5) * 0.022,
        (brickRandom() - 0.5) * 0.018
      );

      if (brickRandom() < params.holeDensity * 0.085) {
        const radius = params.holeScale * (0.55 + brickRandom() * 0.85);
        addCavity(
          wallRoot,
          centerX + (brickRandom() - 0.5) * width * 0.44,
          centerY + (brickRandom() - 0.5) * height * 0.42,
          frontZ + 0.006,
          radius,
          params.seed + brickCount * 97,
          cavityMaterials
        );
        holeCount += 1;
      }

      const fiberGroups = Math.floor(params.strawDensity * 3.2 * brickRandom());
      for (let fiber = 0; fiber < fiberGroups; fiber += 1) {
        const length = params.strawLength * (0.55 + brickRandom() * 0.85);
        const angle = (brickRandom() - 0.5) * Math.PI * 0.9;
        const startX = centerX + (brickRandom() - 0.5) * width * 0.7;
        const startY = centerY + (brickRandom() - 0.5) * height * 0.65;
        const startZ = frontZ + 0.014 + brickRandom() * 0.008;
        strawPositions.push(
          startX,
          startY,
          startZ,
          startX + Math.cos(angle) * length,
          startY + Math.sin(angle) * length,
          startZ + (brickRandom() - 0.5) * 0.012
        );
        strawCount += 1;
      }
      brickCount += 1;
    }
  }

  const frameDepth = 0.24;
  const postWidth = 0.17;
  for (const side of [-1, 1]) {
    const geometry = extrudedBlock(postWidth, doorHeight, frameDepth, params.seed + 5000 + side, 0.18, 0.08, 0.12, noise);
    addMesh(geometry, timberMaterial, wallRoot, side * (doorWidth / 2 - postWidth / 2), doorHeight / 2, wallDepth / 2 + 0.055);
  }
  const lintelWidth = doorWidth + params.lintelEmbed * 2;
  addMesh(extrudedBlock(lintelWidth, lintelHeight, frameDepth * 1.15, params.seed + 5100, 0.23, 0.10, 0.18, noise), timberMaterial, wallRoot, 0, doorHeight + lintelHeight / 2, wallDepth / 2 + 0.065);
  addMesh(extrudedBlock(doorWidth - 0.08, 0.13, frameDepth * 1.15, params.seed + 5200, 0.20, 0.08, 0.12, noise), timberMaterial, wallRoot, 0, 0.065, wallDepth / 2 + 0.07);

  const coverage = clamp(params.plaster * (1 - params.plasterLoss * 0.18), 0.03, 0.94);
  const patchRandom = mulberry32(params.seed + 8801);
  const candidateCenters = [
    [-2.55, 2.72], [2.48, 3.08], [0.18, 4.08], [-3.25, 3.92], [3.18, 2.25],
    [-1.15, 3.55], [1.15, 1.95], [-3.45, 1.88], [3.48, 4.02], [0.05, 3.15]
  ];
  const requestedPatches = Math.round(params.plasterPatchCount);
  for (let index = 0; index < requestedPatches; index += 1) {
    const base = candidateCenters[index % candidateCenters.length];
    const centerX = base[0] + (patchRandom() - 0.5) * 0.42;
    const centerY = base[1] + (patchRandom() - 0.5) * 0.28;
    const width = (0.62 + patchRandom() * 1.95) * (0.45 + coverage * 0.95);
    const height = (0.45 + patchRandom() * 1.70) * (0.45 + coverage * 0.90);
    if (width < 0.35 || height < 0.28) continue;
    const geometry = irregularPatch(width, height, 0.035, params.seed + 6100 + index * 101, noise);
    addMesh(geometry, plasterMaterial, wallRoot, centerX, centerY, wallDepth / 2 + 0.055 + warpField(centerX, centerY, noise));
    patchCount += 1;
  }

  if (strawPositions.length) {
    const strawGeometry = new THREE.BufferGeometry();
    strawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(strawPositions, 3));
    const strawMaterial = new THREE.LineBasicMaterial({ color: 0xd1aa67, transparent: true, opacity: 0.92 });
    const strawLines = new THREE.LineSegments(strawGeometry, strawMaterial);
    strawLines.renderOrder = 4;
    wallRoot.add(strawLines);
  }

  document.getElementById('brickMetric').textContent = brickCount;
  document.getElementById('stoneMetric').textContent = stoneCount;
  document.getElementById('patchMetric').textContent = patchCount;
  const geometryStatus = document.getElementById('geometryStatus');
  if (geometryStatus) geometryStatus.textContent = `${brickCount} 块土坯 · ${stoneCount} 块石料 · ${holeCount} 孔洞 · ${strawCount} 根纤维`;
  const runtimeLabel = document.getElementById('runtimeLabel');
  if (runtimeLabel) runtimeLabel.textContent = `V${VERSION} 知识整流运行中`;

  runtime.geometry = {
    brickCount,
    stoneCount,
    patchCount,
    holeCount,
    strawCount,
    missingBrickCount,
    openSurfaceCount: 0
  };
  runtime.parameters = { ...params };
  window.dispatchEvent(new CustomEvent('yunnan-wall-runtime-updated', { detail: runtime.snapshot() }));
}

function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(buildWall, 110);
}

function applyParameters(patch, options = {}) {
  params = normalizeParameters({ ...params, ...(patch || {}) });
  saveParameters();
  renderControls();
  if (options.immediate === false) scheduleRebuild();
  else buildWall();
  return { ...params };
}

const runtime = {
  version: VERSION,
  noise: ['Perlin', 'Simplex', 'Worley'],
  geometry: {},
  parameters: { ...params },
  controlDefs,
  presets,
  applyParameters,
  setParameter(key, value) {
    return applyParameters({ [key]: value });
  },
  rebuild: buildWall,
  snapshot() {
    return {
      version: VERSION,
      noise: [...this.noise],
      geometry: { ...this.geometry },
      params: { ...params }
    };
  }
};
window.__YUNNAN_WALL_V27__ = runtime;
window.__YUNNAN_WALL_V24__ = runtime;

renderControls();
buildWall();

function resize() {
  const host = canvas.parentElement;
  const width = Math.max(1, host?.clientWidth || canvas.clientWidth || 1);
  const height = Math.max(1, host?.clientHeight || canvas.clientHeight || 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
const resizeObserver = new ResizeObserver(() => requestAnimationFrame(resize));
resizeObserver.observe(canvas.parentElement || canvas);
resize();

(function tick() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
})();

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    params = normalizeParameters({ ...presets[button.dataset.preset], seed: params.seed });
    saveParameters();
    document.querySelectorAll('[data-preset]').forEach((item) => item.classList.toggle('active', item === button));
    renderControls();
    buildWall();
  });
});

document.getElementById('randomize')?.addEventListener('click', () => {
  params.seed = Math.floor(1 + Math.random() * 9999);
  saveParameters();
  buildWall();
});

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    if (view === 'front') camera.position.set(0, 2.6, 11.5);
    if (view === 'oblique') camera.position.set(8.6, 4.6, 9.4);
    if (view === 'close') camera.position.set(3.2, 2.6, 5.2);
    if (view === 'reset') camera.position.set(8.6, 4.6, 9.4);
    orbit.target.set(0, 2.3, 0);
    orbit.update();
  });
});

const referenceImage = document.getElementById('referenceImage');
const referencePlaceholder = document.getElementById('referencePlaceholder');
function showReferenceBlob(blob, label = '墙面资料仓参考图') {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  referenceImage.onload = () => {
    referenceImage.hidden = false;
    referencePlaceholder.style.display = 'none';
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  referenceImage.src = url;
  referenceImage.alt = label;
}

async function loadLegacyReference() {
  try {
    const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__;
    if (!storage) throw new Error('资料库迁移程序未载入');
    const database = await storage.openAttachments();
    const records = await new Promise((resolve, reject) => {
      const transaction = database.transaction('attachments', 'readonly');
      const store = transaction.objectStore('attachments');
      const request = store.indexNames.contains('moduleId')
        ? store.index('moduleId').getAll(IDBKeyRange.only('walls'))
        : store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    const images = records
      .filter((record) => String(record.type || '').startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(record.name || ''))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    if (images[0]?.blob) showReferenceBlob(images[0].blob, images[0].name);
  } catch (error) {
    console.warn('墙面资料仓参考图读取失败', error);
  }
}

loadLegacyReference();
document.getElementById('referenceFile')?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) showReferenceBlob(file, file.name);
});
document.getElementById('fitReference')?.addEventListener('click', () => { referenceImage.style.objectFit = 'contain'; });
document.getElementById('fillReference')?.addEventListener('click', () => { referenceImage.style.objectFit = 'cover'; });

window.addEventListener('error', (event) => {
  const box = document.getElementById('errorBox');
  if (!box) return;
  box.textContent = `程序墙启动失败：${event.message || event.error || '未知错误'}`;
  box.classList.add('show');
});
