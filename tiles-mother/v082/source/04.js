/* Tiles Mother V0.8 century-scale process weathering.
 * Each process has its own onset and growth curve. Values remain visual candidates.
 */
(() => {
  'use strict';
  const C = window.TilesStudyCore;
  const P = window.TilesMotherV08Profile;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / Math.max(1e-9, b - a)); return t * t * (3 - 2 * t); };
  function evolve(tile, ageYears, exposure = 1) {
    const age = clamp(Number(ageYears) || 0, 0, P.weathering.maxAgeYears);
    const seedA = C.noise(2.7, 8.1, tile.seeds.absorption + 1103);
    const seedB = C.noise(7.4, 1.9, tile.seeds.color + 1217);
    const normalizedAge = age / P.weathering.maxAgeYears;
    const settlement = 1 - Math.exp(-age / Math.max(0.5, P.weathering.settlementYears));
    const wash = smooth(P.weathering.rainWashOnsetYears, 92, age) * clamp(exposure, 0, 1.4) * (0.78 + seedA * 0.22);
    const soot = smooth(P.weathering.sootOnsetYears, 110, age) * (0.42 + seedB * 0.58);
    const dustRise = smooth(1, 32, age);
    const dustRelease = smooth(45, 150, age) * wash * 0.38;
    const dust = clamp(dustRise * (0.62 + seedA * 0.38) - dustRelease, 0, 1);
    const biofilm = smooth(P.weathering.biofilmOnsetYears, 145, age) * wash * (0.35 + seedB * 0.65);
    const edgeWear = Math.pow(smooth(P.weathering.edgeWearOnsetYears, 150, age), 1.12) * (0.78 + seedA * 0.22);
    const damage = clamp(settlement * 0.025 + edgeWear * 0.58 + biofilm * 0.12, 0, 0.82);
    const wetness = clamp(0.055 + wash * 0.055 + biofilm * 0.035, 0, 0.22);
    return {
      ageYears: age,
      normalizedAge,
      settlement,
      wash,
      soot,
      dust,
      biofilm,
      edgeWear,
      wetness,
      damage,
      roughnessShift: clamp(settlement * 0.025 + dust * 0.055 + biofilm * 0.045 + edgeWear * 0.035, 0, 0.14),
      calibrationStatus: P.weathering.calibrationStatus,
      id: tile.id
    };
  }
  window.TilesMotherHistoricWeathering = Object.freeze({ evolve });
})();
