#!/usr/bin/env node
/* Execute the real R3.2 inline page JavaScript inside a deterministic DOM and
 * WebGL2 API capture.  This verifies the CPU-to-WebGL contract and interaction
 * invariants.  It deliberately does not claim real GPU compilation or visual
 * acceptance; those are separate checks.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HERE = __dirname;
const DEFAULT_HTML = path.resolve(HERE, '..', '..', 'Brick_Mother_Wall_4x3_R3_2.html');
const REQUIRED_VIEWS = ['iso', 'front', 'back', 'end', 'top'];

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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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

function attribute(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*['"]([^'"]*)['"]`, 'i'));
  return match ? match[1] : null;
}

function extractElementSpecs(html) {
  const specs = new Map();
  const expression = /<([a-z][\w:-]*)\b([^>]*)>/gi;
  for (const match of html.matchAll(expression)) {
    const attrs = match[2];
    const id = attribute(attrs, 'id');
    if (!id) continue;
    specs.set(id, {
      id,
      tagName: match[1].toUpperCase(),
      type: attribute(attrs, 'type') || '',
      value: attribute(attrs, 'value') || '',
      min: attribute(attrs, 'min'),
      max: attribute(attrs, 'max'),
      step: attribute(attrs, 'step'),
      hidden: /(?:^|\s)hidden(?:\s|=|$)/i.test(attrs),
      className: attribute(attrs, 'class') || '',
    });
  }
  return specs;
}

function extractDataControls(html, dataName) {
  const controls = [];
  const expression = /<([a-z][\w:-]*)\b([^>]*)>/gi;
  for (const match of html.matchAll(expression)) {
    const attrs = match[2];
    const value = attribute(attrs, `data-${dataName}`);
    if (value === null) continue;
    controls.push({
      id: attribute(attrs, 'id') || `${dataName}-${value}`,
      value,
      className: attribute(attrs, 'class') || '',
    });
  }
  return controls;
}

function makeClassList(initial = '') {
  const values = new Set(initial.split(/\s+/).filter(Boolean));
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
  const element = {
    id,
    tagName: 'DIV',
    type: '',
    value: '',
    min: '',
    max: '',
    step: '',
    textContent: '',
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    classList: makeClassList(),
    onclick: null,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      listeners.set(type, handlers.filter(item => item !== handler));
    },
    dispatch(type, extraEvent = {}) {
      const event = Object.assign({
        type,
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        deltaY: 0,
      }, extraEvent);
      for (const handler of listeners.get(type) || []) handler(event);
    },
    click() {
      if (typeof this.onclick === 'function') {
        this.onclick({ target: this, currentTarget: this, preventDefault() {} });
      }
      this.dispatch('click');
    },
  };
  return Object.assign(element, extra);
}

function makeWebGL2Capture() {
  let nextObjectId = 1;
  const object = kind => ({ kind, id: nextObjectId++ });
  const shaders = new Map();
  const programs = [];
  const uniforms = new Map();
  const drawCalls = [];
  let currentProgram = null;
  const api = {
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    TRIANGLES: 0x0004,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88E4,
    FLOAT: 0x1406,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    DEPTH_TEST: 0x0B71,
    CULL_FACE: 0x0B44,
    LEQUAL: 0x0203,
    drawingBufferWidth: 960,
    drawingBufferHeight: 620,
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
    createProgram() {
      const program = object('program');
      program.shaders = [];
      programs.push(program);
      return program;
    },
    attachShader(program, shader) { program.shaders.push(shader); },
    linkProgram(program) { program.linked = true; },
    getProgramParameter(program, parameter) {
      return parameter === api.LINK_STATUS && program.linked === true;
    },
    getProgramInfoLog() { return ''; },
    createVertexArray: () => object('vertexArray'),
    bindVertexArray() {},
    createBuffer: () => object('buffer'),
    bindBuffer() {},
    bufferData() {},
    enableVertexAttribArray() {},
    vertexAttribPointer() {},
    getAttribLocation() { return 0; },
    useProgram(program) { currentProgram = program; },
    getUniformLocation(_program, name) { return { name }; },
    uniform1i(location, value) { uniforms.set(location.name, Number(value)); },
    uniform1f(location, value) { uniforms.set(location.name, Number(value)); },
    uniform1fv(location, value) { uniforms.set(location.name, cloneValue(value)); },
    uniform2f(location, x, y) { uniforms.set(location.name, [Number(x), Number(y)]); },
    uniform2fv(location, value) { uniforms.set(location.name, cloneValue(value)); },
    uniform3f(location, x, y, z) { uniforms.set(location.name, [Number(x), Number(y), Number(z)]); },
    uniform3fv(location, value) { uniforms.set(location.name, cloneValue(value)); },
    uniform4f(location, x, y, z, w) {
      uniforms.set(location.name, [Number(x), Number(y), Number(z), Number(w)]);
    },
    uniform4fv(location, value) { uniforms.set(location.name, cloneValue(value)); },
    uniformMatrix3fv(location, _transpose, value) { uniforms.set(location.name, cloneValue(value)); },
    uniformMatrix4fv(location, _transpose, value) { uniforms.set(location.name, cloneValue(value)); },
    viewport(x, y, width, height) {
      api.lastViewport = [x, y, width, height];
      api.drawingBufferWidth = width;
      api.drawingBufferHeight = height;
    },
    clearColor() {},
    clearDepth() {},
    clear() {},
    depthFunc() {},
    enable() {},
    disable() {},
    blendFunc() {},
    getExtension() { return {}; },
    drawArrays(mode, first, count) {
      drawCalls.push({
        call: 'drawArrays',
        mode,
        first,
        count,
        instanceCount: 1,
        programId: currentProgram?.id || null,
        uniforms: cloneValue(Object.fromEntries(uniforms)),
      });
    },
    drawArraysInstanced(mode, first, count, instanceCount) {
      drawCalls.push({
        call: 'drawArraysInstanced',
        mode,
        first,
        count,
        instanceCount: Number(instanceCount),
        programId: currentProgram?.id || null,
        uniforms: cloneValue(Object.fromEntries(uniforms)),
      });
    },
    drawElementsInstanced(mode, count, type, offset, instanceCount) {
      drawCalls.push({
        call: 'drawElementsInstanced',
        mode,
        count,
        type,
        offset,
        instanceCount: Number(instanceCount),
        programId: currentProgram?.id || null,
        uniforms: cloneValue(Object.fromEntries(uniforms)),
      });
    },
    vertexAttribDivisor() {},
  };
  return { api, shaders, programs, uniforms, drawCalls };
}

function buildHarness(html, scripts) {
  const glCapture = makeWebGL2Capture();
  const elements = new Map();
  const specs = extractElementSpecs(html);
  for (const spec of specs.values()) {
    elements.set(spec.id, makeElement(spec.id, {
      tagName: spec.tagName,
      type: spec.type,
      value: spec.value,
      min: spec.min || '',
      max: spec.max || '',
      step: spec.step || '',
      hidden: spec.hidden,
      classList: makeClassList(spec.className),
    }));
  }
  for (const script of scripts) {
    if (!script.id) continue;
    if (!elements.has(script.id)) elements.set(script.id, makeElement(script.id));
    elements.get(script.id).textContent = script.source;
  }

  const stage = makeElement('stage', {
    clientWidth: 960,
    clientHeight: 620,
    getBoundingClientRect() { return { x: 0, y: 0, width: 960, height: 620 }; },
  });
  const canvasId = Array.from(specs.values()).find(spec => spec.tagName === 'CANVAS')?.id || 'c';
  if (!elements.has(canvasId)) elements.set(canvasId, makeElement(canvasId));
  const canvas = elements.get(canvasId);
  Object.assign(canvas, {
    width: 0,
    height: 0,
    clientWidth: 960,
    clientHeight: 620,
    getContext(kind) { return kind === 'webgl2' ? glCapture.api : null; },
    getBoundingClientRect() { return { x: 0, y: 0, width: 960, height: 620 }; },
    setPointerCapture() {},
    releasePointerCapture() {},
  });

  const modeControls = extractDataControls(html, 'mode').map(spec => makeElement(spec.id, {
    dataset: { mode: spec.value },
    classList: makeClassList(spec.className),
  }));
  const viewControls = extractDataControls(html, 'view').map(spec => makeElement(spec.id, {
    dataset: { view: spec.value },
    classList: makeClassList(spec.className),
  }));
  const errorElement = elements.get('error');
  if (errorElement) errorElement.hidden = true;
  const runtimeErrors = [];
  const windowListeners = new Map();
  let frameNumber = 0;

  const document = {
    body: makeElement('body'),
    documentElement: makeElement('documentElement'),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelector(selector) {
      if (selector === '.stage') return stage;
      if (selector === 'canvas' || selector.startsWith('canvas#')) return canvas;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-mode]') return modeControls;
      if (selector === '[data-view]') return viewControls;
      return [];
    },
    createElement(tagName) { return makeElement('', { tagName: String(tagName).toUpperCase() }); },
  };

  class ResizeObserverStub {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() {}
  }

  const sandbox = {
    Array,
    ArrayBuffer,
    Boolean,
    console: {
      log() {},
      info() {},
      warn() {},
      error(...values) { runtimeErrors.push(values.map(value => String(value)).join(' ')); },
    },
    Date,
    devicePixelRatio: 1,
    Error,
    Float32Array,
    Float64Array,
    Infinity,
    Int32Array,
    JSON,
    Map,
    Math,
    NaN,
    Number,
    Object,
    performance: { now: () => frameNumber * 16.6667 },
    ResizeObserver: ResizeObserverStub,
    Set,
    String,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    document,
    innerWidth: 960,
    innerHeight: 620,
    requestAnimationFrame(callback) {
      frameNumber += 1;
      if (frameNumber > 10_000) throw new Error('runaway requestAnimationFrame loop');
      callback(frameNumber * 16.6667);
      return frameNumber;
    },
    cancelAnimationFrame() {},
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
    addEventListener(type, callback) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(callback);
    },
    removeEventListener(type, callback) {
      const handlers = windowListeners.get(type) || [];
      windowListeners.set(type, handlers.filter(item => item !== callback));
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return {
    canvas,
    context: vm.createContext(sandbox),
    elements,
    glCapture,
    modeControls,
    runtimeErrors,
    specs,
    viewControls,
  };
}

function latestDraw(glCapture) {
  return glCapture.drawCalls.at(-1) || null;
}

function captureInteraction(glCapture, action) {
  const start = glCapture.drawCalls.length;
  action();
  return glCapture.drawCalls.slice(start);
}

function lastFrame(calls) {
  const lastBrickIndex = calls.findLastIndex(call => /Instanced$/.test(call.call || ''));
  if (lastBrickIndex < 0) return calls;
  const priorBrickIndex = calls.slice(0, lastBrickIndex)
    .findLastIndex(call => /Instanced$/.test(call.call || ''));
  return calls.slice(priorBrickIndex + 1, lastBrickIndex + 1);
}

function brickDraw(calls) {
  return [...calls].reverse().find(call => /Instanced$/.test(call.call || '')) || null;
}

function soilDraw(calls) {
  return [...calls].reverse().find(call => call.call === 'drawArrays' && call.count === 36) || null;
}

function uniform(draw, name) {
  return draw?.uniforms?.[name] ?? draw?.uniforms?.[`${name}[0]`];
}

function matchingUniforms(draw, expression) {
  return Object.fromEntries(
    Object.entries(draw?.uniforms || {}).filter(([name]) => expression.test(name)),
  );
}

function normalizedUniforms(draw, omit) {
  return Object.fromEntries(
    Object.entries(draw?.uniforms || {})
      .filter(([name]) => !omit.some(expression => expression.test(name)))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function near(left, right, tolerance = 1e-6) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
}

function normalizeVector(vector) {
  const length = Math.hypot(...vector);
  return length > 0 ? vector.map(value => value / length) : vector.map(() => NaN);
}

function nearVector(left, right, tolerance = 1e-6) {
  return left.length === right.length
    && left.every((value, index) => near(value, right[index], tolerance));
}

function projectionAudit(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 16 || !matrix.every(Number.isFinite)) {
    return { kind: 'invalid', homogeneousRow: null, viewBasis: null };
  }
  const homogeneousRow = [matrix[3], matrix[7], matrix[11], matrix[15]];
  const affine = nearVector(homogeneousRow, [0, 0, 0, 1], 1e-7);
  return {
    kind: affine ? 'orthographic' : 'perspective',
    homogeneousRow,
    viewBasis: {
      right: normalizeVector([matrix[0], matrix[4], matrix[8]]),
      up: normalizeVector([matrix[1], matrix[5], matrix[9]]),
      projectedDepth: normalizeVector([matrix[2], matrix[6], matrix[10]]),
    },
  };
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

function parsedJSONScripts(scripts) {
  const parsed = [];
  for (const script of scripts) {
    if (!script.id || !/json/.test(script.type || '')) continue;
    try {
      parsed.push({ id: script.id, value: JSON.parse(script.source) });
    } catch (_error) {
      // A malformed JSON block is reported by the page execution check.
    }
  }
  return parsed;
}

function chooseManifest(items) {
  return items.find(item => item.value?.wall?.courses === 43)
    || items.find(item => item.value?.objectCounts)
    || items.find(item => item.value?.wall)
    || null;
}

function modeRoles(controls) {
  const byValue = Object.fromEntries(controls.map(control => [control.dataset.mode, control]));
  const values = Object.keys(byValue);
  const mother = values.find(value => /mother/i.test(value));
  const brickOnly = values.find(value => value !== mother && /brick/i.test(value));
  const full = values.find(value => value !== mother && value !== brickOnly);
  return { byValue, values, full, brickOnly, mother };
}

function cameraUniforms(draw) {
  return matchingUniforms(draw, /target|angles?|distance|camera|look|viewproj|viewdir|ortho|\bfov\b/i);
}

function visibilityUniforms(draw) {
  return matchingUniforms(draw, /scene|mode|visible|show/i);
}

function sceneModeValue(draw) {
  const entries = Object.entries(visibilityUniforms(draw));
  return entries.find(([name]) => /scene.*mode|mode.*scene/i.test(name))?.[1]
    ?? entries.find(([name]) => /mode/i.test(name))?.[1]
    ?? null;
}

function firstFiniteUniform(draw, expression) {
  for (const [name, value] of Object.entries(draw?.uniforms || {})) {
    if (!expression.test(name)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) return { name, value };
  }
  return null;
}

function advanceControl(control) {
  const numeric = Number(control.value);
  if (control.type === 'color' || /^#[0-9a-f]{6}$/i.test(control.value)) {
    control.value = control.value.toLowerCase() === '#7b573c' ? '#956b48' : '#7b573c';
  } else if (Number.isFinite(numeric)) {
    const step = Number(control.step) || 1;
    const maximum = Number(control.max);
    const candidate = numeric + step;
    control.value = String(Number.isFinite(maximum) && candidate > maximum ? numeric - step : candidate);
  } else {
    control.value = 'qa-alternate';
  }
}

function run() {
  const options = parseArgs(process.argv);
  const htmlPath = path.resolve(options.html || DEFAULT_HTML);
  const report = {
    schemaVersion: 'brick-mother-wall-runtime-vm-qa-r3.2',
    artifact: { path: htmlPath, bytes: null, sha256: null },
    runtime: 'node-vm-dom-webgl2-api-capture',
    checks: {},
    snapshots: {},
    passed: false,
    realGpuCompilation: false,
    humanVisualApproval: false,
    note: 'The actual page JavaScript ran and supplied shader/uniform data to an API capture. Real GPU compilation and human visual approval are separate gates.',
  };

  if (!fs.existsSync(htmlPath)) {
    addCheck(report, 'html_exists', false, htmlPath);
  } else {
    const html = fs.readFileSync(htmlPath, 'utf8');
    report.artifact.bytes = Buffer.byteLength(html);
    report.artifact.sha256 = sha256(html);
    addCheck(report, 'html_exists', true, htmlPath);
    const scripts = extractScripts(html);
    const executable = scripts.filter(script => !script.type || /javascript|ecmascript/.test(script.type));
    const jsonScripts = parsedJSONScripts(scripts);
    const manifestItem = chooseManifest(jsonScripts);
    addCheck(
      report,
      'one_executable_inline_script',
      executable.length === 1,
      scripts.map(script => ({ id: script.id, type: script.type, bytes: Buffer.byteLength(script.source) })),
    );
    addCheck(
      report,
      'wall_manifest_is_parseable',
      Boolean(manifestItem),
      jsonScripts.map(item => item.id),
    );

    if (manifestItem) report.snapshots.manifest = manifestItem.value;

    if (executable.length === 1 && manifestItem) {
      let harness;
      try {
        harness = buildHarness(html, scripts);
        new vm.Script(executable[0].source, { filename: htmlPath }).runInContext(
          harness.context,
          { timeout: 30_000 },
        );
        const errorElement = harness.elements.get('error');
        addCheck(
          report,
          'real_page_javascript_executes_without_exception',
          harness.runtimeErrors.length === 0 && (!errorElement || errorElement.hidden === true),
          {
            consoleErrors: harness.runtimeErrors,
            errorVisible: errorElement ? !errorElement.hidden : false,
            errorText: errorElement?.textContent || '',
          },
        );
      } catch (error) {
        addCheck(report, 'real_page_javascript_executes_without_exception', false, error.stack || String(error));
      }

      if (harness && report.checks.real_page_javascript_executes_without_exception.passed) {
        const { canvas, elements, glCapture, modeControls, specs, viewControls } = harness;
        const manifest = manifestItem.value;
        const sources = Array.from(glCapture.shaders.values());
        const vertexSources = sources
          .filter(item => item.type === glCapture.api.VERTEX_SHADER)
          .map(item => item.source || '');
        const fragmentSources = sources
          .filter(item => item.type === glCapture.api.FRAGMENT_SHADER)
          .map(item => item.source || '');
        const programSources = glCapture.programs.map(program => ({
          id: program.id,
          shaders: program.shaders.map(shader => glCapture.shaders.get(shader)).filter(Boolean),
        }));
        const brickProgramSources = programSources.find(program =>
          program.shaders.some(shader => /brickExactWorld/.test(shader.source || '')));
        const soilProgramSources = programSources.find(program =>
          program.shaders.some(shader => /soilSdf/.test(shader.source || '')));
        const floorProgramSources = programSources.find(program =>
          program.shaders.some(shader => /const vec3 P\[6\]/.test(shader.source || '')));
        const sourceOfType = (program, type) => program?.shaders
          .find(shader => shader.type === type)?.source || '';
        const brickVertex = sourceOfType(brickProgramSources, glCapture.api.VERTEX_SHADER);
        const brickFragment = sourceOfType(brickProgramSources, glCapture.api.FRAGMENT_SHADER);
        const soilVertex = sourceOfType(soilProgramSources, glCapture.api.VERTEX_SHADER);
        const soilFragment = sourceOfType(soilProgramSources, glCapture.api.FRAGMENT_SHADER);
        const shaderSnapshot = {
          shaders: sources.map(item => ({
            type: item.type === glCapture.api.VERTEX_SHADER ? 'vertex' : 'fragment',
            bytes: Buffer.byteLength(item.source || ''),
            sha256: sha256(item.source || ''),
          })),
          brickVertexSha256: sha256(brickVertex),
          brickFragmentSha256: sha256(brickFragment),
          soilVertexSha256: sha256(soilVertex),
          soilFragmentSha256: sha256(soilFragment),
          programCount: glCapture.programs.length,
          programIds: {
            brick: brickProgramSources?.id || null,
            soil: soilProgramSources?.id || null,
            floor: floorProgramSources?.id || null,
          },
        };
        report.snapshots.shaders = shaderSnapshot;
        addCheck(
          report,
          'page_supplies_three_complete_brick_soil_floor_programs',
          sources.length === 6
            && vertexSources.length === 3
            && fragmentSources.length === 3
            && glCapture.programs.length === 3
            && Boolean(brickVertex && brickFragment && soilVertex && soilFragment && floorProgramSources),
          shaderSnapshot,
        );
        const unresolved = sources.flatMap(item =>
          Array.from((item.source || '').matchAll(/\$\{[^}]*\}|\bundefined\b/g), match => match[0]));
        addCheck(report, 'final_shader_strings_have_no_unresolved_generation_markers', unresolved.length === 0, unresolved);

        const harmonics = generatedHarmonicAudit(brickFragment);
        addCheck(
          report,
          'fragment_shader_contains_336_generated_residual_coefficients',
          harmonics.functionCount === 24 && harmonics.coefficientTerms === 336,
          harmonics,
        );
        const kernelTokens = ['sdRoundBox', 'surfaceDelta', 'contourShapeLong', 'processMaterial'];
        addCheck(
          report,
          'fragment_shader_uses_frozen_r2_14_8_1_kernel_and_b_material_path',
          kernelTokens.every(token => brickFragment.includes(token)),
          { required: kernelTokens, found: kernelTokens.filter(token => brickFragment.includes(token)) },
        );
        addCheck(
          report,
          'wall_uses_gpu_instance_decoder_and_does_not_upload_1420_pose_uniforms',
          !sources.some(item => /uBrickPose\s*\[/.test(item.source || ''))
            && /gl_InstanceID/.test(brickVertex)
            && /decodeWall/.test(brickVertex)
            && /course/.test(brickVertex),
          {
            hasPoseArray: sources.some(item => /uBrickPose\s*\[/.test(item.source || '')),
            hasInstanceId: /gl_InstanceID/.test(brickVertex),
            hasDecoder: /decodeWall/.test(brickVertex),
            hasCourseLogic: /course/.test(brickVertex),
          },
        );
        const geometrySegment = soilFragment.split('float soilMicroscopeGeometry')[1]?.split('float soilMicroscopeTop')[0] || '';
        addCheck(
          report,
          'soil_microscope_changes_distance_field_without_fragment_derivatives',
          /soilMicroscopeGeometry/.test(soilFragment)
            && /soilSdf[\s\S]*soilMicroscopeGeometry/.test(soilFragment)
            && !/dFdx|dFdy|fwidth/.test(geometrySegment),
          {
            geometryFunctionFound: /soilMicroscopeGeometry/.test(soilFragment),
            geometryFeedsSdf: /soilSdf[\s\S]*soilMicroscopeGeometry/.test(soilFragment),
            derivativeTokensInGeometry: Array.from(geometrySegment.matchAll(/dFdx|dFdy|fwidth/g), match => match[0]),
          },
        );
        const orthographicOriginBranch = /uOrtho\s*==\s*1\s*\?\s*vBoxPoint\s*-\s*\w+\s*\*\s*8\.?\s*:\s*uCamera/;
        const projectionRayBranch = /uOrtho\s*==\s*1\s*\?\s*normalize\s*\(\s*uViewDir\s*\)\s*:\s*normalize\s*\(\s*vBoxPoint\s*-\s*uCamera\s*\)/;
        addCheck(
          report,
          'brick_and_soil_shaders_switch_between_parallel_ortho_and_point_perspective_rays',
          [brickFragment, soilFragment].every(source => /uniform\s+vec3\s+uViewDir/.test(source)
            && /uniform\s+int\s+uOrtho/.test(source)
            && orthographicOriginBranch.test(source)
            && projectionRayBranch.test(source)),
          {
            brick: {
              hasViewDirUniform: /uniform\s+vec3\s+uViewDir/.test(brickFragment),
              hasOrthoUniform: /uniform\s+int\s+uOrtho/.test(brickFragment),
              originSwitch: orthographicOriginBranch.test(brickFragment),
              raySwitch: projectionRayBranch.test(brickFragment),
            },
            soil: {
              hasViewDirUniform: /uniform\s+vec3\s+uViewDir/.test(soilFragment),
              hasOrthoUniform: /uniform\s+int\s+uOrtho/.test(soilFragment),
              originSwitch: orthographicOriginBranch.test(soilFragment),
              raySwitch: projectionRayBranch.test(soilFragment),
            },
          },
        );

        const initialFrame = lastFrame(glCapture.drawCalls);
        const initial = brickDraw(initialFrame);
        const initialSoil = soilDraw(initialFrame);
        report.snapshots.initial = {
          uniforms: initial?.uniforms || {},
          calls: initialFrame.map(call => ({ call: call.call, count: call.count, instanceCount: call.instanceCount, programId: call.programId })),
          brickInstances: initial?.instanceCount ?? null,
          soilVisible: Boolean(initialSoil),
          soilTopUniform: uniform(initialSoil, 'uSoilTop'),
          canvasReady: canvas.dataset.ready || null,
          canvasMode: canvas.dataset.mode || null,
          canvasBrickCount: canvas.dataset.brickCount || null,
          canvasSoilTop: canvas.dataset.soilTop || null,
          status: elements.get('status')?.textContent || '',
        };
        addCheck(
          report,
          'default_full_wall_draws_1420_bricks_one_soil_and_marks_ready',
          Boolean(initial)
            && initial.instanceCount === 1420
            && Boolean(initialSoil)
            && canvas.dataset.ready === 'true'
            && canvas.dataset.mode === 'wall'
            && Number(canvas.dataset.brickCount) === 1420
            && Math.abs(Number(canvas.dataset.soilTop) - 2.99) <= 1e-9,
          report.snapshots.initial,
        );

        const wall = manifest.wall || {};
        const counts = manifest.objectCounts || wall.objectCounts || {};
        const dimensions = wall.dimensionsM || wall.dimensions || {};
        const width = wall.widthM ?? dimensions.widthM ?? dimensions.width;
        const height = wall.heightM ?? dimensions.heightM ?? dimensions.height;
        const courses = wall.courses ?? wall.courseCount;
        const brickCount = wall.brickCount ?? counts.brick ?? counts.bricks;
        const soilCount = counts.soilCore ?? counts.soil ?? counts.earth ?? wall.soilCount;
        const plasterCount = counts.plaster ?? wall.plasterCount;
        const mortarCount = counts.mortar ?? wall.mortarCount;
        addCheck(
          report,
          'manifest_freezes_4m_by_3m_wall_with_43_courses',
          Math.abs(Number(width) - 4) <= 1e-9
            && Math.abs(Number(height) - 3) <= 1e-9
            && Number(courses) === 43,
          { width, height, courses },
        );
        addCheck(
          report,
          'manifest_counts_1420_bricks_one_soil_and_no_plaster_or_mortar',
          Number(brickCount) === 1420
            && Number(soilCount) === 1
            && Number(plasterCount) === 0
            && Number(mortarCount) === 0,
          { brickCount, soilCount, plasterCount, mortarCount },
        );

        const roles = modeRoles(modeControls);
        const viewByName = Object.fromEntries(viewControls.map(control => [control.dataset.view, control]));
        addCheck(
          report,
          'runtime_exposes_full_bricks_mother_and_five_views',
          roles.values.length === 3
            && Boolean(roles.full && roles.brickOnly && roles.mother)
            && REQUIRED_VIEWS.every(view => viewByName[view]),
          { modes: roles.values, roles: { full: roles.full, brickOnly: roles.brickOnly, mother: roles.mother }, views: Object.keys(viewByName) },
        );

        if (roles.full && roles.brickOnly && roles.mother && viewByName.top) {
          const modeSnapshots = {};
          for (const role of ['full', 'brickOnly', 'mother']) {
            const value = roles[role];
            const shaderCountBefore = glCapture.shaders.size;
            const calls = lastFrame(captureInteraction(glCapture, () => roles.byValue[value].click()));
            const draw = brickDraw(calls);
            const soil = soilDraw(calls);
            modeSnapshots[role] = {
              value,
              calls: calls.map(call => ({ call: call.call, count: call.count, instanceCount: call.instanceCount, programId: call.programId })),
              brickInstances: draw?.instanceCount ?? null,
              soilVisible: Boolean(soil),
              motherMode: uniform(draw, 'uMotherMode'),
              camera: cameraUniforms(draw),
              shaderCountUnchanged: glCapture.shaders.size === shaderCountBefore,
              canvasMode: canvas.dataset.mode,
              canvasBrickCount: Number(canvas.dataset.brickCount),
              courseDisabled: elements.get('courseBuild')?.disabled,
              soilControlsDisabled: ['soilShape', 'soilScale', 'soilLayers', 'soilColor']
                .map(id => elements.get(id)?.disabled),
              title: elements.get('modeTitle')?.textContent || '',
              meta: elements.get('modeMeta')?.textContent || '',
            };
          }
          report.snapshots.modes = modeSnapshots;
          const wallCamera = modeSnapshots.full.camera;
          const brickCamera = modeSnapshots.brickOnly.camera;
          const motherCamera = modeSnapshots.mother.camera;
          const geometryOmissions = [
            /target|angles?|distance|camera|look|viewproj|viewdir|ortho|\bfov\b/i,
            /mother.*mode|mode.*mother/i,
            /built.*course|course.*built/i,
          ];
          const fullCalls = lastFrame(captureInteraction(glCapture, () => roles.byValue[roles.full].click()));
          const fullBrick = brickDraw(fullCalls);
          const bricksCalls = lastFrame(captureInteraction(glCapture, () => roles.byValue[roles.brickOnly].click()));
          const bricksBrick = brickDraw(bricksCalls);
          const motherCalls = lastFrame(captureInteraction(glCapture, () => roles.byValue[roles.mother].click()));
          const motherBrick = brickDraw(motherCalls);
          addCheck(
            report,
            'three_modes_switch_visibility_keep_kernel_and_adapt_mother_camera',
            modeSnapshots.full.brickInstances === 1420
              && modeSnapshots.brickOnly.brickInstances === 1420
              && modeSnapshots.mother.brickInstances === 1
              && modeSnapshots.full.soilVisible === true
              && modeSnapshots.brickOnly.soilVisible === false
              && modeSnapshots.mother.soilVisible === false
              && modeSnapshots.full.motherMode === 0
              && modeSnapshots.brickOnly.motherMode === 0
              && modeSnapshots.mother.motherMode === 1
              && jsonEqual(wallCamera, brickCamera)
              && !jsonEqual(wallCamera, motherCamera)
              && jsonEqual(
                normalizedUniforms(fullBrick, geometryOmissions),
                normalizedUniforms(bricksBrick, geometryOmissions),
              )
              && jsonEqual(
                normalizedUniforms(bricksBrick, geometryOmissions),
                normalizedUniforms(motherBrick, geometryOmissions),
              )
              && Object.values(modeSnapshots).every(snapshot => snapshot.shaderCountUnchanged)
              && modeSnapshots.full.canvasMode === roles.full
              && modeSnapshots.brickOnly.canvasMode === roles.brickOnly
              && modeSnapshots.mother.canvasMode === roles.mother,
            modeSnapshots,
          );
        }

        if (roles.full && REQUIRED_VIEWS.every(view => viewByName[view])) {
          roles.byValue[roles.full].click();
          const objectOmissions = [/target|angles?|distance|camera|look|viewproj|viewdir|ortho|\bfov\b/i, /\bres\b|resolution/i];
          const beforeViews = brickDraw(lastFrame(glCapture.drawCalls));
          const objectBaseline = normalizedUniforms(beforeViews, objectOmissions);
          const viewSnapshots = {};
          for (const view of REQUIRED_VIEWS) {
            const calls = lastFrame(captureInteraction(glCapture, () => viewByName[view].click()));
            const draw = brickDraw(calls);
            const soil = soilDraw(calls);
            const matrix = uniform(draw, 'uViewProj');
            const camera = uniform(draw, 'uCamera');
            viewSnapshots[view] = {
              cameraUniforms: cameraUniforms(draw),
              camera,
              viewProj: matrix,
              projection: projectionAudit(matrix),
              orthoMode: uniform(draw, 'uOrtho'),
              viewDir: uniform(draw, 'uViewDir'),
              soilOrthoMode: uniform(soil, 'uOrtho'),
              soilViewDir: uniform(soil, 'uViewDir'),
              objectsUnchanged: jsonEqual(normalizedUniforms(draw, objectOmissions), objectBaseline),
              brickInstances: draw?.instanceCount ?? null,
              soilVisible: Boolean(soil),
              canvasMode: canvas.dataset.mode,
            };
          }
          report.snapshots.views = viewSnapshots;
          addCheck(
            report,
            'view_buttons_change_camera_without_changing_objects',
            REQUIRED_VIEWS.every(view => viewSnapshots[view].objectsUnchanged
              && viewSnapshots[view].brickInstances === 1420
              && viewSnapshots[view].soilVisible
              && viewSnapshots[view].canvasMode === roles.full)
              && new Set(REQUIRED_VIEWS.map(view => JSON.stringify(viewSnapshots[view].cameraUniforms))).size === REQUIRED_VIEWS.length,
            viewSnapshots,
          );
          const fixedViews = ['front', 'back', 'end', 'top'];
          addCheck(
            report,
            'uploaded_matrices_prove_iso_perspective_and_fixed_views_orthographic',
            viewSnapshots.iso.projection.kind === 'perspective'
              && viewSnapshots.iso.orthoMode === 0
              && fixedViews.every(view => viewSnapshots[view].projection.kind === 'orthographic'
                && viewSnapshots[view].orthoMode === 1
                && viewSnapshots[view].soilOrthoMode === 1),
            Object.fromEntries(REQUIRED_VIEWS.map(view => [view, {
              kind: viewSnapshots[view].projection.kind,
              homogeneousRow: viewSnapshots[view].projection.homogeneousRow,
              brickOrthoMode: viewSnapshots[view].orthoMode,
              soilOrthoMode: viewSnapshots[view].soilOrthoMode,
            }])),
          );
          const expectedViewDirections = {
            front: [0, 0, 1],
            back: [0, 0, -1],
            end: [1, 0, 0],
            top: [0, -1, 0],
          };
          addCheck(
            report,
            'runtime_uses_point_rays_for_iso_and_parallel_axis_rays_for_orthographic_views',
            viewSnapshots.iso.orthoMode === 0
              && fixedViews.every(view => nearVector(
                normalizeVector(viewSnapshots[view].viewDir),
                expectedViewDirections[view],
              )
                && nearVector(viewSnapshots[view].soilViewDir, viewSnapshots[view].viewDir)
                && viewSnapshots[view].orthoMode === 1
                && viewSnapshots[view].soilOrthoMode === 1),
            Object.fromEntries(REQUIRED_VIEWS.map(view => [view, {
              projection: viewSnapshots[view].projection.kind,
              orthoMode: viewSnapshots[view].orthoMode,
              brickViewDir: viewSnapshots[view].viewDir,
              soilViewDir: viewSnapshots[view].soilViewDir,
              expectedViewDir: expectedViewDirections[view] || 'perspective branch uses uCamera per fragment',
            }])),
          );
          const wallCenterY = Number(height) * 0.5;
          const topUpDeclaredInExecutedSource = /currentView\s*===\s*['"]top['"]\s*\?\s*\[\s*0\s*,\s*0\s*,\s*-1\s*\]\s*:\s*\[\s*0\s*,\s*1\s*,\s*0\s*\]/.test(executable[0].source);
          addCheck(
            report,
            'fixed_view_axes_have_zero_pitch_and_top_uses_negative_z_up',
            near(viewSnapshots.front.camera[0], 0)
              && near(viewSnapshots.front.camera[1], wallCenterY)
              && viewSnapshots.front.camera[2] < 0
              && near(viewSnapshots.back.camera[0], 0)
              && near(viewSnapshots.back.camera[1], wallCenterY)
              && viewSnapshots.back.camera[2] > 0
              && viewSnapshots.end.camera[0] < 0
              && near(viewSnapshots.end.camera[1], wallCenterY)
              && near(viewSnapshots.end.camera[2], 0)
              && near(viewSnapshots.top.camera[0], 0)
              && viewSnapshots.top.camera[1] > wallCenterY
              && near(viewSnapshots.top.camera[2], 0)
              && ['front', 'back', 'end'].every(view => nearVector(
                viewSnapshots[view].projection.viewBasis.up,
                [0, 1, 0],
              ))
              && nearVector(viewSnapshots.top.projection.viewBasis.up, [0, 0, -1])
              && topUpDeclaredInExecutedSource,
            {
              cameras: Object.fromEntries(fixedViews.map(view => [view, viewSnapshots[view].camera])),
              normalizedUpBasis: Object.fromEntries(fixedViews.map(view => [view, viewSnapshots[view].projection.viewBasis.up])),
              topUpDeclaredInExecutedSource,
            },
          );
        }

        const courseControl = elements.get('courseBuild')
          || Array.from(elements.values()).find(element => /course/i.test(element.id) && element.tagName === 'INPUT');
        if (courseControl && roles.full) {
          roles.byValue[roles.full].click();
          const courseSnapshots = {};
          const brickH = Number(manifest.brick?.dimensionsM?.height
            ?? manifest.brick?.dimensions?.height
            ?? manifest.brick?.heightM
            ?? manifest.freeze?.dimensionsM?.[1]
            ?? 0.06115);
          const bedGap = Number(wall.bedJointM ?? wall.bedGapM ?? wall.courseGapM
            ?? ((3 - 43 * brickH) / 42));
          for (const step of [1, 22, 43]) {
            courseControl.value = String(step);
            const calls = lastFrame(captureInteraction(glCapture, () => courseControl.dispatch('input')));
            const brick = brickDraw(calls);
            const soil = soilDraw(calls);
            const builtCoursesUniform = firstFiniteUniform(brick, /uBuiltCourses/i);
            const soilTopUniform = firstFiniteUniform(soil, /uSoilTop/i);
            const brickTop = step * brickH + (step - 1) * bedGap;
            const expectedSoilTop = brickTop - 0.01;
            const uploadedSoilTop = soilTopUniform?.value ?? null;
            const expectedBrickCount = Math.floor(step / 2) * 66 + (step % 2 ? 34 : 0);
            courseSnapshots[step] = {
              activeCourseDataset: Number(canvas.dataset.activeCourse),
              brickCountDataset: Number(canvas.dataset.brickCount),
              soilTopDataset: Number(canvas.dataset.soilTop),
              courseOutput: elements.get('courseValue')?.value,
              brickInstances: brick?.instanceCount ?? null,
              soilVisible: Boolean(soil),
              builtCoursesUniform,
              soilTopUniform,
              brickTop,
              expectedSoilTop,
              uploadedSoilTop,
              expectedBrickCount,
              soilTopDelta: uploadedSoilTop === null ? null : Math.abs(uploadedSoilTop - expectedSoilTop),
            };
          }
          report.snapshots.courseBuild = courseSnapshots;
          addCheck(
            report,
            'course_1_22_43_executes_bottom_up_brick_counts',
            [1, 22, 43].every(step => courseSnapshots[step].activeCourseDataset === step
              && courseSnapshots[step].builtCoursesUniform?.value === step
              && courseSnapshots[step].brickInstances === courseSnapshots[step].expectedBrickCount
              && courseSnapshots[step].brickCountDataset === courseSnapshots[step].expectedBrickCount
              && courseSnapshots[step].soilVisible),
            courseSnapshots,
          );
          addCheck(
            report,
            'soil_top_follows_built_courses_with_10mm_top_setback',
            [1, 22, 43].every(step => courseSnapshots[step].soilTopDelta !== null
              && courseSnapshots[step].soilTopDelta <= 1e-9
              && Math.abs(courseSnapshots[step].soilTopDataset - courseSnapshots[step].expectedSoilTop) <= 1e-9)
              && courseSnapshots[1].uploadedSoilTop < courseSnapshots[22].uploadedSoilTop
              && courseSnapshots[22].uploadedSoilTop < courseSnapshots[43].uploadedSoilTop
              && courseSnapshots[1].uploadedSoilTop < 0.06
              && Math.abs(courseSnapshots[43].uploadedSoilTop - 2.99) <= 1e-9,
            courseSnapshots,
          );
        } else {
          addCheck(report, 'course_1_22_43_executes_bottom_up_brick_counts', false, 'course control not found');
          addCheck(report, 'soil_top_follows_built_courses_with_10mm_top_setback', false, 'course control not found');
        }

        const soilColorControls = Array.from(specs.values())
          .filter(spec => spec.tagName === 'INPUT' && /(?:soil|earth).*(?:color|tone|hue|warm)|(?:color|tone|hue|warm).*(?:soil|earth)/i.test(spec.id))
          .map(spec => elements.get(spec.id));
        if (soilColorControls.length && roles.full) {
          roles.byValue[roles.full].click();
          if (courseControl) {
            courseControl.value = '43';
            courseControl.dispatch('input');
          }
          const beforeFrame = lastFrame(glCapture.drawCalls);
          const beforeColor = soilDraw(beforeFrame);
          const beforeBrick = brickDraw(beforeFrame);
          const shaderHashBefore = sha256(sources.map(item => item.source || '').join('\u0000'));
          let colorCalls = [];
          for (const control of soilColorControls) {
            advanceControl(control);
            colorCalls = captureInteraction(glCapture, () => control.dispatch('input'));
            control.dispatch('change');
          }
          const afterFrame = lastFrame(colorCalls);
          const afterColor = soilDraw(afterFrame);
          const afterBrick = brickDraw(afterFrame);
          const colorOmissions = [
            /(?:soil|earth).*(?:colou?r|tone|hue|warm|red|green|blue)|(?:colou?r|tone|hue|warm).*(?:soil|earth)/i,
          ];
          const colorSnapshot = {
            controls: soilColorControls.map(control => ({ id: control.id, value: control.value })),
            output: elements.get('soilColorValue')?.value,
            beforeColorUniforms: matchingUniforms(beforeColor, colorOmissions[0]),
            afterColorUniforms: matchingUniforms(afterColor, colorOmissions[0]),
            soilGeometryUniformsUnchanged: jsonEqual(
              normalizedUniforms(beforeColor, colorOmissions),
              normalizedUniforms(afterColor, colorOmissions),
            ),
            brickDrawUnchanged: beforeBrick?.programId === afterBrick?.programId
              && beforeBrick?.instanceCount === afterBrick?.instanceCount
              && jsonEqual(
                normalizedUniforms(beforeBrick, [/soil|earth/i]),
                normalizedUniforms(afterBrick, [/soil|earth/i]),
              ),
            cameraUnchanged: jsonEqual(cameraUniforms(beforeColor), cameraUniforms(afterColor)),
            shaderHashUnchanged: sha256(sources.map(item => item.source || '').join('\u0000')) === shaderHashBefore,
          };
          report.snapshots.soilColor = colorSnapshot;
          addCheck(
            report,
            'soil_color_controls_do_not_change_soil_geometry_brick_kernel_or_camera',
            colorSnapshot.soilGeometryUniformsUnchanged
              && colorSnapshot.brickDrawUnchanged
              && colorSnapshot.cameraUnchanged
              && colorSnapshot.shaderHashUnchanged
              && !jsonEqual(colorSnapshot.beforeColorUniforms, colorSnapshot.afterColorUniforms),
            colorSnapshot,
          );
        } else {
          addCheck(report, 'soil_color_controls_do_not_change_soil_geometry_brick_kernel_or_camera', false, 'soil color control not found');
        }
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
