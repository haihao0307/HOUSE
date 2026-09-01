/* Tiles Mother V0.5 compact profile. Values are candidate controls, not recovered physics. */
(() => {
  'use strict';
  window.TilesMotherV05Profile = Object.freeze({
    schema: 'tiles-mother-jiangwutang-material-candidate-v0.5',
    version: '0.5.0',
    sourceAnalysis: 'knowledge/jiangwutang-001/analysis.json',
    sourceReceipt: 'JIANGWUTANG_SOURCE_RECEIPT.json',
    observed: Object.freeze({
      diffuseMeanRgb: Object.freeze([88.7763, 78.9414, 71.9805]),
      warmNeutralCoolFractions: Object.freeze([0.5600, 0.3252, 0.1148]),
      normalFullFrameExactFlatFraction: 0.9872216,
      normalEffectiveUvExactFlatFraction: 0.9932327,
      normalEffectiveUvPixels: 3879676,
      normalOriginalMode: 'RGBA',
      normalAnalysisMode: 'RGB'
    }),
    families: Object.freeze({
      pan: Object.freeze({
        name: '青灰板瓦',
        macroFrequency: 1.35,
        mesoFrequency: 4.2,
        grainFrequency: 76,
        microRelief: 0.18,
        roughness: 0.82,
        basis: 'V0.3 observed scale ordering; roughness and relief remain visual candidates'
      }),
      cover: Object.freeze({
        name: '青灰筒瓦',
        macroFrequency: 1.15,
        mesoFrequency: 3.7,
        grainFrequency: 68,
        microRelief: 0.18,
        roughness: 0.80,
        basis: 'V0.3 observed scale ordering; roughness and relief remain visual candidates'
      })
    }),
    geometry: Object.freeze({
      layout: '4 rows x 4 pans plus 4 rows x 3 cover seams = 28 candidate tiles',
      roofId: 'jiangwutang-roof-001',
      coordinateSystem: 'roof local X across courses, Z down slope, Y normal/up',
      dimensions: 'experimental controls in centimetres converted to procedural metres',
      physicalScale: 'unknown; source unit conversion not verified',
      relief: 'derived procedural field; no true height recovered from diffuse or normal',
      coverSeatDrop: -0.0185,
      coverSeatDropBasis: 'candidate local-fit offset derived from the procedural curve relation; not a recovered height'
    }),
    unknown: Object.freeze([
      'exact source semantic board/barrel/top-tile boundaries',
      'real dimensions, thickness tolerance, historical lap and drainage clearance',
      'roughness, pore size, true bump height, tangent handedness and normal strength',
      'whether dark diffuse regions are pigment, baked shadow, occlusion or reflection'
    ])
  });
})();
