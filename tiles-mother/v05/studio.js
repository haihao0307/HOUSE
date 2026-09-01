/* V0.5 observation state: one clock, three explicit display modes, no respawn. */
(() => {
  'use strict';
  const parts = window.TilesMotherV05Parts || (window.TilesMotherV05Parts = {});
  const MODES = Object.freeze({
    neutral_inspection: Object.freeze({ label: '中性几何检查', channel: 'source', detail: false, exposure: 1 }),
    studio_beauty: Object.freeze({ label: '完整光照观察', channel: 'final', detail: true, exposure: 1 }),
    diagnostic: Object.freeze({ label: '字段与斜光诊断', channel: 'meso', detail: true, exposure: 1 })
  });
  const FOCI = ['all', 'side-edge', 'cross-section', 'pan-overlap', 'cover-seam', 'board-micro'];
  function makeState(raw) {
    const v = raw && typeof raw === 'object' ? raw : {};
    const physicalTime = Number.isFinite(Number(v.physicalTime)) ? Math.max(0, Number(v.physicalTime)) : 0;
    return {
      schema: 'tiles-mother-v05-observation-state', version: '0.5.0', enabled: v.enabled !== false,
      view: ['single', 'roof'].includes(v.view) ? v.view : 'roof', mode: MODES[v.mode] ? v.mode : 'studio_beauty',
      focus: FOCI.includes(v.focus) ? v.focus : 'all',
      layers: { macro: v.layers?.macro !== false, meso: v.layers?.meso !== false, micro: v.layers?.micro !== false, weather: v.layers?.weather !== false },
      physicalTime, solverStep: 21600, displayTime: physicalTime,
      roofId: 'jiangwutang-roof-001', entityId: 'tiles-mother-v05-preview', processId: 'tiles-mother-v0.5-candidate',
      calibrationStatus: 'illustrative_not_calibrated'
    };
  }
  function modeInfo(state) { return MODES[state.mode] || MODES.studio_beauty; }
  function tick(state) { state.physicalTime += state.solverStep; state.displayTime = state.physicalTime; return state; }
  parts.studio = Object.freeze({ MODES, FOCI, makeState, modeInfo, tick });
})();
