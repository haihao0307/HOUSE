import * as THREE from 'three';
import { createYunnanMaterialSet, disposeYunnanMaterialSet } from './YunnanMaterialFactory.js';
import { applyYunnanWallSurfaces, setYunnanWallLayerMode } from './YunnanWallSurfaceSystem.js';
import { registerYunnanRoofSurfaces, setYunnanRoofExploded } from './YunnanRoofSurfaceSystem.js';

export const YUNNAN_COURTYARD_DEFAULTS = Object.freeze({
  siteWidth: 12.6,
  siteDepth: 15.3,
  wallHeight: 4.7,
  floorHeight: 2.73,
  wallThickness: 0.55,
  wallTaper: 0.12,
  plinthHeight: 0.45,
  courtyardWidth: 5.2,
  courtyardDepth: 5.4,
  galleryWidth: 1.1,
  roofPitch: 0.46,
  roofEave: 0.58,
  roofThickness: 0.10,
  legacyTileProfile: { tileWidth: 0.28, tileLength: 0.64, tileCourse: 0.46, tileThickness: 0.055 },
  tileProfileId: 'YUNNAN-PAN-COVER-V550',
  tileWidth: 0.242,
  tileLength: 0.223,
  tileCourse: 0.18,
  tileThickness: 0.022,
  seed: 401,
});

const BRANCH = 'BRANCH-CENTRAL-YUNNAN-YIKEYIN';
const UP = new THREE.Vector3(0, 1, 0);

function tag(object, data = {}) {
  object.userData = {
    ...(object.userData || {}),
    branch: BRANCH,
    editableSource: 'threejs/YunnanCourtyardProduction.js',
    ...data,
  };
  return object;
}

function mesh(geometry, material, data = {}) {
  return tag(new THREE.Mesh(geometry, material), data);
}

function box(width, height, depth, material, data = {}) {
  return mesh(new THREE.BoxGeometry(width, height, depth), material, data);
}

function cylinder(radius, height, material, data = {}, radialSegments = 14) {
  return mesh(new THREE.CylinderGeometry(radius, radius, height, radialSegments), material, data);
}

function cylinderBetween(start, end, radius, material, data = {}, radialSegments = 12) {
  const delta = end.clone().sub(start);
  const item = cylinder(radius, delta.length(), material, data, radialSegments);
  item.position.copy(start).add(end).multiplyScalar(0.5);
  item.quaternion.setFromUnitVectors(UP, delta.clone().normalize());
  return item;
}

function seeded01(a, b, c = 0) {
  const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function createBatteredWallGeometry(width, depth, height, taper = 0.12) {
  const hw = width / 2;
  const hd = depth / 2;
  const tw = Math.max(0.02, width - taper * 2) / 2;
  const td = Math.max(0.02, depth - taper * 2) / 2;
  const positions = [
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
    -tw, height, -td, tw, height, -td, tw, height, td, -tw, height, td,
  ];
  const indices = [
    0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7, 3, 2, 1, 3, 1, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createGableGeometry(width, depth, height) {
  const hw = width / 2;
  const hd = depth / 2;
  const positions = [
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
    -hw, height, -hd, 0, height * 1.62, -hd, hw, height, -hd,
    -hw, height, hd, 0, height * 1.62, hd, hw, height, hd,
  ];
  const indices = [
    0, 1, 6, 0, 6, 4, 4, 6, 5, 1, 2, 9, 1, 9, 6,
    2, 3, 7, 2, 7, 9, 7, 8, 9, 3, 0, 4, 3, 4, 7,
    4, 5, 8, 4, 8, 7, 5, 6, 9, 5, 9, 8, 3, 2, 1, 3, 1, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Closed ceramic shell. A pan is concave and a cover is convex. */
function createTileGeometry(width, length, kind = 'pan', thickness = 0.022) {
  const segments = 10;
  const row = segments + 1;
  const radius = Math.max(width * (kind === 'cover' ? 0.62 : 0.82), 0.055);
  const positions = [];
  const indices = [];
  const curveY = (x) => {
    const normalized = Math.min(0.985, Math.abs(x) / radius);
    const arc = Math.sqrt(Math.max(0.0001, radius ** 2 - (normalized * radius) ** 2));
    return kind === 'cover' ? arc - radius * 0.25 : radius * 0.25 - arc;
  };
  for (const offset of [0, -thickness]) {
    for (const z of [-length / 2, length / 2]) {
      for (let i = 0; i <= segments; i += 1) {
        const x = (i / segments - 0.5) * width;
        positions.push(x, curveY(x) + offset, z);
      }
    }
  }
  const bottom = row * 2;
  for (let i = 0; i < segments; i += 1) {
    const a = i;
    const b = a + 1;
    const c = row + i;
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
    const ba = bottom + i;
    const bb = ba + 1;
    const bc = bottom + row + i;
    const bd = bc + 1;
    indices.push(ba, bb, bc, bb, bd, bc);
  }
  for (const endRow of [0, row]) {
    for (let i = 0; i < segments; i += 1) {
      const a = endRow + i;
      const b = a + 1;
      const c = bottom + endRow + i;
      const d = c + 1;
      if (endRow === 0) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }
  for (const edge of [0, segments]) {
    const a = edge;
    const b = row + edge;
    const c = bottom + edge;
    const d = bottom + row + edge;
    if (edge === 0) indices.push(a, c, b, b, c, d);
    else indices.push(a, b, c, b, d, c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = { tileKind: kind, closedShell: true, dimensionsM: { width, length, thickness } };
  return geometry;
}

function addWall(group, x, y, z, width, depth, height, materials, data = {}) {
  const wall = mesh(createBatteredWallGeometry(width, depth, height, data.taper ?? 0.12), materials.wall, {
    type: 'weathered-earth-wall',
    semanticRole: 'wall-core',
    componentId: data.componentId || data.type,
    dimensionsM: { width, depth, height, taper: data.taper ?? 0.12 },
    evidenceRule: 'TJ001-MAT-EARTH-WALL-WEATHERED',
    ...data,
  });
  wall.position.set(x, y, z);
  group.add(wall);
  return wall;
}

function addGable(group, x, y, z, width, depth, height, materials, data = {}) {
  const gable = mesh(createGableGeometry(width, depth, height), materials.wall, {
    type: 'weathered-earth-gable',
    semanticRole: 'wall-core',
    componentId: data.componentId || data.type,
    dimensionsM: { width, depth, height, taper: 0 },
    evidenceRule: 'TJ001-MAT-EARTH-WALL-WEATHERED',
    ...data,
  });
  gable.position.set(x, y, z);
  group.add(gable);
  return gable;
}

function addRoundColumn(group, x, y, z, radius, height, materials, data = {}) {
  const item = cylinder(radius, height, materials.timber, { type: 'round-timber-column', ...data }, 20);
  item.position.set(x, y + height / 2, z);
  group.add(item);
  return item;
}

function addBeam(group, x, y, z, width, height, depth, rotationY, materials, data = {}) {
  const item = box(width, height, depth, materials.timber, { type: 'timber-beam', ...data });
  item.position.set(x, y, z);
  item.rotation.y = rotationY || 0;
  group.add(item);
  return item;
}

function addDoor(group, x, y, z, width, height, materials, data = {}) {
  const assembly = tag(new THREE.Group(), {
    type: 'timber-door-assembly', openingKind: 'door', openingProgress: 0,
    maxAngleRad: Math.PI * 0.47, componentId: data.componentId || data.type, ...data,
  });
  assembly.name = `door_${data.type || 'assembly'}`;
  assembly.position.set(x, y, z);
  const recess = box(width + 0.18, height + 0.18, 0.12, materials.opening, { type: 'deep-door-opening' });
  recess.position.set(0, height / 2, -0.05);
  assembly.add(recess);
  const leafWidth = width / 2 - 0.035;
  const pivots = [];
  for (const side of [-1, 1]) {
    const pivot = tag(new THREE.Group(), { type: 'door-leaf-pivot', side });
    pivot.position.set(side * width / 2, 0, -0.12);
    const leaf = box(leafWidth, height - 0.12, 0.08, materials.doorLeaf, { type: '板门-door-leaf', side, openingSurfaceRole: 'doorLeaf' });
    leaf.position.set(-side * leafWidth / 2, height / 2, 0);
    pivot.add(leaf);
    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      const panel = box(leafWidth * 0.72, height * 0.19, 0.026, materials.doorLeaf, { type: 'door-panel-inset', openingSurfaceRole: 'doorLeaf' });
      panel.position.set(-side * leafWidth / 2, 0.38 + rowIndex * 0.57, -0.052);
      pivot.add(panel);
    }
    if (side === 1) {
      const replacement = box(leafWidth * 0.14, height * 0.36, 0.035, materials.replacementTimber, {
        type: 'door-replacement-cleat', openingSurfaceRole: 'replacementPart', repairChronology: 'later-replacement',
      });
      replacement.position.set(-side * leafWidth * 0.28, height * 0.62, -0.065);
      pivot.add(replacement);
    }
    assembly.add(pivot);
    pivots.push(pivot);
  }
  assembly.userData.pivots = pivots;
  const jambL = box(0.12, height + 0.18, 0.16, materials.openingFrame, { type: 'door-jamb', openingSurfaceRole: 'openingFrame' });
  const jambR = jambL.clone();
  jambR.userData = { ...jambL.userData };
  jambL.position.set(-width / 2 - 0.04, height / 2, -0.16);
  jambR.position.set(width / 2 + 0.04, height / 2, -0.16);
  const lintel = box(width + 0.28, 0.16, 0.18, materials.openingFrame, { type: 'door-lintel', openingSurfaceRole: 'openingFrame' });
  lintel.position.set(0, height + 0.04, -0.16);
  assembly.add(jambL, jambR, lintel);
  group.add(assembly);
  return assembly;
}

function addHighWindow(group, x, y, z, width, height, materials, data = {}) {
  const assembly = tag(new THREE.Group(), {
    type: 'small-high-window', openingKind: 'window', openingProgress: 0,
    maxAngleRad: Math.PI * 0.38, componentId: data.componentId || data.type, ...data,
  });
  assembly.name = `window_${data.type || 'assembly'}`;
  assembly.position.set(x, y, z);
  const recess = box(width, height, 0.10, materials.opening, { type: 'window-recess' });
  recess.position.set(0, height / 2, 0);
  assembly.add(recess);
  const frame = 0.07;
  for (const [px, py, pw, ph] of [
    [-width / 2, height / 2, frame, height + frame], [width / 2, height / 2, frame, height + frame],
    [0, 0, width + frame, frame], [0, height, width + frame, frame],
  ]) {
    const surfaceRole = py === 0 ? 'openingSill' : 'openingFrame';
    const bar = box(pw, ph, 0.14, surfaceRole === 'openingSill' ? materials.openingSill : materials.openingFrame, {
      type: surfaceRole === 'openingSill' ? 'weathered-window-sill' : 'small-window-frame', openingSurfaceRole: surfaceRole,
    });
    bar.position.set(px, py, -0.08);
    assembly.add(bar);
  }
  const pivot = tag(new THREE.Group(), { type: 'window-leaf-pivot', side: -1 });
  pivot.position.set(-width / 2, 0, -0.12);
  const shutter = box(width - 0.08, height - 0.08, 0.045, materials.windowLeaf, { type: 'operable-window-shutter', openingSurfaceRole: 'windowLeaf' });
  shutter.position.set((width - 0.08) / 2, height / 2, 0);
  pivot.add(shutter);
  assembly.add(pivot);
  assembly.userData.pivots = [pivot];
  group.add(assembly);
  return assembly;
}

function addRail(group, start, end, materials, data = {}) {
  const item = cylinderBetween(start, end, 0.042, materials.timber, { type: 'continuous-stair-handrail', ...data }, 10);
  group.add(item);
  return item;
}

function addDoubleFlightStairs(group, x, y, z, materials, options = {}, data = {}) {
  const flightCount = 8;
  const width = options.width || 0.86;
  const gap = options.gap || 0.18;
  const run = options.run || 2.05;
  const landingDepth = options.landingDepth || 0.84;
  const totalRise = options.totalRise || 2.73;
  const stepRise = totalRise / 16;
  const stepRun = run / 8;
  const separation = width + gap;
  const firstX = -separation / 2;
  const secondX = separation / 2;
  const stairs = tag(new THREE.Group(), {
    type: '8+8-double-flight-daily-timber-stair', semanticRole: 'daily-use-dogleg-stair',
    componentId: data.stairId || 'STAIR-WEST-01', flightStepCounts: [8, 8], totalRisers: 16,
    riserHeightM: stepRise, treadDepthM: stepRun, totalRiseM: totalRise,
    landingIds: ['LOWER', 'MIDDLE', 'UPPER'], continuousHandrails: true, ...data,
  });
  stairs.name = `stair_${data.stairId || 'west-main-8x8'}`;
  stairs.position.set(x, y, z);
  for (let i = 0; i < flightCount; i += 1) {
    const first = box(width, 0.10, stepRun + 0.045, materials.timber, { type: 'stair-tread', flight: 1, step: i + 1, walkable: true });
    first.position.set(firstX, stepRise * (i + 0.5), -run / 2 + stepRun * (i + 0.5));
    stairs.add(first);
    const second = box(width, 0.10, stepRun + 0.045, materials.timber, { type: 'stair-tread', flight: 2, step: i + 1, walkable: true });
    second.position.set(secondX, totalRise / 2 + stepRise * (i + 0.5), run / 2 - stepRun * (i + 0.5));
    stairs.add(second);
  }
  const lower = box(width, 0.12, landingDepth, materials.timber, { type: 'stair-lower-landing', walkable: true });
  lower.position.set(firstX, 0.02, -run / 2 - landingDepth / 2);
  const middle = box(width * 2 + gap, 0.12, landingDepth, materials.timber, { type: 'stair-intermediate-landing', walkable: true });
  middle.position.set(0, totalRise / 2, run / 2 + landingDepth / 2);
  const upper = box(width, 0.12, landingDepth, materials.timber, { type: 'stair-upper-landing', walkable: true });
  upper.position.set(secondX, totalRise, -run / 2 - landingDepth / 2);
  stairs.add(lower, middle, upper);
  for (const railX of [firstX - width / 2, firstX + width / 2]) {
    addRail(stairs, new THREE.Vector3(railX, 0.75, -run / 2), new THREE.Vector3(railX, totalRise / 2 + 0.75, run / 2), materials, { flight: 1 });
  }
  for (const railX of [secondX - width / 2, secondX + width / 2]) {
    addRail(stairs, new THREE.Vector3(railX, totalRise / 2 + 0.75, run / 2), new THREE.Vector3(railX, totalRise + 0.75, -run / 2), materials, { flight: 2 });
  }
  stairs.userData.routeLocal = [
    [firstX, 0, -run / 2 - landingDepth], [firstX, totalRise / 2, run / 2],
    [secondX, totalRise / 2, run / 2 + landingDepth * 0.5], [secondX, totalRise, -run / 2],
    [secondX, totalRise, -run / 2 - landingDepth],
  ];
  group.add(stairs);
  return stairs;
}

function addStoneFloor(group, width, depth, materials, data = {}) {
  const floor = tag(new THREE.Group(), { type: 'irregular-stone-slab-courtyard', ...data });
  const step = 0.68;
  for (let x = -width / 2 + step / 2; x < width / 2; x += step) {
    for (let z = -depth / 2 + step / 2; z < depth / 2; z += step) {
      const slab = box(step * 0.93, 0.07, step * 0.93, materials.stone, { type: 'stone-slab', walkable: true });
      slab.position.set(x + ((Math.floor((z + depth) * 7) % 3) - 1) * 0.025, 0.035, z);
      slab.rotation.y = ((Math.floor((x + width) * 5) + Math.floor((z + depth) * 4)) % 5) * 0.025;
      floor.add(slab);
    }
  }
  group.add(floor);
  return floor;
}

function roofLayer(name, order) {
  const layer = tag(new THREE.Group(), {
    type: 'roof-build-up-layer', roofLayerId: name, roofLayer: name, explosionOrder: order,
  });
  layer.name = `roofLayer_${name}`;
  layer.userData.roofLayerBasePosition = [0, 0, 0];
  return layer;
}

function tileColor(profile, roofIndex, column, course, side, state = 'aged') {
  const firing = Number(profile.baseFiringTone ?? 0.46);
  const exposure = Number(profile.orientationExposure ?? 0.42);
  const dust = Number(profile.dust ?? 0.34);
  const rain = Number(profile.rainWash ?? 0.28);
  const moss = Number(profile.moss ?? 0.12);
  const low = seeded01(roofIndex * 0.37 + Math.floor(column / 5), Math.floor(course / 4), side);
  const sun = side > 0 ? exposure : exposure * 0.44;
  const flow = Math.abs(Math.sin((column + roofIndex) * 0.55)) * rain;
  const damp = side < 0 ? moss : moss * 0.36;
  const color = new THREE.Color(0x606866).lerp(new THREE.Color(0x84796b), THREE.MathUtils.clamp(firing * 0.68 + low * 0.25 + sun * 0.08, 0, 1));
  color.lerp(new THREE.Color(0x6c5d50), THREE.MathUtils.clamp(dust * (0.18 + low * 0.16) + flow * 0.07, 0, 0.42));
  color.lerp(new THREE.Color(0x4a5949), THREE.MathUtils.clamp(damp * (0.18 + (1 - low) * 0.20), 0, 0.32));
  if (state === 'repair') color.offsetHSL(Number(profile.repairAgeTone ?? 0.08) * 0.1, -0.03, 0.12);
  if (state === 'broken') color.multiplyScalar(0.74);
  return color;
}

function classifyTile(profile, roofIndex, side, course, column, courses, columns) {
  const damage = Number(profile.damage ?? 0);
  const repair = Number(profile.repair ?? 0);
  const u = columns <= 1 ? 0 : column / (columns - 1);
  const v = courses <= 1 ? 0 : course / (courses - 1);
  const damageCenter = [0.20 + seeded01(roofIndex, side, 11) * 0.58, 0.28 + seeded01(roofIndex, side, 17) * 0.48];
  const repairCenter = [0.18 + seeded01(roofIndex, side, 23) * 0.64, 0.18 + seeded01(roofIndex, side, 29) * 0.64];
  const damageRadii = [0.08 + damage * 0.42, 0.10 + damage * 0.38];
  const repairRadii = [0.12 + repair * 0.46, 0.13 + repair * 0.40];
  const damageDistance = ((u - damageCenter[0]) / damageRadii[0]) ** 2 + ((v - damageCenter[1]) / damageRadii[1]) ** 2;
  const repairDistance = ((u - repairCenter[0]) / repairRadii[0]) ** 2 + ((v - repairCenter[1]) / repairRadii[1]) ** 2;
  const missing = damage > 0.02 && damageDistance < 0.42 && seeded01(course, column, roofIndex + side) > 0.32;
  const broken = !missing && damage > 0.03 && damageDistance < 1.0 && seeded01(column, course, roofIndex) > 0.52;
  const repaired = !missing && repair > 0.02 && repairDistance < 0.85;
  return {
    missing, broken, repaired,
    damagePatch: { center: damageCenter, radii: damageRadii, correlation: 'continuous-ellipse' },
    repairPatch: { center: repairCenter, radii: repairRadii, correlation: 'continuous-ellipse' },
  };
}

function makeInstanceBatch(records, geometry, material, data = {}) {
  if (!records.length) return null;
  const batch = tag(new THREE.InstancedMesh(geometry, material, records.length), { ...data, instanceCount: records.length });
  const dummy = new THREE.Object3D();
  records.forEach((record, index) => {
    dummy.position.fromArray(record.position);
    dummy.rotation.set(...record.rotation);
    dummy.scale.fromArray(record.scale || [1, 1, 1]);
    dummy.updateMatrix();
    batch.setMatrixAt(index, dummy.matrix);
    batch.setColorAt(index, record.color);
  });
  batch.instanceMatrix.needsUpdate = true;
  if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
  return batch;
}

function addRoofUnit(parent, spec, options, materials, profile, baseline, roofIndex) {
  const roof = tag(new THREE.Group(), {
    type: 'independent-yunnan-tile-roof',
    isRoofUnit: true,
    roofUnitId: spec.id,
    buildingUnitId: spec.buildingUnitId,
    roofType: spec.roofType,
    surfaceProfileId: profile.id || (baseline ? 'baselineV544' : 'museum1940sBalanced'),
    tileProfileId: baseline ? 'YUNNAN-PAN-COVER-V544-BASELINE' : options.tileProfileId,
    evidenceStatus: baseline ? 'V5.4.4-visual-baseline' : 'visual-calibration-with-unresolved-lap',
    drainageContinuous: true,
    seed: options.seed + roofIndex * 17,
    sectionCount: spec.sections.length,
  });
  roof.name = `roofUnit_${spec.id}`;
  const purlins = roofLayer('purlins', 0);
  const rafters = roofLayer('rafters', 1);
  const underlay = roofLayer('roofUnderlay', 2);
  const pans = roofLayer('panTileCourses', 3);
  const covers = roofLayer('coverTileCourses', 4);
  const eaves = roofLayer('eaveCapsAndDrips', 5);
  const ridges = roofLayer('ridgeAndClosures', 6);
  roof.add(purlins, rafters, underlay, pans, covers, eaves, ridges);

  const tileWidth = options.tileWidth;
  const tileLength = options.tileLength;
  const tileCourse = options.tileCourse;
  const tileThickness = options.tileThickness;
  const coverWidth = baseline ? tileWidth * 0.92 : tileWidth * 0.48;
  const panGeometry = createTileGeometry(tileWidth, tileLength, 'pan', tileThickness);
  const coverGeometry = createTileGeometry(coverWidth, tileLength * (baseline ? 0.94 : 0.98), 'cover', tileThickness);
  const dripGeometry = createTileGeometry(tileWidth * 0.92, tileLength * 0.52, 'pan', tileThickness * 1.1);
  const hookGeometry = createTileGeometry(coverWidth * 1.08, tileLength * 0.48, 'cover', tileThickness * 1.15);
  const slopes = [];
  const ridgeElevations = [];
  const eaveElevations = [];
  const ridgeTopology = [];
  const instanceMap = [];
  let totalMissing = 0;
  let totalBroken = 0;
  let totalRepair = 0;

  spec.sections.forEach((section, sectionIndex) => {
    const sectionPosition = new THREE.Vector3().fromArray(section.position || [0, 0, 0]);
    const sectionRotationY = section.rotationY || 0;
    const sectionPoint = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(UP, sectionRotationY).add(sectionPosition);
    const sectionRoot = tag(new THREE.Group(), {
      type: 'roof-section', sectionId: section.id, roofUnitId: spec.id,
      sectionTransform: { position: sectionPosition.toArray(), rotationY: sectionRotationY },
    });
    roof.add(sectionRoot);
    const sectionRidge = roofLayer('ridgeAndClosures', 6);
    sectionRoot.add(sectionRidge);
    section.planes.forEach((plane, planeIndex) => {
      const slope = tag(new THREE.Group(), {
        type: 'roof-slope', slopeId: `${spec.id}:${section.id}:S${plane.side}`,
        sectionId: section.id, roofUnitId: spec.id, roofSide: plane.side,
      });
      sectionRoot.add(slope);
      const angle = Math.atan(plane.pitch);
      const slopeLength = plane.run / Math.cos(angle);
      const panColumns = Math.max(5, Math.floor(section.span / tileWidth));
      const coverColumns = baseline ? panColumns : panColumns - 1;
      const columnPitch = section.span / panColumns;
      const courseCount = Math.max(4, Math.ceil(plane.run / tileCourse));
      const courseStep = plane.run / courseCount;
      const overlap = tileLength - courseStep / Math.cos(angle);
      const panX = (column) => -section.span / 2 + (column + 0.5) * columnPitch;
      const coverX = (column) => baseline
        ? -section.span / 2 + (column + 0.73) * columnPitch
        : -section.span / 2 + (column + 1) * columnPitch;
      const panRecords = { aged: [], repair: [], broken: [] };
      const coverRecords = { aged: [], repair: [], broken: [] };
      const missingIds = [];
      const damagePatchIds = new Set();
      const repairPatchIds = new Set();

      for (let course = 0; course < courseCount; course += 1) {
        const distance = (course + 0.5) * courseStep;
        const panZ = plane.centerZ + plane.side * distance;
        const panY = plane.ridgeY - plane.pitch * distance + 0.055;
        for (let column = 0; column < panColumns; column += 1) {
          const state = baseline ? { missing: false, broken: false, repaired: false } : classifyTile(profile.roof || profile, roofIndex + sectionIndex, plane.side, course, column, courseCount, panColumns);
          const id = `${spec.id}:${section.id}:S${plane.side}:PAN:${course}:${column}`;
          if (state.missing) {
            missingIds.push(id); totalMissing += 1;
            instanceMap.push({ tileId: id, kind: 'pan', state: 'missing', courseIndex: course, columnIndex: column });
            continue;
          }
          const stateName = state.repaired ? 'repair' : state.broken ? 'broken' : 'aged';
          const record = {
            position: sectionPoint(panX(column), panY, panZ).toArray(),
            rotation: [plane.side * angle, sectionRotationY + (state.broken ? (seeded01(course, column, 3) - 0.5) * 0.12 : 0), state.broken ? plane.side * 0.05 : 0],
            scale: state.broken ? [0.68, 0.72, 0.62] : [1, 1, 1],
            color: tileColor(profile.roof || profile, roofIndex, column, course, plane.side, stateName),
          };
          panRecords[stateName].push(record);
          if (state.broken) totalBroken += 1;
          if (state.repaired) totalRepair += 1;
          instanceMap.push({ tileId: id, kind: 'pan', state: stateName, courseIndex: course, columnIndex: column });
        }
        for (let column = 0; column < coverColumns; column += 1) {
          const coverDistance = baseline ? distance + courseStep * 0.23 : distance;
          const coverZ = plane.centerZ + plane.side * coverDistance;
          const coverY = plane.ridgeY - plane.pitch * coverDistance + 0.105;
          const state = baseline ? { missing: false, broken: false, repaired: false } : classifyTile(profile.roof || profile, roofIndex + sectionIndex, plane.side, course, column, courseCount, coverColumns);
          const id = `${spec.id}:${section.id}:S${plane.side}:COVER:${course}:${column}`;
          if (state.missing) {
            missingIds.push(id); totalMissing += 1;
            instanceMap.push({ tileId: id, kind: 'cover', state: 'missing', courseIndex: course, columnIndex: column });
            continue;
          }
          const stateName = state.repaired ? 'repair' : state.broken ? 'broken' : 'aged';
          const record = {
            position: sectionPoint(coverX(column), coverY, coverZ).toArray(),
            rotation: [plane.side * angle, sectionRotationY + (state.broken ? (seeded01(column, course, 7) - 0.5) * 0.10 : 0), 0],
            scale: state.broken ? [0.74, 0.76, 0.58] : [1, 1, 1],
            color: tileColor(profile.roof || profile, roofIndex, column + 0.5, course, plane.side, stateName),
          };
          coverRecords[stateName].push(record);
          if (state.broken) totalBroken += 1;
          if (state.repaired) totalRepair += 1;
          instanceMap.push({ tileId: id, kind: 'cover', state: stateName, courseIndex: course, columnIndex: column });
        }
      }

      const addBatch = (layer, records, geometry, material, data) => {
        const batch = makeInstanceBatch(records, geometry, material, data);
        if (batch) layer.add(batch);
      };
      for (const stateName of ['aged', 'repair', 'broken']) {
        addBatch(pans, panRecords[stateName], panGeometry, materials.tilePan, { type: `板瓦-pan-${stateName}`, state: stateName, slopeId: slope.userData.slopeId });
        addBatch(covers, coverRecords[stateName], coverGeometry, materials.tileCover, { type: `筒瓦-cover-${stateName}`, state: stateName, slopeId: slope.userData.slopeId });
      }

      const rafterCount = Math.max(5, Math.ceil(section.span / 0.48));
      for (let index = 0; index < rafterCount; index += 1) {
        const rafter = box(0.055, 0.075, slopeLength, materials.timber, { type: 'roof-rafter', roofLayerId: 'rafters', slopeId: slope.userData.slopeId });
        rafter.rotation.x = plane.side * angle;
        rafter.rotation.y = sectionRotationY;
        rafter.position.copy(sectionPoint(-section.span / 2 + section.span * index / Math.max(1, rafterCount - 1), plane.ridgeY - plane.pitch * plane.run / 2 - 0.17, plane.centerZ + plane.side * plane.run / 2));
        rafters.add(rafter);
      }
      for (let index = 1; index <= 4; index += 1) {
        const distance = plane.run * index / 5;
        purlins.add(cylinderBetween(
          sectionPoint(-section.span / 2, plane.ridgeY - plane.pitch * distance - 0.23, plane.centerZ + plane.side * distance),
          sectionPoint(section.span / 2, plane.ridgeY - plane.pitch * distance - 0.23, plane.centerZ + plane.side * distance),
          0.065, materials.timber, { type: 'roof-purlin', roofLayerId: 'purlins', slopeId: slope.userData.slopeId },
        ));
      }
      const deck = box(section.span, options.roofThickness, slopeLength, materials.timber, { type: 'roof-deck-underlay', roofLayerId: 'roofUnderlay', slopeId: slope.userData.slopeId });
      deck.rotation.x = plane.side * angle;
      deck.rotation.y = sectionRotationY;
      deck.position.copy(sectionPoint(0, plane.ridgeY - plane.pitch * plane.run / 2 - 0.06, plane.centerZ + plane.side * plane.run / 2));
      underlay.add(deck);

      const dripRecords = [];
      const hookRecords = [];
      const eaveDistance = plane.run + tileLength * 0.10;
      const eaveZ = plane.centerZ + plane.side * eaveDistance;
      const eaveY = plane.ridgeY - plane.pitch * eaveDistance + 0.04;
      for (let column = 0; column < panColumns; column += 1) {
        dripRecords.push({ position: sectionPoint(panX(column), eaveY, eaveZ).toArray(), rotation: [plane.side * angle, sectionRotationY, 0], color: tileColor(profile.roof || profile, roofIndex, column, courseCount, plane.side) });
      }
      for (let column = 0; column < coverColumns; column += 1) {
        hookRecords.push({ position: sectionPoint(coverX(column), eaveY + 0.07, eaveZ).toArray(), rotation: [plane.side * angle, sectionRotationY, 0], color: tileColor(profile.roof || profile, roofIndex, column + 0.5, courseCount, plane.side) });
      }
      addBatch(eaves, dripRecords, dripGeometry, materials.tilePan, { type: '滴水-pan-eave-drips', slopeId: slope.userData.slopeId, correspondence: 'one-per-pan-column' });
      addBatch(eaves, hookRecords, hookGeometry, materials.tileCover, { type: '勾头-cover-eave-hooks', slopeId: slope.userData.slopeId, correspondence: 'one-per-cover-column' });
      const fascia = box(section.span, 0.16, 0.09, materials.timber, { type: 'eave-fascia', roofLayerId: 'eaveCapsAndDrips', slopeId: slope.userData.slopeId });
      fascia.rotation.y = sectionRotationY;
      fascia.position.copy(sectionPoint(0, plane.ridgeY - plane.pitch * plane.run - 0.12, plane.centerZ + plane.side * plane.run));
      eaves.add(fascia);

      const panInstanceCount = Object.values(panRecords).reduce((sum, list) => sum + list.length, 0);
      const coverInstanceCount = Object.values(coverRecords).reduce((sum, list) => sum + list.length, 0);
      slope.userData.tileTopology = {
        panColumns, coverColumns,
        coverBridgesPanSeams: !baseline,
        courseCount, courseStepM: courseStep,
        longitudinalOverlapM: overlap,
        coverCourseOffsetM: baseline ? courseStep * 0.23 : 0,
        seamAlignmentMaxErrorM: baseline ? columnPitch * 0.23 : 0,
        panColumnX: Array.from({ length: panColumns }, (_, index) => panX(index)),
        coverColumnX: Array.from({ length: coverColumns }, (_, index) => coverX(index)),
        panInstanceCount, coverInstanceCount,
        dripCount: panColumns, hookCount: coverColumns,
        drainagePathCount: panColumns,
        drainagePathsMonotonic: true,
        drainagePathsEndAtEave: true,
        drainageVectorLocal: [0, -plane.pitch, plane.side],
        drainageTargetId: plane.drainageTargetId,
        missingTileIds: missingIds,
        tileBatchesAreInstanced: true,
        panConcavity: 'up', coverConvexity: 'up',
      };
      slope.userData.damagePatch = { correlation: 'continuous-ellipse', tileCount: instanceMap.filter((entry) => entry.state === 'missing' || entry.state === 'broken').length };
      slope.userData.repairPatch = { correlation: 'bounded-continuous-ellipse', tileCount: instanceMap.filter((entry) => entry.state === 'repair').length };
      slopes.push(slope.userData.tileTopology);
      ridgeElevations.push(plane.ridgeY);
      eaveElevations.push(plane.ridgeY - plane.pitch * plane.run);
    });

    const firstPlane = section.planes[0];
    const isLeanTo = section.planes.length === 1;
    const closure = cylinderBetween(
      sectionPoint(-section.span / 2, firstPlane.ridgeY + 0.10, firstPlane.centerZ),
      sectionPoint(section.span / 2, firstPlane.ridgeY + 0.10, firstPlane.centerZ),
      tileWidth * 0.25, materials.tileCover,
      {
        type: isLeanTo ? '靠墙收口-wall-abutment' : '正脊-ridge-cover',
        ridgeSemantic: isLeanTo ? 'wallAbutment' : 'principalRidge',
        roofLayerId: 'ridgeAndClosures', sectionId: section.id,
      },
    );
    sectionRidge.add(closure);
    for (const x of [-section.span / 2, section.span / 2]) {
      const cap = mesh(new THREE.SphereGeometry(tileWidth * 0.29, 10, 8), materials.tileCover, { type: 'ridge-end-closure', ridgeSemantic: 'endClosure', roofLayerId: 'ridgeAndClosures', sectionId: section.id });
      cap.position.copy(sectionPoint(x, firstPlane.ridgeY + 0.10, firstPlane.centerZ));
      sectionRidge.add(cap);
    }
    let vergeClosureCount = 0;
    for (const plane of section.planes) {
      const eaveDistance = plane.run + tileLength * 0.10;
      for (const x of [-section.span / 2, section.span / 2]) {
        const verge = cylinderBetween(
          sectionPoint(x, plane.ridgeY + 0.075, plane.centerZ),
          sectionPoint(x, plane.ridgeY - plane.pitch * eaveDistance + 0.045, plane.centerZ + plane.side * eaveDistance),
          tileWidth * 0.115, materials.tileCover,
          { type: '山面斜向收边-verge-closure', ridgeSemantic: 'vergeClosure', roofLayerId: 'ridgeAndClosures', sectionId: section.id },
        );
        sectionRidge.add(verge);
        vergeClosureCount += 1;
      }
    }
    ridgeTopology.push({
      sectionId: section.id,
      roofForm: isLeanTo ? 'lean-to' : 'gable',
      principalRidgeCount: isLeanTo ? 0 : 1,
      wallAbutmentCount: isLeanTo ? 1 : 0,
      vergeClosureCount,
      endClosureCount: 2,
      verticalRidgeApplicable: false,
      verticalRidgeCount: 0,
      verticalRidgeReason: isLeanTo
        ? 'Lean-to section terminates at a wall abutment and has no hipped corner.'
        : 'Gable section uses a principal ridge and verge closures; no hipped corner exists.',
    });
  });

  roof.userData.buildUp = ['purlins', 'rafters', 'roofUnderlay', 'panTileCourses', 'coverTileCourses', 'eaveCapsAndDrips', 'ridgeAndClosures'];
  roof.userData.ridgeElevationsM = ridgeElevations;
  roof.userData.eaveElevationsM = eaveElevations;
  roof.userData.ridgeElevationM = Math.max(...ridgeElevations);
  roof.userData.eaveElevationM = Math.min(...eaveElevations);
  roof.userData.slopeDirections = spec.sections.flatMap((section) => section.planes.map((plane) => plane.slopeDirection));
  roof.userData.drainageTargetIds = spec.sections.flatMap((section) => section.planes.map((plane) => plane.drainageTargetId));
  roof.userData.damage = { missingTiles: totalMissing, brokenTiles: totalBroken, clustered: true };
  roof.userData.repairs = { tiles: totalRepair, boundedPatches: true };
  roof.userData.instanceMap = instanceMap;
  roof.userData.slopes = slopes;
  roof.userData.ridgeTopology = ridgeTopology;
  parent.add(roof);
  return roof;
}

function createVisitor() {
  const visitor = tag(new THREE.Group(), { type: 'qa-visitor', routeProgress: 0, routeComplete: false });
  visitor.name = 'visitor_route_actor';
  const coat = new THREE.MeshStandardMaterial({ color: 0x38535c, roughness: 0.82 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98563, roughness: 0.9 });
  const body = cylinder(0.18, 0.78, coat, { type: 'visitor-body' }, 14);
  body.position.y = 0.58;
  const head = mesh(new THREE.SphereGeometry(0.14, 14, 10), skin, { type: 'visitor-head' });
  head.position.y = 1.10;
  visitor.add(body, head);
  visitor.userData.ownedMaterials = [coat, skin];
  return visitor;
}

function interpolateRoute(points, progress) {
  const value = THREE.MathUtils.clamp(progress, 0, 1);
  const lengths = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = points[index].distanceTo(points[index - 1]);
    lengths.push(length);
    total += length;
  }
  let remaining = total * value;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      return points[index].clone().lerp(points[index + 1], lengths[index] ? remaining / lengths[index] : 0);
    }
    remaining -= lengths[index];
  }
  return points.at(-1).clone();
}

function sampleVisitorRoute(points, spacingM = 0.08) {
  const samples = [];
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];
    const steps = Math.max(1, Math.ceil(start.distanceTo(end) / spacingM));
    for (let step = segmentIndex === 0 ? 0 : 1; step <= steps; step += 1) {
      samples.push(start.clone().lerp(end, step / steps));
    }
  }
  return samples;
}

function buildVisitorRouteDiagnostics(root, points) {
  root.updateMatrixWorld(true);
  const wallBounds = [];
  const walkableBounds = [];
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    if (object.userData?.semanticRole === 'wall-core') wallBounds.push(new THREE.Box3().setFromObject(object));
    if (object.userData?.walkable === true) walkableBounds.push(new THREE.Box3().setFromObject(object));
  });
  const samples = sampleVisitorRoute(points);
  let wallIntersectionCount = 0;
  let suspendedFrameCount = 0;
  let stuckFrameCount = 0;
  let maxGroundClearanceM = 0;
  let previous = null;
  samples.forEach((point) => {
    const body = new THREE.Box3(
      new THREE.Vector3(point.x - 0.16, point.y + 0.04, point.z - 0.16),
      new THREE.Vector3(point.x + 0.16, point.y + 1.20, point.z + 0.16),
    );
    if (wallBounds.some((bounds) => bounds.intersectsBox(body))) wallIntersectionCount += 1;
    const supports = walkableBounds.map((bounds) => ({
      bounds, clearance: point.y - bounds.max.y,
    })).filter(({ bounds, clearance }) =>
      point.x >= bounds.min.x - 0.10 && point.x <= bounds.max.x + 0.10
      && point.z >= bounds.min.z - 0.10 && point.z <= bounds.max.z + 0.10
      && clearance >= -0.18 && clearance <= 0.30
    );
    if (!supports.length) suspendedFrameCount += 1;
    else maxGroundClearanceM = Math.max(maxGroundClearanceM, Math.max(0, Math.min(...supports.map((item) => Math.abs(item.clearance)))));
    if (previous && point.distanceTo(previous) < 0.005) stuckFrameCount += 1;
    previous = point;
  });
  return {
    method: 'rendered-wall-aabb-and-walkable-support-sampling',
    sampleSpacingM: 0.08, sampleCount: samples.length, visitorRadiusM: 0.16, visitorHeightM: 1.20,
    wallVolumeCount: wallBounds.length, walkableVolumeCount: walkableBounds.length,
    wallIntersectionCount, suspendedFrameCount, stuckFrameCount, maxGroundClearanceM,
    passed: wallIntersectionCount === 0 && suspendedFrameCount === 0 && stuckFrameCount === 0,
  };
}

function setOpeningProgress(root, progress) {
  const value = THREE.MathUtils.clamp(progress, 0, 1);
  let doors = 0;
  let windows = 0;
  root.traverse((object) => {
    if (!object.userData?.openingKind) return;
    (object.userData.pivots || []).forEach((pivot) => {
      pivot.rotation.y = object.userData.openingKind === 'door'
        ? -pivot.userData.side * object.userData.maxAngleRad * value
        : object.userData.maxAngleRad * value;
    });
    object.userData.openingProgress = value;
    if (object.userData.openingKind === 'door') doors += 1;
    else windows += 1;
  });
  root.userData.runtimeState.openingProgress = value;
  return { progress: value, doors, windows };
}

function setVisitorProgress(root, progress) {
  const value = THREE.MathUtils.clamp(progress, 0, 1);
  const visitor = root.getObjectByName('visitor_route_actor');
  if (!visitor) return null;
  const position = interpolateRoute(root.userData.visitorRoute.points, value);
  visitor.position.copy(position);
  visitor.userData.routeProgress = value;
  visitor.userData.routeComplete = value >= 0.999;
  visitor.userData.floorElevationM = position.y;
  visitor.userData.routeDiagnostics = { ...root.userData.visitorRoute.diagnostics };
  root.userData.runtimeState.visitorProgress = value;
  root.userData.runtimeState.visitorPosition = position.toArray();
  return { progress: value, position: position.toArray(), complete: visitor.userData.routeComplete };
}

function computeStats(root) {
  const stats = { meshCount: 0, instanceCount: 0, vertexCount: 0, triangleCount: 0, drawCallEstimate: 0 };
  root.traverse((object) => {
    if (!object.isMesh) return;
    stats.meshCount += 1;
    stats.drawCallEstimate += 1;
    const multiplier = object.isInstancedMesh ? object.count : 1;
    if (object.isInstancedMesh) stats.instanceCount += object.count;
    const position = object.geometry?.getAttribute?.('position');
    stats.vertexCount += (position?.count || 0) * multiplier;
    stats.triangleCount += (object.geometry?.index ? object.geometry.index.count / 3 : (position?.count || 0) / 3) * multiplier;
  });
  return stats;
}

export function createYunnanCourtyardPrototype(userOptions = {}) {
  const surfaceProfile = userOptions.surfaceProfile || {
    id: userOptions.baselineV544 ? 'baselineV544' : 'museum1940sBalanced',
    enabled: !userOptions.baselineV544,
    roof: {}, wall: {},
  };
  const baseline = !surfaceProfile.enabled || Boolean(userOptions.baselineV544);
  const options = { ...YUNNAN_COURTYARD_DEFAULTS, ...userOptions };
  if (baseline) Object.assign(options, options.legacyTileProfile);
  const materials = createYunnanMaterialSet({
    seed: options.seed,
    surfaceProfile,
    wall: { surfaceChannels: surfaceProfile.wall || {}, ...(userOptions.materials?.wall || {}) },
    tilePan: { surfaceChannels: surfaceProfile.roof || {}, ...(userOptions.materials?.tilePan || {}) },
    tileCover: { surfaceChannels: surfaceProfile.roof || {}, ...(userOptions.materials?.tileCover || {}) },
    timber: userOptions.materials?.timber || {},
    openingWeathering: { enabled: !baseline, ...(surfaceProfile.opening || {}), ...(userOptions.materials?.openingWeathering || {}) },
    stone: userOptions.materials?.stone || {},
    opening: userOptions.materials?.opening || {},
  });
  const root = tag(new THREE.Group(), {
    type: 'yunnan-courtyard-production-prototype',
    caseId: 'YN_TUANJIE_001_PROCEDURAL_SEED',
    exactDimensionsStatus: 'YKY-seed-only-TJ001-dimensions-unresolved',
    comparisonContract: {
      structuralSeed: options.seed,
      cameraAndLightMustMatch: true,
      activeVersion: baseline ? '5.4.4' : '5.5.0',
    },
  });
  root.name = baseline ? 'YunnanCourtyard_V544_Baseline' : 'YunnanCourtyard_V550_Production';
  root.userData.options = { ...options, surfaceProfile: undefined };
  root.userData.materialSet = materials;
  root.userData.materialProfiles = Object.values(materials).map((item) => item.userData?.yunnanProfile).filter(Boolean);
  root.userData.runtimeState = { openingProgress: 0, visitorProgress: 0, roofExploded: false, wallLayerMode: 'complete' };

  const ground = tag(new THREE.Group(), { layer: 'stone-and-ground', editable: true });
  const walls = tag(new THREE.Group(), { layer: 'walls', editable: true });
  const frame = tag(new THREE.Group(), { layer: 'timber-frame', editable: true });
  const roofs = tag(new THREE.Group(), { layer: 'roof-production', editable: true });
  const openings = tag(new THREE.Group(), { layer: 'doors-windows', editable: true });
  const actors = tag(new THREE.Group(), { layer: 'visitor-route', editable: true });
  root.add(ground, walls, frame, roofs, openings, actors);

  const W = options.siteWidth;
  const D = options.siteDepth;
  const t = options.wallThickness;
  const H = options.wallHeight;
  const p = options.plinthHeight;
  const courtyardW = options.courtyardWidth;
  const courtyardD = options.courtyardDepth;
  const galleryZ = D / 2 - 4.8;
  const mainZ = D / 2 - 2.45;
  const sideDepth = D - 4.2;

  const base = box(W + 0.5, 0.16, D + 0.5, materials.stone, { type: 'stone-foundation-plinth', walkable: true });
  base.position.y = 0.08;
  ground.add(base);
  addStoneFloor(ground, courtyardW, courtyardD, materials, { type: 'courtyard-stone-paving' });
  const frontStep = box(2.2, 0.14, 0.55, materials.stone, { type: 'front-stone-step', walkable: true });
  frontStep.position.set(0, 0.18, -D / 2 - 0.3);
  ground.add(frontStep);
  const entryApproach = box(1.6, 0.08, 2.8, materials.stone, { type: 'entry-approach-walkway', walkable: true });
  entryApproach.position.set(0, 0.05, -D / 2 - 1.40);
  ground.add(entryApproach);

  addWall(walls, 0, p, D / 2 - t / 2, W, t, H, materials, { type: 'north-main-wall', componentId: 'WALL-NORTH-MAIN', taper: options.wallTaper });
  addWall(walls, -W / 2 + t / 2, p, 0.15, t, sideDepth, H * 0.9, materials, { type: 'west-side-wall', componentId: 'WALL-WEST-SIDE', taper: options.wallTaper });
  addWall(walls, W / 2 - t / 2, p, 0.15, t, sideDepth, H * 0.9, materials, { type: 'east-side-wall', componentId: 'WALL-EAST-SIDE', taper: options.wallTaper });
  const southSpan = W / 2 - 2.0;
  addWall(walls, -southSpan / 2 - 1.0, p, -D / 2 + t / 2, southSpan, t, H * 0.72, materials, { type: 'south-left-wall', componentId: 'WALL-SOUTH-LEFT', taper: options.wallTaper * 0.85 });
  addWall(walls, southSpan / 2 + 1.0, p, -D / 2 + t / 2, southSpan, t, H * 0.72, materials, { type: 'south-right-wall', componentId: 'WALL-SOUTH-RIGHT', taper: options.wallTaper * 0.85 });
  addGable(walls, 0, p + H, D / 2 - t / 2, W, t, H * 0.72, materials, { type: 'north-gable-wall', componentId: 'WALL-NORTH-GABLE' });

  for (const x of [-W / 2 + 1.0, -courtyardW / 2, courtyardW / 2, W / 2 - 1.0]) {
    addRoundColumn(frame, x, p, galleryZ, 0.14, options.floorHeight, materials, { type: 'gallery-column' });
    addRoundColumn(frame, x, p + options.floorHeight, galleryZ, 0.11, H - options.floorHeight, materials, { type: 'upper-gallery-column' });
  }
  for (const x of [-W / 2 + 1.0, -courtyardW / 2, courtyardW / 2, W / 2 - 1.0]) {
    addBeam(frame, x, p + options.floorHeight, galleryZ, 0.18, 0.16, courtyardW + 0.35, 0, materials, { type: 'gallery-floor-beam' });
  }
  addBeam(frame, 0, p + H * 0.52, galleryZ, courtyardW + 1.0, 0.16, 0.18, 0, materials, { type: 'gallery-lintel' });
  const upperGallery = box(courtyardW + 2.2, 0.12, 1.05, materials.timber, { type: 'upper-gallery-walkway', walkable: true });
  upperGallery.position.set(-0.45, p + options.floorHeight, galleryZ + 0.15);
  frame.add(upperGallery);

  addDoor(openings, 0, p, -D / 2 - 0.01, 1.25, 2.15, materials, { type: 'central-front-door', componentId: 'GATE-SOUTH-01' });
  addHighWindow(openings, -W * 0.28, p + 2.68, D / 2 - t - 0.02, 0.44, 0.38, materials, { type: 'sparse-high-window-left', componentId: 'WINDOW-NORTH-LEFT' });
  addHighWindow(openings, W * 0.28, p + 2.68, D / 2 - t - 0.02, 0.44, 0.38, materials, { type: 'sparse-high-window-right', componentId: 'WINDOW-NORTH-RIGHT' });
  const westWindow = addHighWindow(openings, -W / 2 - 0.02, p + 2.52, 0.55, 0.32, 0.42, materials, { type: 'side-high-window-west', componentId: 'WINDOW-WEST-HIGH' });
  westWindow.rotation.y = Math.PI / 2;
  const eastWindow = addHighWindow(openings, W / 2 + 0.02, p + 2.52, 0.55, 0.32, 0.42, materials, { type: 'side-high-window-east', componentId: 'WINDOW-EAST-HIGH' });
  eastWindow.rotation.y = -Math.PI / 2;

  const stair = addDoubleFlightStairs(frame, -courtyardW / 2 - 1.25, p, galleryZ - 0.20, materials, {
    width: 0.84, gap: 0.18, run: 2.05, landingDepth: 0.82, totalRise: options.floorHeight,
  }, { type: 'west-daily-stair', stairId: 'STAIR-WEST-01' });
  const upperStairConnector = box(1.30, 0.12, 1.90, materials.timber, {
    type: 'upper-stair-gallery-connector', walkable: true, stairId: 'STAIR-WEST-01',
  });
  upperStairConnector.position.set(-3.0, p + options.floorHeight - 0.06, 1.65);
  frame.add(upperStairConnector);

  const specs = [
    {
      id: 'mainHouseDoublePitch', buildingUnitId: 'YKY-main-house', roofType: 'double-pitch-main-house',
      sections: [{ id: 'main', position: [0, 0, mainZ], span: W + 1.2, planes: [
        { side: -1, run: 3.03, pitch: 0.353, ridgeY: 6.18, centerZ: 0, slopeDirection: '-z', drainageTargetId: 'courtyard-north-channel' },
        { side: 1, run: 3.03, pitch: 0.353, ridgeY: 6.18, centerZ: 0, slopeDirection: '+z', drainageTargetId: 'north-exterior-channel' },
      ] }],
    },
    {
      id: 'leftEarAsymmetricDoublePitch', buildingUnitId: 'YKY-left-ear-house', roofType: 'asymmetric-double-pitch-ear-house',
      sections: [{ id: 'left-ear', position: [-W / 2 + 1.45, 0, -0.05], rotationY: Math.PI / 2, span: sideDepth + 1.1, planes: [
        { side: -1, run: 1.15, pitch: 0.487, ridgeY: 5.28, centerZ: 0, slopeDirection: '-x-short', drainageTargetId: 'west-exterior-channel' },
        { side: 1, run: 2.05, pitch: 0.551, ridgeY: 5.28, centerZ: 0, slopeDirection: '+x-long', drainageTargetId: 'courtyard-west-channel' },
      ] }],
    },
    {
      id: 'rightEarAsymmetricDoublePitch', buildingUnitId: 'YKY-right-ear-house', roofType: 'asymmetric-double-pitch-ear-house',
      sections: [{ id: 'right-ear', position: [W / 2 - 1.45, 0, -0.05], rotationY: Math.PI / 2, span: sideDepth + 1.1, planes: [
        { side: -1, run: 2.05, pitch: 0.551, ridgeY: 5.28, centerZ: 0, slopeDirection: '-x-long', drainageTargetId: 'courtyard-east-channel' },
        { side: 1, run: 1.15, pitch: 0.487, ridgeY: 5.28, centerZ: 0, slopeDirection: '+x-short', drainageTargetId: 'east-exterior-channel' },
      ] }],
    },
    {
      id: 'entranceBlockDoublePitch', buildingUnitId: 'YKY-entrance-block', roofType: 'double-pitch-inverted-house',
      sections: [{ id: 'entrance-block', position: [0, 0, -D / 2 + 1.15], span: W * 0.54 + 0.8, planes: [
        { side: -1, run: 2.0, pitch: 0.40, ridgeY: 4.40, centerZ: 0, slopeDirection: '-z', drainageTargetId: 'south-exterior-channel' },
        { side: 1, run: 2.0, pitch: 0.40, ridgeY: 4.40, centerZ: 0, slopeDirection: '+z', drainageTargetId: 'courtyard-south-channel' },
      ] }],
    },
    {
      id: 'mainGalleryLeanTo', buildingUnitId: 'YKY-main-gallery-daxia', roofType: 'main-gallery-lean-to',
      sections: [{ id: 'main-gallery', position: [0, 0, galleryZ], span: courtyardW + 1.1, planes: [
        { side: -1, run: 1.60, pitch: 0.531, ridgeY: 4.05, centerZ: 0, slopeDirection: '-z', drainageTargetId: 'courtyard-main-gallery-channel' },
      ] }],
    },
    {
      id: 'sideGalleryLeanTo', buildingUnitId: 'YKY-side-gallery-xiaoxia', roofType: 'compound-side-gallery-lean-to',
      sections: [
        { id: 'west-xiaoxia', position: [-courtyardW / 2 - 0.55, 0, 0.15], rotationY: Math.PI / 2, span: courtyardD + 1.2, planes: [{ side: 1, run: 1.10, pitch: 0.636, ridgeY: 3.45, centerZ: 0, slopeDirection: '+x', drainageTargetId: 'courtyard-west-xiaoxia' }] },
        { id: 'east-xiaoxia', position: [courtyardW / 2 + 0.55, 0, 0.15], rotationY: Math.PI / 2, span: courtyardD + 1.2, planes: [{ side: -1, run: 1.10, pitch: 0.636, ridgeY: 3.45, centerZ: 0, slopeDirection: '-x', drainageTargetId: 'courtyard-east-xiaoxia' }] },
        { id: 'south-xiaoxia', position: [0, 0, -D / 2 + 2.25], span: courtyardW + 1.1, planes: [{ side: 1, run: 1.10, pitch: 0.636, ridgeY: 3.45, centerZ: 0, slopeDirection: '+z', drainageTargetId: 'courtyard-south-xiaoxia' }] },
      ],
    },
    {
      id: 'gatehouseSmallRoof', buildingUnitId: 'YKY-gatehouse', roofType: 'small-double-pitch-gatehouse',
      sections: [{ id: 'gatehouse', position: [0, 0, -D / 2 - 0.02], span: 2.70, planes: [
        { side: -1, run: 0.75, pitch: 0.60, ridgeY: 2.75, centerZ: 0, slopeDirection: '-z', drainageTargetId: 'gatehouse-exterior-drip' },
        { side: 1, run: 0.75, pitch: 0.60, ridgeY: 2.75, centerZ: 0, slopeDirection: '+z', drainageTargetId: 'gatehouse-courtyard-drip' },
      ] }],
    },
  ];
  specs.forEach((spec, index) => addRoofUnit(roofs, spec, options, materials, surfaceProfile, baseline, index));

  const visitor = createVisitor();
  actors.add(visitor);
  const stairRoute = stair.userData.routeLocal.map(([x, y, z]) => new THREE.Vector3(stair.position.x + x, stair.position.y + y, stair.position.z + z));
  const route = [
    new THREE.Vector3(0, 0.10, -D / 2 - 2.0),
    new THREE.Vector3(0, 0.10, -D / 2 - 0.25),
    new THREE.Vector3(0, 0.10, -D / 2 + 1.0),
    new THREE.Vector3(-1.1, 0.10, -2.4),
    ...stairRoute,
    new THREE.Vector3(-courtyardW / 2, p + options.floorHeight, galleryZ + 0.55),
  ];
  root.userData.visitorRoute = {
    points: route,
    pointArrays: route.map((point) => point.toArray()),
    entersThroughDoor: true,
    stairId: stair.userData.stairId,
    collisionContract: 'centerline-clear-of-wall-volumes',
    reachesUpperFloor: true,
    upperFloorElevationM: p + options.floorHeight,
    relativeUpperFloorM: options.floorHeight,
  };
  root.userData.visitorRoute.diagnostics = buildVisitorRouteDiagnostics(root, route);
  setVisitorProgress(root, 0);
  setOpeningProgress(root, 0);

  applyYunnanWallSurfaces(root, surfaceProfile, { seed: options.seed });
  registerYunnanRoofSurfaces(root, surfaceProfile);
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  root.userData.stats = computeStats(root);
  root.userData.surfaceProduction = {
    version: '5.5.0', baselineVersion: '5.4.4', baselineAvailable: true,
    baselineActive: baseline, profileId: surfaceProfile.id,
    actualRoofUnits: root.userData.roofSurfaceSystem.roofUnitCount,
    stairs: { flightStepCounts: [8, 8], totalRisers: 16, landingCount: 3, totalRiseM: options.floorHeight },
    doorsAndWindowsInteractive: true, visitorRoutePreserved: true,
    unresolvedEvidence: [
      'panTileLongitudinalOverlap', 'tileCourseCenterSpacing', 'coverTileSeamOverlap',
      'underlayMaterialAndFixing', 'residentialRidgeClosure',
    ],
  };
  root.userData.actions = {
    setOpenings: (value) => setOpeningProgress(root, value),
    setVisitor: (value) => setVisitorProgress(root, value),
    setRoofExploded: (value) => {
      const result = setYunnanRoofExploded(root, value);
      root.userData.runtimeState.roofExploded = Boolean(value);
      return result;
    },
    setWallLayerMode: (mode) => {
      const result = setYunnanWallLayerMode(root, mode);
      root.userData.runtimeState.wallLayerMode = mode;
      return result;
    },
  };
  return root;
}

export function disposeYunnanCourtyardPrototype(root) {
  if (!root) return;
  const materialSet = root.userData?.materialSet;
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
    else if (object.material) materials.add(object.material);
    (object.userData?.ownedMaterials || []).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose?.());
  disposeYunnanMaterialSet(materialSet);
  root.clear();
}
