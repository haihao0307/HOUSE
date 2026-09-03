/* Tiles Mother V0.8.2 roof assembly.
 * Courses are solved from eave to ridge. Each upper shell is lifted from actual
 * generated underside samples until it clears the generated top surface below.
 */
(() => {
  'use strict';
  const C = window.TilesStudyCore;
  const P = window.TilesMotherV08Profile;
  const G = window.TilesMotherV08Parts?.geometry;
  const parts = window.TilesMotherV08Parts;
  if (!C || !P || !G || !parts) throw Error('Tiles Mother V0.8 roof dependencies are missing');

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const hash32 = value => {
    let n = Number(value) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    return (n ^ (n >>> 16)) >>> 0;
  };
  const idHash = text => {
    let h = 2166136261;
    for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return hash32(h);
  };
  const positionHash = positions => {
    let h = 2166136261;
    for (const byte of new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength)) { h ^= byte; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  const average = values => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const min = values => Math.min(...values);
  const max = values => Math.max(...values);

  function entitySeeds(base, entityId) {
    const salt = idHash(entityId);
    const result = {};
    for (const [index, key] of ['master', 'shape', 'warp', 'structure', 'damage', 'color', 'weather', 'micro'].entries()) {
      result[key] = hash32((base[key] || 1) ^ salt ^ (index * 1009 + 37)) || 1;
    }
    return result;
  }

  function plan(panControls, coverControls, roofId = P.roof.roofId) {
    const panWidth = Number(panControls.width) * 0.01;
    const panLength = Number(panControls.length) * 0.01;
    const coverLength = Number(coverControls.length) * 0.01;
    const taper = Number(panControls.taper) * 0.01;
    const widestPan = panWidth * (1 + taper * 0.5);
    const panStep = widestPan + P.roof.lateralClearanceMeters;
    const rowStep = panLength * P.roof.longitudinalStepFraction;
    const result = [];
    for (let row = 0; row < P.roof.rows; row += 1) for (let col = 0; col < P.roof.panColumns; col += 1) {
      result.push({
        family: 'pan', role: row === 0 ? 'eave-pan' : row === P.roof.rows - 1 ? 'ridge-pan' : 'pan', row, col,
        entityId: `${roofId}/pan/r${row}/c${col}`,
        x: (col - (P.roof.panColumns - 1) * 0.5) * panStep,
        y: 0,
        z: (row - (P.roof.rows - 1) * 0.5) * rowStep
      });
    }
    for (let row = 0; row < P.roof.rows; row += 1) for (let seam = 0; seam < P.roof.coverSeams; seam += 1) {
      result.push({
        family: 'cover', role: row === 0 ? 'eave-cover' : row === P.roof.rows - 1 ? 'ridge-cover' : 'cover', row, col: seam, seam,
        entityId: `${roofId}/cover/r${row}/s${seam}`,
        x: (seam - (P.roof.coverSeams - 1) * 0.5) * panStep,
        y: 0,
        z: (row - (P.roof.rows - 1) * 0.5) * rowStep
      });
    }
    return {
      roofId,
      rows: P.roof.rows,
      panColumns: P.roof.panColumns,
      coverSeams: P.roof.coverSeams,
      panStep,
      rowStep,
      panLength,
      coverLength,
      widestPan,
      slopeAngleRadians: P.roof.slopeAngleRadians,
      plan: result
    };
  }

  function roofPose(layout, item, extraY = 0, angleZ = 0) {
    const angle = layout.slopeAngleRadians;
    return {
      angleX: angle,
      angleZ,
      x: item.x,
      y: -item.z * Math.sin(angle) + extraY,
      z: item.z * Math.cos(angle)
    };
  }

  function makeTileMesh(item, profile, childSeeds, variant, physicalTime, history) {
    const bank = childSeeds(profile.seeds, variant);
    const seeds = entitySeeds(bank, item.entityId);
    const tile = G.tile(item.family, item.entityId, seeds.master, profile.controls, seeds);
    const state = window.TilesMotherHistoricWeathering.evolve(tile, physicalTime, item.family === 'cover' ? 0.90 : 0.82);
    const runtimeBudget = window.TilesMotherV081Runtime?.roofBudget || P.mesh.roof;
    const raw = G.mesh(tile, { ...runtimeBudget, damage: state.damage });
    return { tile, state, seeds, raw };
  }

  function overlapPairs(lower, upper, lowerItem, upperItem, surfaceLower = 'top', surfaceUpper = 'back') {
    const lowerLength = lower.tile.dimensions.length;
    const upperLength = upper.tile.dimensions.length;
    const centerDelta = upperItem.z - lowerItem.z;
    const vStart = -0.92;
    const vMax = clamp((0.92 * lowerLength - 2 * centerDelta) / upperLength, -0.90, 0.88);
    const pairs = [];
    for (let j = 0; j < P.roof.lapSamplesAlong; j += 1) {
      const vUpper = vStart + (vMax - vStart) * j / Math.max(1, P.roof.lapSamplesAlong - 1);
      const vLower = (2 * centerDelta + vUpper * upperLength) / lowerLength;
      if (vLower < -0.96 || vLower > 0.96) continue;
      for (let i = 0; i < P.roof.lapSamplesAcross; i += 1) {
        const u = -0.84 + 1.68 * i / Math.max(1, P.roof.lapSamplesAcross - 1);
        pairs.push({
          a: G.sampleSurface(lower, u, vLower, surfaceLower),
          b: G.sampleSurface(upper, u, vUpper, surfaceUpper),
          u, vLower, vUpper
        });
      }
    }
    return pairs;
  }

  function solveLongitudinalY(lower, upperProvisional, lowerItem, upperItem) {
    const pairs = overlapPairs(lower, upperProvisional, lowerItem, upperItem, 'top', 'back');
    if (!pairs.length) return { requiredY: 0, pairs: [] };
    const required = pairs.map(pair => pair.a.position[1] + P.roof.shellGapMeters - pair.b.position[1]);
    return { requiredY: max(required), pairs };
  }

  function* placePans(layout, profiles, childSeeds, variant, physicalTime, history) {
    const records = [];
    for (let row = 0; row < layout.rows; row += 1) {
      for (let col = 0; col < layout.panColumns; col += 1) {
        const item = layout.plan.find(entry => entry.family === 'pan' && entry.row === row && entry.col === col);
        const built = makeTileMesh(item, profiles.pan, childSeeds, variant, physicalTime, history);
        let extraY = 0;
        let lapEvidence = null;
        if (row > 0) {
          const lower = records.find(record => record.item.row === row - 1 && record.item.col === col);
          const provisional = G.transform(built.raw, roofPose(layout, item), { entityId: item.entityId });
          const solved = solveLongitudinalY(lower.mesh, provisional, lower.item, item);
          const bedding = (C.noise(row * 1.7 + col * 0.31, col * 2.2 - row, built.seeds.shape + 907) - 0.5) * 0.00032;
          extraY = Math.max(0, solved.requiredY + bedding);
          lapEvidence = solved;
        }
        const pose = roofPose(layout, item, extraY, 0);
        const mesh = G.transform(built.raw, pose, {
          roofId: layout.roofId, entityId: item.entityId, processId: 'tiles-mother-v0.8-candidate', family: item.family,
          role: item.role, row: item.row, col: item.col, seam: null, seeds: built.seeds,
          solvedCourseY: extraY
        });
        records.push({
          item: { ...item, pose, solvedCourseY: extraY },
          lapEvidence,
          mesh: { ...mesh, tile: built.tile, state: built.state, seeds: built.seeds, family: 'pan', profile: 'pan', role: item.role, row: item.row, col: item.col, seam: null }
        });
        yield {phase:"geometry", family:item.family, row, done:records.length};
      }
    }
    return records;
  }

  function seatPairs(cover, leftPan, rightPan) {
    const pairsLeft = [];
    const pairsRight = [];
    for (let i = 0; i < P.roof.seatSamples; i += 1) {
      const vCover = -0.82 + 1.64 * i / Math.max(1, P.roof.seatSamples - 1);
      if (leftPan) {
        const vPan = vCover * cover.tile.dimensions.length / leftPan.tile.dimensions.length;
        pairsLeft.push({
          a: G.sampleSurface(leftPan, P.roof.panSeatU, vPan, 'top'),
          b: G.sampleSurface(cover, -P.roof.coverSeatU, vCover, 'back'),
          vCover, vPan, supportSide: 'left-pan-right-shoulder'
        });
      }
      if (rightPan) {
        const vPan = vCover * cover.tile.dimensions.length / rightPan.tile.dimensions.length;
        pairsRight.push({
          a: G.sampleSurface(rightPan, -P.roof.panSeatU, vPan, 'top'),
          b: G.sampleSurface(cover, P.roof.coverSeatU, vCover, 'back'),
          vCover, vPan, supportSide: 'right-pan-left-shoulder'
        });
      }
    }
    return { left: pairsLeft, right: pairsRight };
  }

  function solveCoverSeat(raw, item, layout, leftPan, rightPan) {
    const provisional = G.transform(raw, roofPose(layout, item), { entityId: item.entityId });
    let pairs = seatPairs(provisional, leftPan, rightPan);
    const reqLeft = pairs.left.map(pair => pair.a.position[1] + P.roof.shellGapMeters - pair.b.position[1]);
    const reqRight = pairs.right.map(pair => pair.a.position[1] + P.roof.shellGapMeters - pair.b.position[1]);
    if (!reqLeft.length && !reqRight.length) throw Error(`missing visible support for ${item.entityId}`);
    let angleZ = 0;
    if (reqLeft.length && reqRight.length) {
      const leftMean = average(reqLeft);
      const rightMean = average(reqRight);
      const leftX = average(pairs.left.map(pair => pair.b.position[0]));
      const rightX = average(pairs.right.map(pair => pair.b.position[0]));
      const span = Math.max(0.04, rightX - leftX);
      angleZ = clamp(Math.asin(clamp((rightMean - leftMean) / span, -0.040, 0.040)), -0.040, 0.040);
    }
    const rolled = G.transform(raw, roofPose(layout, item, 0, angleZ), { entityId: item.entityId });
    pairs = seatPairs(rolled, leftPan, rightPan);
    const required = [...pairs.left, ...pairs.right].map(pair => pair.a.position[1] + P.roof.shellGapMeters - pair.b.position[1]);
    return {
      requiredY: max(required),
      angleZ,
      pairs,
      visibleSupportCount: Number(Boolean(leftPan)) + Number(Boolean(rightPan)),
      boundaryContinuation: !leftPan || !rightPan
    };
  }

  function* placeCovers(layout, profiles, childSeeds, variant, physicalTime, history, panRecords) {
    const records = [];
    for (let row = 0; row < layout.rows; row += 1) {
      for (let seam = 0; seam < layout.coverSeams; seam += 1) {
        const item = layout.plan.find(entry => entry.family === 'cover' && entry.row === row && entry.seam === seam);
        const built = makeTileMesh(item, profiles.cover, childSeeds, variant, physicalTime, history);
        const left = panRecords.find(record => record.item.row === row && record.item.col === seam - 1)?.mesh || null;
        const right = panRecords.find(record => record.item.row === row && record.item.col === seam)?.mesh || null;
        if (!left && !right) throw Error(`missing pan support for ${item.entityId}`);
        const seat = solveCoverSeat(built.raw, item, layout, left, right);
        let extraY = Math.max(0, seat.requiredY);
        let lapEvidence = null;
        if (row > 0) {
          const lower = records.find(record => record.item.row === row - 1 && record.item.seam === seam);
          const provisional = G.transform(built.raw, roofPose(layout, item, extraY, seat.angleZ), { entityId: item.entityId });
          const solved = solveLongitudinalY(lower.mesh, provisional, lower.item, item);
          if (solved.requiredY > 0) extraY += solved.requiredY;
          lapEvidence = solved;
        }
        const pose = roofPose(layout, item, extraY, seat.angleZ);
        const mesh = G.transform(built.raw, pose, {
          roofId: layout.roofId, entityId: item.entityId, processId: 'tiles-mother-v0.8-candidate', family: item.family,
          role: item.role, row: item.row, col: item.col, seam: item.seam, seeds: built.seeds,
          solvedSeatY: extraY, solvedRoll: seat.angleZ
        });
        records.push({
          item: { ...item, pose, solvedSeatY: extraY }, seatEvidence: seat, lapEvidence,
          mesh: { ...mesh, tile: built.tile, state: built.state, seeds: built.seeds, family: 'cover', profile: 'cover', role: item.role, row: item.row, col: item.col, seam: item.seam }
        });
        yield {phase:"geometry", family:item.family, row, done:records.length};
      }
    }
    return records;
  }

  function verticalContact(pairs, label, kind, expectedGap = P.roof.shellGapMeters) {
    const signedGaps = pairs.map(pair => pair.b.position[1] - pair.a.position[1]);
    const line = pairs.flatMap(pair => [pair.a.position, pair.b.position]);
    const minGap = signedGaps.length ? min(signedGaps) : null;
    const maxGap = signedGaps.length ? max(signedGaps) : null;
    const meanGap = signedGaps.length ? average(signedGaps) : null;
    const penetrationDepth = minGap === null ? 0 : Math.max(0, -minGap);
    const status = penetrationDepth > P.roof.penetrationTolerance
      ? 'penetration'
      : meanGap !== null && meanGap <= P.roof.supportTolerance ? 'supported' : 'clearance';
    return {
      label, kind, expectedGap, minSignedGap: minGap, maxSignedGap: maxGap, meanSignedGap: meanGap,
      penetrationDepth, contactSamples: signedGaps.length, status, line,
      method: 'paired generated top and underside samples in roof-up direction'
    };
  }

  function lateralContact(left, right, label) {
    const pairs = [];
    for (let i = 0; i < P.roof.seatSamples; i += 1) {
      const v = -0.92 + 1.84 * i / Math.max(1, P.roof.seatSamples - 1);
      pairs.push({
        a: G.sampleSurface(left, 0.995, v, 'top'),
        b: G.sampleSurface(right, -0.995, v, 'top')
      });
    }
    const gaps = pairs.map(pair => pair.b.position[0] - pair.a.position[0]);
    const minimumClearance = min(gaps);
    return {
      label, kind: 'pan-lateral-clearance', expectedGap: P.roof.lateralClearanceMeters,
      minSignedGap: minimumClearance, maxSignedGap: max(gaps), meanSignedGap: average(gaps),
      penetrationDepth: Math.max(0, -minimumClearance), contactSamples: gaps.length,
      status: minimumClearance < -P.roof.penetrationTolerance ? 'penetration' : 'clearance',
      line: pairs.flatMap(pair => [pair.a.position, pair.b.position]),
      method: 'paired generated inner edge samples in roof-across direction'
    };
  }

  function buildContacts(layout, pans, covers) {
    const contacts = [];
    for (let row = 0; row < layout.rows; row += 1) for (let col = 0; col < layout.panColumns - 1; col += 1) {
      const left = pans.find(record => record.item.row === row && record.item.col === col).mesh;
      const right = pans.find(record => record.item.row === row && record.item.col === col + 1).mesh;
      contacts.push(lateralContact(left, right, `pan-lateral-r${row}-c${col}`));
    }
    for (let row = 0; row < layout.rows; row += 1) for (let seam = 0; seam < layout.coverSeams; seam += 1) {
      const cover = covers.find(record => record.item.row === row && record.item.seam === seam).mesh;
      const left = pans.find(record => record.item.row === row && record.item.col === seam - 1)?.mesh || null;
      const right = pans.find(record => record.item.row === row && record.item.col === seam)?.mesh || null;
      const pairs = seatPairs(cover, left, right);
      if (pairs.left.length) contacts.push(verticalContact(pairs.left, `cover-seat-left-r${row}-s${seam}`, 'cover-seat-left'));
      if (pairs.right.length) contacts.push(verticalContact(pairs.right, `cover-seat-right-r${row}-s${seam}`, 'cover-seat-right'));
    }
    for (let row = 0; row < layout.rows - 1; row += 1) for (let col = 0; col < layout.panColumns; col += 1) {
      const lowerRecord = pans.find(record => record.item.row === row && record.item.col === col);
      const upperRecord = pans.find(record => record.item.row === row + 1 && record.item.col === col);
      contacts.push(verticalContact(overlapPairs(lowerRecord.mesh, upperRecord.mesh, lowerRecord.item, upperRecord.item), `pan-longitudinal-r${row}-${row + 1}-c${col}`, 'pan-longitudinal-lap'));
    }
    for (let row = 0; row < layout.rows - 1; row += 1) for (let seam = 0; seam < layout.coverSeams; seam += 1) {
      const lowerRecord = covers.find(record => record.item.row === row && record.item.seam === seam);
      const upperRecord = covers.find(record => record.item.row === row + 1 && record.item.seam === seam);
      contacts.push(verticalContact(overlapPairs(lowerRecord.mesh, upperRecord.mesh, lowerRecord.item, upperRecord.item), `cover-longitudinal-r${row}-${row + 1}-s${seam}`, 'cover-longitudinal-lap'));
    }
    return contacts;
  }

  function drainage(layout, pans) {
    const paths = [];
    for (let col = 0; col < P.roof.drainageColumns; col += 1) {
      const points = [];
      for (let row = layout.rows - 1; row >= 0; row -= 1) {
        const record = pans.find(value => value.item.row === row && value.item.col === col);
        // Lower courses are visible only from the upper course's eave line downwards.
        // Starting at that mapped v avoids an artificial uphill jump inside the hidden lap.
        const topVisibleV = row === layout.rows - 1
          ? 0.82
          : clamp(2 * layout.rowStep / record.mesh.tile.dimensions.length - 0.82, -0.10, 0.42);
        for (let k = P.roof.drainageSamplesPerTile - 1; k >= 0; k -= 1) {
          const v = -0.82 + (topVisibleV + 0.82) * k / Math.max(1, P.roof.drainageSamplesPerTile - 1);
          points.push(G.sampleSurface(record.mesh, 0, v, 'top').position);
        }
      }
      let uphillViolations = 0;
      for (let i = 1; i < points.length; i += 1) {
        if (points[i][1] > points[i - 1][1] + 0.0055) uphillViolations += 1;
      }
      paths.push({ id: `drainage-column-${col}`, col, points, uphillViolations, continuous: uphillViolations === 0 });
    }
    return { paths, continuousCount: paths.filter(path => path.continuous).length, total: paths.length };
  }

  function diagnosticMesh(record) {
    const mesh = record.mesh;
    return {
      family: mesh.family, role: mesh.role, row: mesh.row, col: mesh.col, seam: mesh.seam,
      entityId: mesh.meta.entityId,
      seedFingerprint: { master: mesh.seeds.master, shape: mesh.seeds.shape, color: mesh.seeds.color, micro: mesh.seeds.micro },
      positionHash: positionHash(mesh.positions),
      geometry: G.quickDiagnostics(mesh),
      edgeProfile: G.edgeProfile(mesh),
      metrics: mesh.metrics,
      state: mesh.state,
      solvedCourseY: mesh.meta.solvedCourseY ?? null,
      solvedSeatY: mesh.meta.solvedSeatY ?? null,
      solvedRoll: mesh.meta.solvedRoll ?? null
    };
  }

  function* buildRoofSteps({ profiles, childSeeds, variant = 0, physicalTime = 0, history, roofId = P.roof.roofId }) {
    const layout = plan(profiles.pan.controls, profiles.cover.controls, roofId);
    const panRecords = yield* placePans(layout, profiles, childSeeds, variant, physicalTime, history);
    const coverRecords = yield* placeCovers(layout, profiles, childSeeds, variant, physicalTime, history, panRecords);
    const contacts = buildContacts(layout, panRecords, coverRecords);
    const drainageData = drainage(layout, panRecords);
    const records = [...panRecords, ...coverRecords];
    const penetrations = contacts.filter(contact => contact.status === 'penetration');
    const supported = contacts.filter(contact => contact.status === 'supported');
    const lateral = contacts.filter(contact => contact.kind === 'pan-lateral-clearance');
    const panLaps = contacts.filter(contact => contact.kind === 'pan-longitudinal-lap');
    const coverLaps = contacts.filter(contact => contact.kind === 'cover-longitudinal-lap');
    const coverSeats = contacts.filter(contact => contact.kind.startsWith('cover-seat'));
    const rowLifts = Array.from({ length: layout.rows }, (_, row) => ({
      row,
      panMean: average(panRecords.filter(record => record.item.row === row).map(record => record.item.solvedCourseY || 0)),
      coverMean: average(coverRecords.filter(record => record.item.row === row).map(record => record.item.solvedSeatY || 0))
    }));
    const meshDiagnostics=[];
    for(let i=0;i<records.length;i++){
      meshDiagnostics.push(diagnosticMesh(records[i]));
      yield {phase:'orientation',done:i+1,total:records.length};
    }
    const diagnostics = {
      schema: 'tiles-mother-v08-roof-diagnostics',
      version: '0.8.2',
      view: 'roof',
      roofId,
      processId: 'tiles-mother-v0.8-candidate',
      rows: layout.rows,
      panColumns: layout.panColumns,
      coverSeams: layout.coverSeams,
      tileCount: records.length,
      panCount: panRecords.length,
      coverCount: coverRecords.length,
      relationCount: contacts.length,
      relationBreakdown: {
        panLateral: lateral.length,
        coverSeats: coverSeats.length,
        panLongitudinal: panLaps.length,
        coverLongitudinal: coverLaps.length
      },
      contacts,
      contactLines: contacts.flatMap(contact => contact.line),
      support: {
        supported: supported.length,
        penetrations: penetrations.length,
        maximumPenetration: max([0, ...contacts.map(contact => contact.penetrationDepth)]),
        minimumPanLateralClearance: min(lateral.map(contact => contact.minSignedGap)),
        minimumPanLapGap: min(panLaps.map(contact => contact.minSignedGap)),
        minimumCoverLapGap: min(coverLaps.map(contact => contact.minSignedGap)),
        minimumCoverSeatGap: min(coverSeats.map(contact => contact.minSignedGap)),
        actualBackGeometry: true,
        allRelationFamiliesChecked: true,
        exhaustiveTriangleCollisionVerified: false,
        scope: 'paired surface samples; not an exhaustive all-triangle collision proof'
      },
      courseStack: {
        rowLifts,
        visibleCourseRise: rowLifts.length > 1 ? rowLifts[rowLifts.length - 1].panMean - rowLifts[0].panMean : 0,
        solvedFromActualUnderside: true
      },
      materialContinuity: {
        sharedFiredClayField: true,
        separateTopBackBaseColors: false,
        faceContinuityTolerance: P.material.faceContinuityTolerance,
        pbrWorkflow: P.material.pbrWorkflow,
        metalness: P.material.metalness,
        dielectricF0: P.material.dielectricF0,
        baseColorSpace: P.material.baseColorSpace,
        dataChannelsSpace: P.material.dataChannelsSpace,
        cavityOcclusionSeparatedFromBaseColor: true
      },
      drainage: drainageData,
      meshes: meshDiagnostics,
      placement: {
        coordinateSystem: P.roof.coordinateSystem,
        slopeAngleRadians: layout.slopeAngleRadians,
        panStep: layout.panStep,
        rowStep: layout.rowStep,
        longitudinalExposureFractionPan: layout.rowStep / layout.panLength,
        longitudinalExposureFractionCover: layout.rowStep / layout.coverLength,
        widestPan: layout.widestPan,
        lateralClearanceMeters: P.roof.lateralClearanceMeters,
        profileControlled: true,
        bboxOnlyContactUsed: false,
        panCourseMethod: 'eave-to-ridge generated underside/top paired-sample clearance solve',
        referenceArrangement: 'three visible pan drainage channels and four cover lines including cropped boundary continuations',
        coverSeatMethod: 'generated cover underside to generated left/right pan top with roll correction',
        coverLapMethod: 'eave-to-ridge generated underside/top paired-sample clearance solve'
      },
      history: {
        physicalTime,
        ageYears: physicalTime,
        maximumAgeYears: P.weathering.maxAgeYears,
        calibrationStatus: P.weathering.calibrationStatus
      },
      visualApproved: false,
      productionApproved: false,
      distillationComplete: false
    };
    return { plan: layout, records, meshes: records.map(record => record.mesh), diagnostics };
  }

  function buildRoof(options){
    const steps=buildRoofSteps(options);let item=steps.next();
    while(!item.done)item=steps.next();return item.value;
  }
  async function buildRoofAsync(options, hooks={}){
    const steps=buildRoofSteps(options);
    let item;
    do{
      if(hooks.cancelled?.()){const e=Error('Superseded build');e.name='AbortError';throw e;}
      item=steps.next();
      if(!item.done){hooks.progress?.(item.value);await hooks.yieldControl();}
    }while(!item.done);
    return item.value;
  }
  parts.roof = Object.freeze({ buildRoof, buildRoofAsync, entitySeeds, plan, positionHash, overlapPairs, seatPairs });
})();
