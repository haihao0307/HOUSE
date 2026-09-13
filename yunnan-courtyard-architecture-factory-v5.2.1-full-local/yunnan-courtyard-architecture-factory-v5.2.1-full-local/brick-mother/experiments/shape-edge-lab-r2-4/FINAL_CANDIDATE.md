# Brick Mother R2.4 — edge closeout candidate

## Status

R2.4 is the current visual closeout candidate for the fired-brick shape/edge pass. It is not marked as final user visual approval until the user reviews this immutable preview.

Immutable preview source commit: `eb58f39ae68a8d9293df477a5f07f2b477fe784f`

Preview:
`https://rawcdn.githack.com/haihao0307/HOUSE/eb58f39ae68a8d9293df477a5f07f2b477fe784f/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/shape-edge-lab-r2-4/Brick_Shape_Edge_Lab_R2_4.html`

## What changed from R2.3

The user judged the R2.3 overall direction essentially correct and requested only the remaining small irregularities visible along the supplied brick-reference edges: shallow missing bits, slight chipped segments, and small non-uniform edge changes.

R2.4 therefore preserves the R2.3 main proportions and low-frequency warp and adds only sparse local SDF subtractions at selected long-edge, rear-edge, end and corner locations. The losses are deliberately shallow, non-periodic and asymmetric. There is no continuous saw-tooth displacement and no new high-frequency outline noise.

## Frozen facts

- Material remains the accepted R2.1 B baseline: microscope ON; strength=1; scale=1; heightContribution=1; roughnessContribution=0.
- No material process/color/pore/microscope algorithm was changed for R2.4.
- Overall reference-derived shape remains approximately long : width : thickness = 1 : 0.46 : 0.255.
- R1/R2/R2.1/R2.2/R2.3 are preserved and not overwritten.
- User-supplied reference meshes were used as shape evidence; they are not embedded as production geometry.
- Stone/rubble and adobe lines remain outside this change and frozen under the inherited handoff boundary.

## QA

GitHub Actions run `34734544194` completed successfully in Chromium/WebGL. The browser test loaded the immutable R2.4 public preview, reached the inner WebGL canvas, verified `data-ready=true`, verified status `WebGL2 · R2.4 EDGE · 成品`, observed no page/console errors, and uploaded the QA screenshot artifact `brick-r24-browser-qa` (artifact ID `10311110122`).

Technical/browser QA does not substitute for the user's final visual acceptance.
