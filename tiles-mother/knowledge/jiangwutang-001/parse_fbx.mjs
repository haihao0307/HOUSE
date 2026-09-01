import fs from 'node:fs';
import path from 'node:path';
import { LoadingManager, Texture } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const fbxPath = process.argv[2];
const outputPath = process.argv[3];
const geometryPath = process.argv[4];
if (!fbxPath || !outputPath) throw new Error('usage: node parse-fbx.mjs <fbx> <output.json>');

const manager = new LoadingManager();
// The FBX scene parser needs texture relationships, but a Node-only parse must not
// invoke browser ImageLoader. External PNGs are analyzed separately by Pillow.
const metadataTextureLoader = {
  path: '',
  setPath(value) { this.path = value; return this; },
  load(fileName) {
    const texture = new Texture();
    texture.userData = { externalFileName: fileName, externalPath: path.resolve(this.path || '', fileName) };
    return texture;
  }
};
manager.addHandler(/\.(png|jpg|jpeg|tga|tif|tiff|bmp)$/i, metadataTextureLoader);

const loader = new FBXLoader(manager);
const sourceDir = path.dirname(fbxPath) + path.sep;
loader.setResourcePath(sourceDir);
const file = fs.readFileSync(fbxPath);
const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
const root = loader.parse(arrayBuffer, sourceDir);

function vec3(v) { return v ? { x: v.x, y: v.y, z: v.z } : null; }
function color(c) { return c ? { r: c.r, g: c.g, b: c.b } : null; }
function materialInfo(m) {
  if (!m) return null;
  const map = m.map;
  return {
    name: m.name || null,
    type: m.type || null,
    color: color(m.color),
    roughness: Number.isFinite(m.roughness) ? m.roughness : null,
    metalness: Number.isFinite(m.metalness) ? m.metalness : null,
    opacity: Number.isFinite(m.opacity) ? m.opacity : null,
    transparent: !!m.transparent,
    hasMap: !!map,
    mapUserData: map?.userData || null,
    normalMap: !!m.normalMap,
    normalMapUserData: m.normalMap?.userData || null,
    bumpMap: !!m.bumpMap,
    bumpMapUserData: m.bumpMap?.userData || null,
    displacementMap: !!m.displacementMap,
    displacementMapUserData: m.displacementMap?.userData || null,
  };
}

function attributeRange(attr) {
  if (!attr) return null;
  const min = Array(attr.itemSize).fill(Infinity);
  const max = Array(attr.itemSize).fill(-Infinity);
  const a = attr.array;
  for (let i = 0; i < a.length; i += attr.itemSize) {
    for (let k = 0; k < attr.itemSize; k++) {
      const v = a[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}

const objects = [];
const geometryData = [];
root.traverse((obj) => {
  if (!obj.isMesh) return;
  const g = obj.geometry;
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  g.computeBoundingBox();
  g.computeBoundingSphere();
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  const groups = (g.groups || []).map((x) => ({ start: x.start, count: x.count, materialIndex: x.materialIndex ?? 0 }));
  objects.push({
    name: obj.name || null,
    type: obj.type,
    parent: obj.parent?.name || null,
    visible: obj.visible,
    vertices: p?.count || 0,
    indexed: !!g.index,
    indexCount: g.index?.count || 0,
    triangles: g.index ? Math.floor(g.index.count / 3) : Math.floor((p?.count || 0) / 3),
    hasNormals: !!n,
    normalComponents: n?.itemSize || 0,
    hasUV: !!uv,
    uvComponents: uv?.itemSize || 0,
    positionRange: attributeRange(p),
    normalRange: attributeRange(n),
    uvRange: attributeRange(uv),
    morphTargets: Object.keys(g.morphAttributes || {}).map((k) => ({ channel: k, count: g.morphAttributes[k].length })),
    bounds: { min: vec3(g.boundingBox?.min), max: vec3(g.boundingBox?.max), radius: g.boundingSphere?.radius || null },
    groups,
    materials: mats.map(materialInfo),
  });
  geometryData.push({
    name: obj.name || null,
    positions: p ? Array.from(p.array) : [],
    normals: n ? Array.from(n.array) : [],
    uvs: uv ? Array.from(uv.array) : [],
    indices: g.index ? Array.from(g.index.array) : null,
  });
});

const out = {
  parser: { name: 'three/examples/jsm/loaders/FBXLoader.js', three: '0.180.0', textureLoad: 'metadata-only' },
  source: { path: fbxPath, bytes: file.byteLength, header: file.subarray(0, 21).toString('ascii') },
  scene: { name: root.name || null, children: root.children.length, objectCount: objects.length },
  objects,
  totals: {
    meshObjects: objects.length,
    vertices: objects.reduce((s, x) => s + x.vertices, 0),
    triangles: objects.reduce((s, x) => s + x.triangles, 0),
    normalBearingMeshes: objects.filter((x) => x.hasNormals).length,
    uvBearingMeshes: objects.filter((x) => x.hasUV).length,
    materialSlots: objects.reduce((s, x) => s + x.materials.length, 0),
    mappedMaterialSlots: objects.reduce((s, x) => s + x.materials.filter((m) => m.hasMap).length, 0),
  }
};
fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
if (geometryPath) fs.writeFileSync(geometryPath, JSON.stringify({ source: out.source, geometryData }, null, 2));
console.log(JSON.stringify(out, null, 2));
