const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

global.window = global;
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'source');
for (const file of ['core.js', 'profile.js', 'geometry.js', 'roof.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(source, file), 'utf8'), { filename: file });
}

(async () => {
  const base = { seed: 32017, form: 24, pores: 40, edge: 20, age: 0, exposure: 0.53, slope: -0.27 };
  const matrix = [
    { name: 'desktop-default', values: {}, nu: 40, nv: 60 },
    { name: 'mobile-150years', values: { age: 150 }, nu: 24, nv: 36 },
    { name: 'parameter-extremes', values: { seed: 321098, form: 42, pores: 64, edge: 46, age: 150 }, nu: 32, nv: 48 },
  ];
  const report = {
    schema: 'tiles-mother-v091-release-core-v1',
    collisionScope: 'projected vertical intervals plus vertex and XZ sampling; not exhaustive triangle-triangle proof',
    runs: [],
    visualApproved: false,
    productionApproved: false,
    distillationComplete: false,
  };

  for (const cfg of matrix) {
    const started = performance.now();
    const result = await TilesRoof091.build({ ...base, ...cfg.values }, { nu: cfg.nu, nv: cfg.nv });
    const rowLifts = result.records
      .filter((item) => item.family === 'pan' && item.row > 0)
      .map((item) => {
        const previous = result.records.find(
          (candidate) => candidate.family === 'pan' && candidate.col === item.col && candidate.row === item.row - 1
        );
        return (item.pose.y - previous.pose.y) * 1000;
      });
    const run = {
      name: cfg.name,
      elapsedMS: performance.now() - started,
      ...result.qa,
      topologyPassed: result.topology.every((entry) => entry.pass),
      topologyFailures: result.topology.filter((entry) => !entry.pass).length,
      drainageUpslopeSamples: result.paths.reduce((sum, entry) => sum + entry.localUpslopeSamples, 0),
      minimumPanRowLiftMM: Math.min(...rowLifts),
    };
    report.runs.push(run);
  }

  const failed = report.runs.filter(
    (run) => !run.topologyPassed || run.sampledPenetrations !== 0 || run.drainageUpslopeSamples !== 0
  );
  report.allPassed = failed.length === 0;
  const out = path.join(root, 'qa', 'core-release.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.allPassed) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
