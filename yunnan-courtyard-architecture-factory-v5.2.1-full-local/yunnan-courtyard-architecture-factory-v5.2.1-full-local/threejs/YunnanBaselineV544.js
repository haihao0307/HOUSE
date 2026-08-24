/**
 * Immutable, traceable V5.4.4 surface baseline used by the controlled A/B view.
 *
 * The building layout remains shared with V5.5.0 so the A/B image isolates the
 * surface-production change.  The legacy tile placement and appearance values
 * below are frozen from the complete procedural generator delivered by the
 * referenced V5.4.4 release commit.
 */
export const V544_FROZEN_BASELINE = Object.freeze({
  id: 'V544-FROZEN-323A893',
  version: '5.4.4',
  sourceCommit: '323a893a791b1d064a1591dcbd2063f2f6a172c1',
  sourceCommittedAt: '2026-08-23T13:20:05+08:00',
  sourceFiles: Object.freeze({
    generator: Object.freeze({
      path: 'threejs/YunnanCourtyardProduction.js',
      frozenRuntimePath: 'threejs/v544/YunnanCourtyardProduction.js',
      gitBlobSha: '7b254beeffde1325329101b50784e694249081bd',
    }),
    materials: Object.freeze({
      path: 'threejs/YunnanMaterialFactory.js',
      frozenRuntimePath: 'threejs/v544/YunnanMaterialFactory.js',
      gitBlobSha: 'd16baad4ff18c5a9e97f7796f9e68d45cd6f9ff9',
    }),
  }),
  comparisonSeed: 401,
  buildingParameters: Object.freeze({
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
  }),
  tileProfile: Object.freeze({
    tileWidth: 0.28,
    tileLength: 0.64,
    tileCourse: 0.46,
    tileThickness: 0.055,
  }),
  roofSurface: Object.freeze({
    baseFiringTone: 0.50,
    orientationExposure: 0.12,
    dust: 0.06,
    moss: 0,
    rainWash: 0.04,
    damage: 0,
    repair: 0,
    repairAgeTone: 0,
    edgeWear: 0.05,
  }),
  wallSurface: Object.freeze({
    plasterCoverage: 0,
    earthExposure: 0,
    cornerProtection: 0,
    dampBand: 0,
    verticalRainWash: 0,
    surfaceLoss: 0,
    crackNetwork: 0,
    repairPatches: 0,
    sootAndDirt: 0,
  }),
  controlledComparison: Object.freeze({
    sharedBuildingParameters: true,
    sharedSeed: true,
    sharedCamera: true,
    sharedCanvasSize: true,
    sharedLighting: true,
  }),
});
