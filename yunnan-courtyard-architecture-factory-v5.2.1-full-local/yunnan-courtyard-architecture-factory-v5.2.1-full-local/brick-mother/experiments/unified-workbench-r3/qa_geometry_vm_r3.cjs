#!/usr/bin/env node
/* Execute the real R3 inline JavaScript with deterministic DOM/WebGL2 stubs.
 *
 * This is not a visual test. It exists so geometry generation, mode switching,
 * QA telemetry, and shader/program setup still run when no browser binary is
 * installed. The implementation code is extracted from the deliverable HTML;
 * no geometry formulas are copied into this harness.
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const HERE = __dirname;
const DEFAULT_HTML = path.resolve(HERE, '..', '..', 'Brick_Mother_Unified_Workbench_R3.html');
const MODES = ['single-brick', 'brick-wall-plaster', 'stone', 'earth-wall-plaster'];
const MAX_TRIS = 150_000;
const MAX_VERTEX_BYTES = 24 * 1024 * 1024;

function parseArgs(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    result[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return result;
}

function element(id, extra = {}) {
  const listeners = new Map();
  return Object.assign({
    id,
    value: '1',
    textContent: '',
    hidden: false,
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatch(type) {
      for (const handler of listeners.get(type) || []) {
        handler({ target: this, preventDefault() {}, pointerId: 1 });
      }
    },
    setPointerCapture() {},
    getBoundingClientRect() { return { x: 0, y: 0, width: 390, height: 400 }; },
  }, extra);
}

function webgl2Stub() {
  let nextId = 1;
  const object = kind => ({ kind, id: nextId++ });
  return {
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88E4,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    DEPTH_TEST: 0x0B71,
    LEQUAL: 0x0203,
    CULL_FACE: 0x0B44,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    NO_ERROR: 0,
    createShader: () => object('shader'),
    shaderSource() {},
    compileShader() {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    createProgram: () => object('program'),
    attachShader() {},
    linkProgram() {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteShader() {},
    createVertexArray: () => object('vao'),
    bindVertexArray() {},
    enable() {},
    depthFunc() {},
    disable() {},
    clearColor() {},
    createBuffer: () => object('buffer'),
    deleteBuffer() {},
    bindBuffer() {},
    bufferData() {},
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    viewport() {},
    clear() {},
    useProgram() {},
    getUniformLocation: (_program, name) => ({ name }),
    uniformMatrix4fv() {},
    uniform3fv() {},
    uniform4f() {},
    drawArrays() {},
    getError: () => 0,
  };
}

function makeContext() {
  const gl = webgl2Stub();
  const elements = new Map();
  const ids = [
    'view', 'stage', 'panel', 'status', 'error', 'strength', 'scale', 'height',
    'roughness', 'edge', 'strengthOut', 'scaleOut', 'heightOut', 'roughnessOut',
    'edgeOut', 'modeName', 'modeNote', 'layerNote', 'reset', 'variant',
  ];
  for (const id of ids) elements.set(id, element(id));
  const canvas = elements.get('view');
  Object.assign(canvas, {
    width: 390,
    height: 400,
    getContext(kind) { return kind === 'webgl2' ? gl : null; },
  });
  Object.assign(elements.get('stage'), {
    clientWidth: 390,
    clientHeight: 400,
    getBoundingClientRect() { return { x: 0, y: 0, width: 390, height: 400 }; },
  });
  elements.get('strength').value = '1';
  elements.get('scale').value = '1';
  elements.get('height').value = '1';
  elements.get('roughness').value = '0';
  elements.get('edge').value = '1';

  const modeElements = MODES.map(mode => element(`mode-${mode}`, { dataset: { mode } }));
  const viewElements = ['front', 'end', 'iso'].map(view =>
    element(`view-${view}`, { dataset: { view } }));
  let timerId = 0;
  const globalListeners = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element(id));
      return elements.get(id);
    },
    querySelectorAll(selector) {
      if (selector === '[data-mode]') return modeElements;
      if (selector === '[data-view]') return viewElements;
      return [];
    },
  };
  const sandbox = {
    console,
    document,
    devicePixelRatio: 1,
    performance,
    structuredClone: globalThis.structuredClone,
    Float32Array,
    Math,
    Map,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Error,
    Infinity,
    NaN,
    setTimeout(callback) { callback(); return ++timerId; },
    clearTimeout() {},
    requestAnimationFrame(callback) { callback(performance.now()); return ++timerId; },
    cancelAnimationFrame() {},
    addEventListener(type, handler) {
      if (!globalListeners.has(type)) globalListeners.set(type, []);
      globalListeners.get(type).push(handler);
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return { context: vm.createContext(sandbox), elements, gl };
}

function addCheck(report, name, passed, evidence) {
  report.checks[name] = { passed: Boolean(passed), evidence };
}

function snapshot(api) {
  return {
    state: structuredClone(api.getState()),
    geometry: structuredClone(api.getGeometryAudit()),
    resources: structuredClone(api.getResourceAudit()),
  };
}

function input(elements, id, value) {
  const control = elements.get(id);
  control.value = String(value);
  control.dispatch('input');
}

function run() {
  const options = parseArgs(process.argv);
  const htmlPath = path.resolve(options.html || DEFAULT_HTML);
  const report = {
    schemaVersion: 'brick-mother-unified-geometry-vm-qa-r3.1',
    artifact: { path: htmlPath, bytes: null },
    runtime: 'node-vm-minimal-dom-webgl2-stub',
    checks: {},
    modes: {},
    passed: false,
    humanVisualApproval: false,
    note: 'Real workbench JavaScript/geometry execution; not raster or visual approval.',
  };
  if (!fs.existsSync(htmlPath)) {
    addCheck(report, 'html_exists', false, htmlPath);
  } else {
    const html = fs.readFileSync(htmlPath, 'utf8');
    report.artifact.bytes = Buffer.byteLength(html);
    report.artifact.sha256 = crypto.createHash('sha256').update(html).digest('hex');
    const match = html.match(/<script>([\s\S]*?)<\/script>/i);
    addCheck(report, 'one_inline_script_found', Boolean(match), match ? match[1].length : 0);
    if (match) {
      const { context, elements } = makeContext();
      const started = performance.now();
      try {
        new vm.Script(match[1], { filename: htmlPath }).runInContext(context, { timeout: 30_000 });
        report.executionMs = performance.now() - started;
        const api = context.window.__BRICK_QA__;
        addCheck(
          report,
          'qa_ready_after_real_build_draw',
          Boolean(api && api.ready && typeof api.setMode === 'function' &&
            typeof api.getState === 'function' && typeof api.getGeometryAudit === 'function' &&
            typeof api.getResourceAudit === 'function'),
          api ? { ready: api.ready } : null,
        );
        if (api) {
          for (const mode of MODES) {
            const accepted = api.setMode(mode);
            report.modes[mode] = snapshot(api);
            report.modes[mode].accepted = accepted;
          }
          addCheck(
            report,
            'four_modes_execute',
            MODES.every(mode => report.modes[mode].accepted === true &&
              report.modes[mode].state.activeMode === mode),
            Object.fromEntries(MODES.map(mode => [mode, report.modes[mode].state.activeMode])),
          );
          addCheck(
            report,
            'resource_budgets',
            MODES.every(mode => {
              const resources = report.modes[mode].resources;
              return resources.contextCount === 1 && resources.activeOnly === true &&
                resources.triangles <= MAX_TRIS && resources.vertexBytes <= MAX_VERTEX_BYTES &&
                resources.canvasPixels <= 520_000 && resources.dprCap <= 1.25;
            }),
            Object.fromEntries(MODES.map(mode => [mode, report.modes[mode].resources])),
          );

          const single = report.modes['single-brick'].geometry;
          const wall = report.modes['brick-wall-plaster'].geometry;
          const stone = report.modes.stone.geometry;
          const earth = report.modes['earth-wall-plaster'].geometry;
          addCheck(
            report,
            'shared_brick_kernel',
            single.brickKernelId === wall.brickKernelId,
            { single: single.brickKernelId, wall: wall.brickKernelId },
          );
          addCheck(
            report,
            'wall_course_ends_alternate',
            wall.courses.length > 1 && wall.courses.every((course, index) =>
              index === 0 || course.endBond !== wall.courses[index - 1].endBond),
            wall.courses.map(course => ({
              course: course.course,
              endBond: course.endBond,
              endYaw: course.endYaw,
            })),
          );
          addCheck(
            report,
            'wall_has_true_half_brick',
            wall.halfBricks > 0 && wall.trueHalfBrick === true,
            { halfBricks: wall.halfBricks, trueHalfBrick: wall.trueHalfBrick },
          );
          addCheck(
            report,
            'stone_not_recolored_brick',
            stone.recoloredBrick === false && Boolean(stone.stoneKernelId),
            stone,
          );
          addCheck(
            report,
            'earth_wall_monolithic',
            earth.monolithic === true && earth.brickSeams === 0,
            earth,
          );
          addCheck(
            report,
            'microscope_17_scales',
            MODES.every(mode => report.modes[mode].geometry.scaleCount === 17),
            Object.fromEntries(MODES.map(mode => [mode, report.modes[mode].geometry.scaleCount])),
          );

          api.setMode('brick-wall-plaster');
          input(elements, 'height', 1);
          const wallHeight1 = api.getGeometryAudit().geometryHash;
          input(elements, 'height', 0);
          const wallHeight0 = api.getGeometryAudit().geometryHash;
          input(elements, 'height', 1);
          const wallHeight1Again = api.getGeometryAudit().geometryHash;
          const beforeRoughness = api.getGeometryAudit().geometryHash;
          input(elements, 'roughness', 0);
          const roughness0 = api.getGeometryAudit().geometryHash;
          input(elements, 'roughness', 2);
          const roughness2 = api.getGeometryAudit().geometryHash;
          addCheck(
            report,
            'wall_height_changes_geometry',
            wallHeight1 !== wallHeight0,
            { height1: wallHeight1, height0: wallHeight0 },
          );
          addCheck(
            report,
            'roughness_does_not_change_geometry',
            beforeRoughness === roughness0 && roughness0 === roughness2,
            { beforeRoughness, roughness0, roughness2 },
          );
          addCheck(
            report,
            'wall_geometry_is_deterministic',
            wallHeight1 === wallHeight1Again,
            { first: wallHeight1, repeated: wallHeight1Again },
          );

          api.setMode('earth-wall-plaster');
          input(elements, 'height', 1);
          const earthHeight1 = api.getGeometryAudit().geometryHash;
          input(elements, 'height', 0);
          const earthHeight0 = api.getGeometryAudit().geometryHash;
          addCheck(
            report,
            'earth_height_changes_geometry',
            earthHeight1 !== earthHeight0,
            { height1: earthHeight1, height0: earthHeight0 },
          );

          api.setMode('single-brick');
          const singleAgain = api.getGeometryAudit().geometryHash;
          addCheck(
            report,
            'frozen_single_survives_mode_roundtrip',
            singleAgain === single.geometryHash,
            { before: single.geometryHash, after: singleAgain },
          );
        }
      } catch (error) {
        report.executionError = error.stack || String(error);
        addCheck(report, 'real_javascript_executes', false, report.executionError);
      }
    }
  }
  report.passed = Boolean(Object.keys(report.checks).length) &&
    Object.values(report.checks).every(item => item.passed);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) fs.writeFileSync(path.resolve(options.out), serialized, 'utf8');
  process.stdout.write(serialized);
  process.exitCode = report.passed ? 0 : 1;
}

run();
