# Brick Mother Unified Workbench R3 QA

These harnesses verify that the unified workbench is a single-file runtime rather
than a wrapper around earlier pages. It does not replace human visual acceptance.

## Page contract

The page contains exactly one `canvas` and exactly four controls carrying these
`data-mode` values:

- `single-brick`
- `brick-wall-plaster`
- `stone`
- `earth-wall-plaster`

The page exposes `window.__BRICK_QA__` after a successful WebGL draw:

```js
window.__BRICK_QA__ = {
  ready: true,
  setMode(id) {},
  getState() {
    return {
      activeMode: "single-brick",
      B: {
        strength: 1,
        scale: 1,
        heightContribution: 1,
        roughnessContribution: 0
      }
    };
  },
  getGeometryAudit() {},
  getResourceAudit() {}
};
```

`getGeometryAudit()` and `getResourceAudit()` are optional evidence hooks in this
first harness revision. They should remain JSON-serializable so later geometry
tests can assert shared brick-kernel identity, half bricks, alternating course
ends, microscope displacement, triangle budgets, and active resource ownership.

## Run

From this directory:

```bash
python qa_unified_r3.py --static-only
"$CODEX_PRIMARY_RUNTIME_NODE" qa_geometry_vm_r3.cjs
"$CODEX_PRIMARY_RUNTIME_NODE" qa_browser_r3.cjs \
  --url "http://127.0.0.1:8000/Brick_Mother_Unified_Workbench_R3.html"
```

For a public fixed-version URL:

```bash
"$CODEX_PRIMARY_RUNTIME_NODE" qa_browser_r3.cjs \
  --url "https://example.invalid/Brick_Mother_Unified_Workbench_R3.html" \
  --out QA_BROWSER_REPORT.json
```

The Node script loads Playwright from `CODEX_PRIMARY_RUNTIME_NODE_MODULES`; it does
not install packages. The generated reports include evidence for every assertion.
`QA_REPORT.json` also records the artifact SHA-256 and keeps
`humanVisualApproval` false by design.

When Chromium is unavailable, `qa_geometry_vm_r3.cjs` still executes the actual
inline workbench JavaScript using deterministic minimal DOM/WebGL2 stubs. It runs
every geometry builder and asserts geometry hashes, frozen-brick isolation,
course bonds, half bricks, distinct stone/earth construction, and memory/triangle
budgets. It is a real JavaScript/geometry test, but not a raster test.
