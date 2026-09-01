/*
 * Tiles Mother Jiangwutang V0.3 candidate material.
 * This is derived from the lightweight native-resolution analysis. It does not
 * load or embed the original FBX, ZIP, Diffuse or Normal PNG.
 */
(() => {
  'use strict';

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const family = Object.freeze({
    pan: Object.freeze({ macroFrequency: 1.35, mottleFrequency: 4.2, grainFrequency: 76, weatherAxis: [1, 0.97], weakMicroRelief: 0.18 }),
    cover: Object.freeze({ macroFrequency: 1.15, mottleFrequency: 3.7, grainFrequency: 68, weatherAxis: [1, 0.97], weakMicroRelief: 0.18 })
  });

  function candidateFor(profile, controls = {}, seeds = {}) {
    const base = family[profile] || family.pan;
    const temperature = clamp(Number(controls.temperature || 0) / 100, -1, 1);
    const microRelief = clamp(Number(controls.microRelief ?? 18) / 100, 0, 1);
    return Object.freeze({
      profile,
      macroFrequency: base.macroFrequency,
      mottleFrequency: base.mottleFrequency,
      grainFrequency: base.grainFrequency,
      weatherAxis: base.weatherAxis,
      temperatureBias: temperature,
      microRelief,
      roughness: clamp(Number(controls.roughness || 82) / 100, 0.08, 0.98),
      seeds: Object.freeze({ color: seeds.color >>> 0, weather: seeds.weather >>> 0, micro: seeds.micro >>> 0 })
    });
  }

  window.TilesMotherJiangwutang = Object.freeze({
    version: '0.3.0',
    configPath: 'tiles-mother/knowledge/jiangwutang-001/material-candidate-v0.3.json',
    sourceAnalysisPath: 'tiles-mother/knowledge/jiangwutang-001/analysis.json',
    sourceReadVerified: true,
    originalSourceRuntimeDependency: false,
    visualApproved: false,
    productionApproved: false,
    family,
    candidateFor
  });
})();
