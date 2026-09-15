# Brick Mother R3.1 — fixed-kernel bond study

Current review page: `../../Brick_Mother_Bond_Study_R3_1.html`

This revision withdraws the R3 substitute triangle-mesh brick. Both the single
mother view and every masonry placement evaluate the frozen R2.14.8.1 right-side
continuous SDF and the frozen R2.1-B material. Full bricks are rigid instances;
the four closers are intersections of that same mother SDF with a planar cut.

## Review scope

- Four courses of a small L-corner, built from the bottom upward.
- Courses A/B alternate which full brick passes through the corner.
- Twelve full bricks and four true half-brick cuts.
- 9.23 mm review gaps, derived from the frozen proportions so the two legs close.
- No wall core, plaster, mortar mesh, stone, or earth-wall object.

The supplied `Brick Stack` GLB is a fused, open scan shell rather than a set of
separable brick nodes. It supports the visible relationships—flat-laid bricks in
two plan directions, half-brick joint staggering, and alternating corner
interlock—but not an exact hidden per-brick bill of materials. The four-course
layout therefore remains a review interpretation and is not labelled as an
automatic extraction from the scan.

## Verification

```bash
python qa_bond_r3_1.py --out LOCAL_QA.json
node qa_runtime_r3_1.cjs --out RUNTIME_QA.json
python qa_glsl_r3_1.py --out GPU_QA.json
```

The first audit independently recomputes placement, gaps, support, closure and
joint staggering from coordinates. The second executes the page JavaScript and
checks the actual shader/uniform payloads and controls. The third compiles,
links, and smoke-renders those runtime-generated shaders using a real Mesa EGL
OpenGL ES 3 context. None of these substitutes for the user's visual approval.
