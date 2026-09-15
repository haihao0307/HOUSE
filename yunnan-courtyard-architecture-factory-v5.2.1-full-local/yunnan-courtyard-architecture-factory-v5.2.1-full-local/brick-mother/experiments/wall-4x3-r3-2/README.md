# Brick Mother wall 4×3 R3.2 QA

This folder audits `../../Brick_Mother_Wall_4x3_R3_2.html`.  The three reports
cover different failure classes and are intentionally independent of the
workbench's own status label.

## Run

From this directory:

```bash
python qa_wall_r3_2.py --out LOCAL_QA.json
node qa_runtime_wall_r3_2.cjs --out RUNTIME_QA.json
python qa_glsl_wall_r3_2.py ../../Brick_Mother_Wall_4x3_R3_2.html \
  --width 512 --height 330 --png GPU_PREVIEW.png --out GPU_QA.json
python qa_glsl_wall_r3_2.py ../../Brick_Mother_Wall_4x3_R3_2.html \
  --view front --width 512 --height 330 --png GPU_FRONT.png
python qa_glsl_wall_r3_2.py ../../Brick_Mother_Wall_4x3_R3_2.html \
  --view end --width 512 --height 330 --png GPU_END.png
python qa_glsl_wall_r3_2.py ../../Brick_Mother_Wall_4x3_R3_2.html \
  --view top --width 512 --height 330 --png GPU_TOP.png
```

`qa_glsl_wall_r3_2.py` takes the HTML path as a positional argument.  It needs
Node.js plus Mesa EGL/OpenGL ES libraries; Pillow is required only when
`--png` is used.

## Gates

- `qa_wall_r3_2.py` parses the inert JSON and executable source, hashes all 336
  frozen R2.14.8.1 residual values, and independently recomputes the wall
  dimensions, A/B course widths, two-header thickness relation, course count,
  brick counts, soil setback and Microscope layer contracts.
- `qa_runtime_wall_r3_2.cjs` executes the actual inline page JavaScript in a
  deterministic DOM/WebGL2 API capture.  It exercises all three object modes,
  five fixed views, courses 1/22/43, and the soil controls.  It verifies the
  generated shaders, instanced counts, uploaded soil top, and isolation of the
  soil color control from geometry, brick identity and camera.  It also reads
  the uploaded matrices and shader uniforms to prove that `iso` uses a
  perspective projection with point-origin rays, while front/back/end/top use
  orthographic matrices with parallel SDF rays.  This guards the fixed-view
  fan-distortion regression rather than trusting view names or manifest text.
- `qa_glsl_wall_r3_2.py` captures the three exact runtime program pairs, compiles
  and links them with a real surfaceless OpenGL ES 3 context, then replays one
  complete default frame: floor, one continuous soil body, and 1,420 instances
  of the exact brick SDF proxy.  The front/end/top invocations repeat that real
  GPU path with the page's actual orthographic camera matrices and parallel
  ray uniforms so the bond face, 0.48923 m thickness and recessed soil core can
  be inspected independently.  The ISO invocation retains the perspective
  camera for spatial inspection.

Passing these checks proves source identity, construction arithmetic, runtime
data flow, real shader acceptance and a non-empty offscreen draw.  It does not
claim human visual approval, historical certainty for the interpreted bond, or
production approval.
