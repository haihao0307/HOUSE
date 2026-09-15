#!/usr/bin/env node
/* 390x844 browser smoke test for Brick Mother Unified Workbench R3.
 *
 * This script uses the Playwright bundled with the Codex primary runtime. It
 * never runs npm install and does not require a repository package.json.
 */

const fs = require('fs');
const path = require('path');

const EXPECTED_MODES = [
  'single-brick',
  'brick-wall-plaster',
  'stone',
  'earth-wall-plaster',
];
const B_DEFAULTS = {
  strength: 1,
  scale: 1,
  heightContribution: 1,
  roughnessContribution: 0,
};

function args(argv) {
  const parsed = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      parsed[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return parsed;
}

function addCheck(report, name, passed, evidence) {
  report.checks[name] = { passed: Boolean(passed), evidence };
}

function loadPlaywright() {
  const moduleRoot = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!moduleRoot) {
    throw new Error('CODEX_PRIMARY_RUNTIME_NODE_MODULES is not set');
  }
  return require(path.join(moduleRoot, 'playwright'));
}

async function run() {
  const options = args(process.argv);
  if (!options.url) {
    throw new Error('Usage: qa_browser_r3.cjs --url <http(s) URL> [--out report.json]');
  }
  const report = {
    schemaVersion: 'brick-mother-unified-browser-qa-r3.1',
    browser: {
      status: 'running',
      url: options.url,
      viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
      errors: [],
      externalRequests: [],
      failedRequests: [],
      badResponses: [],
      geometryAudit: null,
      resourceAudit: null,
    },
    checks: {},
    passed: false,
  };
  const { chromium } = loadPlaywright();
  const launchOptions = {
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  };
  const explicitBrowser = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const bundledBrowser = chromium.executablePath();
  if (explicitBrowser && fs.existsSync(explicitBrowser)) {
    launchOptions.executablePath = explicitBrowser;
  } else if (bundledBrowser && fs.existsSync(bundledBrowser)) {
    // The primary runtime may bundle full Chromium without headless-shell.
    launchOptions.executablePath = bundledBrowser;
  }
  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    report.browser.status = 'unavailable';
    report.browser.launchError = error.message;
    addCheck(report, 'browser_runtime_available', false, error.message);
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (options.out) fs.writeFileSync(options.out, serialized, 'utf8');
    process.stdout.write(serialized);
    process.exitCode = 1;
    return;
  }
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const expectedHost = new URL(options.url).hostname;
    page.on('pageerror', error => report.browser.errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') report.browser.errors.push(`console: ${message.text()}`);
    });
    page.on('request', request => {
      const requestUrl = new URL(request.url());
      if (/^https?:$/.test(requestUrl.protocol) && requestUrl.hostname !== expectedHost) {
        report.browser.externalRequests.push(request.url());
      }
    });
    page.on('requestfailed', request => {
      report.browser.failedRequests.push({
        url: request.url(),
        failure: request.failure() ? request.failure().errorText : 'unknown',
      });
    });
    page.on('response', response => {
      if (response.status() >= 400) {
        report.browser.badResponses.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    try {
      await page.waitForFunction(() => {
        const qa = window.__BRICK_QA__;
        return Boolean(qa && (qa.ready === true ||
          (typeof qa.isReady === 'function' && qa.isReady() === true)));
      }, null, { timeout: 30_000 });
    } catch (error) {
      report.browser.errors.push(`readiness timeout: ${error.message}`);
    }

    const qaShape = await page.evaluate(() => {
      const qa = window.__BRICK_QA__;
      if (!qa) return null;
      return {
        ready: qa.ready === true || (typeof qa.isReady === 'function' && qa.isReady() === true),
        setMode: typeof qa.setMode === 'function',
        getState: typeof qa.getState === 'function',
        getGeometryAudit: typeof qa.getGeometryAudit === 'function',
        getResourceAudit: typeof qa.getResourceAudit === 'function',
      };
    });
    report.browser.qaShape = qaShape;
    addCheck(
      report,
      'browser_qa_api_ready',
      qaShape && qaShape.ready && qaShape.setMode && qaShape.getState,
      qaShape,
    );

    const canvas = await page.evaluate(() => {
      const canvases = [...document.querySelectorAll('canvas')];
      if (!canvases.length) return { count: 0 };
      const element = canvases[0];
      const rect = element.getBoundingClientRect();
      let glError = null;
      try {
        const gl = element.getContext('webgl2');
        glError = gl ? gl.getError() : null;
      } catch (error) {
        glError = `exception: ${error.message}`;
      }
      return {
        count: canvases.length,
        cssWidth: rect.width,
        cssHeight: rect.height,
        backingWidth: element.width,
        backingHeight: element.height,
        backingPixels: element.width * element.height,
        readyAttr: element.dataset.ready || null,
        visible: rect.width > 0 && rect.height > 0,
        glError,
      };
    });
    report.browser.canvas = canvas;
    addCheck(report, 'browser_one_visible_canvas', canvas.count === 1 && canvas.visible, canvas);
    addCheck(report, 'mobile_canvas_height', canvas.cssHeight >= 360, canvas.cssHeight);
    addCheck(report, 'mobile_backing_pixel_budget', canvas.backingPixels <= 520_000, canvas);
    addCheck(report, 'browser_webgl_no_error', canvas.glError === 0, canvas.glError);

    const layout = await page.evaluate(() => ({
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      canvasCount: document.querySelectorAll('canvas').length,
      iframeCount: document.querySelectorAll('iframe').length,
      modeControls: [...document.querySelectorAll('[data-mode]')].map(element => {
        const rect = element.getBoundingClientRect();
        return { mode: element.dataset.mode, width: rect.width, height: rect.height };
      }),
    }));
    report.browser.layout = layout;
    addCheck(report, 'mobile_no_horizontal_overflow', layout.scrollWidth <= layout.innerWidth, layout);
    addCheck(
      report,
      'mobile_mode_targets_44px',
      layout.modeControls.length === 4 &&
        layout.modeControls.every(control => control.width >= 44 && control.height >= 44),
      layout.modeControls,
    );
    addCheck(report, 'browser_no_iframe', layout.iframeCount === 0, layout.iframeCount);

    const modeResults = {};
    if (qaShape && qaShape.setMode && qaShape.getState) {
      for (const mode of EXPECTED_MODES) {
        modeResults[mode] = await page.evaluate(async requestedMode => {
          const qa = window.__BRICK_QA__;
          await qa.setMode(requestedMode);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const state = qa.getState();
          return {
            activeMode: state.activeMode || state.mode || qa.mode || null,
            state,
            geometry: typeof qa.getGeometryAudit === 'function' ? qa.getGeometryAudit() : null,
            resources: typeof qa.getResourceAudit === 'function' ? qa.getResourceAudit() : null,
          };
        }, mode);
      }
    }
    report.browser.modeResults = modeResults;
    addCheck(
      report,
      'browser_four_modes_switch',
      Object.keys(modeResults).length === 4 &&
        Object.entries(modeResults).every(([mode, result]) => result.activeMode === mode),
      modeResults,
    );

    const single = modeResults['single-brick']?.geometry;
    const wall = modeResults['brick-wall-plaster']?.geometry;
    const stone = modeResults.stone?.geometry;
    const earth = modeResults['earth-wall-plaster']?.geometry;
    addCheck(
      report,
      'browser_shared_brick_kernel',
      Boolean(single && wall && single.brickKernelId === wall.brickKernelId),
      { single: single?.brickKernelId, wall: wall?.brickKernelId },
    );
    const courses = wall?.courses || [];
    const alternating = courses.length > 1 && courses.every((course, index) =>
      index === 0 || course.endBond !== courses[index - 1].endBond);
    addCheck(
      report,
      'browser_alternating_course_ends',
      alternating,
      courses.map(course => ({ course: course.course, endBond: course.endBond, endYaw: course.endYaw })),
    );
    addCheck(
      report,
      'browser_true_half_brick',
      Boolean(wall && wall.halfBricks > 0 && wall.trueHalfBrick === true),
      wall ? { halfBricks: wall.halfBricks, trueHalfBrick: wall.trueHalfBrick } : null,
    );
    addCheck(
      report,
      'browser_stone_not_recolored_brick',
      Boolean(stone && stone.recoloredBrick === false && stone.stoneKernelId),
      stone,
    );
    addCheck(
      report,
      'browser_earth_is_monolithic',
      Boolean(earth && earth.monolithic === true && earth.brickSeams === 0),
      earth,
    );
    const geometryAudits = Object.values(modeResults).map(result => result.geometry).filter(Boolean);
    addCheck(
      report,
      'browser_microscope_scale_count_17',
      geometryAudits.length === 4 && geometryAudits.every(audit => audit.scaleCount === 17),
      geometryAudits.map(audit => ({ mode: audit.mode, fieldId: audit.fieldId, scaleCount: audit.scaleCount })),
    );
    const resourceAudits = Object.values(modeResults).map(result => result.resources).filter(Boolean);
    addCheck(
      report,
      'browser_resource_budgets',
      resourceAudits.length === 4 && resourceAudits.every(resource =>
        resource.contextCount === 1 && resource.activeOnly === true &&
        resource.triangles <= 150_000 && resource.vertexBytes <= 24 * 1024 * 1024 &&
        resource.canvasPixels <= 520_000 && resource.dprCap <= 1.25),
      resourceAudits,
    );

    const bState = await page.evaluate(() => {
      const qa = window.__BRICK_QA__;
      if (!qa || typeof qa.getState !== 'function') return null;
      const state = qa.getState();
      return state.B || state.bDefaults || state.microscope || null;
    });
    report.browser.bState = bState;
    addCheck(
      report,
      'browser_frozen_b_defaults',
      bState && Object.entries(B_DEFAULTS).every(([key, value]) => Number(bState[key]) === value),
      { expected: B_DEFAULTS, actual: bState },
    );

    if (qaShape && qaShape.getGeometryAudit) {
      report.browser.geometryAudit = await page.evaluate(() => window.__BRICK_QA__.getGeometryAudit());
    }
    if (qaShape && qaShape.getResourceAudit) {
      report.browser.resourceAudit = await page.evaluate(() => window.__BRICK_QA__.getResourceAudit());
    }
    if (options.screenshot) {
      await page.screenshot({ path: options.screenshot, fullPage: true });
      report.browser.screenshot = options.screenshot;
    }
    await context.close();
  } finally {
    await browser.close();
  }

  report.browser.status = 'completed';
  addCheck(report, 'browser_no_errors', report.browser.errors.length === 0, report.browser.errors);
  addCheck(
    report,
    'browser_no_external_requests',
    report.browser.externalRequests.length === 0,
    report.browser.externalRequests,
  );
  addCheck(report, 'browser_no_failed_requests', report.browser.failedRequests.length === 0, report.browser.failedRequests);
  addCheck(report, 'browser_no_bad_responses', report.browser.badResponses.length === 0, report.browser.badResponses);
  report.passed = Object.values(report.checks).every(item => item.passed);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) fs.writeFileSync(options.out, serialized, 'utf8');
  process.stdout.write(serialized);
  process.exitCode = report.passed ? 0 : 1;
}

run().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 2;
});
