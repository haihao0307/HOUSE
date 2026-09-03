/* Tiles Mother V0.8.2 Yunnan gray-tile profile.
 * Dimensions and material calibration remain research candidates pending measured samples.
 */
(() => {
  'use strict';
  const deepFreeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
  };
  window.TilesMotherV08Profile = deepFreeze({
    schema: 'tiles-mother-yunnan-gray-tile-candidate-v0.8.0',
    version: '0.8.2',
    sourceAnalysis: 'knowledge/jiangwutang-001/analysis.json',
    sourceReceipt: 'JIANGWUTANG_SOURCE_RECEIPT.json',
    approval: {
      visualApproved: false,
      productionApproved: false,
      distillationComplete: false
    },
    observed: {
      diffuseMeanRgb: [88.7763, 78.9414, 71.9805],
      warmNeutralCoolFractions: [0.5600, 0.3252, 0.1148],
      normalEffectiveUvExactFlatFraction: 0.9932327,
      interpretation: 'Reference diffuse carries cool gray, warm brown and pale fired-clay islands. Recoverable normal relief is nearly flat, therefore physical relief remains procedural.'
    },
    families: {
      pan: {
        name: '云南手工板瓦',
        macroFrequency: 1.55,
        mesoFrequency: 4.8,
        microFrequency: 84,
        formingAmplitude: 0.76,
        scrapeAmplitude: 0.58,
        paddleAmplitude: 0.72,
        localSagAmplitude: 0.52,
        blisterAmplitude: 0.44,
        edgeBreakAmplitude: 0.48,
        backCompressionAmplitude: 0.26,
        roughness: 0.86,
        sectionRoughness: 0.92
      },
      cover: {
        name: '云南手工筒瓦',
        macroFrequency: 1.38,
        mesoFrequency: 4.35,
        microFrequency: 78,
        formingAmplitude: 0.68,
        scrapeAmplitude: 0.48,
        paddleAmplitude: 0.60,
        localSagAmplitude: 0.42,
        blisterAmplitude: 0.36,
        edgeBreakAmplitude: 0.44,
        backCompressionAmplitude: 0.24,
        roughness: 0.84,
        sectionRoughness: 0.91
      }
    },
    mesh: {
      single: { nu: 104, nv: 144 },
      trio: { nu: 64, nv: 90 },
      roof: { nu: 48, nv: 70 },
      minimumThicknessFraction: 0.48,
      normalEpsilon: 1e-8,
      tangentOrthogonalityTolerance: 0.025
    },
    roof: {
      roofId: 'jiangwutang-roof-001',
      rows: 4,
      panColumns: 3,
      coverSeams: 4,
      eaveGapMeters: 0.006,
      lateralClearanceMeters: 0.0055,
      longitudinalStepFraction: 0.47,
      slopeAngleRadians: -0.205,
      shellGapMeters: 0.00055,
      coverSeatU: 0.82,
      panSeatU: 0.40,
      seatSamples: 17,
      lapSamplesAcross: 11,
      lapSamplesAlong: 9,
      supportTolerance: 0.0042,
      penetrationTolerance: 0.00065,
      drainageSamplesPerTile: 7,
      drainageColumns: 3,
      coordinateSystem: 'roof local X across channels, Z up-slope, Y shell normal/up',
      scaleCalibration: 'experimental_not_measured'
    },
    material: {
      colorVariationDefault: 88,
      macroStrength: 1.0,
      mesoStrength: 1.0,
      grainStrength: 0.88,
      cavityDarkening: 0.06,
      faceContinuityTolerance: 0.025,
      palette: {
        coolGray: [0.33, 0.355, 0.365],
        neutralAsh: [0.45, 0.425, 0.395],
        warmBrown: [0.55, 0.365, 0.245],
        paleFired: [0.62, 0.585, 0.53],
        smokeDark: [0.19, 0.205, 0.205]
      },
      pbrWorkflow: 'metallic-roughness',
      metalness: 0,
      dielectricF0: 0.04,
      baseColorSpace: 'sRGB',
      dataChannelsSpace: 'linear',
      aoAffects: 'ambient diffuse only',
      heightBand: 'low and medium frequency final geometry',
      normalBand: 'high frequency derivative perturbation'
    },
    weathering: {
      maxAgeYears: 150,
      settlementYears: 3,
      rainWashOnsetYears: 5,
      sootOnsetYears: 8,
      edgeWearOnsetYears: 18,
      biofilmOnsetYears: 28,
      calibrationStatus: 'process-structured visual candidate, not measured historic kinetics'
    },
    studio: {
      defaultMode: 'aaa_beauty',
      defaultView: 'roof',
      defaultFocus: 'all',
      maxPixelRatio: 1.5,
      exposure: 1.10,
      background: '#171b19',
      neutralBackground: '#d7d8d3',
      rakingBackground: '#101412'
    },
    unknown: [
      'exact historic dimensions, firing shrinkage and regional bedding practice',
      'measured roughness, pore depth, tangent handedness and height scale',
      'exact overlap ratio for the original roof sample',
      'whether individual dark source regions are firing atmosphere, soot, occlusion or reflection'
    ]
  });
})();
