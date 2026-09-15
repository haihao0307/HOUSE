#!/usr/bin/env node
/* Execute the deliverable's real inline JavaScript with deterministic DOM and
 * WebGL2 API stubs.
 *
 * The harness captures the shader strings and uniform uploads produced by the
 * page.  It proves JavaScript execution, scene selection, build-step filtering
 * and CPU-to-WebGL data flow.  A stub cannot prove that a real GPU accepts or
 * rasterizes the shader; the JSON report states that boundary explicitly.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const DEFAULT_HTML = path.resolve(HERE, '..', '..', 'Brick_Mother_Bond_Study_R3_1.html');
const REQUIRED_VIEWS = ['iso', 'front', 'end', 'top'];
const REQUIRED_MODES = ['wall', 'mother'];

function parseArgs(argv) {
  const result = {};
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) continue;
    const key = argument.slice(2);
    result[key] = argv[index + 1] && !argv[index + 1].startsWith('--')
      ? argv[++index]
      : true;
  }
  return result;
}

function addCheck(report, name, passed, evidence) {
  report.checks[name] = { passed: Boolean(passed), evidence };
}

function cloneValue(value) {
  if (ArrayBuffer.isView(value)) return Array.from(value);
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
  );
  return value;
}

function extractScripts(html) {
  const scripts = [];
  const expression = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(expression)) {
    const attrs = match[1];
    const idMatch = attrs.match(/\bid\s*=\s*['"]([^'"]+)['"]/i);
    const typeMatch = attrs.match(/\btype\s*=\s*['"]([^'"]+)['"]/i);
    scripts.push({
      id: idMatch ? idMatch[1] : null,
      type: typeMatch ? typeMatch[1].toLowerCase() : null,
      source: match[2],
    });
  }
  return scripts;
}

function extractControls(html, attribute) {
  const expression = new RegExp(`\\b${attribute}\\s*=\\s*['"]([^'"]+)['"]`, 'gi');
  return Array.from(html.matchAll(expression), match => match[1]);
}

function makeClassList() {
  const values = new Set();
  return {
    add(...items) { items.forEach(item => values.add(item)); },
    remove(...items) { items.forEach(item => values.delete(item)); },
    toggle(item, force) {
      const enabled = force === undefined ? !values.has(item) : Boolean(force);
      if (enabled) values.add(item);
      else values.delete(item);
      return enabled;
    },
    contains(item) { return values.has(item); },
    values() { return Array.from(values); },
  };
}

function makeElement(id, extra = {}) {
  const listeners = new Map();
  const attributes = new Map();
  return Object.assign({
    id,
    value: '',
    textContent: '',
    hidden: false,
    disabled: false,
    dataset: {},
    classList: makeClassList(),
    onclick: null,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatch(type, extraEvent = {}) {
      const event = Object.assign({
        target: this,
        currentTarget: this,
        preventDefault() {},
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        deltaY: 0,
      }, extraEvent);
      for (const handler of listeners.get(type) || []) handler(event);
    },
    click() {
      if (typeof this.onclick === 'function') this.onclick({ target: this, currentTarget: this });
      this.dispatch('click');
    },
  }, extra);
}

function makeWebGL2Capture() {
  let nextObjectId = 1;
  const object = kind => ({ kind, id: nextObjectId++ });
  const shaders = new Map();
  const uniforms = new Map();
  const drawCalls = [];
  const api = {
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    TRIANGLES: 0x0004,
    createShader(type) {
      const shader = object('shader');
      shaders.set(shader, { type, source: null, compiled: false });
      return shader;
    },
    shaderSource(shader, source) { shaders.get(shader).source = String(source); },
    compileShader(shader) { shaders.get(shader).compiled = true; },
    getShaderParameter(shader, parameter) {
      return parameter === api.COMPILE_STATUS && shaders.get(shader)?.compiled === true;
    },
    getShaderInfoLog() { return ''; },
    createProgram: () => object('program'),
    attachShader() {},
    linkProgram(program) { program.linked = true; },
    getProgramParameter(program, parameter) {
      return parameter === api.LINK_STATUS && program.linked === true;
    },
    getProgramInfoLog() { return ''; },
    createVertexArray: () => object('vertexArray'),
    bindVertexArray() {},
    useProgram() {},
    getUniformLocation(_program, name) { return { name }; },
    uniform4fv(location, value) { uniforms.set(location.name, cloneValue(value)); },
    uniform1fv(location, value) { uniforms.set(location.name, cloneValue(value)); },
    uniform1i(location, value) { uniforms.set(location.name, Number(value)); },
    uniform1f(location, value) { uniforms.set(location.name, Number(value)); },
    uniform2f(location, x, y) { uniforms.set(location.name, [Number(x), Number(y)]); },
    uniform3fv(location, value) { uniforms.set(location.name, cloneValue(value)); },
    viewport(x, y, width, height) { api.lastViewport = [x, y, width, height]; },
    drawArrays(mode, first, count) {
      drawCalls.push({
        mode,
        first,
        count,
        uniforms: cloneValue(Object.fromEntries(uniforms)),
      });
    },
  };
  return { api, shaders, uniforms, drawCalls };
}

function buildHarness(html, scripts) {
  const manifestScript = scripts.find(script => script.id === 'brick-bond-manifest');
  const edgeScript = scripts.find(script => script.id === 'edge-band-data');
  if (!manifestScript || !edgeScript) throw new Error('required JSON script blocks are missing');

  const glCapture = makeWebGL2Capture();
  const elements = new Map();
  const ids = [
    'c', 'status', 'error', 'modeTitle', 'modeMeta', 'courseBuild', 'courseValue',
    'brick-bond-manifest', 'edge-band-data',
  ];
  for (const id of ids) elements.set(id, makeElement(id));
  elements.get('brick-bond-manifest').textContent = manifestScript.source;
  elements.get('edge-band-data').textContent = edgeScript.source;
  elements.get('courseBuild').value = '4';

  const stage = makeElement('stage', {
    getBoundingClientRect() { return { x: 0, y: 0, width: 960, height: 620 }; },
  });
  const canvas = elements.get('c');
  Object.assign(canvas, {
    width: 0,
    height: 0,
    getContext(kind) { return kind === 'webgl2' ? glCapture.api : null; },
    setPointerCapture() {},
  });

  const modeControls = extractControls(html, 'data-mode').map(mode => makeElement(`mode-${mode}`, {
    dataset: { mode },
  }));
  const viewControls = extractControls(html, 'data-view').map(view => makeElement(`view-${view}`, {
    dataset: { view },
  }));
  elements.get('error').hidden = true;
  const runtimeErrors = [];
  const windowListeners = new Map();
  let frameNumber = 0;

  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelector(selector) {
      if (selector === '.stage') return stage;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-mode]') return modeControls;
      if (selector === '[data-view]') return viewControls;
      return [];
    },
  };

  class ResizeObserverStub {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() {}
  }

  const sandbox = {
    Array,
    Boolean,
    console: {
      log() {},
      info() {},
      warn() {},
      error(...values) { runtimeErrors.push(values.map(value => String(value)).join(' ')); },
    },
    devicePixelRatio: 1,
    Error,
    Float32Array,
    Infinity,
    JSON,
    Map,
    Math,
    NaN,
    Number,
    Object,
    ResizeObserver: ResizeObserverStub,
    Set,
    String,
    document,
    requestAnimationFrame(callback) {
      callback(++frameNumber * 16.6667);
      return frameNumber;
    },
    cancelAnimationFrame() {},
    addEventListener(type, callback) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(callback);
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return {
    context: vm.createContext(sandbox),
    elements,
    modeControls,
    viewControls,
    glCapture,
    runtimeErrors,
  };
}

function latestDraw(glCapture) {
  return glCapture.drawCalls.at(-1) || null;
}

function uniform(draw, name) {
  return draw?.uniforms?.[name] ?? draw?.uniforms?.[`${name}[0]`];
}

function posePrefix(draw) {
  const count = uniform(draw, 'uBrickCount') || 0;
  return (uniform(draw, 'uBrickPose') || []).slice(0, count * 4);
}

function cutCount(draw) {
  const count = uniform(draw, 'uBrickCount') || 0;
  return (uniform(draw, 'uBrickCut') || []).slice(0, count).filter(value => Math.abs(value) > 0.5).length;
}

function generatedHarmonicAudit(fragmentSource) {
  const functions = [];
  const expression = /float\s+((?:mid|high)_[xyz]_[mp]_[mp])\s*\(float\s+t\)\s*\{([\s\S]*?)\}/g;
  for (const match of fragmentSource.matchAll(expression)) {
    const coefficientTerms = (match[2].match(/\*(?:cos|sin)\s*\(/g) || []).length;
    functions.push({ name: match[1], coefficientTerms });
  }
  return {
    functionCount: functions.length,
    coefficientTerms: functions.reduce((sum, item) => sum + item.coefficientTerms, 0),
    functions,
  };
}

function run() {
  const options = parseArgs(process.argv);
  const htmlPath = path.resolve(options.html || DEFAULT_HTML);
  const report = {
    schemaVersion: 'brick-mother-bond-runtime-vm-qa-r3.1',
    artifact: { path: htmlPath, bytes: null, sha256: null },
    runtime: 'node-vm-dom-webgl2-api-capture',
    checks: {},
    snapshots: {},
    passed: false,
    realGpuCompilation: false,
    humanVisualApproval: false,
    note: 'The actual page JavaScript ran and supplied shader/uniform data to an API stub; no real GPU compilation or visual approval is claimed.',
  };

  if (!fs.existsSync(htmlPath)) {
    addCheck(report, 'html_exists', false, htmlPath);
  } else {
    const html = fs.readFileSync(htmlPath, 'utf8');
    report.artifact.bytes = Buffer.byteLength(html);
    report.artifact.sha256 = crypto.createHash('sha256').update(html).digest('hex');
    addCheck(report, 'html_exists', true, htmlPath);
    const scripts = extractScripts(html);
    const executable = scripts.filter(script => !script.type || /javascript|ecmascript/.test(script.type));
    addCheck(
      report,
      'one_executable_inline_script',
      executable.length === 1,
      scripts.map(script => ({ id: script.id, type: script.type, bytes: Buffer.byteLength(script.source) })),
    );

    if (executable.length === 1) {
      let harness;
      try {
        harness = buildHarness(html, scripts);
        new vm.Script(executable[0].source, { filename: htmlPath }).runInContext(
          harness.context,
          { timeout: 30_000 },
        );
        const surfacedErrors = harness.runtimeErrors;
        const errorElement = harness.elements.get('error');
        addCheck(
          report,
          'real_page_javascript_executes_without_exception',
          surfacedErrors.length === 0 && errorElement.hidden === true,
          { consoleErrors: surfacedErrors, errorVisible: !errorElement.hidden, errorText: errorElement.textContent },
        );
      } catch (error) {
        addCheck(
          report,
          'real_page_javascript_executes_without_exception',
          false,
          error.stack || String(error),
        );
      }

      if (harness && report.checks.real_page_javascript_executes_without_exception.passed) {
        const { glCapture, elements, modeControls, viewControls } = harness;
        const manifest = JSON.parse(scripts.find(script => script.id === 'brick-bond-manifest').source);
        const sources = Array.from(glCapture.shaders.values());
        const vertex = sources.find(item => item.type === glCapture.api.VERTEX_SHADER)?.source || '';
        const fragment = sources.find(item => item.type === glCapture.api.FRAGMENT_SHADER)?.source || '';
        addCheck(
          report,
          'page_supplies_one_vertex_and_one_fragment_shader',
          sources.length === 2 && Boolean(vertex) && Boolean(fragment),
          sources.map(item => ({ type: item.type, bytes: item.source?.length || 0 })),
        );
        const unresolved = [
          ...vertex.matchAll(/\$\{[^}]*\}|\bundefined\b/g),
          ...fragment.matchAll(/\$\{[^}]*\}|\bundefined\b/g),
        ].map(match => match[0]);
        addCheck(
          report,
          'final_shader_strings_have_no_unresolved_generation_markers',
          unresolved.length === 0,
          unresolved,
        );
        const harmonics = generatedHarmonicAudit(fragment);
        addCheck(
          report,
          'fragment_shader_contains_336_generated_residual_coefficients',
          harmonics.functionCount === 24 && harmonics.coefficientTerms === 336,
          harmonics,
        );
        addCheck(
          report,
          'fragment_shader_uses_exact_sdf_and_frozen_material_path',
          ['sdRoundBox', 'surfaceDelta', 'contourShapeLong', 'processMaterial', 'brickExactWorld']
            .every(token => fragment.includes(token)),
          ['sdRoundBox', 'surfaceDelta', 'contourShapeLong', 'processMaterial', 'brickExactWorld']
            .filter(token => fragment.includes(token)),
        );

        const initial = latestDraw(glCapture);
        report.snapshots.initial = {
          brickCount: uniform(initial, 'uBrickCount'),
          cutCount: cutCount(initial),
          posePrefix: posePrefix(initial),
        };
        addCheck(
          report,
          'default_wall_uploads_16_poses_and_4_real_cuts',
          uniform(initial, 'uBrickCount') === 16 && cutCount(initial) === 4 && posePrefix(initial).length === 64,
          report.snapshots.initial,
        );
        const uploadedPoses = posePrefix(initial);
        const uploadedCuts = (uniform(initial, 'uBrickCut') || []).slice(0, 16);
        const expectedPoses = manifest.wall.placements.flatMap(placement => {
          const center = placement.kernelCenter || placement.center;
          return [center[0], center[1], center[2], placement.yawQuarter];
        });
        const maxPoseDelta = Math.max(
          ...expectedPoses.map((value, index) => Math.abs(value - uploadedPoses[index])),
        );
        const expectedCuts = manifest.wall.placements.map(placement =>
          placement.cutPlane?.keep === 'local-x-positive'
            ? 1
            : placement.cutPlane?.keep === 'local-x-negative' ? -1 : 0);
        addCheck(
          report,
          'uploaded_poses_and_cuts_match_manifest_kernel_transforms',
          expectedPoses.length === uploadedPoses.length
            && maxPoseDelta <= 1e-6
            && JSON.stringify(expectedCuts) === JSON.stringify(uploadedCuts),
          { maxPoseDelta, expectedCuts, uploadedCuts },
        );

        const slider = elements.get('courseBuild');
        const buildCounts = {};
        for (const step of [1, 2, 3, 4]) {
          slider.value = String(step);
          slider.dispatch('input');
          const draw = latestDraw(glCapture);
          buildCounts[step] = {
            brickCount: uniform(draw, 'uBrickCount'),
            cutCount: cutCount(draw),
            output: elements.get('courseValue').value,
          };
        }
        report.snapshots.buildSteps = buildCounts;
        addCheck(
          report,
          'course_slider_uploads_4_8_12_16_bottom_up',
          [1, 2, 3, 4].every(step => buildCounts[step].brickCount === step * 4)
            && [1, 2, 3, 4].every(step => buildCounts[step].cutCount === step),
          buildCounts,
        );

        const modeByName = Object.fromEntries(modeControls.map(control => [control.dataset.mode, control]));
        const viewByName = Object.fromEntries(viewControls.map(control => [control.dataset.view, control]));
        addCheck(
          report,
          'runtime_controls_contain_only_wall_mother_and_four_views',
          JSON.stringify(Object.keys(modeByName).sort()) === JSON.stringify(REQUIRED_MODES.sort())
            && REQUIRED_VIEWS.every(view => viewByName[view]),
          { modes: Object.keys(modeByName), views: Object.keys(viewByName) },
        );

        modeByName.mother.click();
        const mother = latestDraw(glCapture);
        report.snapshots.mother = {
          brickCount: uniform(mother, 'uBrickCount'),
          cutCount: cutCount(mother),
          posePrefix: posePrefix(mother),
        };
        addCheck(
          report,
          'mother_mode_uploads_one_uncut_canonical_pose',
          uniform(mother, 'uBrickCount') === 1 && cutCount(mother) === 0 && posePrefix(mother).length === 4,
          report.snapshots.mother,
        );

        modeByName.wall.click();
        slider.value = '4';
        slider.dispatch('input');
        const beforeViews = latestDraw(glCapture);
        const placementBeforeViews = posePrefix(beforeViews);
        const viewSnapshots = {};
        for (const view of REQUIRED_VIEWS) {
          viewByName[view].click();
          const draw = latestDraw(glCapture);
          viewSnapshots[view] = {
            brickCount: uniform(draw, 'uBrickCount'),
            poseUnchanged: JSON.stringify(posePrefix(draw)) === JSON.stringify(placementBeforeViews),
            target: draw?.uniforms?.uTarget,
            angles: draw?.uniforms?.uAngles,
            distance: draw?.uniforms?.uDistance,
          };
        }
        report.snapshots.views = viewSnapshots;
        addCheck(
          report,
          'view_buttons_change_camera_without_changing_placement_uploads',
          REQUIRED_VIEWS.every(view => viewSnapshots[view].brickCount === 16 && viewSnapshots[view].poseUnchanged)
            && new Set(REQUIRED_VIEWS.map(view => JSON.stringify([
              viewSnapshots[view].target,
              viewSnapshots[view].angles,
              viewSnapshots[view].distance,
            ]))).size === 4,
          viewSnapshots,
        );
      }
    }
  }

  report.passed = Boolean(Object.keys(report.checks).length)
    && Object.values(report.checks).every(check => check.passed);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) fs.writeFileSync(path.resolve(options.out), serialized, 'utf8');
  process.stdout.write(serialized);
  process.exitCode = report.passed ? 0 : 1;
}

run();
