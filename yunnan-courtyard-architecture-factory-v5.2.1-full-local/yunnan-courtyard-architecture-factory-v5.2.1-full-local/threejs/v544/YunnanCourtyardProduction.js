import * as THREE from 'three';
import {
  createYunnanMaterialSet,
  disposeYunnanMaterialSet,
} from './YunnanMaterialFactory.js';

/**
 * Editable, procedural seed for the 滇中一颗印 / 团结乡 production family.
 *
 * This is intentionally a source model, not a replacement for the high-res
 * scan.  The measured YKY dimensions are used as a canonical layout seed;
 *团结乡 tile dimensions, laps and repair chronology remain evidence-gated.
 */
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
  tileWidth: 0.28,
  tileLength: 0.64,
  tileCourse: 0.46,
  tileThickness: 0.055,
  wallGap: 0.07,
  seed: 401,
});

const BRANCH = 'BRANCH-CENTRAL-YUNNAN-YIKEYIN';

function tag(object, data = {}) {
  object.userData = {
    ...(object.userData || {}),
    branch: BRANCH,
    editableSource: 'threejs/YunnanCourtyardProduction.js',
    ...data,
  };
  return object;
}

function mesh(geometry, material, data) {
  return tag(new THREE.Mesh(geometry, material), data);
}

function box(width, height, depth, material, data) {
  return mesh(new THREE.BoxGeometry(width, height, depth), material, data);
}

function cylinder(radius, height, material, data, radialSegments = 16) {
  return mesh(new THREE.CylinderGeometry(radius, radius, height, radialSegments), material, data);
}

function createBatteredWallGeometry(width, depth, height, taper = 0.12) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const topW = Math.max(0.02, width - taper * 2);
  const topD = Math.max(0.02, depth - taper * 2);
  const positions = [
    -halfW, 0, -halfD, halfW, 0, -halfD, halfW, 0, halfD, -halfW, 0, halfD,
    -topW / 2, height, -topD / 2, topW / 2, height, -topD / 2,
    topW / 2, height, topD / 2, -topW / 2, height, topD / 2,
  ];
  const indices = [
    0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
    4, 5, 6, 4, 6, 7, 3, 2, 1, 3, 1, 0,
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
    // lower wall band and the two end gables
    0, 1, 6, 0, 6, 4, 4, 6, 5,
    1, 2, 9, 1, 9, 6,
    2, 3, 7, 2, 7, 9, 7, 8, 9,
    3, 0, 4, 3, 4, 7,
    // two roof planes between the front and rear gables
    4, 5, 8, 4, 8, 7,
    5, 6, 9, 5, 9, 8,
    // underside
    3, 2, 1, 3, 1, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createTileGeometry(width, length, kind = 'pan', thickness = 0.055) {
  const crossSegments = 8;
  const lengthSegments = 1;
  const radius = Math.max(width * 0.78, 0.08);
  const positions = [];
  const indices = [];
  for (let z = 0; z <= lengthSegments; z += 1) {
    const l = length * (z / lengthSegments) - length / 2;
    for (let x = 0; x <= crossSegments; x += 1) {
      const u = x / crossSegments;
      const xx = (u - 0.5) * width;
      const norm = Math.min(0.98, Math.abs(xx) / radius);
      const curve = Math.sqrt(Math.max(0.002, radius * radius - (norm * radius) ** 2));
      const yy = kind === 'cover' ? curve - radius * 0.12 : radius * 0.12 - curve;
      positions.push(xx, yy, l);
    }
  }
  const row = crossSegments + 1;
  for (let z = 0; z < lengthSegments; z += 1) {
    for (let x = 0; x < crossSegments; x += 1) {
      const a = z * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const base = positions.length / 3;
  for (let z = 0; z <= lengthSegments; z += 1) {
    const l = length * (z / lengthSegments) - length / 2;
    for (let x = 0; x <= crossSegments; x += 1) {
      const u = x / crossSegments;
      const xx = (u - 0.5) * width;
      const norm = Math.min(0.98, Math.abs(xx) / radius);
      const curve = Math.sqrt(Math.max(0.002, radius * radius - (norm * radius) ** 2));
      const yy = (kind === 'cover' ? curve - radius * 0.12 : radius * 0.12 - curve) - thickness;
      positions.push(xx, yy, l);
    }
  }
  for (let z = 0; z < lengthSegments; z += 1) {
    for (let x = 0; x < crossSegments; x += 1) {
      const a = base + z * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addWall(group, x, y, z, width, depth, height, materials, data = {}) {
  const wall = mesh(createBatteredWallGeometry(width, depth, height, data.taper ?? 0.12), materials.wall, {
    type: 'weathered-earth-wall',
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
    evidenceRule: 'TJ001-MAT-EARTH-WALL-WEATHERED',
    ...data,
  });
  gable.position.set(x, y, z);
  group.add(gable);
  return gable;
}

function addRoundColumn(group, x, y, z, radius, height, materials, data = {}) {
  const col = cylinder(radius, height, materials.timber, {
    type: 'round-timber-column',
    evidenceRule: 'TJ001-MAT-AGED-EXTERIOR-TIMBER',
    ...data,
  }, 20);
  col.position.set(x, y + height / 2, z);
  group.add(col);
  return col;
}

function addBeam(group, x, y, z, width, height, depth, rotationY, materials, data = {}) {
  const beam = box(width, height, depth, materials.timber, {
    type: 'timber-beam',
    evidenceRule: 'TJ001-MAT-AGED-EXTERIOR-TIMBER',
    ...data,
  });
  beam.position.set(x, y, z);
  beam.rotation.y = rotationY || 0;
  group.add(beam);
  return beam;
}

function addDoor(group, x, y, z, width, height, materials, data = {}) {
  const assembly = tag(new THREE.Group(), { type: 'timber-door-assembly', ...data });
  const recess = box(width + 0.18, height + 0.18, 0.12, materials.opening, {
    type: 'deep-door-opening',
    evidenceRule: 'YKY-MAT-DOOR-OPENING-SHADOW',
  });
  recess.position.set(x, y + height / 2, z - 0.05);
  assembly.add(recess);
  const leafWidth = width / 2 - 0.035;
  for (let side = -1; side <= 1; side += 2) {
    const leaf = box(leafWidth, height - 0.12, 0.08, materials.timber, {
      type: '板门-door-leaf',
      evidenceRule: 'TJ001-MAT-AGED-EXTERIOR-TIMBER',
    });
    leaf.position.set(x + side * (leafWidth / 2 + 0.035), y + height / 2, z - 0.12);
    assembly.add(leaf);
    for (let row = 0; row < 2; row += 1) {
      const panel = box(leafWidth * 0.74, height * 0.24, 0.026, materials.timber, { type: 'door-panel-inset' });
      panel.position.set(leaf.position.x, y + 0.44 + row * 0.62, z - 0.17);
      assembly.add(panel);
    }
  }
  const jambL = box(0.12, height + 0.18, 0.16, materials.timber, { type: 'door-jamb' });
  const jambR = jambL.clone();
  jambL.position.set(x - width / 2 - 0.04, y + height / 2, z - 0.16);
  jambR.position.set(x + width / 2 + 0.04, y + height / 2, z - 0.16);
  const lintel = box(width + 0.28, 0.16, 0.18, materials.timber, { type: 'door-lintel' });
  lintel.position.set(x, y + height + 0.04, z - 0.16);
  assembly.add(jambL, jambR, lintel);
  group.add(assembly);
  return assembly;
}

function addHighWindow(group, x, y, z, width, height, materials, data = {}) {
  const window = tag(new THREE.Group(), { type: 'small-high-window', ...data });
  const recess = box(width, height, 0.10, materials.opening, { type: 'window-recess' });
  recess.position.set(x, y + height / 2, z);
  window.add(recess);
  const frame = 0.07;
  for (const [px, py, pw, ph] of [
    [x - width / 2, y + height / 2, frame, height + frame],
    [x + width / 2, y + height / 2, frame, height + frame],
    [x, y, width + frame, frame],
    [x, y + height, width + frame, frame],
  ]) {
    const bar = box(pw, ph, 0.14, materials.timber, { type: 'small-window-frame' });
    bar.position.set(px, py, z - 0.08);
    window.add(bar);
  }
  const mullion = box(frame * 0.7, height - 0.12, 0.12, materials.timber, { type: 'small-window-mullion' });
  mullion.position.set(x, y + height / 2, z - 0.10);
  window.add(mullion);
  group.add(window);
  return window;
}

function addStairs(group, x, y, z, width, run, rise, count, direction, materials, data = {}) {
  const stairs = tag(new THREE.Group(), { type: 'daily-use-timber-stairs', ...data });
  const sign = direction >= 0 ? 1 : -1;
  for (let i = 0; i < count; i += 1) {
    const tread = box(width, 0.10, run / count + 0.035, materials.timber, {
      type: 'stair-tread',
      evidenceRule: 'YKY-T07-daily-stair',
    });
    tread.position.set(x, y + rise * (i + 0.5), z + sign * (run * (i + 0.5) / count));
    stairs.add(tread);
  }
  const railLeft = cylinder(0.045, Math.sqrt(run * run + (rise * count) ** 2), materials.timber, { type: 'stair-handrail' }, 12);
  const railRight = railLeft.clone();
  const railAngle = Math.atan2(rise * count, run);
  for (const rail of [railLeft, railRight]) {
    rail.rotation.x = sign * (Math.PI / 2 - railAngle);
    rail.position.set(x + (rail === railLeft ? -width / 2 : width / 2), y + rise * count / 2 + 0.7, z + sign * run / 2);
    stairs.add(rail);
  }
  stairs.position.set(0, 0, 0);
  group.add(stairs);
  return stairs;
}

function addStoneFloor(group, width, depth, materials, data = {}) {
  const floor = tag(new THREE.Group(), { type: 'irregular-stone-slab-courtyard', ...data });
  const slabMat = materials.stone;
  const step = 0.68;
  for (let x = -width / 2 + step / 2; x < width / 2; x += step) {
    for (let z = -depth / 2 + step / 2; z < depth / 2; z += step) {
      const slab = box(step * 0.93, 0.07, step * 0.93, slabMat, { type: 'stone-slab' });
      slab.position.set(x + ((Math.floor((z + depth) * 7) % 3) - 1) * 0.025, 0.035, z);
      slab.rotation.y = ((Math.floor((x + width) * 5) + Math.floor((z + depth) * 4)) % 5) * 0.025;
      floor.add(slab);
    }
  }
  group.add(floor);
  return floor;
}

function addRoof(group, options, materials, data = {}) {
  const {
    width,
    depth,
    eaveY,
    centerZ,
    pitch,
    eave = 0.58,
    tileWidth = 0.28,
    tileLength = 0.64,
    tileCourse = 0.46,
    axis = 'x',
    seedOffset = 0,
  } = options;
  const roof = tag(new THREE.Group(), {
    type: 'independent-yunnan-tile-roof',
    evidenceRule: 'TJ001-ROOF-YUNNAN-PAN-COVER-TILE-AGED',
    exactDimensionsStatus: 'unresolved_tile_dimensions',
    ...data,
  });
  const halfRun = depth / 2 + eave;
  const angle = Math.atan(pitch);
  const deckMat = materials.timber;
  const panGeometry = createTileGeometry(tileWidth, tileLength, 'pan', options.tileThickness || 0.055);
  const coverGeometry = createTileGeometry(tileWidth * 0.92, tileLength * 0.94, 'cover', options.tileThickness || 0.055);
  for (const side of [-1, 1]) {
    const deck = box(width + eave * 2, options.roofThickness || 0.1, halfRun, deckMat, {
      type: 'roof-deck-underlay',
      evidenceRule: 'visual_reference_only',
    });
    deck.rotation.x = -side * angle;
    deck.position.set(0, eaveY - pitch * halfRun / 2, centerZ + side * halfRun / 2);
    roof.add(deck);
    const courses = Math.max(4, Math.ceil(halfRun / tileCourse));
    const across = Math.max(4, Math.ceil((width + eave * 2) / tileWidth));
    for (let c = 0; c < courses; c += 1) {
      const run = c * tileCourse + tileCourse * 0.5;
      const z = centerZ + side * run;
      const y = eaveY - pitch * run;
      for (let i = 0; i < across; i += 1) {
        const x = -((across - 1) * tileWidth) / 2 + i * tileWidth;
        const pan = mesh(panGeometry, materials.tilePan, {
          type: '板瓦-pan-tile',
          roofSide: side,
          course: c,
          tileIndex: i,
          evidenceRule: 'TJ001-ROOF-YUNNAN-PAN-COVER-TILE-AGED',
        });
        pan.rotation.x = -side * angle;
        pan.position.set(x, y + 0.035, z);
        roof.add(pan);
        const coverZ = centerZ + side * (run + tileCourse * 0.23);
        const coverY = eaveY - pitch * (run + tileCourse * 0.23) + 0.08;
        const cover = mesh(coverGeometry, materials.tileCover, {
          type: '筒瓦-cover-tile',
          roofSide: side,
          course: c,
          tileIndex: i,
          evidenceRule: 'TJ001-ROOF-YUNNAN-PAN-COVER-TILE-AGED',
        });
        cover.rotation.x = -side * angle;
        cover.position.set(x + tileWidth * 0.5, coverY, coverZ);
        roof.add(cover);
      }
    }
  }
  if (axis === 'z') roof.rotation.y = Math.PI / 2;
  roof.userData.seedOffset = seedOffset;
  group.add(roof);
  return roof;
}

function addShed(group, x, z, width, depth, materials, options, data = {}) {
  const shed = tag(new THREE.Group(), { type: 'front-firewood-shed', ...data });
  const wallH = options.wallHeight * 0.63;
  const wallT = options.wallThickness * 0.82;
  addWall(shed, 0, options.plinthHeight, 0, width, wallT, wallH, materials, { type: 'shed-wall-front' });
  addWall(shed, -width / 2 + wallT / 2, options.plinthHeight, 0, wallT, depth, wallH, materials, { type: 'shed-wall-side' });
  addWall(shed, width / 2 - wallT / 2, options.plinthHeight, 0, wallT, depth, wallH, materials, { type: 'shed-wall-side' });
  addRoof(shed, {
    width,
    depth: depth * 1.12,
    eaveY: options.plinthHeight + wallH,
    centerZ: 0,
    pitch: options.roofPitch * 0.84,
    eave: options.roofEave * 0.72,
    tileWidth: options.tileWidth,
    tileLength: options.tileLength,
    tileCourse: options.tileCourse,
    seedOffset: 31,
  }, materials, { type: 'shed-tile-roof' });
  shed.position.set(x, 0, z);
  group.add(shed);
  return shed;
}

export function createYunnanCourtyardPrototype(userOptions = {}) {
  const options = { ...YUNNAN_COURTYARD_DEFAULTS, ...userOptions };
  const materials = createYunnanMaterialSet({ seed: options.seed, ...(userOptions.materials || {}) });
  const root = tag(new THREE.Group(), {
    type: 'yunnan-courtyard-production-prototype',
    caseId: 'YN_TUANJIE_001_PROCEDURAL_SEED',
    sourceEvidence: [
      'data/evidence/tuanjie_township_001_material_weathering_reference_v5_3_6.json',
      'data/system_v5_2_1.json',
    ],
    exactDimensionsStatus: 'YKY_seed_only_TJ001_dimensions_unresolved',
    materialSystem: 'threejs/YunnanMaterialFactory.js',
  });
  root.userData.options = { ...options };
  root.userData.materialProfiles = Object.values(materials).map((m) => m.userData?.yunnanProfile).filter(Boolean);
  const walls = tag(new THREE.Group(), { layer: 'walls', editable: true });
  const frame = tag(new THREE.Group(), { layer: 'timber-frame', editable: true });
  const roof = tag(new THREE.Group(), { layer: 'roof-tiles', editable: true });
  const ground = tag(new THREE.Group(), { layer: 'stone-and-ground', editable: true });
  const openings = tag(new THREE.Group(), { layer: 'doors-windows', editable: true });
  root.add(ground, walls, frame, roof, openings);

  const W = options.siteWidth;
  const D = options.siteDepth;
  const t = options.wallThickness;
  const H = options.wallHeight;
  const p = options.plinthHeight;
  const courtyardW = options.courtyardWidth;
  const courtyardD = options.courtyardDepth;

  const base = box(W + 0.5, 0.16, D + 0.5, materials.stone, { type: 'stone-foundation-plinth' });
  base.position.y = 0.08;
  ground.add(base);
  addStoneFloor(ground, courtyardW, courtyardD, materials, { type: 'courtyard-stone-paving' });
  const frontStep = box(2.2, 0.14, 0.55, materials.stone, { type: 'front-stone-step' });
  frontStep.position.set(0, 0.18, -D / 2 - 0.3);
  ground.add(frontStep);

  const mainZ = D / 2 - 2.45;
  const sideDepth = D - 4.2;
  addWall(walls, 0, p, D / 2 - t / 2, W, t, H, materials, { type: 'north-main-wall', taper: options.wallTaper });
  addWall(walls, -W / 2 + t / 2, p, 0.15, t, sideDepth, H * 0.9, materials, { type: 'west-side-wall', taper: options.wallTaper });
  addWall(walls, W / 2 - t / 2, p, 0.15, t, sideDepth, H * 0.9, materials, { type: 'east-side-wall', taper: options.wallTaper });
  const southSpan = W / 2 - 2.0;
  addWall(walls, -southSpan / 2 - 2.0 / 2, p, -D / 2 + t / 2, southSpan, t, H * 0.72, materials, { type: 'south-left-wall', taper: options.wallTaper * 0.85 });
  addWall(walls, southSpan / 2 + 2.0 / 2, p, -D / 2 + t / 2, southSpan, t, H * 0.72, materials, { type: 'south-right-wall', taper: options.wallTaper * 0.85 });
  addGable(walls, 0, p + H, D / 2 - t / 2, W, t, H * 0.72, materials, { type: 'north-gable-wall' });

  // The inner gallery is timber-separated rather than exposed structural boxes.
  const galleryZ = D / 2 - 4.8;
  for (const x of [-W / 2 + 1.0, -courtyardW / 2, courtyardW / 2, W / 2 - 1.0]) {
    addRoundColumn(frame, x, p, galleryZ, 0.14, options.floorHeight, materials, { type: 'gallery-column' });
    addRoundColumn(frame, x, p + options.floorHeight, galleryZ, 0.11, H - options.floorHeight, materials, { type: 'upper-gallery-column' });
  }
  for (const x of [-W / 2 + 1.0, -courtyardW / 2, courtyardW / 2, W / 2 - 1.0]) {
    addBeam(frame, x, p + options.floorHeight, galleryZ, 0.18, 0.16, courtyardW + 0.35, 0, materials, { type: 'gallery-floor-beam' });
  }
  addBeam(frame, 0, p + H * 0.52, galleryZ, courtyardW + 1.0, 0.16, 0.18, 0, materials, { type: 'gallery-lintel' });
  addBeam(frame, 0, p + H * 0.72, D / 2 - t - 0.18, W - 0.8, 0.16, 0.18, 0, materials, { type: 'front-of-main-beam' });

  addDoor(openings, 0, p, -D / 2 - 0.01, 1.25, 2.15, materials, { type: 'central-front-door' });
  addHighWindow(openings, -W * 0.28, p + 2.68, D / 2 - t - 0.02, 0.44, 0.38, materials, { type: 'sparse-high-window-left' });
  addHighWindow(openings, W * 0.28, p + 2.68, D / 2 - t - 0.02, 0.44, 0.38, materials, { type: 'sparse-high-window-right' });
  addHighWindow(openings, -W / 2 - 0.02, p + 2.52, 0.55, 0.32, 0.42, materials, { type: 'side-high-window', rotationY: Math.PI / 2 });
  openings.children.at(-1).rotation.y = Math.PI / 2;
  addHighWindow(openings, W / 2 + 0.02, p + 2.52, 0.55, 0.32, 0.42, materials, { type: 'side-high-window', rotationY: -Math.PI / 2 });
  openings.children.at(-1).rotation.y = -Math.PI / 2;

  addStairs(frame, -courtyardW / 2 - 0.55, p, galleryZ - 0.45, 0.92, 1.95, (options.floorHeight - p) / 9, 9, 1, materials, { type: 'west-daily-stair' });
  addStairs(frame, courtyardW / 2 + 0.55, p, galleryZ - 0.45, 0.92, 1.95, (options.floorHeight - p) / 9, 9, 1, materials, { type: 'east-daily-stair' });

  addRoof(roof, {
    width: W + 0.65,
    depth: 4.9,
    eaveY: p + H + 0.05,
    centerZ: mainZ,
    pitch: options.roofPitch,
    eave: options.roofEave,
    tileWidth: options.tileWidth,
    tileLength: options.tileLength,
    tileCourse: options.tileCourse,
    seedOffset: 0,
  }, materials, { type: 'north-main-roof' });
  addRoof(roof, {
    width: sideDepth + 0.55,
    depth: 2.45,
    eaveY: p + H * 0.73,
    centerZ: -0.05,
    pitch: options.roofPitch * 0.92,
    eave: options.roofEave * 0.78,
    tileWidth: options.tileWidth,
    tileLength: options.tileLength,
    tileCourse: options.tileCourse,
    axis: 'z',
    seedOffset: 11,
  }, materials, { type: 'west-ear-roof' }).position.x = -W / 2 + 1.45;
  const eastRoof = addRoof(roof, {
    width: sideDepth + 0.55,
    depth: 2.45,
    eaveY: p + H * 0.73,
    centerZ: -0.05,
    pitch: options.roofPitch * 0.92,
    eave: options.roofEave * 0.78,
    tileWidth: options.tileWidth,
    tileLength: options.tileLength,
    tileCourse: options.tileCourse,
    axis: 'z',
    seedOffset: 17,
  }, materials, { type: 'east-ear-roof' });
  eastRoof.position.x = W / 2 - 1.45;
  addRoof(roof, {
    width: W * 0.52,
    depth: 1.8,
    eaveY: p + H * 0.72,
    centerZ: -D / 2 + 1.1,
    pitch: options.roofPitch * 0.80,
    eave: options.roofEave * 0.72,
    tileWidth: options.tileWidth,
    tileLength: options.tileLength,
    tileCourse: options.tileCourse,
    seedOffset: 23,
  }, materials, { type: 'front-gate-roof' });

  addShed(root, -W / 2 + 1.65, -D / 2 + 1.35, 2.35, 2.6, materials, options, { type: 'left-firewood-shed' });
  addShed(root, W / 2 - 1.65, -D / 2 + 1.35, 2.35, 2.6, materials, options, { type: 'right-firewood-shed' });

  root.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
    if (object.isMesh) object.receiveShadow = true;
  });
  root.userData.stats = { meshCount: 0, vertexCount: 0, triangleCount: 0 };
  root.traverse((object) => {
    if (!object.isMesh) return;
    root.userData.stats.meshCount += 1;
    const position = object.geometry?.getAttribute?.('position');
    root.userData.stats.vertexCount += position?.count || 0;
    root.userData.stats.triangleCount += object.geometry?.index ? object.geometry.index.count / 3 : (position?.count || 0) / 3;
  });
  root.userData.materialSet = materials;
  return root;
}

export function disposeYunnanCourtyardPrototype(root) {
  if (!root) return;
  const materials = root.userData?.materialSet;
  const geometries = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
  });
  geometries.forEach((geometry) => geometry.dispose());
  disposeYunnanMaterialSet(materials);
  root.clear();
}
