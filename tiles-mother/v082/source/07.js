/* Tiles Mother V0.8.2 observation contract. */
(() => {
  'use strict';
  const parts = window.TilesMotherV08Parts || (window.TilesMotherV08Parts = {});
  const MODES = Object.freeze({
    aaa_beauty: Object.freeze({ label: '3A 工作室', exposure: 1.10, diagnostic: null }),
    neutral_inspection: Object.freeze({ label: '中性检查', exposure: 1.0, diagnostic: null }),
    raking_light: Object.freeze({ label: '掠射光', exposure: 1.04, diagnostic: null }),
    contact_diagnostic: Object.freeze({ label: '搭接诊断', exposure: 1.04, diagnostic: 'contacts' }),
    drainage_diagnostic: Object.freeze({ label: '排水诊断', exposure: 1.03, diagnostic: 'drainage' })
  });
  const VIEWS = Object.freeze(['roof', 'single', 'trio']);
  const FOCI = Object.freeze(['all', 'side-edge', 'cross-section', 'pan-overlap', 'cover-seat', 'drainage', 'surface-micro']);
  function makeState(raw) {
    const value = raw && typeof raw === 'object' ? raw : {};
    const physicalTime = Number.isFinite(Number(value.physicalTime)) ? Math.max(0, Number(value.physicalTime)) : 0;
    return {
      schema: 'tiles-mother-v08-observation-state',
      version: '0.8.2',
      view: VIEWS.includes(value.view) ? value.view : 'roof',
      mode: MODES[value.mode] ? value.mode : 'aaa_beauty',
      focus: FOCI.includes(value.focus) ? value.focus : 'all',
      activeFamily: value.activeFamily === 'cover' ? 'cover' : 'pan',
      variant: Number.isInteger(value.variant) ? Math.max(0, Math.min(2, value.variant)) : 0,
      physicalTime,
      solverStep: 1,
      displayTime: physicalTime,
      channel: ['final','albedo','roughness','ao','normal','weather'].includes(value.channel) ? value.channel : 'final',
      roofId: 'jiangwutang-roof-001',
      processId: 'tiles-mother-v0.8-candidate',
      visualApproved: false,
      productionApproved: false,
      distillationComplete: false
    };
  }
  function modeInfo(state) { return MODES[state.mode] || MODES.aaa_beauty; }
  function tick(state) { state.physicalTime = Math.min(150, state.physicalTime + state.solverStep); state.displayTime = state.physicalTime; return state; }
  parts.studio = Object.freeze({ MODES, VIEWS, FOCI, makeState, modeInfo, tick });
})();
