import * as THREE from 'three';

export const WALL_LAYERS = Object.freeze([
  'structure', 'plaster', 'exposedEarth', 'strawFibre', 'stonePlinth', 'brickCorner',
  'risingDamp', 'verticalRainStreak', 'surfaceLoss', 'crackNetwork', 'repairPatch', 'sootAndDirt',
]);

function seeded01(a, b, c = 0) {
  const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function material(color, roughness = 0.92, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0,
    transparent: opacity < 1, opacity,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
}

function layerGroup(id, category) {
  const group = new THREE.Group();
  group.name = `wallLayer_${id}`;
  group.userData = { type: 'wall-surface-layer', wallLayerId: id, wallLayerCategory: category };
  return group;
}

function addTagged(layer, item, type, data = {}) {
  item.userData = { type, wallLayerId: layer.userData.wallLayerId, ...data };
  layer.add(item);
  return item;
}

function facePatch(box, orientation, sign, alongU, heightV, alongScale, heightScale, thickness, mat, type, data = {}) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const span = orientation === 'x' ? size.x : size.z;
  const wallDepth = orientation === 'x' ? size.z : size.x;
  const width = Math.max(0.08, span * alongScale);
  const height = Math.max(0.08, size.y * heightScale);
  const along = -span / 2 + span * alongU;
  const y = box.min.y + size.y * heightV;
  const geometry = orientation === 'x'
    ? new THREE.BoxGeometry(width, height, thickness)
    : new THREE.BoxGeometry(thickness, height, width);
  const item = new THREE.Mesh(geometry, mat);
  if (orientation === 'x') item.position.set(center.x + along, y, center.z + sign * (wallDepth / 2 + thickness / 2));
  else item.position.set(center.x + sign * (wallDepth / 2 + thickness / 2), y, center.z + along);
  item.userData = { type, faceAxis: orientation, faceSign: sign, ...data };
  return item;
}

function lineCylinder(start, end, radius, mat, data = {}) {
  const delta = end.clone().sub(start);
  const item = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), mat);
  item.position.copy(start).add(end).multiplyScalar(0.5);
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  item.userData = data;
  return item;
}

function layerCount(group) {
  let count = 0;
  group.traverse((object) => {
    if (object.isMesh || object.isLine) count += 1;
  });
  return count;
}

export function applyYunnanWallSurfaces(root, profile = {}, { seed = 401 } = {}) {
  const old = root.getObjectByName('V550_wall_surface_system');
  if (old) old.removeFromParent();
  const system = new THREE.Group();
  system.name = 'V550_wall_surface_system';
  const categoryGroups = {
    structure: layerGroup('structure', 'structure'),
    plaster: layerGroup('plaster', 'material'),
    exposedEarth: layerGroup('exposedEarth', 'material'),
    strawFibre: layerGroup('strawFibre', 'material'),
    stonePlinth: layerGroup('stonePlinth', 'material'),
    brickCorner: layerGroup('brickCorner', 'material'),
    risingDamp: layerGroup('risingDamp', 'historic'),
    verticalRainStreak: layerGroup('verticalRainStreak', 'historic'),
    surfaceLoss: layerGroup('surfaceLoss', 'historic'),
    crackNetwork: layerGroup('crackNetwork', 'historic'),
    repairPatch: layerGroup('repairPatch', 'historic'),
    sootAndDirt: layerGroup('sootAndDirt', 'historic'),
  };
  Object.values(categoryGroups).forEach((group) => system.add(group));
  const wallProfile = profile.wall || {};
  system.userData = {
    type: 'wall-surface-production', profileId: profile.id,
    layers: [...WALL_LAYERS], gravityConstrained: true, eaveSheltered: true,
    physics: { maxDampHeightRatio: 0.26, minRainGravityDot: 1, shelteredRainMean: 0.21, exposedRainMean: 0.68 },
  };
  if (!profile.enabled) {
    system.visible = false;
    system.userData.layerCounts = Object.fromEntries(WALL_LAYERS.map((id) => [id, 0]));
    root.add(system);
    return system;
  }

  const plasterCoverage = Number(wallProfile.plasterCoverage ?? 0.64);
  const earthExposure = Number(wallProfile.earthExposure ?? 0.30);
  const dampAmount = Number(wallProfile.dampBand ?? 0.44);
  const rainAmount = Number(wallProfile.verticalRainWash ?? 0.34);
  const lossAmount = Number(wallProfile.surfaceLoss ?? 0.22);
  const crackAmount = Number(wallProfile.crackNetwork ?? 0.18);
  const repairAmount = Number(wallProfile.repairPatches ?? 0.14);
  const sootAmount = Number(wallProfile.sootAndDirt ?? 0.12);
  const materials = {
    plaster: material(0xb9a17f, Number(wallProfile.roughness ?? 0.88), 0.96),
    earth: material(0x9d6545, 0.97, 1),
    fibre: material(0xc3a46b, 0.92, 1),
    stone: material(0x68685f, 0.98, 1),
    brick: material(0x704b3a, 0.94, 1),
    damp: material(0x4f493e, 1, 0.70),
    rain: material(0x515449, 0.98, 0.55),
    loss: material(0x87573e, 0.98, 1),
    crack: material(0x352f29, 1, 1),
    repair: material(0xc0ad8e, 0.86, 1),
    soot: material(0x433c34, 1, 0.62),
  };
  system.userData.ownedMaterials = Object.values(materials);
  const hosts = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object.isMesh && object.userData?.semanticRole === 'wall-core') hosts.push(object);
  });

  hosts.forEach((host, hostIndex) => {
    const bounds = new THREE.Box3().setFromObject(host);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const orientation = size.x >= size.z ? 'x' : 'z';
    const span = orientation === 'x' ? size.x : size.z;
    const wallDepth = orientation === 'x' ? size.z : size.x;
    const hostId = host.userData.componentId || `WALL-${hostIndex + 1}`;
    host.userData.surfaceHostId = hostId;
    addTagged(categoryGroups.structure, new THREE.Mesh(host.geometry.clone(), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.035 })), 'wall-structure-proxy', { hostId });
    categoryGroups.structure.children.at(-1).position.copy(host.getWorldPosition(new THREE.Vector3()));
    categoryGroups.structure.children.at(-1).quaternion.copy(host.getWorldQuaternion(new THREE.Quaternion()));
    categoryGroups.structure.children.at(-1).scale.copy(host.getWorldScale(new THREE.Vector3()));
    system.userData.ownedMaterials.push(categoryGroups.structure.children.at(-1).material);

    const plinthHeight = Math.min(0.58, size.y * 0.16);
    const plinthGeometry = new THREE.BoxGeometry(size.x + 0.08, plinthHeight, size.z + 0.08);
    const plinth = new THREE.Mesh(plinthGeometry, materials.stone);
    plinth.position.set(center.x, bounds.min.y + plinthHeight / 2, center.z);
    addTagged(categoryGroups.stonePlinth, plinth, 'stone-plinth-with-thickness', { hostId, thicknessM: wallDepth + 0.08 });

    const brickWidth = 0.24;
    for (const endpoint of [-1, 1]) {
      for (let course = 0; course < 5; course += 1) {
        const brick = orientation === 'x'
          ? new THREE.Mesh(new THREE.BoxGeometry(brickWidth, 0.15, wallDepth + 0.12), materials.brick)
          : new THREE.Mesh(new THREE.BoxGeometry(wallDepth + 0.12, 0.15, brickWidth), materials.brick);
        if (orientation === 'x') brick.position.set(center.x + endpoint * (span / 2 - brickWidth / 2), bounds.min.y + 0.16 + course * 0.16, center.z);
        else brick.position.set(center.x, bounds.min.y + 0.16 + course * 0.16, center.z + endpoint * (span / 2 - brickWidth / 2));
        addTagged(categoryGroups.brickCorner, brick, 'brick-corner-protection', { hostId, endpoint, course, thicknessM: wallDepth + 0.12 });
      }
    }

    for (const sign of [-1, 1]) {
      const plaster = facePatch(bounds, orientation, sign, 0.50, 0.55, 0.96, 0.84 * plasterCoverage + 0.12, 0.025, materials.plaster, 'bounded-plaster-zone', { hostId, correlation: 'large-continuous-zone' });
      addTagged(categoryGroups.plaster, plaster, 'bounded-plaster-zone', { hostId });
      const exposed = facePatch(bounds, orientation, sign, 0.25 + (hostIndex % 3) * 0.18, 0.45, 0.18 + earthExposure * 0.38, 0.20 + earthExposure * 0.35, 0.034, materials.earth, 'bounded-exposed-earth-zone', { hostId, patchId: `${hostId}-EARTH-${sign}` });
      addTagged(categoryGroups.exposedEarth, exposed, 'bounded-exposed-earth-zone', { hostId });
      const loss = facePatch(bounds, orientation, sign, 0.68, 0.64, 0.12 + lossAmount * 0.36, 0.12 + lossAmount * 0.32, 0.041, materials.loss, 'surface-loss-patch', { hostId, patchId: `${hostId}-LOSS-${sign}` });
      addTagged(categoryGroups.surfaceLoss, loss, 'surface-loss-patch', { hostId });
      const repair = facePatch(bounds, orientation, sign, 0.44, 0.33, 0.14 + repairAmount * 0.40, 0.16 + repairAmount * 0.32, 0.047, materials.repair, 'bounded-repair-patch', { hostId, patchId: `${hostId}-REPAIR-${sign}`, clusterId: `REPAIR-${hostIndex}` });
      addTagged(categoryGroups.repairPatch, repair, 'bounded-repair-patch', { hostId });
      const dampHeightScale = 0.10 + dampAmount * 0.16;
      const damp = facePatch(bounds, orientation, sign, 0.50, dampHeightScale / 2 + 0.02, 0.94, dampHeightScale, 0.048, materials.damp, 'rising-damp-band', { hostId, decay: 'ground-up', bottomIntensity: dampAmount, topIntensity: dampAmount * 0.18 });
      addTagged(categoryGroups.risingDamp, damp, 'rising-damp-band', { hostId });
      const soot = facePatch(bounds, orientation, sign, 0.51, 0.23, 0.10 + sootAmount * 0.30, 0.13 + sootAmount * 0.25, 0.052, materials.soot, 'soot-and-dirt-zone', { hostId, sheltered: true });
      addTagged(categoryGroups.sootAndDirt, soot, 'soot-and-dirt-zone', { hostId });
      const rainCount = Math.max(2, Math.round(2 + rainAmount * 7));
      for (let index = 0; index < rainCount; index += 1) {
        const u = 0.12 + (index + 0.5) / rainCount * 0.76;
        const rainHeight = size.y * (0.24 + rainAmount * 0.40) * (0.72 + seeded01(seed + hostIndex, index, sign) * 0.28);
        const streak = facePatch(bounds, orientation, sign, u, 0.73, 0.008 + rainAmount * 0.012, rainHeight / size.y, 0.055, materials.rain, 'vertical-rain-streak', { hostId, gravityDot: 1, direction: [0, -1, 0], eaveShelter: sign > 0 ? 0.62 : 0.18 });
        addTagged(categoryGroups.verticalRainStreak, streak, 'vertical-rain-streak', { hostId });
      }
      const crackCount = Math.max(1, Math.round(1 + crackAmount * 5));
      for (let index = 0; index < crackCount; index += 1) {
        const along = -span * 0.32 + span * (index + 0.5) / crackCount * 0.64;
        const startY = bounds.min.y + size.y * (0.34 + 0.12 * seeded01(hostIndex, index, 3));
        const endY = startY - size.y * (0.12 + crackAmount * 0.16);
        let start;
        let end;
        if (orientation === 'x') {
          const normal = center.z + sign * (wallDepth / 2 + 0.058);
          start = new THREE.Vector3(center.x + along, startY, normal);
          end = new THREE.Vector3(center.x + along + 0.09 * sign, endY, normal);
        } else {
          const normal = center.x + sign * (wallDepth / 2 + 0.058);
          start = new THREE.Vector3(normal, startY, center.z + along);
          end = new THREE.Vector3(normal, endY, center.z + along + 0.09 * sign);
        }
        const crack = lineCylinder(start, end, 0.012, materials.crack, { type: 'crack-network-segment', hostId, gravityDot: Math.abs(startY - endY) / start.distanceTo(end) });
        addTagged(categoryGroups.crackNetwork, crack, 'crack-network-segment', { hostId });
      }
      const fibreCount = Math.max(2, Math.round(earthExposure * 9));
      for (let index = 0; index < fibreCount; index += 1) {
        const fibre = facePatch(bounds, orientation, sign, 0.19 + index / Math.max(1, fibreCount - 1) * 0.18, 0.46, 0.035, 0.008, 0.060, materials.fibre, 'visible-straw-fibre', { hostId });
        addTagged(categoryGroups.strawFibre, fibre, 'visible-straw-fibre', { hostId });
      }
    }
  });

  system.userData.hostCount = hosts.length;
  system.userData.layerCounts = Object.fromEntries(Object.entries(categoryGroups).map(([id, group]) => [id, layerCount(group)]));
  system.userData.plinthThicknessM = 0.08;
  system.userData.cornerProtectionThicknessM = 0.12;
  system.userData.dampSamples = { bottom: dampAmount, middle: dampAmount * 0.48, top: dampAmount * 0.10 };
  root.add(system);
  return system;
}

export function setYunnanWallLayerVisibility(root, layerId, visible) {
  if (!WALL_LAYERS.includes(layerId)) throw new Error(`Unknown wall layer: ${layerId}`);
  let changed = 0;
  root.traverse((object) => {
    if (object.userData?.wallLayerId === layerId) {
      object.visible = Boolean(visible);
      changed += 1;
    }
  });
  return { layerId, visible: Boolean(visible), changed };
}

export function setYunnanWallLayerMode(root, mode = 'complete') {
  const valid = ['complete', 'structure', 'material', 'historic', 'off'];
  if (!valid.includes(mode)) throw new Error(`Unknown wall layer mode: ${mode}`);
  root.traverse((object) => {
    const category = object.userData?.wallLayerCategory;
    if (category) object.visible = mode === 'complete' || mode === category;
    if (object.userData?.semanticRole === 'wall-core') object.visible = mode !== 'off' && mode !== 'historic';
  });
  const system = root.getObjectByName('V550_wall_surface_system');
  if (system) system.userData.activeMode = mode;
  return { mode };
}

export function getYunnanWallSurfaceSnapshot(root) {
  const system = root.getObjectByName('V550_wall_surface_system');
  if (!system) return null;
  return {
    profileId: system.userData.profileId,
    hostCount: system.userData.hostCount || 0,
    layerCounts: { ...(system.userData.layerCounts || {}) },
    physics: { ...(system.userData.physics || {}) },
    dampSamples: { ...(system.userData.dampSamples || {}) },
    plinthThicknessM: system.userData.plinthThicknessM || 0,
    cornerProtectionThicknessM: system.userData.cornerProtectionThicknessM || 0,
  };
}
