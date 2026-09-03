
/* Tiles Mother V0.9.1 final-surface shell generator.
 * Geometry is procedural. Reference dimensions and material response remain candidates.
 */
(() => {
  'use strict';
  const C = window.TilesStudyCore;
  const P = window.TilesMotherV08Profile;
  const parts = window.TilesMotherV08Parts || (window.TilesMotherV08Parts = {});
  if (!C || !P) throw Error('Tiles Mother V0.8 geometry dependencies are missing');

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / Math.max(1e-9, b - a));
    return t * t * (3 - 2 * t);
  };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => {
    const length = Math.hypot(a[0], a[1], a[2]);
    return length > 1e-12 ? [a[0] / length, a[1] / length, a[2] / length] : [0, 1, 0];
  };
  const orthogonalTangent = (along, normal) => norm(sub(along, mul(normal, dot(along, normal))));
  const noise = (x, y, seed) => C.noise(x, y, seed);
  const fbm = (x, y, seed) => C.fbm(x, y, seed);
  const at = (i, j, nu) => j * (nu + 1) + i;

  function familyProfile(profile) {
    const result = P.families[profile];
    if (!result) throw Error(`unknown V0.8 tile family ${profile}`);
    return result;
  }

  function tile(profile, id, master, controls, bank) {
    const result = C.tile(profile, id, master, controls, bank);
    const c = controls || {};
    result.parameters.relief = clamp(Number(c.warp ?? 22) / 22, 0, 2.25);
    result.parameters.forming = clamp(Number(c.warp ?? 22) / 22, 0, 2.25);
    result.parameters.pores = clamp(Number(c.pores ?? 32) / 32, 0, 2.25);
    result.parameters.edge = clamp(Number(c.damage ?? 18) / 18, 0, 2.25);
    result.v07Profile = familyProfile(profile);
    result.v07Controls = { ...c };
    return result;
  }

  function centerPoint(u, v, t) {
    const d = t.dimensions;
    const f = familyProfile(t.profile);
    const end = Math.abs(v);
    // Historic pan and cover tiles are directionally tapered: the eave end is wider,
    // the ridge end is narrower. The signed v term is essential for nesting.
    const directionalTaper = 1 - d.taper * v * 0.5;
    const handmadeWidth = (fbm(v * 2.35 + 5.2, v * 5.9 - 1.1, t.seeds.shape) - 0.5) * 0.018;
    const width = d.width * (directionalTaper + handmadeWidth * (1 - end * 0.25));
    const twistField = (fbm(v * 1.25 + 7.1, u * 1.65 - 4.3, t.seeds.forming) - 0.5);
    const crossSkew = (noise(u * 2.9 + 1.7, v * 2.2 + 8.1, t.seeds.shape + 53) - 0.5);
    const endCrook = (noise(v * 3.4 + 2.9, u * 1.3 + 8.1, t.seeds.shape) - 0.5) * d.length * 0.0075 * smooth(0.52, 1, end);
    let x;
    let y;
    if (t.profile === 'cover') {
      const arc = u * Math.PI * 0.472;
      x = Math.sin(arc) * width * 0.5;
      y = Math.cos(arc) * d.curve * directionalTaper - d.curve * 0.50;
      y += u * crossSkew * d.thickness * 0.10;
    } else {
      x = u * width * 0.5;
      y = (u * u - 0.51) * d.curve;
      y += u * crossSkew * d.thickness * 0.12;
    }
    const longCamber = Math.sin((v + 1) * Math.PI * 0.5) * (fbm(u * 1.8 + 11, v * 2.0 - 3, t.seeds.forming + 31) - 0.43) * d.thickness * 0.22 * f.formingAmplitude;
    const localSag = -(1 - u * u) * (1 - v * v) * d.thickness * f.localSagAmplitude * (0.055 + 0.075 * noise(3.2 + u, 7.7 + v, t.seeds.shape));
    const twist = u * v * twistField * d.thickness * 0.30 * f.formingAmplitude;
    const edgeKick = smooth(0.76, 1, Math.abs(u)) * (noise(v * 7.5, u * 2.3, t.seeds.shape + 117) - 0.5) * d.thickness * 0.12;
    return [x + twistField * d.width * 0.006 * (1 - end * 0.35), y + longCamber + localSag + twist + edgeKick, v * d.length * 0.5 + endCrook];
  }

  function baseNormal(u, v, t) {
    const e = 0.001;
    const alongV = sub(centerPoint(u, clamp(v + e, -1, 1), t), centerPoint(u, clamp(v - e, -1, 1), t));
    const alongU = sub(centerPoint(clamp(u + e, -1, 1), v, t), centerPoint(clamp(u - e, -1, 1), v, t));
    return norm(cross(alongV, alongU));
  }

  function handRelief(u, v, t, events, damage) {
    const T=t.dimensions.thickness,s=t.seeds;
    const f=t.parameters.forming,por=t.parameters.pores;
    const q=u+.026*(fbm(u*3,v*3,s.forming)-.5);
    const r=v+.019*(fbm(u*3+9,v*3,s.shape)-.5);
    const broad=(fbm(q*2.8,r*3.2,s.forming)-.5)*T*.22*f;
    const middle=(noise(q*13.3,r*15.5,s.forming+103)-.5)*T*.04*f;
    const paddle=Math.sin(v*17+u*2+noise(u*2,v*2,s.shape))*T*.019*f* smooth(.35,.7,fbm(u*4,v*4,s.forming+227));
    let cavity=0,flake=0,drag=0,rim=0;const hits=[];
    for(const e of events){
      const dx=u-e.u,dy=v-e.v,ca=Math.cos(e.angle),sa=Math.sin(e.angle);
      let x=(dx*ca+dy*sa)/e.ru,y=(-dx*sa+dy*ca)/e.rv;
      if(e.type==='drag'){
        x+=.18*Math.sin(y*3+e.phase);
        const d=Math.exp(-x*x*6)*Math.max(0,1-y*y)**2;
        drag+=e.depth*d*.60*f;if(d>.08)hits.push(e.id);continue;
      }
      let rr=Math.hypot(x,y),a=Math.atan2(y,x);
      rr/=1+.14*Math.sin(a*3+e.phase)+.07*Math.sin(a*7-e.phase);
      if(rr>1.25)continue;
      // Finite flat-bottom pockets, narrow fracture lips, no Gaussian all-over lumps.
      const inner=1-smooth(.46,.98,rr);
      if(e.type==='cavity'){
        cavity=Math.max(cavity,e.depth*inner*por*(1+damage*.16));
        rim=Math.max(rim,e.depth*.085*Math.exp(-(((rr-1.01)/.09)**2))*por);
      } else flake=Math.max(flake,e.depth*(1-smooth(.72,1.04,rr))*.60);
      if(rr<.98)hits.push(e.id);
    }
    const edge=smooth(.88,1,Math.max(Math.abs(u),Math.abs(v)))*smooth(.38,.76,fbm(u*8,v*8,s.flake));
    const chamfer=smooth(.976,1,Math.max(Math.abs(u),Math.abs(v)))*T*.085;
    const wear=edge*T*(.024+damage*.045)*t.parameters.edge;
    const top=clamp(broad+middle+paddle-drag-cavity-flake+rim-wear-chamfer,-.42*T,.22*T);
    const back=(fbm(u*4.7,v*6.1,s.forming+71)-.5)*T*.06+chamfer;
    return {top,back,cavity:clamp(cavity/(T*.20)),flake:clamp(flake/(T*.065)),
      forming:clamp(.5+broad/(T*.25)),scrape:clamp(drag/(T*.08)),edgeWear:edge,hits};
  }

  function outlineInset(u, v, t, damage) {
    const T = t.dimensions.thickness;
    const f = familyProfile(t.profile);
    const side = smooth(0.86, 1, Math.abs(u));
    const end = smooth(0.86, 1, Math.abs(v));
    const sideNoise = smooth(0.43, 0.83, fbm(v * 11 + 3, u * 2.2 - 9, t.seeds.flake + 137));
    const endNoise = smooth(0.45, 0.84, fbm(u * 12 - 4, v * 2.1 + 6, t.seeds.flake + 173));
    const strength = f.edgeBreakAmplitude * clamp(0.28 + damage, 0, 1.5);
    return {
      x: Math.sign(u || 1) * side * sideNoise * T * 0.18 * strength,
      z: Math.sign(v || 1) * end * endNoise * T * 0.15 * strength
    };
  }

  function gridFrame(grid, i, j, nu, nv, flip = false) {
    const pL = grid[at(Math.max(0, i - 1), j, nu)];
    const pR = grid[at(Math.min(nu, i + 1), j, nu)];
    const pD = grid[at(i, Math.max(0, j - 1), nu)];
    const pU = grid[at(i, Math.min(nv, j + 1), nu)];
    const alongU = sub(pR, pL);
    const alongV = sub(pU, pD);
    let normal = norm(cross(alongV, alongU));
    if (flip) normal = mul(normal, -1);
    const tangent = orthogonalTangent(alongU, normal);
    const handedness = dot(cross(normal, tangent), alongV) < 0 ? -1 : 1;
    return { normal, tangent: [...tangent, handedness] };
  }

  function appendEdgeStrip({ name, code, pointIndices, top, back, positions, normals, tangents, uv, cavities, flakes, relief, face, section, indices, tile: t }) {
    const segments = pointIndices.length - 1;
    const depthSegments = 4;
    const baseIndex = positions.length / 3;
    const family = familyProfile(t.profile);
    const T = t.dimensions.thickness;
    const grid = [];
    const localFrame = [];

    for (let k = 0; k <= segments; k += 1) {
      const idx = pointIndices[k];
      const prev = pointIndices[Math.max(0, k - 1)];
      const next = pointIndices[Math.min(segments, k + 1)];
      const along = sub(top[next], top[prev]);
      const thickness = sub(back[idx], top[idx]);
      const sideNormal = norm(cross(along, thickness));
      localFrame.push({ along, sideNormal });
      const row = [];
      for (let q = 0; q <= depthSegments; q += 1) {
        const depth = q / depthSegments;
        let p = add(top[idx], mul(sub(back[idx], top[idx]), depth));
        const envelope = Math.sin(Math.PI * depth) * Math.sin(Math.PI * (k / Math.max(1, segments)));
        const chipped = (noise(k * 0.77 + code * 7.1, depth * 5.2 + 3, t.seeds.flake + 701 + Math.abs(code) * 37) - 0.5) * 2;
        const pressed = (fbm(k * 0.31 + 5, depth * 3.4 - 2, t.seeds.forming + 809 + Math.abs(code) * 19) - 0.5) * 2;
        const offset = envelope * T * (chipped * 0.040 * family.edgeBreakAmplitude + pressed * 0.025 * family.backCompressionAmplitude);
        p = add(p, mul(sideNormal, offset));
        row.push(p);
        positions.push(...p);
        uv.push(k / Math.max(1, segments), depth);
        cavities.push(0);
        flakes.push(clamp(0.45 + chipped * 0.32, 0, 1));
        relief.push(offset);
        face.push(code);
        section.push(clamp(0.5 + pressed * 0.35 + chipped * 0.15, 0, 1));
        normals.push(0, 0, 0);
        tangents.push(0, 0, 0, 1);
      }
      grid.push(row);
    }

    const edgeAt = (k, q) => baseIndex + k * (depthSegments + 1) + q;
    for (let k = 0; k < segments; k += 1) for (let q = 0; q < depthSegments; q += 1) {
      const a = edgeAt(k, q), b = edgeAt(k, q + 1), c = edgeAt(k + 1, q), d = edgeAt(k + 1, q + 1);
      indices.push(a, c, b, c, d, b);
    }
    for (let k = 0; k <= segments; k += 1) for (let q = 0; q <= depthSegments; q += 1) {
      const pS0 = grid[Math.max(0, k - 1)][q];
      const pS1 = grid[Math.min(segments, k + 1)][q];
      const pQ0 = grid[k][Math.max(0, q - 1)];
      const pQ1 = grid[k][Math.min(depthSegments, q + 1)];
      const alongS = sub(pS1, pS0);
      const alongQ = sub(pQ1, pQ0);
      const n = norm(cross(alongS, alongQ));
      const tangent = [...orthogonalTangent(alongS, n), 1];
      const outIndex = edgeAt(k, q);
      normals[outIndex * 3] = n[0]; normals[outIndex * 3 + 1] = n[1]; normals[outIndex * 3 + 2] = n[2];
      tangents[outIndex * 4] = tangent[0]; tangents[outIndex * 4 + 1] = tangent[1]; tangents[outIndex * 4 + 2] = tangent[2]; tangents[outIndex * 4 + 3] = 1;
    }
    return { name, code, vertexStart: baseIndex, vertexCount: (segments + 1) * (depthSegments + 1), segments, depthSegments };
  }

  function mesh(t, options = {}) {
    const budget = options.budget || P.mesh.single;
    const nu = Number(options.nu || budget.nu);
    const nv = Number(options.nv || budget.nv);
    const damage = Number(options.damage || 0);
    if (!Number.isInteger(nu) || !Number.isInteger(nv) || nu < 12 || nv < 12 || nu > 180 || nv > 240) throw Error('invalid V0.8 mesh budget');
    const events = C.events(t);
    const count = (nu + 1) * (nv + 1);
    const top = new Array(count);
    const back = new Array(count);
    const fields = new Array(count);
    const baseNormals = new Array(count);
    const hitMap = Object.fromEntries(events.map(event => [event.id, 0]));
    let minThickness = Infinity;
    let minTop = Infinity;
    let maxTop = -Infinity;

    for (let j = 0; j <= nv; j += 1) for (let i = 0; i <= nu; i += 1) {
      const u = i / nu * 2 - 1;
      const v = j / nv * 2 - 1;
      const center = centerPoint(u, v, t);
      const inset = outlineInset(u, v, t, damage);
      center[0] -= inset.x;
      center[2] -= inset.z;
      const n = baseNormal(u, v, t);
      const field = handRelief(u, v, t, events, damage);
      const minimumLocalThickness = t.dimensions.thickness * P.mesh.minimumThicknessFraction;
      const localThickness = t.dimensions.thickness + field.top - field.back;
      if (localThickness < minimumLocalThickness) {
        const correction = minimumLocalThickness - localThickness;
        // Preserve the handmade top silhouette while preventing physically impossible paper-thin clay.
        field.top += correction * 0.68;
        field.back -= correction * 0.32;
      }
      const half = t.dimensions.thickness * 0.5;
      const index = at(i, j, nu);
      top[index] = add(center, mul(n, half + field.top));
      back[index] = add(center, mul(n, -half + field.back));
      fields[index] = field;
      baseNormals[index] = n;
      minThickness = Math.min(minThickness, t.dimensions.thickness + field.top - field.back);
      minTop = Math.min(minTop, field.top);
      maxTop = Math.max(maxTop, field.top);
      for (const hit of field.hits) hitMap[hit] += 1;
    }

    const positions = [];
    const normals = [];
    const tangents = [];
    const uv = [];
    const cavities = [];
    const flakes = [];
    const relief = [];
    const face = [];
    const section = [];
    const indices = [];
    let normalDeltaSum = 0;
    let maxTangentDot = 0;

    for (let j = 0; j <= nv; j += 1) for (let i = 0; i <= nu; i += 1) {
      const index = at(i, j, nu);
      const frame = gridFrame(top, i, j, nu, nv, false);
      positions.push(...top[index]); normals.push(...frame.normal); tangents.push(...frame.tangent);
      uv.push(i / nu, j / nv); cavities.push(fields[index].cavity); flakes.push(fields[index].flake);
      relief.push(fields[index].top); face.push(1); section.push(fields[index].forming * 0.65 + fields[index].scrape * 0.35);
      normalDeltaSum += Math.acos(clamp(dot(frame.normal, baseNormals[index]), -1, 1)) * 180 / Math.PI;
      maxTangentDot = Math.max(maxTangentDot, Math.abs(dot(frame.normal, frame.tangent)));
    }
    for (let j = 0; j <= nv; j += 1) for (let i = 0; i <= nu; i += 1) {
      const index = at(i, j, nu);
      const frame = gridFrame(back, i, j, nu, nv, true);
      positions.push(...back[index]); normals.push(...frame.normal); tangents.push(...frame.tangent);
      uv.push(i / nu, j / nv); cavities.push(0); flakes.push(0);
      relief.push(fields[index].back); face.push(0); section.push(fields[index].edgeWear * 0.35);
      maxTangentDot = Math.max(maxTangentDot, Math.abs(dot(frame.normal, frame.tangent)));
    }
    for (let j = 0; j < nv; j += 1) for (let i = 0; i < nu; i += 1) {
      const a = at(i, j, nu), b = at(i + 1, j, nu), c = at(i, j + 1, nu), d = at(i + 1, j + 1, nu);
      indices.push(a, c, b, b, c, d);
      indices.push(count + a, count + b, count + c, count + b, count + d, count + c);
    }

    const segments = [
      { name: 'eave', code: -1, pointIndices: Array.from({ length: nu + 1 }, (_, i) => at(i, 0, nu)) },
      { name: 'right', code: -2, pointIndices: Array.from({ length: nv + 1 }, (_, j) => at(nu, j, nu)) },
      { name: 'ridge', code: -3, pointIndices: Array.from({ length: nu + 1 }, (_, k) => at(nu - k, nv, nu)) },
      { name: 'left', code: -4, pointIndices: Array.from({ length: nv + 1 }, (_, k) => at(0, nv - k, nu)) }
    ];
    const edgeGroups = segments.map(segment => appendEdgeStrip({ ...segment, top, back, positions, normals, tangents, uv, cavities, flakes, relief, face, section, indices, tile: t }));

    const result = {
      positions: new Float32Array(positions), normals: new Float32Array(normals), tangents: new Float32Array(tangents),
      uv: new Float32Array(uv), cavities: new Float32Array(cavities), flakes: new Float32Array(flakes),
      relief: new Float32Array(relief), face: new Float32Array(face), section: new Float32Array(section),
      indices: ((positions.length / 3) <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices)), nu, nv, count, profile: t.profile, tile: t, v07: true, edgeGroups,
      metrics: {
        minThickness,
        minimumAllowedThickness: t.dimensions.thickness * P.mesh.minimumThicknessFraction,
        topPeakToValley: maxTop - minTop,
        finalNormalDeltaDegreesMean: normalDeltaSum / count,
        maxNormalTangentDot: maxTangentDot,
        hitMap,
        throughHoles: false,
        undercuts: false,
        scaleCalibration: P.roof.scaleCalibration,
        normalSource: 'recomputed from final displaced top and back coordinates',
        tangentSource: 'orthogonalized final surface u derivative',
        edgeCoordinateSystem: 'four independent continuous section strips'
      }
    };
    return result;
  }

  function spatialKey(positions, index, tolerance = 1e-6) {
    const i = index * 3;
    return [0, 1, 2].map(k => Math.round(positions[i + k] / tolerance)).join(':');
  }
  const edgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

  function diagnostics(m) {
    const indexed = new Map();
    const spatial = new Map();
    const counts = { surfaceTop: 0, surfaceBack: 0, eave: 0, right: 0, ridge: 0, left: 0, unknown: 0 };
    let degenerateTriangles = 0;
    let flippedWindingTriangles = 0;
    let minWindingNormalDot = 1;
    let windingNormalDotSum = 0;
    for (let i = 0; i < m.indices.length; i += 3) {
      const a = m.indices[i], b = m.indices[i + 1], c = m.indices[i + 2];
      const pa = Array.from(m.positions.slice(a * 3, a * 3 + 3));
      const pb = Array.from(m.positions.slice(b * 3, b * 3 + 3));
      const pc = Array.from(m.positions.slice(c * 3, c * 3 + 3));
      const geometricCross = cross(sub(pb, pa), sub(pc, pa));
      if (Math.hypot(...geometricCross) * 0.5 <= 1e-11) degenerateTriangles += 1;
      const geometricNormal = norm(geometricCross);
      const averageNormal = norm([
        m.normals[a * 3] + m.normals[b * 3] + m.normals[c * 3],
        m.normals[a * 3 + 1] + m.normals[b * 3 + 1] + m.normals[c * 3 + 1],
        m.normals[a * 3 + 2] + m.normals[b * 3 + 2] + m.normals[c * 3 + 2]
      ]);
      const windingDot = dot(geometricNormal, averageNormal);
      minWindingNormalDot = Math.min(minWindingNormalDot, windingDot);
      windingNormalDotSum += windingDot;
      if (windingDot < 0) flippedWindingTriangles += 1;
      const flag = m.face[a];
      if (flag === 1) counts.surfaceTop += 1;
      else if (flag === 0) counts.surfaceBack += 1;
      else if (flag === -1) counts.eave += 1;
      else if (flag === -2) counts.right += 1;
      else if (flag === -3) counts.ridge += 1;
      else if (flag === -4) counts.left += 1;
      else counts.unknown += 1;
      for (const [x, y] of [[a, b], [b, c], [c, a]]) {
        indexed.set(edgeKey(x, y), (indexed.get(edgeKey(x, y)) || 0) + 1);
        const sx = spatialKey(m.positions, x), sy = spatialKey(m.positions, y);
        const key = sx < sy ? `${sx}|${sy}` : `${sy}|${sx}`;
        spatial.set(key, (spatial.get(key) || 0) + 1);
      }
    }
    const normalLengths = [];
    let maxTangentDot = 0;
    for (let i = 0, t = 0; i < m.normals.length; i += 3, t += 4) {
      const n = [m.normals[i], m.normals[i + 1], m.normals[i + 2]];
      const tangent = [m.tangents[t], m.tangents[t + 1], m.tangents[t + 2]];
      normalLengths.push(Math.hypot(...n));
      maxTangentDot = Math.max(maxTangentDot, Math.abs(dot(n, tangent)));
    }
    const indexedBoundary = [...indexed.values()].filter(value => value === 1).length;
    const spatialBoundary = [...spatial.values()].filter(value => value === 1).length;
    return {
      vertexCount: m.positions.length / 3,
      triangleCount: m.indices.length / 3,
      faceCounts: counts,
      degenerateTriangles,
      flippedWindingTriangles,
      minWindingNormalDot,
      meanWindingNormalDot: windingNormalDotSum / Math.max(1, m.indices.length / 3),
      exteriorWindingVerified: flippedWindingTriangles === 0 && windingNormalDotSum / Math.max(1, m.indices.length / 3) > 0.98,
      minNormalLength: Math.min(...normalLengths),
      maxNormalLength: Math.max(...normalLengths),
      maxNormalTangentDot: maxTangentDot,
      boundaryEdges: indexedBoundary,
      closedByIndexedIncidence: indexedBoundary === 0,
      boundaryEdgesBySpatialPosition: spatialBoundary,
      overSharedEdgesBySpatialPosition: [...spatial.values()].filter(value => value > 2).length,
      closedBySpatialIncidence: spatialBoundary === 0,
      backUvContinuous: m.uv[countOffset(m) * 2] === 0 && m.uv[(countOffset(m) + m.count - 1) * 2 + 1] === 1,
      edgeGroups: m.edgeGroups.map(group => ({ ...group })),
      topologyNote: 'final top and back grids plus four independent section strips; duplicated seams preserve hard section normals while spatial positions remain closed'
    };
  }

  const countOffset = meshValue => meshValue.count;

  function sampleGrid(meshValue, u, v, surface = 'top') {
    const x = clamp((u + 1) * 0.5 * meshValue.nu, 0, meshValue.nu);
    const y = clamp((v + 1) * 0.5 * meshValue.nv, 0, meshValue.nv);
    const i0 = Math.floor(x), i1 = Math.min(meshValue.nu, i0 + 1);
    const j0 = Math.floor(y), j1 = Math.min(meshValue.nv, j0 + 1);
    const tx = x - i0, ty = y - j0;
    const offset = surface === 'back' ? meshValue.count : 0;
    const fetch = (i, j) => {
      const vertex = offset + at(i, j, meshValue.nu);
      return {
        position: Array.from(meshValue.positions.slice(vertex * 3, vertex * 3 + 3)),
        normal: Array.from(meshValue.normals.slice(vertex * 3, vertex * 3 + 3))
      };
    };
    const q00 = fetch(i0, j0), q10 = fetch(i1, j0), q01 = fetch(i0, j1), q11 = fetch(i1, j1);
    const blend = key => [0, 1, 2].map(k => mix(mix(q00[key][k], q10[key][k], tx), mix(q01[key][k], q11[key][k], tx), ty));
    return { position: blend('position'), normal: norm(blend('normal')), u, v, surface };
  }

  function surfaceBand(meshValue, fixed, axis = 'side', samples = 13, surface = 'top') {
    const result = [];
    for (let i = 0; i < samples; i += 1) {
      const t = -0.9 + 1.8 * i / Math.max(1, samples - 1);
      result.push(axis === 'end' ? sampleGrid(meshValue, t, fixed, surface) : sampleGrid(meshValue, fixed, t, surface));
    }
    return result;
  }

  function edgeProfile(meshValue, samples = 19) {
    const rows = [];
    for (let i = 0; i < samples; i += 1) {
      const v = -0.9 + 1.8 * i / Math.max(1, samples - 1);
      const leftTop = sampleGrid(meshValue, -0.985, v, 'top');
      const leftBack = sampleGrid(meshValue, -0.985, v, 'back');
      const rightTop = sampleGrid(meshValue, 0.985, v, 'top');
      const rightBack = sampleGrid(meshValue, 0.985, v, 'back');
      rows.push({
        v,
        width: Math.hypot(...sub(rightTop.position, leftTop.position)),
        leftThickness: Math.hypot(...sub(leftTop.position, leftBack.position)),
        rightThickness: Math.hypot(...sub(rightTop.position, rightBack.position))
      });
    }
    const widths = rows.map(row => row.width);
    const thickness = rows.flatMap(row => [row.leftThickness, row.rightThickness]);
    return {
      samples: rows,
      widthMin: Math.min(...widths), widthMax: Math.max(...widths), widthMean: widths.reduce((a, b) => a + b, 0) / widths.length,
      thicknessMin: Math.min(...thickness), thicknessMax: Math.max(...thickness),
      coordinateSystem: 'continuous u and v surfaces with four independent thickness section strips'
    };
  }

  function transform(meshValue, pose, meta = {}) {
    const ax = Number(pose.angleX || 0);
    const az = Number(pose.angleZ || 0);
    const cx = Math.cos(ax), sx = Math.sin(ax), cz = Math.cos(az), sz = Math.sin(az);
    const positions = new Float32Array(meshValue.positions.length);
    const normals = new Float32Array(meshValue.normals.length);
    const tangents = new Float32Array(meshValue.tangents.length);
    const rotate = (x, y, z) => {
      const y1 = y * cx - z * sx;
      const z1 = y * sx + z * cx;
      return [x * cz - y1 * sz, x * sz + y1 * cz, z1];
    };
    for (let i = 0, t = 0; i < meshValue.positions.length; i += 3, t += 4) {
      const p = rotate(meshValue.positions[i], meshValue.positions[i + 1], meshValue.positions[i + 2]);
      positions[i] = p[0] + Number(pose.x || 0);
      positions[i + 1] = p[1] + Number(pose.y || 0);
      positions[i + 2] = p[2] + Number(pose.z || 0);
      const n = rotate(meshValue.normals[i], meshValue.normals[i + 1], meshValue.normals[i + 2]);
      normals[i] = n[0]; normals[i + 1] = n[1]; normals[i + 2] = n[2];
      const q = rotate(meshValue.tangents[t], meshValue.tangents[t + 1], meshValue.tangents[t + 2]);
      tangents[t] = q[0]; tangents[t + 1] = q[1]; tangents[t + 2] = q[2]; tangents[t + 3] = meshValue.tangents[t + 3];
    }
    return { ...meshValue, restPositions: meshValue.restPositions || meshValue.positions, positions, normals, tangents, meta: { ...meta, pose: { ...pose } } };
  }

  function nearestDistance(a, b) {
    let value = Infinity;
    for (const pa of a) for (const pb of b) value = Math.min(value, Math.hypot(...sub(pa.position, pb.position)));
    return value;
  }

  parts.geometry = Object.freeze({
    tile, mesh, diagnostics, sampleSurface: sampleGrid, sampleBackSurface: (m, u, v) => sampleGrid(m, u, v, 'back'),
    surfaceBand, edgeProfile, transform, nearestDistance, familyProfile, clamp, sub, add, mul, dot, norm
  });
})();

