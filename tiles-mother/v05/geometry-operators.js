/*
 * Tiles Mother V0.5 geometry candidate.
 * The source FBX is not a runtime dependency. C04 event fields are reused only
 * as a lightweight observed-family starting point; this file owns the V0.5
 * surface, thickness and edge response.
 */
(() => {
  'use strict';
  const C = window.TilesStudyCore;
  const P = window.TilesMotherV05Profile;
  const parts = window.TilesMotherV05Parts || (window.TilesMotherV05Parts = {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const n = Math.hypot(...a) || 1; return a.map(v => v / n); };
  const hash = text => C.hash(String(text) + '|tiles-mother-v05');
  const noise = (x, y, seed) => C.noise(x, y, seed);
  const fbm = (x, y, seed) => C.fbm(x, y, seed);

  function shapePoint(u, v, tile) {
    const d = tile.dimensions;
    const family = tile.profile;
    const familyProfile = P.families[family];
    const end = Math.abs(v);
    const hand = (fbm(u * 2.3 + 3, v * 1.7 - 2, tile.seeds.shape) - 0.5) * d.width * 0.012;
    const endVariation = (noise(v * 2.1 + 4, u * 1.2 - 6, tile.seeds.shape) - 0.5) * 0.018;
    const width = d.width * (1 - d.taper * end * 0.43 + endVariation * d.taper);
    let x;
    let y;
    if (family === 'cover') {
      const arc = u * Math.PI * 0.475;
      x = Math.sin(arc) * width * 0.5;
      y = Math.cos(arc) * d.curve - d.curve * 0.5;
    } else {
      x = u * width * 0.5;
      y = (u * u - 0.48) * d.curve;
    }
    const longitudinal = (fbm(u * 2.6 + 9, v * 2.4 + 5, tile.seeds.forming) - 0.5) * d.curve * 0.035;
    return [x + hand * (1 - end * 0.35), y + longitudinal, v * d.length * 0.5];
  }

  function surfaceNormal(u, v, tile) {
    const du = 0.0008;
    const dv = 0.0008;
    const alongV = sub(shapePoint(u, v + dv, tile), shapePoint(u, v - dv, tile));
    const alongU = sub(shapePoint(u + du, v, tile), shapePoint(u - du, v, tile));
    return norm(cross(alongV, alongU));
  }

  function tile(profile, id, master, controls, bank) {
    const t = C.tile(profile, id, master, controls, bank);
    const c = controls || {};
    t.parameters.relief = clamp(Number(c.warp ?? 22) / 22, 0, 2);
    t.parameters.forming = clamp(Number(c.warp ?? 22) / 22, 0, 2);
    t.parameters.pores = clamp(Number(c.pores ?? 32) / 32, 0, 2);
    t.parameters.edge = clamp(Number(c.damage ?? 18) / 18, 0, 2);
    t.v05Profile = familyProfile(profile);
    return t;
  }

  function familyProfile(profile) { return P.families[profile]; }

  function edgeWear(u, v, tile, damage) {
    const edge = smooth(0.82, 1, Math.max(Math.abs(u), Math.abs(v)));
    const islands = smooth(0.60, 0.91, noise(u * 9.2 + v * 2, v * 7.1, tile.seeds.flake));
    const corner = smooth(0.84, 1, Math.abs(u)) * smooth(0.76, 1, Math.abs(v));
    return edge * (0.25 * islands + 0.75 * corner) * clamp(damage, 0, 1);
  }

  function mesh(t, options = {}) {
    const nu = options.nu || 48;
    const nv = options.nv || 64;
    const damage = Number(options.damage || 0);
    if (!Number.isInteger(nu) || !Number.isInteger(nv) || nu < 12 || nv < 12 || nu > 180 || nv > 220) throw Error('invalid V0.5 mesh budget');
    const events = C.events(t);
    const count = (nu + 1) * (nv + 1);
    const top = new Array(count);
    const back = new Array(count);
    const positions = [];
    const uv = [];
    const cavities = [];
    const flakes = [];
    const relief = [];
    const faces = [];
    const indices = [];
    let minThickness = Infinity;
    let minTop = Infinity;
    let maxTop = -Infinity;
    const hitMap = Object.fromEntries(events.map(event => [event.id, 0]));
    const at = (i, j) => j * (nu + 1) + i;
    for (let j = 0; j <= nv; j += 1) for (let i = 0; i <= nu; i += 1) {
      const u = i / nu * 2 - 1;
      const v = j / nv * 2 - 1;
      const p = shapePoint(u, v, t);
      const n = surfaceNormal(u, v, t);
      const f = C.field(u, v, t, events, damage);
      const wear = edgeWear(u, v, t, damage);
      const topDelta = f.top - wear * t.dimensions.thickness * 0.095;
      const backDelta = f.bottom + wear * t.dimensions.thickness * 0.035;
      const half = t.dimensions.thickness * 0.5;
      top[at(i, j)] = p.map((x, k) => x + n[k] * (half + topDelta));
      back[at(i, j)] = p.map((x, k) => x + n[k] * (-half + backDelta));
      positions.push(...top[at(i, j)]);
      uv.push((u + 1) * 0.5, (v + 1) * 0.5);
      cavities.push(f.cavity);
      flakes.push(f.flake);
      relief.push(topDelta);
      faces.push(1);
      minThickness = Math.min(minThickness, t.dimensions.thickness + topDelta - backDelta);
      minTop = Math.min(minTop, topDelta);
      maxTop = Math.max(maxTop, topDelta);
      for (const hit of f.hits) hitMap[hit] += 1;
    }
    for (const p of back) { positions.push(...p); uv.push(0, 0); cavities.push(0); flakes.push(0); relief.push(0); faces.push(0); }
    for (let j = 0; j < nv; j += 1) for (let i = 0; i < nu; i += 1) {
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      indices.push(a, b, c, b, d, c);
      indices.push(count + a, count + c, count + b, count + b, count + c, count + d);
    }
    const boundary = [];
    for (let i = 0; i <= nu; i += 1) boundary.push(at(i, 0));
    for (let j = 1; j <= nv; j += 1) boundary.push(at(nu, j));
    for (let i = nu - 1; i >= 0; i -= 1) boundary.push(at(i, nv));
    for (let j = nv - 1; j > 0; j -= 1) boundary.push(at(0, j));
    // The wall has its own vertex ring. This keeps a real normal seam between
    // surface and edge while spatial welding still proves the shell is closed.
    const edgeTop = new Map(), edgeBack = new Map();
    for (const a of boundary) {
      const b = boundary[(boundary.indexOf(a) + 1) % boundary.length];
      if (!edgeTop.has(a)) { edgeTop.set(a, positions.length / 3); positions.push(...top[a]); uv.push(0, 0); cavities.push(0); flakes.push(0); relief.push(0); faces.push(-1); }
      if (!edgeBack.has(a)) { edgeBack.set(a, positions.length / 3); positions.push(...back[a]); uv.push(0, 0); cavities.push(0); flakes.push(0); relief.push(0); faces.push(-1); }
      if (!edgeTop.has(b)) { edgeTop.set(b, positions.length / 3); positions.push(...top[b]); uv.push(0, 0); cavities.push(0); flakes.push(0); relief.push(0); faces.push(-1); }
      if (!edgeBack.has(b)) { edgeBack.set(b, positions.length / 3); positions.push(...back[b]); uv.push(0, 0); cavities.push(0); flakes.push(0); relief.push(0); faces.push(-1); }
      const aTop = edgeTop.get(a), bTop = edgeTop.get(b), aBack = edgeBack.get(a), bBack = edgeBack.get(b);
      indices.push(aTop, aBack, bTop, bTop, aBack, bBack);
    }
    const P3 = new Float32Array(positions);
    const N3 = new Float32Array(P3.length);
    const addNormal = (index, n) => { N3[index * 3] = n[0]; N3[index * 3 + 1] = n[1]; N3[index * 3 + 2] = n[2]; };
    for (let j = 0; j <= nv; j += 1) for (let i = 0; i <= nu; i += 1) {
      const u = i / nu * 2 - 1, v = j / nv * 2 - 1, n = surfaceNormal(u, v, t);
      addNormal(at(i, j), n); addNormal(count + at(i, j), n.map(x => -x));
    }
    for (const a of boundary) {
      const b = boundary[(boundary.indexOf(a) + 1) % boundary.length];
      const ba = edgeBack.get(a), bb = edgeBack.get(b), ea = edgeTop.get(a), eb = edgeTop.get(b);
      const pa = P3.slice(a * 3, a * 3 + 3), pb = P3.slice(b * 3, b * 3 + 3), pba = P3.slice(ba * 3, ba * 3 + 3);
      const side = norm(cross(sub(pb, pa), sub(pba, pa)));
      addNormal(ea, side); addNormal(eb, side); addNormal(ba, side); addNormal(bb, side);
    }
    return {
      positions: P3, normals: N3, uv: new Float32Array(uv), cavities: new Float32Array(cavities),
      flakes: new Float32Array(flakes), relief: new Float32Array(relief), face: new Float32Array(faces),
      indices: new Uint32Array(indices), nu, nv, count, profile: t.profile, tile: t, v05: true,
      metrics: { minThickness, minimumAllowedThickness: t.dimensions.thickness * 0.55, topPeakToValley: maxTop - minTop, hitMap, throughHoles: false, undercuts: false, scaleCalibration: 'experimental_not_measured' }
    };
  }

  function spatialKey(positions, index, tolerance = 1e-6) { const i = index * 3; return [0, 1, 2].map(k => Math.round(positions[i + k] / tolerance)).join(':'); }
  function edgeKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }
  function diagnostics(m) {
    const edgeCounts = new Map(), spatial = new Map(); let degenerate = 0;
    const counts = { surfaceTop: 0, surfaceBack: 0, edge: 0, unknown: 0 };
    for (let i = 0; i < m.indices.length; i += 3) {
      const a = m.indices[i], b = m.indices[i + 1], c = m.indices[i + 2];
      const pa = m.positions.slice(a * 3, a * 3 + 3), pb = m.positions.slice(b * 3, b * 3 + 3), pc = m.positions.slice(c * 3, c * 3 + 3);
      if (!(Math.hypot(...cross(sub(pb, pa), sub(pc, pa))) * 0.5 > 1e-10)) degenerate += 1;
      const flag = m.face[a]; if (flag === 1) counts.surfaceTop += 1; else if (flag === 0) counts.surfaceBack += 1; else if (flag === -1) counts.edge += 1; else counts.unknown += 1;
      for (const [x, y] of [[a, b], [b, c], [c, a]]) { edgeCounts.set(edgeKey(x, y), (edgeCounts.get(edgeKey(x, y)) || 0) + 1); const sx = spatialKey(m.positions, x), sy = spatialKey(m.positions, y), key = sx < sy ? `${sx}|${sy}` : `${sy}|${sx}`; spatial.set(key, (spatial.get(key) || 0) + 1); }
    }
    const boundaryEdges = [...edgeCounts.values()].filter(v => v === 1).length;
    const spatialBoundaryEdges = [...spatial.values()].filter(v => v === 1).length;
    const normals = []; for (let i = 0; i < m.normals.length; i += 3) normals.push(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]));
    return { vertexCount: m.positions.length / 3, triangleCount: m.indices.length / 3, faceCounts: counts, degenerateTriangles: degenerate, minNormalLength: Math.min(...normals), maxNormalLength: Math.max(...normals), boundaryEdges, closedByIndexedIncidence: boundaryEdges === 0, boundaryEdgesBySpatialPosition: spatialBoundaryEdges, overSharedEdgesBySpatialPosition: [...spatial.values()].filter(v => v > 2).length, closedBySpatialIncidence: spatialBoundaryEdges === 0, edgeNormalSpace: 'local thickness axis; edge normals are separately assigned', topologyNote: 'top/back normals are not averaged into edge normals' };
  }

  function sampleSurface(mesh, u, v) {
    const x = clamp((u + 1) * 0.5 * mesh.nu, 0, mesh.nu), y = clamp((v + 1) * 0.5 * mesh.nv, 0, mesh.nv), i = Math.round(x), j = Math.round(y), k = (j * (mesh.nu + 1) + i) * 3;
    return { position: Array.from(mesh.positions.slice(k, k + 3)), normal: norm(Array.from(mesh.normals.slice(k, k + 3))), u, v };
  }
  function surfaceBand(mesh, side, samples = 11) { const out = []; for (let i = 0; i < samples; i += 1) out.push(sampleSurface(mesh, side, -0.88 + 1.76 * i / (samples - 1))); return out; }
  function edgeProfile(mesh, samples = 17) { const rows = []; for (let i = 0; i < samples; i += 1) { const v = -0.88 + 1.76 * i / (samples - 1); const l = sampleSurface(mesh, -0.98, v), r = sampleSurface(mesh, 0.98, v); rows.push({ v, left: l, right: r, width: Math.hypot(...sub(r.position, l.position)) }); } const widths = rows.map(x => x.width); return { samples: rows, widthMin: Math.min(...widths), widthMax: Math.max(...widths), widthMean: widths.reduce((a, b) => a + b, 0) / widths.length, axis: 'local u/v with independent thickness-axis edge response' }; }
  function transform(mesh, pose, meta) { const c = Math.cos(pose.angleX || 0), s = Math.sin(pose.angleX || 0), out = new Float32Array(mesh.positions.length), nrm = new Float32Array(mesh.normals.length); for (let i = 0; i < mesh.positions.length; i += 3) { const x = mesh.positions[i], y = mesh.positions[i + 1], z = mesh.positions[i + 2]; out[i] = x + (pose.x || 0); out[i + 1] = y * c - z * s + (pose.y || 0); out[i + 2] = y * s + z * c + (pose.z || 0); const nx = mesh.normals[i], ny = mesh.normals[i + 1], nz = mesh.normals[i + 2]; nrm[i] = nx; nrm[i + 1] = ny * c - nz * s; nrm[i + 2] = ny * s + nz * c; } return { ...mesh, positions: out, normals: nrm, meta: { ...meta, pose } }; }
  function nearestDistance(a, b) { let d = Infinity; for (const pa of a) for (const pb of b) d = Math.min(d, Math.hypot(...sub(pa.position, pb.position))); return d; }
  parts.geometry = Object.freeze({ tile, mesh, diagnostics, sampleSurface, surfaceBand, edgeProfile, transform, nearestDistance, familyProfile, clamp });
})();
