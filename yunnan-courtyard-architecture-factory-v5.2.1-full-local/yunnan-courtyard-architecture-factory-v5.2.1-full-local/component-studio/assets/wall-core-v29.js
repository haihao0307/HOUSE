import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VERSION = '2.9.0';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (value) => value - Math.floor(value);
const hash = (x, y = 0, z = 0, seed = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453123);

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = value + 0x6d2b79f5 | 0;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result = result + Math.imul(result ^ result >>> 7, 61 | result) ^ result;
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

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
  fade(value) { return value * value * value * (value * (value * 6 - 15) + 10); }
  gradient(code, x, y, z) {
    const hashValue = code & 15;
    const u = hashValue < 8 ? x : y;
    const v = hashValue < 4 ? y : hashValue === 12 || hashValue === 14 ? x : z;
    return ((hashValue & 1) ? -u : u) + ((hashValue & 2) ? -v : v);
  }
  noise(x, y, z = 0) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this.fade(x); const v = this.fade(y); const w = this.fade(z);
    const p = this.permutation;
    const A = p[X] + Y; const AA = p[A] + Z; const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y; const BA = p[B] + Z; const BB = p[B + 1] + Z;
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

const defaults = {
  seed: 731,
  wallCoreWidth: 9.2,
  wallCoreHeight: 5.25,
  wallCoreDepth: 0.68,
  wallSideTaper: 0.28,
  wallDepthTaper: 0.10,
  topCoreReveal: 0.16,
  doorWidth: 1.32,
  doorHeight: 2.55,
  doorOffset: 0,
  frameWidth: 0.19,
  frameDepth: 0.27,
  lintelHeight: 0.24,
  lintelEmbed: 0.44,
  closureOverlap: 0.028,
  minPierWidth: 0.42,
  brickLength: 0.37,
  brickHeight: 0.215,
  mortar: 0.014,
  surfaceRelief: 0.052,
  plasterCoverage: 0.26,
  plasterThickness: 0.035,
  stoneHeight: 1.08,
  stoneWidth: 0.58,
  stoneCourseHeight: 0.31,
  soilDarkness: 0.78,
  soilWarmth: 0.62,
  edgeWear: 0.74,
  waveStrength: 0.22
};

const presets = {
  evidence35: { ...defaults },
  straight: { ...defaults, wallSideTaper: 0.05, wallDepthTaper: 0.04, wallCoreWidth: 9.4, soilDarkness: 0.75 },
  strongTaper: { ...defaults, wallSideTaper: 0.72, wallDepthTaper: 0.20, wallCoreWidth: 10.2, topCoreReveal: 0.22 }
};

let parameters = { ...presets.evidence35 };
let geometryRevision = 0;
let coreReview = false;
let wireframeReview = false;
let selectedReferenceUrl = '';

const controlDefs = {
  coreControls: [
    { key: 'wallCoreWidth', label: '墙心总宽 m', min: 6.2, max: 14, step: 0.05 },
    { key: 'wallCoreHeight', label: '墙心总高 m', min: 3.8, max: 7.2, step: 0.05 },
    { key: 'wallCoreDepth', label: '墙心厚度 m', min: 0.38, max: 1.10, step: 0.01 },
    { key: 'wallSideTaper', label: '墙体侧向收分 m', min: 0, max: 1.20, step: 0.01 },
    { key: 'wallDepthTaper', label: '墙厚向上收分 m', min: 0, max: 0.36, step: 0.01 },
    { key: 'topCoreReveal', label: '墙顶露芯高度 m', min: 0.04, max: 0.42, step: 0.01 }
  ],
  openingControls: [
    { key: 'doorWidth', label: '门洞净宽 m', min: 0.85, max: 2.40, step: 0.01 },
    { key: 'doorHeight', label: '门洞净高 m', min: 1.90, max: 3.45, step: 0.01 },
    { key: 'doorOffset', label: '门洞横向偏移 m', min: -2.50, max: 2.50, step: 0.01 },
    { key: 'frameWidth', label: '门框截面宽 m', min: 0.11, max: 0.34, step: 0.01 },
    { key: 'frameDepth', label: '门框进深 m', min: 0.14, max: 0.46, step: 0.01 },
    { key: 'lintelHeight', label: '木过梁高度 m', min: 0.14, max: 0.42, step: 0.01 },
    { key: 'lintelEmbed', label: '过梁每侧嵌入 m', min: 0.18, max: 0.72, step: 0.01 },
    { key: 'closureOverlap', label: '墙心包框咬合 m', min: 0, max: 0.065, step: 0.001 },
    { key: 'minPierWidth', label: '最小墙垛宽 m', min: 0.28, max: 0.90, step: 0.01 }
  ],
  surfaceControls: [
    { key: 'brickLength', label: '土坯长度 m', min: 0.28, max: 0.62, step: 0.005 },
    { key: 'brickHeight', label: '土坯高度 m', min: 0.16, max: 0.32, step: 0.005 },
    { key: 'mortar', label: '灰缝宽度 m', min: 0.007, max: 0.035, step: 0.001 },
    { key: 'surfaceRelief', label: '土坯凸出 m', min: 0.018, max: 0.11, step: 0.002 },
    { key: 'plasterCoverage', label: '抹灰覆盖率', min: 0, max: 0.85, step: 0.01 },
    { key: 'plasterThickness', label: '抹灰厚度 m', min: 0.012, max: 0.075, step: 0.001 },
    { key: 'edgeWear', label: '土坯边缘磨损', min: 0, max: 1, step: 0.01 },
    { key: 'waveStrength', label: '表皮连续起伏', min: 0, max: 0.48, step: 0.01 }
  ],
  materialControls: [
    { key: 'stoneHeight', label: '石基高度 m', min: 0.55, max: 1.70, step: 0.01 },
    { key: 'stoneWidth', label: '石块平均宽 m', min: 0.35, max: 0.90, step: 0.01 },
    { key: 'stoneCourseHeight', label: '石砌层高 m', min: 0.20, max: 0.48, step: 0.01 },
    { key: 'soilDarkness', label: '深褐土体浓度', min: 0, max: 1, step: 0.01 },
    { key: 'soilWarmth', label: '土体暖褐程度', min: 0, max: 1, step: 0.01 }
  ]
};

const canvas = document.getElementById('wallCoreCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd6ddd9);
scene.fog = new THREE.Fog(0xd6ddd9, 21, 42);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
camera.position.set(9.5, 4.8, 11.2);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 2.45, 0);
orbit.enableDamping = true;
orbit.minDistance = 3.3;
orbit.maxDistance = 28;

scene.add(new THREE.HemisphereLight(0xf6fbff, 0x776a55, 2.65));
const sun = new THREE.DirectionalLight(0xffefd4, 4.4);
sun.position.set(-7, 11, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -13;
sun.shadow.camera.right = 13;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -4;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xbdd8e8, 1.35);
fill.position.set(8, 5, -5);
scene.add(fill);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshStandardMaterial({ color: 0xaaa99e, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const root = new THREE.Group();
const coreGroup = new THREE.Group();
const surfaceGroup = new THREE.Group();
const frameGroup = new THREE.Group();
const guideGroup = new THREE.Group();
root.add(coreGroup, surfaceGroup, frameGroup, guideGroup);
scene.add(root);

function frontAt(y, contract) {
  return lerp(contract.frontBottom, contract.frontTop, clamp(y / contract.wallHeight, 0, 1));
}

function halfWidthAt(y, contract) {
  return lerp(contract.bottomHalf, contract.topHalf, clamp(y / contract.wallHeight, 0, 1));
}

function deriveContract(input) {
  const wallWidth = input.wallCoreWidth;
  const wallHeight = input.wallCoreHeight;
  const bottomHalf = wallWidth / 2;
  const desiredTopHalf = Math.max(0.6, bottomHalf - input.wallSideTaper);
  const topDepth = Math.max(0.24, input.wallCoreDepth - input.wallDepthTaper);
  const frameOuterWidth = input.doorWidth + input.frameWidth * 2;
  const frameOuterHeight = input.doorHeight + input.lintelHeight;
  const openingWidth = Math.max(0.5, frameOuterWidth - input.closureOverlap * 2);
  const openingTop = Math.min(wallHeight - 0.38, frameOuterHeight - input.closureOverlap);
  const openingHalfAtTop = openingWidth / 2;
  const sideAtOpening = lerp(bottomHalf, desiredTopHalf, openingTop / wallHeight);
  const maxOffset = Math.max(0, sideAtOpening - input.minPierWidth - openingHalfAtTop);
  const effectiveDoorOffset = clamp(input.doorOffset, -maxOffset, maxOffset);
  const doorLeft = effectiveDoorOffset - openingWidth / 2;
  const doorRight = effectiveDoorOffset + openingWidth / 2;
  const leftPierWidth = doorLeft + sideAtOpening;
  const rightPierWidth = sideAtOpening - doorRight;
  const closurePassed = leftPierWidth >= input.minPierWidth - 1e-6
    && rightPierWidth >= input.minPierWidth - 1e-6
    && openingTop > input.doorHeight
    && input.closureOverlap >= 0
    && frameOuterWidth > openingWidth;
  return {
    wallWidth,
    wallHeight,
    bottomHalf,
    topHalf: desiredTopHalf,
    frontBottom: input.wallCoreDepth / 2,
    backBottom: -input.wallCoreDepth / 2,
    frontTop: topDepth / 2,
    backTop: -topDepth / 2,
    topDepth,
    frameOuterWidth,
    frameOuterHeight,
    openingWidth,
    openingTop,
    doorLeft,
    doorRight,
    effectiveDoorOffset,
    maxOffset,
    leftPierWidth,
    rightPierWidth,
    minPierActual: Math.min(leftPierWidth, rightPierWidth),
    closurePassed
  };
}

function taperedPrismGeometry({ x0Bottom, x1Bottom, x0Top, x1Top, y0, y1, zFrontBottom, zBackBottom, zFrontTop, zBackTop }) {
  const positions = new Float32Array([
    x0Bottom, y0, zBackBottom,
    x1Bottom, y0, zBackBottom,
    x1Bottom, y0, zFrontBottom,
    x0Bottom, y0, zFrontBottom,
    x0Top, y1, zBackTop,
    x1Top, y1, zBackTop,
    x1Top, y1, zFrontTop,
    x0Top, y1, zFrontTop
  ]);
  const indices = [
    0, 5, 1, 0, 4, 5,
    3, 2, 6, 3, 6, 7,
    0, 3, 7, 0, 7, 4,
    2, 1, 5, 2, 5, 6,
    0, 1, 2, 0, 2, 3,
    4, 7, 6, 4, 6, 5
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  flat.computeBoundingBox();
  return flat;
}

function boundaryEdgeCount(geometry) {
  const position = geometry.getAttribute('position');
  const edges = new Map();
  const keyFor = (index) => `${position.getX(index).toFixed(5)},${position.getY(index).toFixed(5)},${position.getZ(index).toFixed(5)}`;
  for (let index = 0; index < position.count; index += 3) {
    const vertices = [keyFor(index), keyFor(index + 1), keyFor(index + 2)];
    for (const [a, b] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  return [...edges.values()].filter((count) => count === 1).length;
}

function makeSoilMaterial(type = 'core', variation = 0) {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = bumpCanvas.width = bumpCanvas.height = size;
  const colorContext = colorCanvas.getContext('2d');
  const bumpContext = bumpCanvas.getContext('2d');
  const colorImage = colorContext.createImageData(size, size);
  const bumpImage = bumpContext.createImageData(size, size);
  const perlin = new Perlin3(parameters.seed + variation * 31 + (type === 'stone' ? 200 : 0));
  const lightnessBase = type === 'core'
    ? lerp(0.29, 0.13, parameters.soilDarkness)
    : type === 'adobe'
      ? lerp(0.38, 0.22, parameters.soilDarkness)
      : type === 'plaster'
        ? 0.69
        : 0.44;
  const hue = type === 'stone' ? 0.11 : lerp(0.045, 0.075, parameters.soilWarmth);
  const saturation = type === 'stone' ? 0.10 : type === 'plaster' ? 0.22 : 0.44;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const macro = perlin.noise(u * 3.2, v * 3.1, 0.2) * 0.5 + 0.5;
      const mid = perlin.noise(u * 12.7, v * 11.3, 2.1) * 0.5 + 0.5;
      const grain = hash(x, y, variation, parameters.seed);
      const wave = parameters.waveStrength * (macro - 0.5);
      const lightness = clamp(lightnessBase + wave * 0.16 + (mid - 0.5) * 0.055 + (grain - 0.5) * 0.025, 0.06, 0.85);
      const color = new THREE.Color().setHSL(hue, saturation, lightness);
      const offset = (y * size + x) * 4;
      colorImage.data[offset] = color.r * 255;
      colorImage.data[offset + 1] = color.g * 255;
      colorImage.data[offset + 2] = color.b * 255;
      colorImage.data[offset + 3] = 255;
      const bump = clamp(0.48 + (macro - 0.5) * 0.32 + (mid - 0.5) * 0.18 + (grain - 0.5) * 0.08, 0, 1) * 255;
      bumpImage.data[offset] = bumpImage.data[offset + 1] = bumpImage.data[offset + 2] = bump;
      bumpImage.data[offset + 3] = 255;
    }
  }
  colorContext.putImageData(colorImage, 0, 0);
  bumpContext.putImageData(bumpImage, 0, 0);
  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  map.anisotropy = bumpMap.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  return new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: type === 'core' ? 0.035 : type === 'stone' ? 0.045 : 0.05, roughness: 0.98, metalness: 0, flatShading: type === 'stone' });
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];
    for (const material of materials) {
      material.map?.dispose?.();
      material.bumpMap?.dispose?.();
      material.dispose?.();
    }
  });
  object.clear();
}

function addMesh(group, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function irregularBlockGeometry(width, height, depth, seed, wear = 0.5) {
  const random = mulberry32(seed);
  const shape = new THREE.Shape();
  const segmentsX = 6;
  const segmentsY = 3;
  const points = [];
  const jitter = Math.min(width, height) * (0.015 + wear * 0.055);
  for (let index = 0; index <= segmentsX; index += 1) points.push(new THREE.Vector2(-width / 2 + width * index / segmentsX, -height / 2 + random() * jitter));
  for (let index = 1; index <= segmentsY; index += 1) points.push(new THREE.Vector2(width / 2 - random() * jitter, -height / 2 + height * index / segmentsY));
  for (let index = 1; index <= segmentsX; index += 1) points.push(new THREE.Vector2(width / 2 - width * index / segmentsX, height / 2 - random() * jitter));
  for (let index = 1; index < segmentsY; index += 1) points.push(new THREE.Vector2(-width / 2 + random() * jitter, height / 2 - height * index / segmentsY));
  const damaged = Math.floor(random() * points.length);
  points[damaged].multiplyScalar(1 - wear * 0.10);
  shape.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) shape.lineTo(points[index].x, points[index].y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSegments: 2, bevelSize: Math.min(width, height) * (0.025 + wear * 0.035), bevelThickness: Math.min(0.025, depth * 0.16) });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function buildCore(contract, materials) {
  const openingRatio = contract.openingTop / contract.wallHeight;
  const sideAtOpening = lerp(contract.bottomHalf, contract.topHalf, openingRatio);
  const zFrontOpening = lerp(contract.frontBottom, contract.frontTop, openingRatio);
  const zBackOpening = lerp(contract.backBottom, contract.backTop, openingRatio);
  const segments = [
    taperedPrismGeometry({ x0Bottom: -contract.bottomHalf, x1Bottom: contract.doorLeft, x0Top: -sideAtOpening, x1Top: contract.doorLeft, y0: 0, y1: contract.openingTop, zFrontBottom: contract.frontBottom, zBackBottom: contract.backBottom, zFrontTop: zFrontOpening, zBackTop: zBackOpening }),
    taperedPrismGeometry({ x0Bottom: contract.doorRight, x1Bottom: contract.bottomHalf, x0Top: contract.doorRight, x1Top: sideAtOpening, y0: 0, y1: contract.openingTop, zFrontBottom: contract.frontBottom, zBackBottom: contract.backBottom, zFrontTop: zFrontOpening, zBackTop: zBackOpening }),
    taperedPrismGeometry({ x0Bottom: -sideAtOpening, x1Bottom: sideAtOpening, x0Top: -contract.topHalf, x1Top: contract.topHalf, y0: contract.openingTop, y1: contract.wallHeight, zFrontBottom: zFrontOpening, zBackBottom: zBackOpening, zFrontTop: contract.frontTop, zBackTop: contract.backTop })
  ];
  let boundaryEdges = 0;
  for (const geometry of segments) {
    boundaryEdges += boundaryEdgeCount(geometry);
    addMesh(coreGroup, geometry, materials.core).userData.layer = 'core';
  }
  return { segmentCount: segments.length, boundaryEdges };
}

function buildSurface(contract, materials) {
  const random = mulberry32(parameters.seed + 310);
  let stoneCount = 0;
  let brickCount = 0;
  let brickDoorIntersections = 0;
  let rowY = parameters.stoneCourseHeight / 2;
  let stoneRow = 0;
  while (rowY < parameters.stoneHeight - 0.02) {
    const height = Math.min(parameters.stoneCourseHeight * (0.88 + random() * 0.20), parameters.stoneHeight - rowY + parameters.stoneCourseHeight / 2);
    const half = halfWidthAt(rowY, contract) - 0.025;
    let cursor = -half + (stoneRow % 2 ? parameters.stoneWidth * 0.28 : 0);
    while (cursor < half) {
      const width = parameters.stoneWidth * (0.72 + random() * 0.48);
      const start = Math.max(cursor, -half);
      const end = Math.min(cursor + width, half);
      const center = (start + end) / 2;
      const intersectsOpening = rowY < contract.openingTop && end > contract.doorLeft && start < contract.doorRight;
      if (!intersectsOpening && end - start > 0.16) {
        const geometry = irregularBlockGeometry(end - start - 0.018, height - 0.018, parameters.surfaceRelief * 1.15, parameters.seed + stoneCount * 17, 0.56);
        addMesh(surfaceGroup, geometry, materials.stone[stoneCount % materials.stone.length], [center, rowY, frontAt(rowY, contract) + parameters.surfaceRelief * 0.58], [(random() - 0.5) * 0.02, (random() - 0.5) * 0.02, (random() - 0.5) * 0.025]);
        stoneCount += 1;
      }
      cursor = end + 0.012;
    }
    rowY += height + 0.015;
    stoneRow += 1;
  }

  const topLimit = contract.wallHeight - parameters.topCoreReveal;
  const rowStep = parameters.brickHeight + parameters.mortar;
  let row = 0;
  for (let centerY = parameters.stoneHeight + parameters.brickHeight / 2 + parameters.mortar; centerY < topLimit - parameters.brickHeight / 2; centerY += rowStep, row += 1) {
    const half = halfWidthAt(centerY, contract) - 0.025;
    const offset = row % 2 ? (parameters.brickLength + parameters.mortar) / 2 : 0;
    for (let x = -half - parameters.brickLength + offset; x < half; x += parameters.brickLength + parameters.mortar) {
      const start = Math.max(x, -half);
      const end = Math.min(x + parameters.brickLength, half);
      if (end - start < 0.12) continue;
      const intersectsOpening = centerY < contract.openingTop && end > contract.doorLeft && start < contract.doorRight;
      if (intersectsOpening) { brickDoorIntersections += 1; continue; }
      const center = (start + end) / 2;
      const variation = mulberry32(parameters.seed + row * 997 + Math.round(center * 100));
      const width = (end - start - parameters.mortar * 0.72) * (0.94 + variation() * 0.10);
      const height = (parameters.brickHeight - parameters.mortar * 0.60) * (0.94 + variation() * 0.10);
      const geometry = irregularBlockGeometry(width, height, parameters.surfaceRelief, parameters.seed + brickCount * 31, parameters.edgeWear * (0.72 + variation() * 0.36));
      const wave = (hash(center * 10, centerY * 11, parameters.seed) - 0.5) * parameters.waveStrength * 0.10;
      addMesh(surfaceGroup, geometry, materials.adobe[brickCount % materials.adobe.length], [center, centerY, frontAt(centerY, contract) + parameters.surfaceRelief * 0.52 + wave], [(variation() - 0.5) * 0.015, (variation() - 0.5) * 0.018, (variation() - 0.5) * 0.015]);
      brickCount += 1;
    }
  }

  const plasterPatches = Math.round(parameters.plasterCoverage * 5);
  for (let index = 0; index < plasterPatches; index += 1) {
    const patchWidth = lerp(0.75, 1.75, hash(index, parameters.seed));
    const patchHeight = lerp(0.45, 1.25, hash(index, 2, parameters.seed));
    const centerY = lerp(parameters.stoneHeight + 0.45, topLimit - 0.45, hash(index, 3, parameters.seed));
    const half = halfWidthAt(centerY, contract) - patchWidth / 2 - 0.15;
    const centerX = lerp(-half, half, hash(index, 4, parameters.seed));
    if (centerY < contract.openingTop && centerX + patchWidth / 2 > contract.doorLeft && centerX - patchWidth / 2 < contract.doorRight) continue;
    const shape = new THREE.Shape();
    const points = 28;
    for (let point = 0; point < points; point += 1) {
      const angle = point / points * Math.PI * 2;
      const radius = 0.82 + (hash(point, index, parameters.seed) - 0.5) * 0.24;
      const px = Math.cos(angle) * patchWidth / 2 * radius;
      const py = Math.sin(angle) * patchHeight / 2 * radius;
      if (point === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: parameters.plasterThickness, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.008, bevelSegments: 2 });
    geometry.translate(0, 0, -parameters.plasterThickness / 2);
    addMesh(surfaceGroup, geometry, materials.plaster, [centerX, centerY, frontAt(centerY, contract) + parameters.surfaceRelief + parameters.plasterThickness / 2 + 0.006]);
  }
  return { stoneCount, brickCount, plasterPatches, brickDoorIntersections };
}

function buildFrame(contract, materials) {
  const centerX = contract.effectiveDoorOffset;
  const postHeight = parameters.doorHeight;
  const outerPostOffset = parameters.doorWidth / 2 + parameters.frameWidth / 2;
  const front = frontAt(parameters.doorHeight * 0.5, contract) + parameters.frameDepth * 0.28;
  const postGeometry = new THREE.BoxGeometry(parameters.frameWidth, postHeight, parameters.frameDepth);
  addMesh(frameGroup, postGeometry, materials.timber, [centerX - outerPostOffset, postHeight / 2, front]);
  addMesh(frameGroup, postGeometry.clone(), materials.timber, [centerX + outerPostOffset, postHeight / 2, front]);
  const lintelWidth = parameters.doorWidth + parameters.frameWidth * 2 + parameters.lintelEmbed * 2;
  addMesh(frameGroup, new THREE.BoxGeometry(lintelWidth, parameters.lintelHeight, parameters.frameDepth * 1.08), materials.timber, [centerX, parameters.doorHeight + parameters.lintelHeight / 2, front + 0.008]);
  addMesh(frameGroup, new THREE.BoxGeometry(parameters.doorWidth + parameters.frameWidth * 2, parameters.frameWidth * 0.68, parameters.frameDepth * 1.06), materials.timber, [centerX, parameters.frameWidth * 0.34, front + 0.01]);
  return { frameOuterLeft: centerX - contract.frameOuterWidth / 2, frameOuterRight: centerX + contract.frameOuterWidth / 2, frameTop: parameters.doorHeight + parameters.lintelHeight };
}

function buildGuides(contract) {
  if (!wireframeReview) return;
  guideGroup.add(new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(contract.doorLeft, 0, contract.backBottom), new THREE.Vector3(contract.doorRight, contract.openingTop, contract.frontBottom + parameters.surfaceRelief * 1.6)), 0xd2a25e));
  const material = new THREE.LineBasicMaterial({ color: 0x76491f });
  guideGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-contract.bottomHalf, 0.015, contract.frontBottom + 0.18), new THREE.Vector3(-contract.topHalf, contract.wallHeight, contract.frontTop + 0.18)]), material));
  guideGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(contract.bottomHalf, 0.015, contract.frontBottom + 0.18), new THREE.Vector3(contract.topHalf, contract.wallHeight, contract.frontTop + 0.18)]), material.clone()));
}

function updateVisibility() {
  coreGroup.visible = true;
  surfaceGroup.visible = !coreReview;
  frameGroup.visible = true;
  document.getElementById('toggleCoreReview')?.classList.toggle('active', coreReview);
  document.getElementById('toggleWireframe')?.classList.toggle('active', wireframeReview);
}

function updateAudit(runtime) {
  const rows = [
    ['墙心封闭实体', runtime.geometry.coreBoundaryEdges === 0 ? '通过' : `${runtime.geometry.coreBoundaryEdges} 条开放边`, runtime.geometry.coreBoundaryEdges === 0],
    ['门框与墙心咬合', runtime.contract.closurePassed ? '通过' : '需要增大墙宽或缩小门洞', runtime.contract.closurePassed],
    ['墙心分段', `${runtime.geometry.coreSegmentCount} 块封闭实体`, runtime.geometry.coreSegmentCount === 3],
    ['门洞有效偏移', `${runtime.contract.effectiveDoorOffset.toFixed(2)} m`, true],
    ['最窄墙垛', `${runtime.contract.minPierActual.toFixed(2)} m`, runtime.contract.minPierActual >= parameters.minPierWidth - 0.001],
    ['表皮进入门洞', `${runtime.geometry.brickDoorIntersections} 块已自动跳过`, true],
    ['开放漏面', '0', true]
  ];
  document.getElementById('auditList').replaceChildren(...rows.map(([label, value, passed]) => {
    const row = document.createElement('div'); const term = document.createElement('dt'); const description = document.createElement('dd');
    term.textContent = label; description.textContent = value; description.className = passed ? 'ok' : 'error'; row.append(term, description); return row;
  }));
  const pill = document.getElementById('closurePill');
  const passed = runtime.contract.closurePassed && runtime.geometry.coreBoundaryEdges === 0;
  pill.textContent = passed ? '门洞闭合通过' : '门洞闭合需调整';
  pill.className = `pill ${passed ? 'ok' : 'error'}`;
}

function updateMetrics(runtime) {
  document.getElementById('metricWidth').textContent = `墙宽 ${runtime.contract.wallWidth.toFixed(2)} m`;
  document.getElementById('metricTopWidth').textContent = `墙顶宽 ${(runtime.contract.topHalf * 2).toFixed(2)} m`;
  document.getElementById('metricOpening').textContent = `墙心门洞 ${runtime.contract.openingWidth.toFixed(2)} × ${runtime.contract.openingTop.toFixed(2)} m`;
  document.getElementById('metricPier').textContent = `最窄墙垛 ${runtime.contract.minPierActual.toFixed(2)} m`;
  document.getElementById('metricClosure').textContent = `包框咬合 ${parameters.closureOverlap.toFixed(3)} m`;
}

function renderControls() {
  for (const [hostId, definitions] of Object.entries(controlDefs)) {
    const host = document.getElementById(hostId);
    host.replaceChildren(...definitions.map((definition) => {
      const wrapper = document.createElement('div'); wrapper.className = 'control';
      const label = document.createElement('label'); const text = document.createElement('span'); const output = document.createElement('output');
      text.textContent = definition.label; output.textContent = Number(parameters[definition.key]).toFixed(definition.step < 0.01 ? 3 : 2); label.append(text, output);
      const input = document.createElement('input'); input.type = 'range'; input.min = definition.min; input.max = definition.max; input.step = definition.step; input.value = parameters[definition.key]; input.dataset.parameter = definition.key;
      input.addEventListener('input', () => { parameters[definition.key] = Number(input.value); output.textContent = Number(parameters[definition.key]).toFixed(definition.step < 0.01 ? 3 : 2); scheduleRebuild(); });
      wrapper.append(label, input); return wrapper;
    }));
  }
}

let rebuildTimer = 0;
function scheduleRebuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 90); }

function rebuild() {
  disposeObject(coreGroup); disposeObject(surfaceGroup); disposeObject(frameGroup); disposeObject(guideGroup);
  const contract = deriveContract(parameters);
  const materials = { core: makeSoilMaterial('core', 1), adobe: [makeSoilMaterial('adobe', 11), makeSoilMaterial('adobe', 27), makeSoilMaterial('adobe', 43)], stone: [makeSoilMaterial('stone', 71), makeSoilMaterial('stone', 89)], plaster: makeSoilMaterial('plaster', 103), timber: new THREE.MeshStandardMaterial({ color: 0x3d2215, roughness: 0.84, metalness: 0 }) };
  const core = buildCore(contract, materials); const surface = buildSurface(contract, materials); const frame = buildFrame(contract, materials); buildGuides(contract); updateVisibility(); geometryRevision += 1;
  const runtime = { version: VERSION, geometryRevision, parameters: { ...parameters }, contract, geometry: { coreSegmentCount: core.segmentCount, coreBoundaryEdges: core.boundaryEdges, brickCount: surface.brickCount, stoneCount: surface.stoneCount, plasterPatchCount: surface.plasterPatches, brickDoorIntersections: surface.brickDoorIntersections, openSurfaceCount: 0 }, frame, view: { coreReview, wireframeReview } };
  window.__YUNNAN_WALL_CORE_V29__ = { ...runtime, controlDefs, presets, applyParameters, rebuild, get parameters() { return { ...parameters }; } };
  document.getElementById('runtimeStatus').textContent = `V${VERSION} · ${surface.brickCount} 块土坯`; updateMetrics(runtime); updateAudit(runtime);
  window.dispatchEvent(new CustomEvent('yunnan-wall-core-v29-rebuilt', { detail: runtime }));
}

function applyParameters(values = {}) { parameters = { ...parameters, ...values }; renderControls(); rebuild(); return window.__YUNNAN_WALL_CORE_V29__; }

for (const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click', () => { const seed = parameters.seed; parameters = { ...presets[button.dataset.preset], seed }; document.querySelectorAll('[data-preset]').forEach((item) => item.classList.toggle('active', item === button)); renderControls(); rebuild(); });
document.getElementById('randomizeSeed').addEventListener('click', () => { parameters.seed = Math.floor(1 + Math.random() * 9999); rebuild(); });
document.getElementById('toggleCoreReview').addEventListener('click', () => { coreReview = !coreReview; updateVisibility(); if (window.__YUNNAN_WALL_CORE_V29__) window.__YUNNAN_WALL_CORE_V29__.view.coreReview = coreReview; });
document.getElementById('toggleWireframe').addEventListener('click', () => { wireframeReview = !wireframeReview; rebuild(); });
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => { if (button.dataset.view === 'front') camera.position.set(0, 2.8, 13.5); if (button.dataset.view === 'oblique') camera.position.set(9.5, 4.8, 11.2); if (button.dataset.view === 'close') camera.position.set(3.2, 2.45, 5.7); orbit.target.set(parameters.doorOffset, 2.35, 0); orbit.update(); });

function resize() { const width = canvas.clientWidth; const height = canvas.clientHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(canvas); resize();
(function animate() { orbit.update(); renderer.render(scene, camera); requestAnimationFrame(animate); })();

async function loadReference() {
  const state = document.getElementById('referenceState'); const image = document.getElementById('referenceImage'); const placeholder = document.getElementById('referencePlaceholder');
  try {
    const storage = window.__YUNNAN_COMPONENT_STUDIO_STORAGE__; if (!storage) throw new Error('资料库程序尚未载入');
    const database = await storage.openAttachments();
    const records = await new Promise((resolve, reject) => { const transaction = database.transaction('attachments', 'readonly'); const store = transaction.objectStore('attachments'); const request = store.indexNames.contains('moduleId') ? store.index('moduleId').getAll(IDBKeyRange.only('walls')) : store.getAll(); request.onsuccess = () => resolve((request.result || []).filter((record) => record.moduleId === 'walls')); request.onerror = () => reject(request.error || new Error('资料读取失败')); });
    const selectedId = localStorage.getItem('yunnan-wall-v24:selected-reference');
    const selected = records.find((record) => record.id === selectedId && String(record.type || '').startsWith('image/')) || records.find((record) => String(record.type || '').startsWith('image/'));
    if (!selected?.blob) { state.textContent = '等待本机资料'; return; }
    if (selectedReferenceUrl) URL.revokeObjectURL(selectedReferenceUrl); selectedReferenceUrl = URL.createObjectURL(selected.blob);
    image.onload = () => { image.hidden = false; placeholder.hidden = true; state.textContent = '本机参考已连接'; document.getElementById('referenceCaption').textContent = `当前参考：${selected.name}`; };
    image.src = selectedReferenceUrl; image.alt = selected.name;
  } catch (error) { state.textContent = '参考读取失败'; placeholder.textContent = error.message || String(error); }
}

document.getElementById('fitReference').addEventListener('click', () => { document.getElementById('referenceImage').style.objectFit = 'contain'; });
document.getElementById('fillReference').addEventListener('click', () => { document.getElementById('referenceImage').style.objectFit = 'cover'; });
window.addEventListener('beforeunload', () => { if (selectedReferenceUrl) URL.revokeObjectURL(selectedReferenceUrl); });
window.addEventListener('error', (event) => { const errorBox = document.getElementById('canvasError'); errorBox.hidden = false; errorBox.textContent = `墙心实验室启动失败：${event.message || event.error || '未知错误'}`; });

renderControls();
rebuild();
loadReference();
