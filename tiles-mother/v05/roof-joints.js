/* V0.5 roof-local composition, surface contacts and explicit tile roles. */
(() => {
  'use strict';
  const C = window.TilesStudyCore;
  const G = window.TilesMotherV05Parts.geometry;
  const P = window.TilesMotherV05Profile;
  const parts = window.TilesMotherV05Parts;
  const hash32 = value => { let n = Number(value) >>> 0; n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; };
  const idHash = text => { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return hash32(h); };
  const positionHash = positions => { let h = 2166136261; for (const byte of new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength)) { h ^= byte; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };
  const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const distance = (a, b) => Math.hypot(...subtract(a, b));

  function entitySeeds(base, entityId) {
    const salt = idHash(entityId);
    const out = {};
    for (const [index, key] of ['master', 'shape', 'warp', 'structure', 'damage', 'color', 'weather', 'micro'].entries()) out[key] = hash32((base[key] || 1) ^ salt ^ (index * 101)) || 1;
    return out;
  }

  function plan(panControls, coverControls, roofId = P.geometry.roofId) {
    const panWidth = Number(panControls.width) * 0.01;
    const panLength = Number(panControls.length) * 0.01;
    const panStep = panWidth * 0.86;
    const rowStep = panLength * 0.79;
    const panCurve = Number(panControls.curve) * 0.01;
    const coverCurve = Number(coverControls.curve) * 0.01;
    const panThickness = Number(panControls.thickness) * 0.01;
    const coverThickness = Number(coverControls.thickness) * 0.01;
    // Candidate seat drop: the cover's crown already contains its own
    // curvature. This relative placement is only a visual-fit parameter; it
    // is not a recovered historical height or construction measurement.
    const coverY = panCurve * 0.50 - coverCurve * 0.75 + panThickness * 0.5 + coverThickness * 0.5 + 0.0015;
    const result = [];
    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) result.push({ family: 'pan', role: row === 0 ? 'front-pan' : row === 3 ? 'back-pan' : 'pan', row, col, entityId: `${roofId}/pan/r${row}/c${col}`, x: (col - 1.5) * panStep, y: 0, z: (row - 1.5) * rowStep });
    for (let row = 0; row < 4; row += 1) for (let seam = 0; seam < 3; seam += 1) result.push({ family: 'cover', role: row === 0 ? 'front-cover' : row === 3 ? 'back-cover' : 'cover', row, col: seam, seam, entityId: `${roofId}/cover/r${row}/s${seam}`, x: (seam - 1) * panStep, y: coverY, z: (row - 1.5) * rowStep });
    return { roofId, rows: 4, panColumns: 4, coverSeams: 3, panStep, rowStep, slopeAngleRadians: -0.19, coverY, plan: result };
  }

  function band(mesh, side, axis = 'side', samples = 11) {
    const out = [];
    for (let i = 0; i < samples; i += 1) {
      const t = -0.88 + 1.76 * i / (samples - 1);
      out.push(axis === 'end' ? G.sampleSurface(mesh, t, side) : G.sampleSurface(mesh, side, t));
    }
    return out;
  }

  function coverSeatBand(mesh, side, samples = 11) {
    const out = [];
    const thickness = Number(mesh.tile?.dimensions?.thickness || 0) * 0.92;
    for (let i = 0; i < samples; i += 1) {
      const t = -0.88 + 1.76 * i / (samples - 1);
      const sample = G.sampleSurface(mesh, side, t);
      out.push({ ...sample, position: sample.position.map((v, index) => v - sample.normal[index] * thickness) });
    }
    return out;
  }

  function contactRecord(a, b, label, expectedGap, kind) {
    const distances = a.map(pa => Math.min(...b.map(pb => distance(pa.position, pb.position))));
    const closest = Math.min(...distances); const mean = distances.reduce((x, y) => x + y, 0) / distances.length;
    return { label, kind, expectedGap, closestSurfaceDistance: closest, meanSampleDistance: mean, contactSamples: distances.length, status: closest <= Math.max(expectedGap * 4, 0.012) ? 'candidate-contact' : 'candidate-clearance', method: 'generated top-surface band for pans and cover underside band for seats; nearest samples; triangle-aware mesh diagnostics run separately; not bbox-only' };
  }

  function buildRoof({ profiles, childSeeds, variant = 0, physicalTime = 0, history, roofId = P.geometry.roofId }) {
    const layout = plan(profiles.pan.controls, profiles.cover.controls, roofId);
    const records = [];
    for (const item of layout.plan) {
      const profile = profiles[item.family];
      const bank = childSeeds(profile.seeds, variant);
      const seeds = entitySeeds(bank, item.entityId);
      const tile = G.tile(item.family, item.entityId, seeds.master, profile.controls, seeds);
      const state = C.evolve(tile, physicalTime, history, item.family === 'cover' ? 0.92 : 0.82);
      // Roof mode is an interactive evidence carrier; single-tile mode uses a
      // denser budget. The profile and field are unchanged, only sampling is.
      const mesh = G.mesh(tile, { nu: 36, nv: 52, damage: state.damage });
      const placed = G.transform(mesh, { angleX: layout.slopeAngleRadians, x: item.x, y: item.y, z: item.z }, { roofId, entityId: item.entityId, processId: 'tiles-mother-v0.5-candidate', family: item.family, role: item.role, row: item.row, col: item.col, seam: item.seam ?? null, seeds, surfaceBasis: 'object-local u/v; independent edge thickness-axis field' });
      records.push({ tile: item, mesh: { ...placed, tile, state, seeds, family: item.family, role: item.role, row: item.row, col: item.col, seam: item.seam ?? null } });
    }
    const pans = records.filter(x => x.tile.family === 'pan');
    const covers = records.filter(x => x.tile.family === 'cover');
    const contacts = [];
    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 3; col += 1) {
      const left = pans.find(x => x.tile.row === row && x.tile.col === col);
      const right = pans.find(x => x.tile.row === row && x.tile.col === col + 1);
      contacts.push(contactRecord(band(left.mesh, 0.94), band(right.mesh, -0.94), `pan-overlap-r${row}-c${col}`, layout.panStep * 0.015, 'pan-lateral-overlap'));
    }
    for (let row = 0; row < 4; row += 1) for (let seam = 0; seam < 3; seam += 1) {
      const cover = covers.find(x => x.tile.row === row && x.tile.seam === seam);
      const left = pans.find(x => x.tile.row === row && x.tile.col === seam);
      const right = pans.find(x => x.tile.row === row && x.tile.col === seam + 1);
      contacts.push(contactRecord(coverSeatBand(cover.mesh, -0.20), band(left.mesh, 0.70), `cover-seat-left-r${row}-s${seam}`, 0.0015, 'cover-seam-left'));
      contacts.push(contactRecord(coverSeatBand(cover.mesh, 0.20), band(right.mesh, -0.70), `cover-seat-right-r${row}-s${seam}`, 0.0015, 'cover-seam-right'));
    }
    const frontBack = pans.filter(x => x.tile.col === 1).slice(0, 2);
    const coverFrontBack = covers.filter(x => x.tile.seam === 1).slice(0, 2);
    const compositions = {
      adjacentPans: contacts.filter(x => x.kind === 'pan-lateral-overlap').slice(0, 1),
      frontBackPans: frontBack.length === 2 ? [contactRecord(band(frontBack[0].mesh, 0.86, 'end'), band(frontBack[1].mesh, -0.86, 'end'), 'front-back-pan-r0-r1', layout.rowStep * 0.02, 'pan-longitudinal-lap')] : [],
      frontBackCovers: coverFrontBack.length === 2 ? [contactRecord(band(coverFrontBack[0].mesh, 0.86, 'end'), band(coverFrontBack[1].mesh, -0.86, 'end'), 'front-back-cover-r0-r1', layout.rowStep * 0.02, 'cover-longitudinal-lap')] : [],
      adjacentPanAndCover: contacts.filter(x => x.kind.startsWith('cover-seam')).slice(0, 2)
    };
    const diagnostics = {
      roofId, processId: 'tiles-mother-v0.5-candidate', rows: layout.rows, panColumns: layout.panColumns, coverSeams: layout.coverSeams,
      tileCount: records.length, panCount: pans.length, coverCount: covers.length, roles: [...new Set(layout.plan.map(x => x.role))], contacts,
      compositions, meshes: records.map(({ tile, mesh }) => ({ ...tile, entityId: mesh.meta.entityId, seedFingerprint: { master: mesh.seeds.master, shape: mesh.seeds.shape, color: mesh.seeds.color, micro: mesh.seeds.micro }, positionHash: positionHash(mesh.positions), geometry: G.diagnostics(mesh), edgeProfile: G.edgeProfile(mesh), metrics: mesh.metrics, state: mesh.state })),
      placement: { coordinateSystem: P.geometry.coordinateSystem, sourceOfDimensions: P.geometry.dimensions, physicalScale: P.geometry.physicalScale, slopeAngleRadians: layout.slopeAngleRadians, bboxOnlyContactUsed: false, interlockStatus: 'candidate only; contact distances are visual fit evidence, not historical construction validation' },
      history: { physicalTime, solverStepSeconds: history?.solverStepSeconds ?? 21600, displayTime: physicalTime, calibrationStatus: 'illustrative_not_calibrated' }
    };
    return { plan: layout, records, meshes: records.map(x => x.mesh), diagnostics };
  }

  parts.roof = Object.freeze({ buildRoof, entitySeeds, plan, contactRecord, positionHash });
})();
