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
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function cylinderTransformRecord(start, end, radius, semantic = {}) {
  const delta = end.clone().sub(start);
  return {
    position: start.clone().add(end).multiplyScalar(0.5).toArray(),
    quaternion: new THREE.Quaternion().setFromUnitVectors(UP, delta.clone().normalize()).toArray(),
    scale: [radius, delta.length(), radius],
    semantic,
  };
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
  // Six transverse arc spans preserve a readable pan/cover silhouette while
  // keeping every tile a closed shell. The former ten-span shell spent 84
  // triangles per instance, most of them below the rendered tile width.
  const segments = 6;
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
  geometry.userData = {
    tileKind: kind,
    closedShell: true,
    transverseArcSegments: segments,
    dimensionsM: { width, length, thickness },
  };
  return geometry;
}

/** A separate ceramic face plate at the exposed end of a cover-tile neck. */
function createHookHeadGeometry(width, height, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.50, -height * 0.12);
  shape.lineTo(-width * 0.50, height * 0.10);
  shape.quadraticCurveTo(-width * 0.42, height * 0.50, 0, height * 0.54);
  shape.quadraticCurveTo(width * 0.42, height * 0.50, width * 0.50, height * 0.10);
  shape.lineTo(width * 0.50, -height * 0.12);
  shape.quadraticCurveTo(width * 0.24, -height * 0.48, 0, -height * 0.54);
  shape.quadraticCurveTo(-width * 0.24, -height * 0.48, -width * 0.50, -height * 0.12);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    // Three curve subdivisions keep the silhouette round at this small scale.
    // Removing the sub-pixel bevel cuts this repeated plate from 140 to 52
    // triangles without replacing the physical front plate with a decal.
    curveSegments: 3,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.userData = {
    geometryRole: 'cover-tile-hook-head',
    frontPlate: true,
    dimensionsM: { width, height, depth },
  };
  return geometry;
}

function createSharedRoofGeometries(options, baseline) {
  const tileWidth = options.tileWidth;
  const tileLength = options.tileLength;
  const tileThickness = options.tileThickness;
  const coverWidth = baseline ? tileWidth * 0.92 : tileWidth * 0.48;
  return {
    panGeometry: createTileGeometry(tileWidth, tileLength, 'pan', tileThickness),
    coverGeometry: createTileGeometry(coverWidth, tileLength * (baseline ? 0.94 : 0.98), 'cover', tileThickness),
    dripGeometry: createTileGeometry(tileWidth * 0.92, tileLength * 0.52, 'pan', tileThickness * 1.1),
    hookNeckGeometry: createTileGeometry(coverWidth * 1.08, tileLength * 0.48, 'cover', tileThickness * 1.15),
    hookHeadGeometry: createHookHeadGeometry(coverWidth * 1.18, coverWidth * 1.12, tileThickness * 2.8),
    unitBoxGeometry: new THREE.BoxGeometry(1, 1, 1),
    unitCylinderGeometry: new THREE.CylinderGeometry(1, 1, 1, 12),
    unitRidgeCapGeometry: new THREE.SphereGeometry(1, 10, 8),
  };
}

function addWall(group, x, y, z, width, depth, height, materials, data = {}) {
  const wall = mesh(createBatteredWallGeometry(width, depth, height, data.taper ?? 0.12), materials.wall, {
    type: 'weathered-earth-wall',
    semanticRole: 'wall-core',
    surfaceHostKind: data.surfaceHostKind || 'battered-wall',
    foundationBearing: data.foundationBearing !== false,
    componentId: data.componentId || data.type,
    dimensionsM: { width, depth, height, taper: data.taper ?? 0.12 },
    evidenceRule: 'TJ001-MAT-EARTH-WALL-WEATHERED',
    ...data,
  });
  wall.position.set(x, y, z);
  group.add(wall);
  return wall;
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .map(([start, end]) => [Math.min(start, end), Math.max(start, end)])
    .sort((left, right) => left[0] - right[0]);
  const merged = [];
  sorted.forEach(([start, end]) => {
    const last = merged.at(-1);
    if (!last || start > last[1] + 1e-6) merged.push([start, end]);
    else last[1] = Math.max(last[1], end);
  });
  return merged;
}

/** Produce real wall solids around rectangular door or window apertures. */
function addWallWithOpenings(group, spec, materials, data = {}) {
  const {
    orientation = 'x', centerAlong = 0, fixed = 0, baseY = 0,
    span, thickness, height, taper = 0.12, openings = [],
  } = spec;
  const cuts = [...new Set([
    0, height,
    ...openings.flatMap((opening) => [opening.bottomOffset, opening.bottomOffset + opening.height]),
  ].map((value) => THREE.MathUtils.clamp(value, 0, height)))].sort((a, b) => a - b);
  const facadeId = data.componentId || 'WALL';
  const facade = tag(new THREE.Group(), {
    type: `${data.type || 'wall'}-opening-host`, semanticRole: 'opening-host',
    componentId: facadeId, openingIds: openings.map((opening) => opening.id),
  });
  facade.name = `openingHost_${facadeId}`;
  for (let bandIndex = 0; bandIndex < cuts.length - 1; bandIndex += 1) {
    const y0 = cuts[bandIndex];
    const y1 = cuts[bandIndex + 1];
    const bandHeight = y1 - y0;
    if (bandHeight <= 1e-5) continue;
    const bandMid = (y0 + y1) / 2;
    const blocked = mergeIntervals(openings
      .filter((opening) => bandMid > opening.bottomOffset + 1e-6
        && bandMid < opening.bottomOffset + opening.height - 1e-6)
      .map((opening) => [opening.along - opening.width / 2, opening.along + opening.width / 2]));
    const solids = [];
    let cursor = -span / 2;
    blocked.forEach(([start, end]) => {
      if (start > cursor + 0.035) solids.push([cursor, start]);
      cursor = Math.max(cursor, end);
    });
    if (cursor < span / 2 - 0.035) solids.push([cursor, span / 2]);
    const midScale = Math.max(0.1, (span - taper * 2 * bandMid / height) / span);
    solids.forEach(([rawStart, rawEnd], intervalIndex) => {
      const start = rawStart * midScale;
      const end = rawEnd * midScale;
      const segmentSpan = end - start;
      if (segmentSpan <= 0.05) return;
      const along = centerAlong + (start + end) / 2;
      const componentId = `${facadeId}-B${bandIndex + 1}-S${intervalIndex + 1}`;
      const segmentData = {
        ...data,
        type: `${data.type || 'wall'}-opening-segment`, componentId, facadeId,
        surfaceHostKind: 'facade-segment', foundationBearing: y0 <= 1e-6,
        openingIds: openings.map((opening) => opening.id),
        taper: Math.min(segmentSpan * 0.18, taper * bandHeight / height),
      };
      if (orientation === 'x') {
        addWall(facade, along, baseY + y0, fixed, segmentSpan, thickness, bandHeight, materials, segmentData);
      } else {
        addWall(facade, fixed, baseY + y0, along, thickness, segmentSpan, bandHeight, materials, segmentData);
      }
    });
  }
  group.add(facade);
  return facade;
}

function addGable(group, x, y, z, width, depth, height, materials, data = {}) {
  const gable = mesh(createGableGeometry(width, depth, height), materials.wall, {
    type: 'weathered-earth-gable',
    semanticRole: 'wall-core',
    surfaceHostKind: 'gable',
    foundationBearing: false,
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
  const componentId = data.componentId || data.type || 'DOOR';
  const hostId = data.hostId || 'WALL-SOUTH-GATE';
  const maxAngleRad = Math.PI * 0.47;
  const assembly = tag(new THREE.Group(), {
    type: 'timber-door-assembly', openingKind: 'door', openingProgress: 0,
    maxAngleRad, componentId, hostId, openingState: 'closed', apertureM: { width, height },
    openingEnvelopeLocal: { min: [-width / 2, 0, -0.30], max: [width / 2, height, 0.30] },
    ...data,
  });
  assembly.name = `door_${data.type || 'assembly'}`;
  assembly.position.set(x, y, z);
  const recess = box(width + 0.18, height + 0.18, 0.12, materials.opening, {
    type: 'deep-door-opening', componentId: `${componentId}-RECESS`, openingId: componentId, hostId,
  });
  recess.position.set(0, height / 2, -0.05);
  assembly.add(recess);
  const leafWidth = width / 2 - 0.035;
  const pivots = [];
  for (const side of [-1, 1]) {
    const sideName = side < 0 ? 'LEFT' : 'RIGHT';
    const leafId = `${componentId}-${sideName}-LEAF`;
    const openAngleRad = -side * maxAngleRad;
    const pivot = tag(new THREE.Group(), {
      type: 'door-leaf-pivot', semanticRole: 'opening-hinge', side,
      componentId: `${leafId}-PIVOT`, openingId: componentId, hostId,
      axisLocal: [0, 1, 0], closedAngleRad: 0, openAngleRad, currentAngleRad: 0,
      angleRangeRad: [Math.min(0, openAngleRad), Math.max(0, openAngleRad)], state: 'closed',
    });
    pivot.position.set(side * width / 2, 0, -0.12);
    const leaf = box(leafWidth, height - 0.12, 0.08, materials.doorLeaf, {
      type: '板门-door-leaf', semanticRole: 'opening-leaf', collisionRole: 'opening-leaf',
      componentId: leafId, openingId: componentId, hostId, side, openingSurfaceRole: 'doorLeaf',
      collisionEnvelopeLocal: {
        min: [side < 0 ? 0 : -leafWidth, 0.06, -0.04],
        max: [side < 0 ? leafWidth : 0, height - 0.06, 0.04],
      },
    });
    leaf.position.set(-side * leafWidth / 2, height / 2, 0);
    pivot.add(leaf);
    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      const panel = box(leafWidth * 0.72, height * 0.19, 0.026, materials.doorLeaf, {
        type: 'door-panel-inset', componentId: `${leafId}-PANEL-${rowIndex + 1}`,
        openingId: componentId, hostId, openingSurfaceRole: 'doorLeaf',
      });
      panel.position.set(-side * leafWidth / 2, 0.38 + rowIndex * 0.57, -0.052);
      pivot.add(panel);
    }
    if (side === 1) {
      const replacement = box(leafWidth * 0.14, height * 0.36, 0.035, materials.replacementTimber, {
        type: 'door-replacement-cleat', componentId: `${leafId}-REPLACEMENT-CLEAT`,
        openingId: componentId, hostId, openingSurfaceRole: 'replacementPart', repairChronology: 'later-replacement',
      });
      replacement.position.set(-side * leafWidth * 0.28, height * 0.62, -0.065);
      pivot.add(replacement);
    }
    assembly.add(pivot);
    pivots.push(pivot);
  }
  assembly.userData.pivots = pivots;
  const jambL = box(0.12, height + 0.18, 0.16, materials.openingFrame, {
    type: 'door-jamb', componentId: `${componentId}-JAMB-LEFT`, openingId: componentId, hostId,
    openingSurfaceRole: 'openingFrame',
  });
  const jambR = jambL.clone();
  jambR.userData = { ...jambL.userData, componentId: `${componentId}-JAMB-RIGHT` };
  jambL.position.set(-width / 2 - 0.04, height / 2, -0.16);
  jambR.position.set(width / 2 + 0.04, height / 2, -0.16);
  const lintel = box(width + 0.28, 0.16, 0.18, materials.openingFrame, {
    type: 'door-lintel', componentId: `${componentId}-LINTEL`, openingId: componentId, hostId,
    openingSurfaceRole: 'openingFrame',
  });
  lintel.position.set(0, height + 0.04, -0.16);
  assembly.add(jambL, jambR, lintel);
  group.add(assembly);
  return assembly;
}

function addHighWindow(group, x, y, z, width, height, materials, data = {}) {
  const componentId = data.componentId || data.type || 'WINDOW';
  const hostId = data.hostId || null;
  const maxAngleRad = Math.PI * 0.38;
  const assembly = tag(new THREE.Group(), {
    type: 'small-high-window', openingKind: 'window', openingProgress: 0,
    maxAngleRad, componentId, hostId, openingState: 'closed', apertureM: { width, height },
    openingEnvelopeLocal: { min: [-width / 2, 0, -0.24], max: [width / 2, height, 0.24] },
    ...data,
  });
  assembly.name = `window_${data.type || 'assembly'}`;
  assembly.position.set(x, y, z);
  const recess = box(width, height, 0.10, materials.opening, {
    type: 'window-recess', componentId: `${componentId}-RECESS`, openingId: componentId, hostId,
  });
  recess.position.set(0, height / 2, 0);
  assembly.add(recess);
  const frame = 0.07;
  for (const [px, py, pw, ph, frameId] of [
    [-width / 2, height / 2, frame, height + frame, 'JAMB-LEFT'],
    [width / 2, height / 2, frame, height + frame, 'JAMB-RIGHT'],
    [0, 0, width + frame, frame, 'SILL'], [0, height, width + frame, frame, 'LINTEL'],
  ]) {
    const surfaceRole = py === 0 ? 'openingSill' : 'openingFrame';
    const bar = box(pw, ph, 0.14, surfaceRole === 'openingSill' ? materials.openingSill : materials.openingFrame, {
      type: surfaceRole === 'openingSill' ? 'weathered-window-sill' : 'small-window-frame',
      componentId: `${componentId}-${frameId}`, openingId: componentId, hostId, openingSurfaceRole: surfaceRole,
    });
    bar.position.set(px, py, -0.08);
    assembly.add(bar);
  }
  const pivot = tag(new THREE.Group(), {
    type: 'window-leaf-pivot', semanticRole: 'opening-hinge', side: -1,
    componentId: `${componentId}-LEAF-PIVOT`, openingId: componentId, hostId,
    axisLocal: [0, 1, 0], closedAngleRad: 0, openAngleRad: maxAngleRad,
    currentAngleRad: 0, angleRangeRad: [0, maxAngleRad], state: 'closed',
  });
  pivot.position.set(-width / 2, 0, -0.12);
  const shutter = box(width - 0.08, height - 0.08, 0.045, materials.windowLeaf, {
    type: 'operable-window-shutter', semanticRole: 'opening-leaf', collisionRole: 'opening-leaf',
    componentId: `${componentId}-LEAF`, openingId: componentId, hostId, openingSurfaceRole: 'windowLeaf',
    collisionEnvelopeLocal: { min: [0, 0.04, -0.023], max: [width - 0.08, height - 0.04, 0.023] },
  });
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
  const treadThickness = 0.10;
  const landingThickness = 0.12;
  const handrailHeight = options.handrailHeight || 0.86;
  const stepRise = totalRise / 16;
  const stepRun = run / 8;
  const middleElevation = totalRise / 2;
  const separation = width + gap;
  const firstX = -separation / 2;
  const secondX = separation / 2;
  const componentId = data.stairId || 'STAIR-WEST-01';
  const stairs = tag(new THREE.Group(), {
    type: '8+8-double-flight-daily-timber-stair', semanticRole: 'daily-use-dogleg-stair',
    componentId, stairId: componentId, flightStepCounts: [8, 8], totalRisers: 16,
    riserHeightM: stepRise, treadDepthM: stepRun, totalRiseM: totalRise,
    elevationsM: { lower: 0, middle: middleElevation, upper: totalRise },
    landingIds: [`${componentId}-LOWER`, `${componentId}-MIDDLE`, `${componentId}-UPPER`],
    handrailHeightM: handrailHeight, ...data,
  });
  stairs.name = `stair_${componentId}`;
  stairs.position.set(x, y, z);
  const routeAnchors = [];
  for (let i = 0; i < flightCount; i += 1) {
    const firstTop = stepRise * (i + 1);
    const firstZ = -run / 2 + stepRun * (i + 0.5);
    const firstId = `${componentId}-F1-T${String(i + 1).padStart(2, '0')}`;
    const first = box(width, treadThickness, stepRun + 0.045, materials.timber, {
      type: 'stair-tread', semanticRole: 'walkable-stair-tread', componentId: firstId,
      supportId: firstId, flight: 1, step: i + 1, walkable: true, topElevationLocalM: firstTop,
    });
    first.position.set(firstX, firstTop - treadThickness / 2, firstZ);
    stairs.add(first);
    routeAnchors.push({
      id: `${firstId}-ROUTE`, position: [firstX, firstTop, firstZ], supportId: firstId,
      stage: 'lower-flight', flight: 1, step: i + 1,
    });
    const secondTop = middleElevation + stepRise * (i + 1);
    const secondZ = run / 2 - stepRun * (i + 0.5);
    const secondId = `${componentId}-F2-T${String(i + 1).padStart(2, '0')}`;
    const second = box(width, treadThickness, stepRun + 0.045, materials.timber, {
      type: 'stair-tread', semanticRole: 'walkable-stair-tread', componentId: secondId,
      supportId: secondId, flight: 2, step: i + 1, walkable: true, topElevationLocalM: secondTop,
    });
    second.position.set(secondX, secondTop - treadThickness / 2, secondZ);
    stairs.add(second);
  }
  const lowerId = `${componentId}-LOWER`;
  const middleId = `${componentId}-MIDDLE`;
  const upperId = `${componentId}-UPPER`;
  const lower = box(width, landingThickness, landingDepth, materials.timber, {
    type: 'stair-lower-landing', semanticRole: 'walkable-stair-landing', componentId: lowerId,
    supportId: lowerId, landing: 'lower', walkable: true, topElevationLocalM: 0,
  });
  lower.position.set(firstX, -landingThickness / 2, -run / 2 - landingDepth / 2);
  const middle = box(width * 2 + gap, landingThickness, landingDepth, materials.timber, {
    type: 'stair-intermediate-landing', semanticRole: 'walkable-stair-landing', componentId: middleId,
    supportId: middleId, landing: 'middle', walkable: true, topElevationLocalM: middleElevation,
  });
  middle.position.set(0, middleElevation - landingThickness / 2, run / 2 + landingDepth / 2);
  const upper = box(width, landingThickness, landingDepth, materials.timber, {
    type: 'stair-upper-landing', semanticRole: 'walkable-stair-landing', componentId: upperId,
    supportId: upperId, landing: 'upper', walkable: true, topElevationLocalM: totalRise,
  });
  upper.position.set(secondX, totalRise - landingThickness / 2, -run / 2 - landingDepth / 2);
  stairs.add(lower, middle, upper);

  routeAnchors.unshift({
    id: `${lowerId}-ROUTE`, position: [firstX, 0, -run / 2 - landingDepth / 2],
    supportId: lowerId, stage: 'lower-landing',
  });
  routeAnchors.push({
    id: `${middleId}-IN`, position: [firstX, middleElevation, run / 2 + landingDepth / 2],
    supportId: middleId, stage: 'middle-landing',
  });
  routeAnchors.push({
    id: `${middleId}-OUT`, position: [secondX, middleElevation, run / 2 + landingDepth / 2],
    supportId: middleId, stage: 'middle-landing',
  });
  for (let i = 0; i < flightCount; i += 1) {
    const secondTop = middleElevation + stepRise * (i + 1);
    const secondZ = run / 2 - stepRun * (i + 0.5);
    const secondId = `${componentId}-F2-T${String(i + 1).padStart(2, '0')}`;
    routeAnchors.push({
      id: `${secondId}-ROUTE`, position: [secondX, secondTop, secondZ], supportId: secondId,
      stage: 'upper-flight', flight: 2, step: i + 1,
    });
  }
  routeAnchors.push({
    id: `${upperId}-ROUTE`, position: [secondX, totalRise, -run / 2 - landingDepth / 2],
    supportId: upperId, stage: 'upper-landing',
  });

  for (const xOffset of [-width * 0.30, width * 0.30]) {
    const firstStringer = cylinderBetween(
      new THREE.Vector3(firstX + xOffset, stepRise - 0.16, -run / 2),
      new THREE.Vector3(firstX + xOffset, middleElevation - 0.16, run / 2),
      0.065, materials.timber, {
        type: 'stair-stringer-support', semanticRole: 'stair-structure',
        componentId: `${componentId}-F1-STRINGER-${xOffset < 0 ? 'L' : 'R'}`, flight: 1,
      }, 10,
    );
    const secondStringer = cylinderBetween(
      new THREE.Vector3(secondX + xOffset, middleElevation + stepRise - 0.16, run / 2),
      new THREE.Vector3(secondX + xOffset, totalRise - 0.16, -run / 2),
      0.065, materials.timber, {
        type: 'stair-stringer-support', semanticRole: 'stair-structure',
        componentId: `${componentId}-F2-STRINGER-${xOffset < 0 ? 'L' : 'R'}`, flight: 2,
      }, 10,
    );
    stairs.add(firstStringer, secondStringer);
  }

  const handrailSegments = [];
  const addHandrail = (start, end, id, role = 'flight') => {
    addRail(stairs, start, end, materials, {
      type: 'stair-handrail-segment', semanticRole: 'stair-handrail', collisionRole: 'stair-rail',
      componentId: id, handrailRole: role, startLocal: start.toArray(), endLocal: end.toArray(),
    });
    handrailSegments.push({ componentId: id, start: start.toArray(), end: end.toArray(), role });
  };
  const addPost = (position, supportY, id) => {
    const post = cylinder(0.035, handrailHeight, materials.timber, {
      type: 'stair-handrail-post', semanticRole: 'stair-handrail-support', collisionRole: 'stair-rail',
      componentId: id, baseLocal: [position.x, supportY, position.z],
      topLocal: [position.x, supportY + handrailHeight, position.z],
    }, 10);
    post.position.set(position.x, supportY + handrailHeight / 2, position.z);
    stairs.add(post);
  };

  for (const edge of [-1, 1]) {
    const railX = firstX + edge * width / 2;
    addHandrail(
      new THREE.Vector3(railX, handrailHeight, -run / 2),
      new THREE.Vector3(railX, middleElevation + handrailHeight, run / 2),
      `${componentId}-F1-RAIL-${edge < 0 ? 'L' : 'R'}`,
    );
    const secondRailX = secondX + edge * width / 2;
    addHandrail(
      new THREE.Vector3(secondRailX, middleElevation + handrailHeight, run / 2),
      new THREE.Vector3(secondRailX, totalRise + handrailHeight, -run / 2),
      `${componentId}-F2-RAIL-${edge < 0 ? 'L' : 'R'}`,
    );
    for (let i = 0; i <= flightCount; i += 2) {
      addPost(
        new THREE.Vector3(railX, 0, -run / 2 + stepRun * i),
        stepRise * i,
        `${componentId}-F1-POST-${edge}-${i}`,
      );
      addPost(
        new THREE.Vector3(secondRailX, 0, run / 2 - stepRun * i),
        middleElevation + stepRise * i,
        `${componentId}-F2-POST-${edge}-${i}`,
      );
    }
  }

  const firstInner = firstX + width / 2;
  const secondInner = secondX - width / 2;
  addHandrail(
    new THREE.Vector3(firstInner, middleElevation + handrailHeight, run / 2),
    new THREE.Vector3(secondInner, middleElevation + handrailHeight, run / 2),
    `${componentId}-MIDDLE-INNER-CONNECTOR`, 'middle-connector',
  );
  const backZ = run / 2 + landingDepth;
  const firstOuter = firstX - width / 2;
  const secondOuter = secondX + width / 2;
  addHandrail(
    new THREE.Vector3(firstOuter, middleElevation + handrailHeight, run / 2),
    new THREE.Vector3(firstOuter, middleElevation + handrailHeight, backZ),
    `${componentId}-MIDDLE-OUTER-L`, 'middle-connector',
  );
  addHandrail(
    new THREE.Vector3(firstOuter, middleElevation + handrailHeight, backZ),
    new THREE.Vector3(secondOuter, middleElevation + handrailHeight, backZ),
    `${componentId}-MIDDLE-OUTER-BACK`, 'middle-connector',
  );
  addHandrail(
    new THREE.Vector3(secondOuter, middleElevation + handrailHeight, backZ),
    new THREE.Vector3(secondOuter, middleElevation + handrailHeight, run / 2),
    `${componentId}-MIDDLE-OUTER-R`, 'middle-connector',
  );
  for (const railX of [firstX - width / 2, firstX + width / 2]) {
    addHandrail(
      new THREE.Vector3(railX, handrailHeight, -run / 2 - landingDepth),
      new THREE.Vector3(railX, handrailHeight, -run / 2),
      `${componentId}-LOWER-RAIL-${railX < firstX ? 'L' : 'R'}`, 'lower-landing',
    );
    addPost(new THREE.Vector3(railX, 0, -run / 2 - landingDepth), 0, `${componentId}-LOWER-POST-${railX}`);
  }
  const upperLeftRailX = secondX - width / 2;
  const upperRightRailX = secondX + width / 2;
  const upperConnectorOuterX = upperRightRailX + 0.94;
  const upperSouthZ = -run / 2 - landingDepth;
  const upperNorthZ = -run / 2 + 0.85;
  addHandrail(
    new THREE.Vector3(upperLeftRailX, totalRise + handrailHeight, upperSouthZ),
    new THREE.Vector3(upperLeftRailX, totalRise + handrailHeight, -run / 2),
    `${componentId}-UPPER-RAIL-L`, 'upper-landing',
  );
  addHandrail(
    new THREE.Vector3(upperConnectorOuterX, totalRise + handrailHeight, upperSouthZ),
    new THREE.Vector3(upperConnectorOuterX, totalRise + handrailHeight, upperNorthZ),
    `${componentId}-UPPER-OUTER-RAIL`, 'upper-connector',
  );
  addHandrail(
    new THREE.Vector3(upperLeftRailX, totalRise + handrailHeight, upperSouthZ),
    new THREE.Vector3(upperConnectorOuterX, totalRise + handrailHeight, upperSouthZ),
    `${componentId}-UPPER-SOUTH-RAIL`, 'upper-connector',
  );
  for (const [postX, postZ, postId] of [
    [upperLeftRailX, upperSouthZ, 'UPPER-L'],
    [upperConnectorOuterX, upperSouthZ, 'UPPER-OUTER-S'],
    [upperConnectorOuterX, upperNorthZ, 'UPPER-OUTER-N'],
  ]) {
    addPost(new THREE.Vector3(postX, 0, postZ), totalRise, `${componentId}-${postId}-POST`);
  }

  for (const [postX, postZ, topY, id] of [
    [firstX - width / 2, backZ, middleElevation, 'MIDDLE-L'],
    [secondX + width / 2, backZ, middleElevation, 'MIDDLE-R'],
    [secondX - width / 2, -run / 2 - landingDepth, totalRise, 'UPPER-L'],
    [secondX + width / 2, -run / 2 - landingDepth, totalRise, 'UPPER-R'],
  ]) {
    const supportHeight = Math.max(0.15, topY - 0.08);
    const support = box(0.11, supportHeight, 0.11, materials.timber, {
      type: 'stair-support-post', semanticRole: 'stair-structure', componentId: `${componentId}-${id}-SUPPORT`,
    });
    support.position.set(postX, supportHeight / 2, postZ);
    stairs.add(support);
  }

  stairs.userData.routeAnchors = routeAnchors;
  stairs.userData.routeLocal = routeAnchors.map((anchor) => anchor.position);
  stairs.userData.handrailSegments = handrailSegments;
  stairs.userData.handrailSegmentCount = handrailSegments.length;
  stairs.userData.railContinuityContract = {
    source: 'actual-segment-endpoints', toleranceM: 0.015,
    requiredJunctions: ['lower-to-flight1', 'flight1-to-middle', 'middle-to-flight2', 'flight2-to-upper'],
  };
  group.add(stairs);
  return stairs;
}

function addStoneFloor(group, width, depth, materials, data = {}) {
  const floor = tag(new THREE.Group(), { type: 'irregular-stone-slab-courtyard', ...data });
  const supportId = data.componentId || 'COURTYARD-STONE-FLOOR';
  const mortarBed = box(width, 0.06, depth, materials.stone, {
    type: 'courtyard-stone-support-bed', semanticRole: 'walkable-courtyard-bed',
    componentId: `${supportId}-SUPPORT-BED`, supportId, walkable: true,
  });
  mortarBed.position.y = 0.04;
  floor.add(mortarBed);
  const step = 0.68;
  let slabIndex = 0;
  for (let x = -width / 2 + step / 2; x < width / 2; x += step) {
    for (let z = -depth / 2 + step / 2; z < depth / 2; z += step) {
      const slab = box(step * 0.93, 0.07, step * 0.93, materials.stone, {
        type: 'stone-slab', semanticRole: 'walkable-floor', componentId: `${supportId}-SLAB-${slabIndex + 1}`,
        supportId, walkable: true,
      });
      slab.position.set(x + ((Math.floor((z + depth) * 7) % 3) - 1) * 0.025, 0.035, z);
      slab.rotation.y = ((Math.floor((x + width) * 5) + Math.floor((z + depth) * 4)) % 5) * 0.025;
      floor.add(slab);
      slabIndex += 1;
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

/** Compose the roof rotation as Qy x Qx so a rotated section keeps its local pitch. */
function composeSlopeQuaternion(sectionRotationY, slopeAngle, yawJitter = 0, roll = 0) {
  const section = new THREE.Quaternion().setFromAxisAngle(UP, sectionRotationY + yawJitter);
  const slope = new THREE.Quaternion().setFromAxisAngle(X_AXIS, slopeAngle);
  const result = section.multiply(slope);
  if (roll) result.multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, roll));
  return result.normalize();
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function tileCrossSectionCurvature(geometry) {
  const position = geometry?.getAttribute?.('position');
  if (!position || !geometry.userData?.tileKind || position.count < 12) return null;
  const row = Math.floor(position.count / 4);
  const center = Math.floor(row / 2);
  return position.getY(center) - (position.getY(0) + position.getY(row - 1)) / 2;
}

function geometryHasClosedTriangleShell(geometry) {
  const index = geometry?.index;
  if (!index || index.count % 3 !== 0) return false;
  const edges = new Map();
  const addEdge = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edges.set(key, (edges.get(key) || 0) + 1);
  };
  for (let offset = 0; offset < index.count; offset += 3) {
    const a = index.getX(offset);
    const b = index.getX(offset + 1);
    const c = index.getX(offset + 2);
    addEdge(a, b); addEdge(b, c); addEdge(c, a);
  }
  return edges.size > 0 && [...edges.values()].every((count) => count === 2);
}

function boxAudit(box3) {
  if (!box3 || box3.isEmpty()) return null;
  const size = box3.getSize(new THREE.Vector3());
  return {
    min: box3.min.toArray(),
    max: box3.max.toArray(),
    sizeM: size.toArray(),
    volumeM3: size.x * size.y * size.z,
  };
}

/** Read the actual InstancedMesh matrices and transformed geometry bounds. */
function sampleInstanceBatches(batches) {
  const samples = [];
  const localMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  for (const batch of batches.filter(Boolean)) {
    batch.updateWorldMatrix(true, false);
    batch.geometry.computeBoundingBox();
    const localLength = batch.geometry.boundingBox.max.z - batch.geometry.boundingBox.min.z;
    const semantics = batch.userData.instanceMap || [];
    for (let index = 0; index < batch.count; index += 1) {
      batch.getMatrixAt(index, localMatrix);
      worldMatrix.multiplyMatrices(batch.matrixWorld, localMatrix);
      const across = new THREE.Vector3().setFromMatrixColumn(worldMatrix, 0);
      const course = new THREE.Vector3().setFromMatrixColumn(worldMatrix, 2);
      const courseScale = course.length();
      const bounds = batch.geometry.boundingBox.clone().applyMatrix4(worldMatrix);
      samples.push({
        ...(semantics[index] || {}),
        batchType: batch.userData.type,
        matrixIndex: index,
        position: new THREE.Vector3().setFromMatrixPosition(worldMatrix),
        acrossAxis: across.normalize(),
        courseAxis: course.normalize(),
        effectiveLengthM: localLength * courseScale,
        geometry: batch.geometry,
        bounds,
        matrixFinite: worldMatrix.elements.every(Number.isFinite),
      });
    }
  }
  return samples;
}

function unionSampleBounds(samples) {
  const bounds = new THREE.Box3();
  for (const sample of samples) bounds.union(sample.bounds);
  return boxAudit(bounds);
}

function auditSlopeGeometry({
  panBatches, coverBatches, dripBatches, hookBatches, verticalRidgeBatches,
  expectedDownhillWorld, expectedPitch, expectedTileVerticalComponent,
}) {
  const pans = sampleInstanceBatches(panBatches);
  const covers = sampleInstanceBatches(coverBatches);
  const drips = sampleInstanceBatches(dripBatches);
  const hooks = sampleInstanceBatches(hookBatches);
  const verticalRidges = sampleInstanceBatches(verticalRidgeBatches);
  const stablePans = pans.filter((sample) => sample.state !== 'broken');
  const stableCovers = covers.filter((sample) => sample.state !== 'broken');

  const panByColumn = new Map();
  for (const sample of pans) {
    if (!panByColumn.has(sample.columnIndex)) panByColumn.set(sample.columnIndex, []);
    panByColumn.get(sample.columnIndex).push(sample);
  }
  for (const path of panByColumn.values()) path.sort((a, b) => a.courseIndex - b.courseIndex);
  const longestPath = [...panByColumn.values()].sort((a, b) => b.length - a.length)[0] || [];
  const downhillVector = longestPath.length > 1
    ? longestPath[longestPath.length - 1].position.clone().sub(longestPath[0].position).normalize()
    : new THREE.Vector3();
  const downhillHorizontal = downhillVector.clone().setY(0).normalize();
  const horizontalRun = Math.hypot(downhillVector.x, downhillVector.z);
  const measuredPitch = horizontalRun > 1e-9 ? Math.abs(downhillVector.y) / horizontalRun : null;
  const expectedDirection = expectedDownhillWorld.clone().normalize();

  const courseSpacings = [];
  const drainageFalls = [];
  let monotonicPathCount = 0;
  for (const path of panByColumn.values()) {
    let monotonic = path.length > 1;
    for (let index = 1; index < path.length; index += 1) {
      const previous = path[index - 1];
      const current = path[index];
      const delta = current.position.clone().sub(previous.position);
      const courseGap = Math.max(1, current.courseIndex - previous.courseIndex);
      courseSpacings.push(delta.length() / courseGap);
      drainageFalls.push((previous.position.y - current.position.y) / courseGap);
      if (current.position.y >= previous.position.y || delta.dot(expectedDirection) <= 0) monotonic = false;
    }
    if (monotonic) monotonicPathCount += 1;
  }

  const stableTiles = [...stablePans, ...stableCovers];
  const tangentAlignments = stableTiles
    .map((sample) => Math.abs(sample.courseAxis.dot(expectedDirection)))
    .filter(Number.isFinite);
  const verticalComponents = stableTiles.map((sample) => Math.abs(sample.courseAxis.y)).filter(Number.isFinite);
  const panLookup = new Map(stablePans.map((sample) => [`${sample.courseIndex}:${sample.columnIndex}`, sample]));
  const seamErrors = [];
  const courseOffsets = [];
  for (const cover of stableCovers) {
    const left = panLookup.get(`${cover.courseIndex}:${cover.columnIndex}`);
    const right = panLookup.get(`${cover.courseIndex}:${cover.columnIndex + 1}`);
    if (!left || !right) continue;
    const midpoint = left.position.clone().add(right.position).multiplyScalar(0.5);
    const delta = cover.position.clone().sub(midpoint);
    seamErrors.push(Math.abs(delta.dot(left.acrossAxis)));
    courseOffsets.push(Math.abs(delta.dot(downhillHorizontal)));
  }

  const dripByColumn = new Map(drips.map((sample) => [sample.columnIndex, sample]));
  let eaveTerminationCount = 0;
  const eaveCrossErrors = [];
  for (const [column, path] of panByColumn.entries()) {
    if (!path.length || !dripByColumn.has(column)) continue;
    const last = path[path.length - 1];
    const drip = dripByColumn.get(column);
    const delta = drip.position.clone().sub(last.position);
    if (delta.dot(expectedDirection) > 0 && drip.position.y < last.position.y) eaveTerminationCount += 1;
    eaveCrossErrors.push(Math.abs(delta.dot(last.acrossAxis)));
  }

  const panGeometry = stablePans[0]?.geometry || pans[0]?.geometry;
  const coverGeometry = stableCovers[0]?.geometry || covers[0]?.geometry;
  const hookGeometry = hooks[0]?.geometry;
  if (hookGeometry) hookGeometry.computeBoundingBox();
  const hookSize = hookGeometry
    ? hookGeometry.boundingBox.getSize(new THREE.Vector3())
    : new THREE.Vector3();
  const hookVertexCount = hookGeometry?.getAttribute?.('position')?.count || 0;
  const courseSpacingM = median(courseSpacings);
  const effectiveTileLengthM = median(stablePans.map((sample) => sample.effectiveLengthM));
  const actualOverlapM = courseSpacingM === null || effectiveTileLengthM === null
    ? null
    : effectiveTileLengthM - courseSpacingM;
  const allSamples = [...pans, ...covers, ...drips, ...hooks, ...verticalRidges];
  return {
    evidenceSource: 'actual-instance-matrices-buffer-geometry-and-world-bounds',
    rotationComposition: 'Qy*Qx',
    panInstanceCount: pans.length,
    coverInstanceCount: covers.length,
    dripInstanceCount: drips.length,
    hookHeadInstanceCount: hooks.length,
    verticalRidgeTileInstanceCount: verticalRidges.length,
    instanceMatrixCount: allSamples.length,
    allInstanceMatricesFinite: allSamples.length > 0 && allSamples.every((sample) => sample.matrixFinite),
    panGeometryClosedShell: geometryHasClosedTriangleShell(panGeometry),
    coverGeometryClosedShell: geometryHasClosedTriangleShell(coverGeometry),
    panGeometryVertexCount: panGeometry?.getAttribute?.('position')?.count || 0,
    coverGeometryVertexCount: coverGeometry?.getAttribute?.('position')?.count || 0,
    panGeometryTriangleCount: panGeometry?.index?.count ? panGeometry.index.count / 3 : 0,
    coverGeometryTriangleCount: coverGeometry?.index?.count ? coverGeometry.index.count / 3 : 0,
    panTransverseArcSegments: panGeometry?.userData?.transverseArcSegments || 0,
    coverTransverseArcSegments: coverGeometry?.userData?.transverseArcSegments || 0,
    panCrossSectionCurvatureM: tileCrossSectionCurvature(panGeometry),
    coverCrossSectionCurvatureM: tileCrossSectionCurvature(coverGeometry),
    hookHeadVertexCount: hookVertexCount,
    hookHeadDimensionsM: hookSize.toArray(),
    hookHeadFrontPlate: hookVertexCount >= 20
      && hookSize.x > hookSize.z * 1.75
      && hookSize.y > hookSize.z * 1.75,
    expectedPitch,
    measuredPitch,
    expectedDownhillVectorWorld: expectedDirection.toArray(),
    downhillVectorWorld: downhillVector.toArray(),
    drainageDirectionDot: downhillVector.dot(expectedDirection),
    expectedTileVerticalComponent,
    minTileVerticalComponent: verticalComponents.length ? Math.min(...verticalComponents) : null,
    minTileSlopeAlignment: tangentAlignments.length ? Math.min(...tangentAlignments) : null,
    courseSpacingSampleCount: courseSpacings.length,
    medianCourseSpacingM: courseSpacingM,
    effectiveTileLengthM,
    longitudinalOverlapM: actualOverlapM,
    seamSampleCount: seamErrors.length,
    seamAlignmentMaxErrorM: seamErrors.length ? Math.max(...seamErrors) : null,
    coverCourseOffsetMaxM: courseOffsets.length ? Math.max(...courseOffsets) : null,
    drainagePathCount: panByColumn.size,
    monotonicDrainagePathCount: monotonicPathCount,
    minimumCourseFallM: drainageFalls.length ? Math.min(...drainageFalls) : null,
    eaveTerminationCount,
    eaveCrossAlignmentMaxErrorM: eaveCrossErrors.length ? Math.max(...eaveCrossErrors) : null,
    worldBounds: {
      pan: unionSampleBounds(pans),
      cover: unionSampleBounds(covers),
      eave: unionSampleBounds([...drips, ...hooks]),
      verticalRidge: unionSampleBounds(verticalRidges),
      all: unionSampleBounds(allSamples),
    },
  };
}

function makeInstanceBatch(records, geometry, material, data = {}) {
  if (!records.length) return null;
  const batch = tag(new THREE.InstancedMesh(geometry, material, records.length), { ...data, instanceCount: records.length });
  const dummy = new THREE.Object3D();
  records.forEach((record, index) => {
    dummy.position.fromArray(record.position);
    dummy.quaternion.identity();
    if (record.quaternion) dummy.quaternion.fromArray(record.quaternion);
    else if (record.rotation) dummy.rotation.set(...record.rotation);
    dummy.scale.fromArray(record.scale || [1, 1, 1]);
    dummy.updateMatrix();
    batch.setMatrixAt(index, dummy.matrix);
    if (record.color) batch.setColorAt(index, record.color);
  });
  batch.userData.instanceMap = records.map((record) => ({ ...(record.semantic || {}) }));
  batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  batch.instanceMatrix.needsUpdate = true;
  if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
  batch.computeBoundingBox();
  batch.computeBoundingSphere();
  return batch;
}

function addRoofUnit(parent, spec, options, materials, profile, baseline, roofIndex, roofGeometries) {
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
  const {
    panGeometry,
    coverGeometry,
    dripGeometry,
    hookNeckGeometry,
    hookHeadGeometry,
    unitBoxGeometry,
    unitCylinderGeometry,
    unitRidgeCapGeometry,
  } = roofGeometries;
  const slopes = [];
  const slopeGeometryAudits = [];
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
    const addSectionRidgeBatch = (records, geometry, data) => {
      const batch = makeInstanceBatch(records, geometry, materials.tileCover, {
        roofLayerId: 'ridgeAndClosures',
        roofUnitId: spec.id,
        sectionId: section.id,
        ...data,
      });
      if (batch) sectionRidge.add(batch);
      return batch;
    };
    let sectionVerticalRidgeTileCount = 0;
    let sectionVerticalRidgeRunCount = 0;
    let sectionVerticalRidgeEndClosureCount = 0;
    section.planes.forEach((plane, planeIndex) => {
      const slope = tag(new THREE.Group(), {
        type: 'roof-slope', slopeId: `${spec.id}:${section.id}:S${plane.side}`,
        sectionId: section.id, roofUnitId: spec.id, roofSide: plane.side,
        sectionRotationY, rotationComposition: 'Qy*Qx',
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
      let damagePatchDefinition = null;
      let repairPatchDefinition = null;
      let slopeMissing = 0;
      let slopeBroken = 0;
      let slopeRepair = 0;
      const slopeId = slope.userData.slopeId;
      const expectedDownhillWorld = new THREE.Vector3(0, -plane.pitch, plane.side)
        .applyAxisAngle(UP, sectionRotationY)
        .normalize();
      const expectedTileVerticalComponent = Math.sin(angle);

      for (let course = 0; course < courseCount; course += 1) {
        const distance = (course + 0.5) * courseStep;
        const panZ = plane.centerZ + plane.side * distance;
        const panY = plane.ridgeY - plane.pitch * distance + 0.055;
        for (let column = 0; column < panColumns; column += 1) {
          const state = baseline ? { missing: false, broken: false, repaired: false } : classifyTile(profile.roof || profile, roofIndex + sectionIndex, plane.side, course, column, courseCount, panColumns);
          const id = `${spec.id}:${section.id}:S${plane.side}:PAN:${course}:${column}`;
          damagePatchDefinition ||= state.damagePatch || null;
          repairPatchDefinition ||= state.repairPatch || null;
          if (state.missing) {
            missingIds.push(id); damagePatchIds.add(id); slopeMissing += 1; totalMissing += 1;
            instanceMap.push({ tileId: id, kind: 'pan', state: 'missing', slopeId, sectionId: section.id, courseIndex: course, columnIndex: column });
            continue;
          }
          const stateName = state.repaired ? 'repair' : state.broken ? 'broken' : 'aged';
          const yawJitter = stateName === 'broken' ? (seeded01(course, column, 3) - 0.5) * 0.12 : 0;
          const roll = stateName === 'broken' ? plane.side * 0.05 : 0;
          const record = {
            position: sectionPoint(panX(column), panY, panZ).toArray(),
            quaternion: composeSlopeQuaternion(sectionRotationY, plane.side * angle, yawJitter, roll).toArray(),
            scale: stateName === 'broken' ? [0.68, 0.72, 0.62] : [1, 1, 1],
            color: tileColor(profile.roof || profile, roofIndex, column, course, plane.side, stateName),
            semantic: { tileId: id, kind: 'pan', state: stateName, slopeId, sectionId: section.id, courseIndex: course, columnIndex: column },
          };
          panRecords[stateName].push(record);
          if (stateName === 'broken') { damagePatchIds.add(id); slopeBroken += 1; totalBroken += 1; }
          if (stateName === 'repair') { repairPatchIds.add(id); slopeRepair += 1; totalRepair += 1; }
          instanceMap.push({ tileId: id, kind: 'pan', state: stateName, slopeId, sectionId: section.id, courseIndex: course, columnIndex: column });
        }
        for (let column = 0; column < coverColumns; column += 1) {
          const coverDistance = baseline ? distance + courseStep * 0.23 : distance;
          const coverZ = plane.centerZ + plane.side * coverDistance;
          const coverY = plane.ridgeY - plane.pitch * coverDistance + 0.105;
          const state = baseline ? { missing: false, broken: false, repaired: false } : classifyTile(profile.roof || profile, roofIndex + sectionIndex, plane.side, course, column, courseCount, coverColumns);
          const id = `${spec.id}:${section.id}:S${plane.side}:COVER:${course}:${column}`;
          damagePatchDefinition ||= state.damagePatch || null;
          repairPatchDefinition ||= state.repairPatch || null;
          if (state.missing) {
            missingIds.push(id); damagePatchIds.add(id); slopeMissing += 1; totalMissing += 1;
            instanceMap.push({ tileId: id, kind: 'cover', state: 'missing', slopeId, sectionId: section.id, courseIndex: course, columnIndex: column });
            continue;
          }
          const stateName = state.repaired ? 'repair' : state.broken ? 'broken' : 'aged';
          const yawJitter = stateName === 'broken' ? (seeded01(column, course, 7) - 0.5) * 0.10 : 0;
          const record = {
            position: sectionPoint(coverX(column), coverY, coverZ).toArray(),
            quaternion: composeSlopeQuaternion(sectionRotationY, plane.side * angle, yawJitter).toArray(),
            scale: stateName === 'broken' ? [0.74, 0.76, 0.58] : [1, 1, 1],
            color: tileColor(profile.roof || profile, roofIndex, column + 0.5, course, plane.side, stateName),
            semantic: { tileId: id, kind: 'cover', state: stateName, slopeId, sectionId: section.id, courseIndex: course, columnIndex: column },
          };
          coverRecords[stateName].push(record);
          if (stateName === 'broken') { damagePatchIds.add(id); slopeBroken += 1; totalBroken += 1; }
          if (stateName === 'repair') { repairPatchIds.add(id); slopeRepair += 1; totalRepair += 1; }
          instanceMap.push({ tileId: id, kind: 'cover', state: stateName, slopeId, sectionId: section.id, courseIndex: course, columnIndex: column });
        }
      }

      const addBatch = (layer, records, geometry, material, data) => {
        const batch = makeInstanceBatch(records, geometry, material, {
          roofLayerId: layer.userData.roofLayerId,
          roofUnitId: spec.id,
          sectionId: section.id,
          ...data,
        });
        if (batch) layer.add(batch);
        return batch;
      };
      const stateCounts = (records) => Object.fromEntries(
        Object.entries(records).map(([state, values]) => [state, values.length]),
      );
      const panBatches = [addBatch(
        pans,
        [...panRecords.aged, ...panRecords.repair, ...panRecords.broken],
        panGeometry,
        materials.tilePan,
        {
          type: '板瓦-pan-instanced', tileKind: 'pan', state: 'per-instance',
          stateCounts: stateCounts(panRecords), slopeId,
        },
      )];
      const coverBatches = [addBatch(
        covers,
        [...coverRecords.aged, ...coverRecords.repair, ...coverRecords.broken],
        coverGeometry,
        materials.tileCover,
        {
          type: '筒瓦-cover-instanced', tileKind: 'cover', state: 'per-instance',
          stateCounts: stateCounts(coverRecords), slopeId,
        },
      )];

      const rafterCount = Math.max(5, Math.ceil(section.span / 0.48));
      const rafterRecords = [];
      for (let index = 0; index < rafterCount; index += 1) {
        rafterRecords.push({
          position: sectionPoint(
            -section.span / 2 + section.span * index / Math.max(1, rafterCount - 1),
            plane.ridgeY - plane.pitch * plane.run / 2 - 0.17,
            plane.centerZ + plane.side * plane.run / 2,
          ).toArray(),
          quaternion: composeSlopeQuaternion(sectionRotationY, plane.side * angle).toArray(),
          scale: [0.055, 0.075, slopeLength],
          semantic: { slopeId, sectionId: section.id, rafterIndex: index },
        });
      }
      addBatch(rafters, rafterRecords, unitBoxGeometry, materials.timber, {
        type: 'roof-rafter', slopeId, correspondence: 'one-instance-per-rafter-line',
      });
      const purlinRecords = [];
      for (let index = 1; index <= 4; index += 1) {
        const distance = plane.run * index / 5;
        purlinRecords.push(cylinderTransformRecord(
          sectionPoint(-section.span / 2, plane.ridgeY - plane.pitch * distance - 0.23, plane.centerZ + plane.side * distance),
          sectionPoint(section.span / 2, plane.ridgeY - plane.pitch * distance - 0.23, plane.centerZ + plane.side * distance),
          0.065,
          { slopeId, sectionId: section.id, purlinIndex: index - 1 },
        ));
      }
      addBatch(purlins, purlinRecords, unitCylinderGeometry, materials.timber, {
        type: 'roof-purlin', slopeId, correspondence: 'four-instances-per-slope',
      });
      const deck = mesh(unitBoxGeometry, materials.timber, {
        type: 'roof-deck-underlay', roofLayerId: 'roofUnderlay', slopeId,
        dimensionsM: [section.span, options.roofThickness, slopeLength],
      });
      deck.scale.set(section.span, options.roofThickness, slopeLength);
      deck.quaternion.copy(composeSlopeQuaternion(sectionRotationY, plane.side * angle));
      deck.position.copy(sectionPoint(0, plane.ridgeY - plane.pitch * plane.run / 2 - 0.06, plane.centerZ + plane.side * plane.run / 2));
      underlay.add(deck);

      const dripRecords = [];
      const hookNeckRecords = [];
      const hookHeadRecords = [];
      const eaveDistance = plane.run + tileLength * 0.10;
      const eaveZ = plane.centerZ + plane.side * eaveDistance;
      const eaveY = plane.ridgeY - plane.pitch * eaveDistance + 0.04;
      const slopeQuaternion = composeSlopeQuaternion(sectionRotationY, plane.side * angle).toArray();
      for (let column = 0; column < panColumns; column += 1) {
        dripRecords.push({
          position: sectionPoint(panX(column), eaveY, eaveZ).toArray(),
          quaternion: slopeQuaternion,
          color: tileColor(profile.roof || profile, roofIndex, column, courseCount, plane.side),
          semantic: { kind: 'drip', state: 'aged', slopeId, sectionId: section.id, courseIndex: courseCount, columnIndex: column },
        });
      }
      for (let column = 0; column < coverColumns; column += 1) {
        const color = tileColor(profile.roof || profile, roofIndex, column + 0.5, courseCount, plane.side);
        const semantic = { kind: 'hook', state: 'aged', slopeId, sectionId: section.id, courseIndex: courseCount, columnIndex: column };
        hookNeckRecords.push({
          position: sectionPoint(coverX(column), eaveY + 0.07, eaveZ - plane.side * tileLength * 0.10).toArray(),
          quaternion: slopeQuaternion,
          color,
          semantic,
        });
        hookHeadRecords.push({
          position: sectionPoint(coverX(column), eaveY + 0.065, eaveZ + plane.side * tileThickness * 0.75).toArray(),
          quaternion: slopeQuaternion,
          color,
          semantic,
        });
      }
      const dripBatches = [addBatch(eaves, dripRecords, dripGeometry, materials.tilePan, {
        type: '滴水-pan-eave-drips', slopeId, correspondence: 'one-per-pan-column',
      })];
      addBatch(eaves, hookNeckRecords, hookNeckGeometry, materials.tileCover, {
        type: '筒瓦-eave-hook-necks', slopeId, correspondence: 'one-neck-per-cover-column',
      });
      const hookBatches = [addBatch(eaves, hookHeadRecords, hookHeadGeometry, materials.tileCover, {
        type: '勾头-cover-eave-hook-heads', slopeId, correspondence: 'one-independent-front-plate-per-cover-column',
      })];
      const fascia = mesh(unitBoxGeometry, materials.timber, {
        type: 'eave-fascia', roofLayerId: 'eaveCapsAndDrips', slopeId,
        dimensionsM: [section.span, 0.16, 0.09],
      });
      fascia.scale.set(section.span, 0.16, 0.09);
      fascia.rotation.y = sectionRotationY;
      fascia.position.copy(sectionPoint(0, plane.ridgeY - plane.pitch * plane.run - 0.12, plane.centerZ + plane.side * plane.run));
      eaves.add(fascia);

      const verticalRidgeRecords = [];
      for (const edge of [-1, 1]) {
        for (let course = 0; course < courseCount; course += 1) {
          const distance = (course + 0.5) * courseStep;
          verticalRidgeRecords.push({
            position: sectionPoint(edge * section.span / 2, plane.ridgeY - plane.pitch * distance + 0.13, plane.centerZ + plane.side * distance).toArray(),
            quaternion: slopeQuaternion,
            color: tileColor(profile.roof || profile, roofIndex, edge < 0 ? 0 : panColumns - 1, course, plane.side),
            semantic: { kind: 'vertical-ridge', state: 'aged', slopeId, sectionId: section.id, edge, courseIndex: course, columnIndex: edge < 0 ? -1 : panColumns },
          });
        }
      }
      const verticalRidgeBatches = [addBatch(sectionRidge, verticalRidgeRecords, coverGeometry, materials.tileCover, {
        type: '垂脊-vertical-ridge-tile-courses', ridgeSemantic: 'verticalRidge', slopeId,
        correspondence: 'two-discrete-sloping-ridge-courses-per-roof-plane',
      })];
      const verticalRidgeEndRecords = [-1, 1].map((edge) => ({
        position: sectionPoint(edge * section.span / 2, eaveY + 0.09, eaveZ + plane.side * tileThickness * 0.75).toArray(),
        quaternion: slopeQuaternion,
        color: tileColor(profile.roof || profile, roofIndex, edge < 0 ? 0 : panColumns - 1, courseCount, plane.side),
        semantic: { kind: 'vertical-ridge-end-closure', state: 'aged', slopeId, sectionId: section.id, edge, courseIndex: courseCount, columnIndex: edge < 0 ? -1 : panColumns },
      }));
      const verticalRidgeEnds = addBatch(sectionRidge, verticalRidgeEndRecords, hookHeadGeometry, materials.tileCover, {
        type: '垂脊-eave-end-closures', ridgeSemantic: 'verticalRidgeEndClosure', slopeId,
        correspondence: 'one-physical-end-closure-per-vertical-ridge-course',
      });
      sectionVerticalRidgeTileCount += verticalRidgeBatches.reduce((sum, batch) => sum + (batch?.count || 0), 0);
      sectionVerticalRidgeRunCount += 2;
      sectionVerticalRidgeEndClosureCount += verticalRidgeEnds?.count || 0;

      const geometryAudit = auditSlopeGeometry({
        panBatches,
        coverBatches,
        dripBatches,
        hookBatches,
        verticalRidgeBatches,
        expectedDownhillWorld,
        expectedPitch: plane.pitch,
        expectedTileVerticalComponent,
      });
      const drainagePathsMonotonic = geometryAudit.drainagePathCount > 0
        && geometryAudit.monotonicDrainagePathCount === geometryAudit.drainagePathCount
        && geometryAudit.minimumCourseFallM > 0
        && geometryAudit.drainageDirectionDot >= 0.999999;
      const drainagePathsEndAtEave = geometryAudit.drainagePathCount > 0
        && geometryAudit.eaveTerminationCount === geometryAudit.drainagePathCount
        && geometryAudit.eaveCrossAlignmentMaxErrorM <= 1e-6;
      const coverBridgesPanSeams = coverColumns === panColumns - 1
        && geometryAudit.seamSampleCount > 0
        && geometryAudit.seamAlignmentMaxErrorM <= 1e-6;
      slope.userData.tileTopology = {
        panColumns, coverColumns,
        coverBridgesPanSeams,
        courseCount, courseStepM: courseStep,
        designLongitudinalOverlapM: overlap,
        longitudinalOverlapM: geometryAudit.longitudinalOverlapM,
        coverCourseOffsetM: geometryAudit.coverCourseOffsetMaxM,
        seamAlignmentMaxErrorM: geometryAudit.seamAlignmentMaxErrorM,
        panColumnX: Array.from({ length: panColumns }, (_, index) => panX(index)),
        coverColumnX: Array.from({ length: coverColumns }, (_, index) => coverX(index)),
        panInstanceCount: geometryAudit.panInstanceCount,
        coverInstanceCount: geometryAudit.coverInstanceCount,
        dripCount: geometryAudit.dripInstanceCount,
        hookCount: geometryAudit.hookHeadInstanceCount,
        verticalRidgeTileCount: geometryAudit.verticalRidgeTileInstanceCount,
        drainagePathCount: geometryAudit.drainagePathCount,
        drainagePathsMonotonic,
        drainagePathsEndAtEave,
        drainageVectorLocal: [0, -plane.pitch, plane.side],
        drainageVectorWorld: geometryAudit.downhillVectorWorld,
        drainageTargetId: plane.drainageTargetId,
        missingTileIds: missingIds,
        tileBatchesAreInstanced: [...panBatches, ...coverBatches, ...dripBatches, ...hookBatches, ...verticalRidgeBatches]
          .filter(Boolean)
          .every((batch) => batch.isInstancedMesh),
        panConcavity: geometryAudit.panCrossSectionCurvatureM < 0 ? 'up' : 'invalid',
        coverConvexity: geometryAudit.coverCrossSectionCurvatureM > 0 ? 'up' : 'invalid',
      };
      slope.userData.geometryAudit = geometryAudit;
      slope.userData.damagePatch = {
        ...(damagePatchDefinition || {}),
        correlation: 'continuous-ellipse',
        tileCount: damagePatchIds.size,
        missingTileCount: slopeMissing,
        brokenTileCount: slopeBroken,
        tileIds: [...damagePatchIds],
      };
      slope.userData.repairPatch = {
        ...(repairPatchDefinition || {}),
        correlation: 'bounded-continuous-ellipse',
        tileCount: repairPatchIds.size,
        repairTileCount: slopeRepair,
        tileIds: [...repairPatchIds],
      };
      slopeGeometryAudits.push({
        slopeId,
        sectionId: section.id,
        geometryAudit,
        damagePatch: { ...slope.userData.damagePatch },
        repairPatch: { ...slope.userData.repairPatch },
      });
      slopes.push(slope.userData.tileTopology);
      ridgeElevations.push(plane.ridgeY);
      eaveElevations.push(plane.ridgeY - plane.pitch * plane.run);
    });

    const firstPlane = section.planes[0];
    const isLeanTo = section.planes.length === 1;
    const closureRecord = cylinderTransformRecord(
      sectionPoint(-section.span / 2, firstPlane.ridgeY + 0.10, firstPlane.centerZ),
      sectionPoint(section.span / 2, firstPlane.ridgeY + 0.10, firstPlane.centerZ),
      tileWidth * 0.25,
      { kind: isLeanTo ? 'wall-abutment' : 'principal-ridge', sectionId: section.id },
    );
    addSectionRidgeBatch([closureRecord], unitCylinderGeometry, {
      type: isLeanTo ? '靠墙收口-wall-abutment' : '正脊-ridge-cover',
      ridgeSemantic: isLeanTo ? 'wallAbutment' : 'principalRidge',
      correspondence: 'one-ridge-or-wall-abutment-run-per-section',
    });
    const ridgeEndRecords = [-1, 1].map((edge) => ({
      position: sectionPoint(edge * section.span / 2, firstPlane.ridgeY + 0.10, firstPlane.centerZ).toArray(),
      scale: [tileWidth * 0.29, tileWidth * 0.29, tileWidth * 0.29],
      semantic: { kind: 'ridge-end-closure', sectionId: section.id, edge },
    }));
    addSectionRidgeBatch(ridgeEndRecords, unitRidgeCapGeometry, {
      type: 'ridge-end-closure', ridgeSemantic: 'endClosure',
      correspondence: 'two-independent-end-closures-per-section',
    });
    const vergeRecords = [];
    for (const plane of section.planes) {
      const eaveDistance = plane.run + tileLength * 0.10;
      for (const x of [-section.span / 2, section.span / 2]) {
        vergeRecords.push(cylinderTransformRecord(
          sectionPoint(x, plane.ridgeY + 0.075, plane.centerZ),
          sectionPoint(x, plane.ridgeY - plane.pitch * eaveDistance + 0.045, plane.centerZ + plane.side * eaveDistance),
          tileWidth * 0.115,
          { kind: 'verge-closure', sectionId: section.id, roofSide: plane.side, edge: Math.sign(x) || 1 },
        ));
      }
    }
    addSectionRidgeBatch(vergeRecords, unitCylinderGeometry, {
      type: '山面斜向收边-verge-closure', ridgeSemantic: 'vergeClosure',
      correspondence: 'two-sloping-verge-runs-per-roof-plane',
    });
    const vergeClosureCount = vergeRecords.length;
    const roofForm = isLeanTo ? 'lean-to' : 'gable';
    const verticalRidgeRequirement = isLeanTo
      ? 'lean-to-side-closing-ridge'
      : 'gable-end-sloping-ridge';
    const verticalRidgeApplicable = section.planes.length > 0 && section.planes.every((plane) => plane.run > 0);
    const sectionRidgeBounds = new THREE.Box3().setFromObject(sectionRidge);
    const sectionRidgeAudit = {
      evidenceSource: 'actual-ridge-geometry-instance-matrices-and-world-bounds',
      roofForm,
      verticalRidgeRequirement,
      verticalRidgeRunCount: sectionVerticalRidgeRunCount,
      verticalRidgeTileCount: sectionVerticalRidgeTileCount,
      verticalRidgeEndClosureCount: sectionVerticalRidgeEndClosureCount,
      worldBounds: boxAudit(sectionRidgeBounds),
    };
    sectionRoot.userData.ridgeGeometryAudit = sectionRidgeAudit;
    ridgeTopology.push({
      sectionId: section.id,
      roofForm,
      principalRidgeCount: isLeanTo ? 0 : 1,
      wallAbutmentCount: isLeanTo ? 1 : 0,
      vergeClosureCount,
      endClosureCount: 2,
      verticalRidgeApplicable,
      verticalRidgeCount: sectionVerticalRidgeTileCount,
      verticalRidgeRunCount: sectionVerticalRidgeRunCount,
      verticalRidgeEndClosureCount: sectionVerticalRidgeEndClosureCount,
      verticalRidgeReason: verticalRidgeRequirement,
      geometryAudit: sectionRidgeAudit,
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
  roof.userData.rotationComposition = 'Qy*Qx';
  roof.userData.slopeGeometryAudits = slopeGeometryAudits;
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

function interpolateRouteDetailed(points, progress) {
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
      return {
        position: points[index].clone().lerp(points[index + 1], lengths[index] ? remaining / lengths[index] : 0),
        segmentIndex: index, routeDistanceM: total * value, totalDistanceM: total,
      };
    }
    remaining -= lengths[index];
  }
  return {
    position: points.at(-1).clone(), segmentIndex: Math.max(0, points.length - 2),
    routeDistanceM: total, totalDistanceM: total,
  };
}

function findWalkableSupport(root, target) {
  root.updateMatrixWorld(true);
  const walkables = [];
  root.traverse((object) => {
    if (object.isMesh && object.userData?.walkable === true) walkables.push(object);
  });
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(target.x, target.y + 5, target.z),
    new THREE.Vector3(0, -1, 0), 0, 9,
  );
  const candidates = raycaster.intersectObjects(walkables, false).filter((candidate) => (
    candidate.point.y <= target.y + 0.24 && candidate.point.y >= target.y - 0.26
  ));
  candidates.sort((left, right) => {
    const elevationDelta = right.point.y - left.point.y;
    if (Math.abs(elevationDelta) > 1e-5) return elevationDelta;
    const priority = (candidate) => {
      const componentId = candidate.object.userData?.componentId || '';
      if (componentId.startsWith('STAIR-WEST-01')) return 2;
      if (candidate.object.userData?.semanticRole === 'walkable-stair-landing') return 2;
      return 0;
    };
    return priority(right) - priority(left);
  });
  const hit = candidates[0];
  if (!hit) return null;
  return {
    point: hit.point.clone(), object: hit.object,
    supportId: hit.object.userData.supportId || hit.object.userData.componentId || hit.object.userData.type,
  };
}

function visitorCollisionSnapshot(root, footPosition) {
  root.updateMatrixWorld(true);
  const visitorRadius = 0.18;
  const visitorHeight = 1.26;
  const capsuleBox = new THREE.Box3(
    new THREE.Vector3(footPosition.x - visitorRadius, footPosition.y + 0.025, footPosition.z - visitorRadius),
    new THREE.Vector3(footPosition.x + visitorRadius, footPosition.y + visitorHeight, footPosition.z + visitorRadius),
  );
  const collisions = [];
  root.traverse((object) => {
    if (!object.isMesh || object.userData?.walkable === true) return;
    const isWall = object.userData?.semanticRole === 'wall-core';
    const role = object.userData?.collisionRole;
    if (!isWall && role !== 'opening-leaf' && role !== 'stair-rail') return;
    const objectBox = new THREE.Box3().setFromObject(object);
    if (!capsuleBox.intersectsBox(objectBox)) return;
    collisions.push({
      componentId: object.userData.componentId || object.name || object.userData.type,
      kind: isWall ? 'wall' : role,
    });
  });
  return {
    collisions,
    wallIntersectionCount: collisions.filter((item) => item.kind === 'wall').length,
    openingCollisionCount: collisions.filter((item) => item.kind === 'opening-leaf').length,
    railCollisionCount: collisions.filter((item) => item.kind === 'stair-rail').length,
  };
}

function setOpeningProgress(root, progress) {
  const value = THREE.MathUtils.clamp(progress, 0, 1);
  let doors = 0;
  let windows = 0;
  const leaves = [];
  root.traverse((object) => {
    if (!object.userData?.openingKind) return;
    (object.userData.pivots || []).forEach((pivot) => {
      const angle = THREE.MathUtils.lerp(
        Number(pivot.userData.closedAngleRad || 0), Number(pivot.userData.openAngleRad || 0), value,
      );
      pivot.rotation.y = angle;
      pivot.userData.currentAngleRad = angle;
      pivot.userData.state = value <= 1e-4 ? 'closed' : value >= 0.9999 ? 'open' : 'moving';
      leaves.push({
        componentId: pivot.userData.componentId,
        openingId: pivot.userData.openingId,
        angleRad: angle,
        hingeLocal: pivot.position.toArray(),
        pivot,
      });
    });
    object.userData.openingProgress = value;
    object.userData.openingState = value <= 1e-4 ? 'closed' : value >= 0.9999 ? 'open' : 'moving';
    if (object.userData.openingKind === 'door') doors += 1;
    else windows += 1;
  });
  root.updateMatrixWorld(true);
  leaves.forEach((leaf) => {
    leaf.hingeWorld = leaf.pivot.getWorldPosition(new THREE.Vector3()).toArray();
    delete leaf.pivot;
  });
  root.userData.runtimeState.openingProgress = value;
  root.userData.runtimeState.openingLeaves = leaves;
  return { progress: value, doors, windows, leaves };
}

function setVisitorProgress(root, progress) {
  const value = THREE.MathUtils.clamp(progress, 0, 1);
  const visitor = root.getObjectByName('visitor_route_actor');
  if (!visitor) return null;
  const previousProgress = Number(visitor.userData.routeProgress || 0);
  const previousPosition = visitor.userData.lastFootPosition
    ? new THREE.Vector3().fromArray(visitor.userData.lastFootPosition) : null;
  const route = interpolateRouteDetailed(root.userData.visitorRoute.points, value);
  const position = route.position;
  const requestedElevationM = position.y;
  const support = findWalkableSupport(root, position);
  const requestedSupportGapM = support ? Math.abs(requestedElevationM - support.point.y) : null;
  if (support) position.y = support.point.y;
  visitor.position.copy(position);
  root.updateMatrixWorld(true);
  const collision = visitorCollisionSnapshot(root, position);
  const supportGapM = support ? Math.abs(position.y - support.point.y) : null;
  const routeAnchor = root.userData.visitorRoute.anchors[Math.min(
    route.segmentIndex + 1, root.userData.visitorRoute.anchors.length - 1,
  )];
  const stuckFrameCount = previousPosition && value > previousProgress + 1e-7
    && position.distanceTo(previousPosition) < 1e-5 ? 1 : 0;
  visitor.userData.routeProgress = value;
  visitor.userData.routeComplete = value >= 0.999;
  visitor.userData.floorElevationM = position.y;
  visitor.userData.supportId = support?.supportId || null;
  visitor.userData.supportGapM = supportGapM;
  visitor.userData.requestedSupportGapM = requestedSupportGapM;
  visitor.userData.stage = routeAnchor?.stage || 'route';
  visitor.userData.routeDistanceM = route.routeDistanceM;
  visitor.userData.wallIntersectionCount = collision.wallIntersectionCount;
  visitor.userData.openingCollisionCount = collision.openingCollisionCount;
  visitor.userData.railCollisionCount = collision.railCollisionCount;
  visitor.userData.collisionIds = collision.collisions.map((item) => item.componentId);
  visitor.userData.suspendedFrameCount = !support || supportGapM > 0.03 ? 1 : 0;
  visitor.userData.stuckFrameCount = stuckFrameCount;
  visitor.userData.lastFootPosition = position.toArray();
  root.userData.runtimeState.visitorProgress = value;
  root.userData.runtimeState.visitorPosition = position.toArray();
  const snapshot = {
    progress: value,
    position: position.toArray(),
    complete: visitor.userData.routeComplete,
    stage: visitor.userData.stage,
    routeDistanceM: route.routeDistanceM,
    totalDistanceM: route.totalDistanceM,
    supportId: visitor.userData.supportId,
    supportGapM,
    requestedElevationM,
    requestedSupportGapM,
    wallIntersectionCount: collision.wallIntersectionCount,
    openingCollisionCount: collision.openingCollisionCount,
    railCollisionCount: collision.railCollisionCount,
    collisionIds: [...visitor.userData.collisionIds],
    suspendedFrameCount: visitor.userData.suspendedFrameCount,
    stuckFrameCount,
  };
  root.userData.runtimeState.visitorSnapshot = snapshot;
  return snapshot;
}

function sampleVisitorRoute(root, sampleCount = 101) {
  const count = Math.max(17, Math.floor(sampleCount));
  const previousProgress = Number(root.userData.runtimeState.visitorProgress || 0);
  const previousOpening = Number(root.userData.runtimeState.openingProgress || 0);
  setOpeningProgress(root, 1);
  const samples = [];
  let previousPosition = null;
  let stuckFrameCount = 0;
  for (let index = 0; index < count; index += 1) {
    const sample = setVisitorProgress(root, index / (count - 1));
    const position = new THREE.Vector3().fromArray(sample.position);
    if (previousPosition && position.distanceTo(previousPosition) < 1e-5) stuckFrameCount += 1;
    previousPosition = position;
    samples.push(sample);
  }
  const final = samples.at(-1);
  const anchorSupportAudits = root.userData.visitorRoute.anchors.map((anchor) => {
    const target = new THREE.Vector3().fromArray(anchor.position);
    const support = findWalkableSupport(root, target);
    return {
      anchorId: anchor.id,
      expectedSupportId: anchor.supportId,
      actualSupportId: support?.supportId || null,
      supportGapM: support ? Math.abs(target.y - support.point.y) : null,
    };
  });
  const result = {
    evidenceSource: 'raycaster-plus-world-bounds',
    sampleCount: samples.length,
    maxSupportGapM: Math.max(...samples.map((sample) => sample.supportGapM ?? Number.POSITIVE_INFINITY)),
    maxRequestedSupportGapM: Math.max(...samples.map((sample) => sample.requestedSupportGapM ?? Number.POSITIVE_INFINITY)),
    maxAnchorSupportGapM: Math.max(...anchorSupportAudits.map((item) => item.supportGapM ?? Number.POSITIVE_INFINITY)),
    unsupportedAnchorCount: anchorSupportAudits.filter((item) => item.supportGapM === null).length,
    mismatchedAnchorSupportCount: anchorSupportAudits.filter((item) => (
      item.actualSupportId !== item.expectedSupportId
      && !(item.expectedSupportId === 'COURTYARD-FLOOR' && item.actualSupportId === 'SITE-BASE')
    )).length,
    suspendedFrameCount: samples.filter((sample) => sample.suspendedFrameCount > 0).length,
    stuckFrameCount,
    wallIntersectionCount: samples.reduce((sum, sample) => sum + sample.wallIntersectionCount, 0),
    openingCollisionCount: samples.reduce((sum, sample) => sum + sample.openingCollisionCount, 0),
    railCollisionCount: samples.reduce((sum, sample) => sum + sample.railCollisionCount, 0),
    reachedUpperFloor: Boolean(final?.complete)
      && Math.abs((final?.position?.[1] || 0) - root.userData.visitorRoute.upperFloorElevationM) <= 0.02,
    finalElevationM: final?.position?.[1] || 0,
    relativeUpperFloorM: root.userData.visitorRoute.relativeUpperFloorM,
    stages: [...new Set(samples.map((sample) => sample.stage))],
    supportIds: [...new Set(samples.map((sample) => sample.supportId).filter(Boolean))],
    anchorSupportAudits,
  };
  setVisitorProgress(root, previousProgress);
  setOpeningProgress(root, previousOpening);
  root.userData.runtimeState.visitorRouteAudit = result;
  return result;
}

function projectedLeafInterval(leaf, assembly) {
  leaf.geometry.computeBoundingBox();
  leaf.updateMatrixWorld(true);
  assembly.updateMatrixWorld(true);
  const bounds = leaf.geometry.boundingBox;
  const inverseAssembly = assembly.matrixWorld.clone().invert();
  const xs = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        xs.push(new THREE.Vector3(x, y, z).applyMatrix4(leaf.matrixWorld).applyMatrix4(inverseAssembly).x);
      }
    }
  }
  return { min: Math.min(...xs), max: Math.max(...xs) };
}

function railWorldEndpoints(item) {
  const height = Number(item.geometry?.parameters?.height || 0);
  item.updateMatrixWorld(true);
  return [
    new THREE.Vector3(0, -height / 2, 0).applyMatrix4(item.matrixWorld),
    new THREE.Vector3(0, height / 2, 0).applyMatrix4(item.matrixWorld),
  ];
}

function connectedRailComponents(segments, toleranceM = 0.015) {
  const adjacency = segments.map(() => []);
  for (let left = 0; left < segments.length; left += 1) {
    for (let right = left + 1; right < segments.length; right += 1) {
      const connected = segments[left].endpoints.some((a) => (
        segments[right].endpoints.some((b) => a.distanceTo(b) <= toleranceM)
      ));
      if (connected) {
        adjacency[left].push(right);
        adjacency[right].push(left);
      }
    }
  }
  const visited = new Set();
  const components = [];
  adjacency.forEach((_, start) => {
    if (visited.has(start)) return;
    const stack = [start];
    const component = [];
    while (stack.length) {
      const current = stack.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      adjacency[current].forEach((next) => stack.push(next));
    }
    components.push(component);
  });
  return components;
}

function collisionEnvelopeAudit(pivot, leaf) {
  const declared = leaf.userData?.collisionEnvelopeLocal;
  if (!declared?.min || !declared?.max) return null;
  pivot.updateWorldMatrix(true, false);
  const declaredWorld = new THREE.Box3();
  for (const x of [declared.min[0], declared.max[0]]) {
    for (const y of [declared.min[1], declared.max[1]]) {
      for (const z of [declared.min[2], declared.max[2]]) {
        declaredWorld.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(pivot.matrixWorld));
      }
    }
  }
  const geometryWorld = new THREE.Box3().setFromObject(leaf);
  const tolerance = 1e-5;
  const expanded = declaredWorld.clone().expandByScalar(tolerance);
  return {
    declaredLocal: { min: [...declared.min], max: [...declared.max] },
    declaredWorld: { min: declaredWorld.min.toArray(), max: declaredWorld.max.toArray() },
    geometryWorld: { min: geometryWorld.min.toArray(), max: geometryWorld.max.toArray() },
    containsGeometry: expanded.containsPoint(geometryWorld.min) && expanded.containsPoint(geometryWorld.max),
  };
}

function inspectInteractionGeometry(root) {
  const previousOpening = Number(root.userData.runtimeState.openingProgress || 0);
  const assemblies = [];
  const interactionIds = [];
  const allComponentIds = new Set();
  root.traverse((object) => {
    if (object.userData?.componentId) allComponentIds.add(object.userData.componentId);
    if (object.userData?.openingKind) assemblies.push(object);
    if (object.userData?.openingKind || object.userData?.semanticRole === 'opening-hinge'
      || object.userData?.semanticRole === 'opening-leaf'
      || object.userData?.componentId?.startsWith?.('STAIR-WEST-01')) {
      if (object.userData.componentId) interactionIds.push(object.userData.componentId);
    }
  });
  const duplicateComponentIds = [...new Set(interactionIds.filter((id, index) => interactionIds.indexOf(id) !== index))];
  setOpeningProgress(root, 0);
  root.updateMatrixWorld(true);
  const closedHinges = new Map();
  assemblies.forEach((assembly) => (assembly.userData.pivots || []).forEach((pivot) => {
    closedHinges.set(pivot.userData.componentId, pivot.getWorldPosition(new THREE.Vector3()));
  }));
  setOpeningProgress(root, 1);
  root.updateMatrixWorld(true);
  const openingChecks = assemblies.map((assembly) => {
    const leaves = (assembly.userData.pivots || []).map((pivot) => (
      pivot.children.find((child) => child.userData?.semanticRole === 'opening-leaf')
    )).filter(Boolean);
    const intervals = leaves.map((leaf) => projectedLeafInterval(leaf, assembly)).sort((a, b) => a.min - b.min);
    const clearWidthM = assembly.userData.openingKind === 'door' && intervals.length === 2
      ? Math.max(0, intervals[1].min - intervals[0].max) : null;
    const pivots = (assembly.userData.pivots || []).map((pivot) => {
      const hingeWorld = pivot.getWorldPosition(new THREE.Vector3());
      const closedWorld = closedHinges.get(pivot.userData.componentId);
      const leaf = pivot.children.find((child) => child.userData?.semanticRole === 'opening-leaf');
      return {
        componentId: pivot.userData.componentId,
        leafId: leaf?.userData?.componentId,
        actualAngleRad: pivot.rotation.y,
        expectedOpenAngleRad: pivot.userData.openAngleRad,
        hingeDriftM: closedWorld ? hingeWorld.distanceTo(closedWorld) : null,
        hingeWorld: hingeWorld.toArray(),
        collisionEnvelope: leaf ? collisionEnvelopeAudit(pivot, leaf) : null,
      };
    });
    return {
      componentId: assembly.userData.componentId,
      kind: assembly.userData.openingKind,
      hostId: assembly.userData.hostId,
      hostExists: allComponentIds.has(assembly.userData.hostId),
      apertureM: { ...assembly.userData.apertureM },
      actualClearWidthM: clearWidthM,
      leafWorldBoundsM: leaves.map((leaf) => new THREE.Box3().setFromObject(leaf).getSize(new THREE.Vector3()).toArray()),
      pivots,
    };
  });
  setOpeningProgress(root, previousOpening);

  const stair = root.getObjectByName('stair_STAIR-WEST-01');
  const treads = [];
  const landings = [];
  const rails = [];
  let stringerCount = 0;
  let supportCount = 0;
  let handrailPostCount = 0;
  stair?.traverse((object) => {
    if (!object.isMesh) return;
    const boxWorld = new THREE.Box3().setFromObject(object);
    if (object.userData?.type === 'stair-tread') {
      treads.push({
        componentId: object.userData.componentId, flight: object.userData.flight,
        step: object.userData.step, topElevationM: boxWorld.max.y,
      });
    }
    if (object.userData?.walkable && object.userData?.landing) {
      landings.push({ componentId: object.userData.componentId, landing: object.userData.landing, topElevationM: boxWorld.max.y });
    }
    if (object.userData?.semanticRole === 'stair-handrail') {
      rails.push({ componentId: object.userData.componentId, endpoints: railWorldEndpoints(object) });
    }
    if (object.userData?.type === 'stair-stringer-support') stringerCount += 1;
    if (object.userData?.type === 'stair-support-post') supportCount += 1;
    if (object.userData?.type === 'stair-handrail-post') handrailPostCount += 1;
  });
  treads.sort((a, b) => a.flight - b.flight || a.step - b.step);
  const expectedRise = Number(stair?.userData?.riserHeightM || 0);
  const lowerElevation = landings.find((item) => item.landing === 'lower')?.topElevationM ?? 0;
  const riseErrorsM = treads.map((item) => {
    const expected = lowerElevation + expectedRise * (item.flight === 1 ? item.step : 8 + item.step);
    return Math.abs(item.topElevationM - expected);
  });
  const railComponents = connectedRailComponents(rails, 0.015);
  const railComponentSpans = railComponents.map((component) => {
    const endpoints = component.flatMap((index) => rails[index].endpoints);
    return {
      segmentIds: component.map((index) => rails[index].componentId),
      minElevationM: Math.min(...endpoints.map((point) => point.y)),
      maxElevationM: Math.max(...endpoints.map((point) => point.y)),
    };
  });
  const handrailHeight = Number(stair?.userData?.handrailHeightM || 0);
  const upperElevation = landings.find((item) => item.landing === 'upper')?.topElevationM ?? 0;
  const continuousHandrails = railComponentSpans.length === 2 && railComponentSpans.every((component) => (
    Math.abs(component.minElevationM - (lowerElevation + handrailHeight)) <= 0.015
    && Math.abs(component.maxElevationM - (upperElevation + handrailHeight)) <= 0.015
  ));
  return {
    evidenceSource: 'world-matrices-buffer-bounds-and-cylinder-endpoints',
    duplicateComponentIds,
    openings: openingChecks,
    stair: {
      componentId: stair?.userData?.componentId,
      flightStepCounts: [1, 2].map((flight) => treads.filter((item) => item.flight === flight).length),
      treadTopElevationsM: treads.map((item) => item.topElevationM),
      landingTopElevationsM: Object.fromEntries(landings.map((item) => [item.landing, item.topElevationM])),
      firstRiserHeightM: treads[0] ? treads[0].topElevationM - lowerElevation : null,
      expectedRiserHeightM: expectedRise,
      maxRiserErrorM: riseErrorsM.length ? Math.max(...riseErrorsM) : null,
      stringerCount, supportCount, handrailPostCount,
      handrailSegmentCount: rails.length,
      handrailConnectedComponentCount: railComponents.length,
      handrailComponentSpans: railComponentSpans,
      continuousHandrails,
      handrailEndpoints: rails.map((item) => ({
        componentId: item.componentId, endpoints: item.endpoints.map((point) => point.toArray()),
      })),
    },
  };
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

  const base = box(W + 0.5, 0.16, D + 0.5, materials.stone, {
    type: 'stone-foundation-plinth', semanticRole: 'walkable-site-base',
    componentId: 'SITE-BASE', supportId: 'SITE-BASE', walkable: true,
  });
  base.position.y = 0.08;
  ground.add(base);
  const courtyardFloor = addStoneFloor(ground, courtyardW, courtyardD, materials, {
    type: 'courtyard-stone-paving', componentId: 'COURTYARD-FLOOR',
  });
  courtyardFloor.position.y = p - 0.07;
  const approach = box(2.2, 0.12, 2.2, materials.stone, {
    type: 'front-approach', semanticRole: 'walkable-entry',
    componentId: 'ENTRY-APPROACH', supportId: 'ENTRY-APPROACH', walkable: true,
  });
  approach.position.set(0, 0.10, -D / 2 - 1.25);
  const frontStep = box(2.2, 0.14, 0.55, materials.stone, {
    type: 'front-stone-step', semanticRole: 'walkable-entry',
    componentId: 'ENTRY-STEP-01', supportId: 'ENTRY-STEP-01', walkable: true,
  });
  frontStep.position.set(0, 0.18, -D / 2 - 0.3);
  const secondStep = box(1.85, 0.20, 0.48, materials.stone, {
    type: 'front-stone-step', semanticRole: 'walkable-entry',
    componentId: 'ENTRY-STEP-02', supportId: 'ENTRY-STEP-02', walkable: true,
  });
  secondStep.position.set(0, 0.25, -D / 2 - 0.02);
  const threshold = box(1.55, 0.20, 0.48, materials.stone, {
    type: 'door-threshold', semanticRole: 'walkable-entry',
    componentId: 'ENTRY-THRESHOLD', supportId: 'ENTRY-THRESHOLD', walkable: true,
  });
  threshold.position.set(0, p - 0.10, -D / 2 + 0.24);
  const entryWalkway = box(2.0, 0.12, 5.1, materials.stone, {
    type: 'entry-gallery-floor', semanticRole: 'walkable-floor',
    componentId: 'ENTRY-GALLERY-FLOOR', supportId: 'ENTRY-GALLERY-FLOOR', walkable: true,
  });
  entryWalkway.position.set(0, p - 0.06, -D / 2 + 2.80);
  const westGalleryFloor = box(3.0, 0.12, courtyardD + 1.2, materials.timber, {
    type: 'west-lower-gallery-floor', semanticRole: 'walkable-floor',
    componentId: 'WEST-LOWER-GALLERY-FLOOR', supportId: 'WEST-LOWER-GALLERY-FLOOR', walkable: true,
  });
  westGalleryFloor.position.set(-4.05, p - 0.06, 0.15);
  ground.add(approach, frontStep, secondStep, threshold, entryWalkway, westGalleryFloor);

  addWallWithOpenings(walls, {
    orientation: 'x', centerAlong: 0, fixed: D / 2 - t / 2, baseY: p,
    span: W, thickness: t, height: H, taper: options.wallTaper,
    openings: [
      { id: 'WINDOW-NORTH-LEFT', along: -W * 0.28, width: 0.44, bottomOffset: 2.68, height: 0.38 },
      { id: 'WINDOW-NORTH-RIGHT', along: W * 0.28, width: 0.44, bottomOffset: 2.68, height: 0.38 },
    ],
  }, materials, { type: 'north-main-wall', componentId: 'WALL-NORTH-MAIN', taper: options.wallTaper });
  for (const [side, fixed, openingId] of [
    ['west', -W / 2 + t / 2, 'WINDOW-WEST-HIGH'],
    ['east', W / 2 - t / 2, 'WINDOW-EAST-HIGH'],
  ]) {
    addWallWithOpenings(walls, {
      orientation: 'z', centerAlong: 0.15, fixed, baseY: p,
      span: sideDepth, thickness: t, height: H * 0.9, taper: options.wallTaper,
      openings: [{ id: openingId, along: 0.40, width: 0.32, bottomOffset: 2.52, height: 0.42 }],
    }, materials, { type: `${side}-side-wall`, componentId: `WALL-${side.toUpperCase()}-SIDE`, taper: options.wallTaper });
  }
  const southSpan = W / 2 - 2.0;
  addWall(walls, -southSpan / 2 - 1.0, p, -D / 2 + t / 2, southSpan, t, H * 0.72, materials, { type: 'south-left-wall', componentId: 'WALL-SOUTH-LEFT', taper: options.wallTaper * 0.85 });
  addWall(walls, southSpan / 2 + 1.0, p, -D / 2 + t / 2, southSpan, t, H * 0.72, materials, { type: 'south-right-wall', componentId: 'WALL-SOUTH-RIGHT', taper: options.wallTaper * 0.85 });
  addWall(
    walls, 0, p + 2.15, -D / 2 + t / 2, 2.0, t, H * 0.72 - 2.15,
    materials, {
      type: 'south-gate-lintel-wall', componentId: 'WALL-SOUTH-GATE',
      taper: options.wallTaper * 0.35, foundationBearing: false,
    },
  );
  addGable(walls, 0, p + H, D / 2 - t / 2, W, t, H * 0.72, materials, { type: 'north-gable-wall', componentId: 'WALL-NORTH-GABLE' });

  for (const x of [-W / 2 + 1.0, -courtyardW / 2, courtyardW / 2, W / 2 - 1.0]) {
    addRoundColumn(frame, x, p, galleryZ, 0.14, options.floorHeight, materials, { type: 'gallery-column' });
    addRoundColumn(frame, x, p + options.floorHeight, galleryZ, 0.11, H - options.floorHeight, materials, { type: 'upper-gallery-column' });
  }
  for (const x of [-W / 2 + 1.0, -courtyardW / 2, courtyardW / 2, W / 2 - 1.0]) {
    addBeam(frame, x, p + options.floorHeight, galleryZ, 0.18, 0.16, courtyardW + 0.35, 0, materials, { type: 'gallery-floor-beam' });
  }
  addBeam(frame, 0, p + H * 0.52, galleryZ, courtyardW + 1.0, 0.16, 0.18, 0, materials, { type: 'gallery-lintel' });
  const upperGallery = box(courtyardW + 2.2, 0.12, 1.05, materials.timber, {
    type: 'upper-gallery-walkway', semanticRole: 'walkable-floor',
    componentId: 'UPPER-GALLERY-FLOOR', supportId: 'UPPER-GALLERY-FLOOR', walkable: true,
  });
  upperGallery.position.set(-0.45, p + options.floorHeight - 0.06, galleryZ + 0.15);
  frame.add(upperGallery);

  addDoor(openings, 0, p, -D / 2 - 0.01, 1.25, 2.15, materials, {
    type: 'central-front-door', componentId: 'GATE-SOUTH-01', hostId: 'WALL-SOUTH-GATE',
  });
  addHighWindow(openings, -W * 0.28, p + 2.68, D / 2 - t - 0.02, 0.44, 0.38, materials, {
    type: 'sparse-high-window-left', componentId: 'WINDOW-NORTH-LEFT', hostId: 'WALL-NORTH-MAIN',
  });
  addHighWindow(openings, W * 0.28, p + 2.68, D / 2 - t - 0.02, 0.44, 0.38, materials, {
    type: 'sparse-high-window-right', componentId: 'WINDOW-NORTH-RIGHT', hostId: 'WALL-NORTH-MAIN',
  });
  const westWindow = addHighWindow(openings, -W / 2 - 0.02, p + 2.52, 0.55, 0.32, 0.42, materials, {
    type: 'side-high-window-west', componentId: 'WINDOW-WEST-HIGH', hostId: 'WALL-WEST-SIDE',
  });
  westWindow.rotation.y = Math.PI / 2;
  const eastWindow = addHighWindow(openings, W / 2 + 0.02, p + 2.52, 0.55, 0.32, 0.42, materials, {
    type: 'side-high-window-east', componentId: 'WINDOW-EAST-HIGH', hostId: 'WALL-EAST-SIDE',
  });
  eastWindow.rotation.y = -Math.PI / 2;

  const stair = addDoubleFlightStairs(frame, -courtyardW / 2 - 1.25, p, galleryZ - 0.20, materials, {
    width: 0.84, gap: 0.18, run: 2.05, landingDepth: 0.82, totalRise: options.floorHeight,
  }, { type: 'west-daily-stair', stairId: 'STAIR-WEST-01' });
  const upperLandingExtension = box(2.80, 0.12, 0.82, materials.timber, {
    type: 'stair-upper-landing-extension', semanticRole: 'walkable-floor',
    componentId: 'STAIR-WEST-01-UPPER-TURN', supportId: 'STAIR-WEST-01-UPPER-TURN',
    walkable: true, topElevationM: p + options.floorHeight,
  });
  upperLandingExtension.position.set(
    stair.position.x + 0.47, p + options.floorHeight - 0.06,
    stair.position.z - 1.435,
  );
  const upperStairConnector = box(0.84, 0.12, 0.85, materials.timber, {
    type: 'stair-upper-gallery-connector', semanticRole: 'walkable-floor',
    componentId: 'STAIR-WEST-01-UPPER-CONNECTOR', supportId: 'STAIR-WEST-01-UPPER-CONNECTOR',
    walkable: true, topElevationM: p + options.floorHeight,
  });
  upperStairConnector.position.set(
    stair.position.x + 1.45, p + options.floorHeight - 0.06,
    stair.position.z - 0.60,
  );
  frame.add(upperLandingExtension, upperStairConnector);

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
  const roofGeometries = createSharedRoofGeometries(options, baseline);
  specs.forEach((spec, index) => addRoofUnit(
    roofs, spec, options, materials, surfaceProfile, baseline, index, roofGeometries,
  ));

  const visitor = createVisitor();
  actors.add(visitor);
  const routeAnchors = [
    { id: 'ROUTE-APPROACH', position: [0, 0.16, -D / 2 - 1.72], supportId: 'ENTRY-APPROACH', stage: 'approach' },
    { id: 'ROUTE-STEP-01', position: [0, 0.25, -D / 2 - 0.44], supportId: 'ENTRY-STEP-01', stage: 'entry-steps' },
    { id: 'ROUTE-STEP-02', position: [0, 0.35, -D / 2 - 0.08], supportId: 'ENTRY-STEP-02', stage: 'entry-steps' },
    { id: 'ROUTE-THRESHOLD', position: [0, p, -D / 2 + 0.24], supportId: 'ENTRY-THRESHOLD', stage: 'door-threshold' },
    { id: 'ROUTE-ENTRY-GALLERY', position: [0, p, -D / 2 + 1.35], supportId: 'ENTRY-GALLERY-FLOOR', stage: 'inside-entry' },
    { id: 'ROUTE-COURTYARD-SOUTH', position: [0, p, -2.45], supportId: 'COURTYARD-FLOOR', stage: 'courtyard' },
    { id: 'ROUTE-COURTYARD-WEST', position: [-2.42, p, 0.15], supportId: 'COURTYARD-FLOOR', stage: 'courtyard' },
    { id: 'ROUTE-WEST-GALLERY', position: [-3.50, p, 0.15], supportId: 'WEST-LOWER-GALLERY-FLOOR', stage: 'lower-gallery' },
    { id: 'ROUTE-STAIR-APPROACH', position: [-4.36, p, 0.35], supportId: 'WEST-LOWER-GALLERY-FLOOR', stage: 'stair-approach' },
    ...stair.userData.routeAnchors.map((anchor) => ({
      ...anchor,
      position: [
        stair.position.x + anchor.position[0],
        stair.position.y + anchor.position[1],
        stair.position.z + anchor.position[2],
      ],
    })),
    {
      id: 'ROUTE-UPPER-TURN',
      position: [upperStairConnector.position.x, p + options.floorHeight, upperLandingExtension.position.z],
      supportId: 'STAIR-WEST-01-UPPER-TURN', stage: 'upper-turn',
    },
    {
      id: 'ROUTE-UPPER-CONNECTOR',
      position: [upperStairConnector.position.x, p + options.floorHeight, upperStairConnector.position.z + 0.30],
      supportId: 'STAIR-WEST-01-UPPER-CONNECTOR', stage: 'upper-connector',
    },
    {
      id: 'ROUTE-UPPER-GALLERY',
      position: [upperStairConnector.position.x, p + options.floorHeight, galleryZ + 0.15],
      supportId: 'UPPER-GALLERY-FLOOR', stage: 'upper-gallery',
    },
    {
      id: 'ROUTE-UPPER-DESTINATION',
      position: [upperStairConnector.position.x, p + options.floorHeight, galleryZ + 0.44],
      supportId: 'UPPER-GALLERY-FLOOR', stage: 'destination',
    },
  ];
  const route = routeAnchors.map((anchor) => new THREE.Vector3(...anchor.position));
  root.userData.visitorRoute = {
    anchors: routeAnchors,
    points: route,
    pointArrays: route.map((point) => point.toArray()),
    entersThroughDoor: true,
    stairId: stair.userData.stairId,
    collisionContract: 'centerline-clear-of-wall-volumes',
    reachesUpperFloor: true,
    upperFloorElevationM: p + options.floorHeight,
    relativeUpperFloorM: options.floorHeight,
  };
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
  root.userData.interactionGeometry = inspectInteractionGeometry(root);
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
    sampleVisitorRoute: (count = 193) => sampleVisitorRoute(root, count),
    auditVisitorRoute: (count = 193) => sampleVisitorRoute(root, count),
    inspectInteractions: () => {
      const result = inspectInteractionGeometry(root);
      root.userData.interactionGeometry = result;
      return result;
    },
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
