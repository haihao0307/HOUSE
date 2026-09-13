# Brick Mother · R2.2 Shape / Edge Study · 2026-09-13

## Status

- Branch: `codex/brick-shape-edge-r22-20260913`
- Base commit: `030d84b979a8158d03398aa60da69e8e3315cd40`
- R2.1 remains untouched.
- This is a reversible **shape/edge study**, not a production approval and not a claim of Yunnan historical dimensional accuracy.

## Frozen material invariant

R2.1 B material is carried forward unchanged in intent and parameters:

- microscope: on
- strength: `1`
- scale: `1`
- heightContribution: `1`
- roughnessContribution: `0`

The R2.2 page removes material sliders so shape review cannot accidentally drift the accepted material. It preserves the R2.1 center-pole smoothing formula with the frozen scale.

## Shape-only candidate controls

1. face bow — low-frequency broad-face departure from a perfect plane;
2. arris irregularity — stable low-frequency deviation localized toward edges;
3. arris radius variation — removes the identical industrial radius around every edge;
4. slight out-of-square deformation — reversible study parameter only.

All four are dimensionless study amplitudes. Setting all four to zero must reproduce the R2.1 round-box geometry exactly; this was corrected in the second R2.2 commit.

## Evidence boundary

The generic direction is supported by Historic England records of early/handmade brickwork describing irregular shape, irregular and slightly rounded arrises, rough faces, and occasional drying/stacking marks. These records are used only to justify the *type of geometric imperfection*. Their British brick dimensions are **not** transferred to Yunnan bricks.

Sources:

- Historic England, *The Historical Development of Ightfield Hall Farm Barn, Ightfield, North Shropshire*, Appendix 1: https://historicengland.org.uk/research/results/reports/6728/THEHISTORICALDEVELOPMENTOFIGHTFIELDHALLFARMBARNIGHTFIELDNORTHSHROPSHIRE
- Historic England, *Repairing Walls of an Older Home*: https://historicengland.org.uk/advice/your-home/maintain-repair/walls/

## Current QA

Static/source checks completed:

- compare against base shows only the new `shape-edge-lab-r2-2` experiment path; frozen R2.1 source is not modified;
- zero-control candidate geometry now reduces to the exact R2.1 `sdRoundBox(..., vec3(1.04,.43,.50), .075)` form;
- the hard discontinuity from `sign(q.y)` in the first draft was replaced by a smooth `tanh` transition;
- material controls are absent from the UI and the B values are hard-coded for this study;
- responsive side-by-side / stacked comparison is retained.

No CI status is currently attached to the commit. A real browser/WebGL public-preview execution check is still required before this candidate may be called delivered or visually accepted.

## Next convergence step

When a target Yunnan brick-shape reference is available, adjust only the four shape mechanisms (or replace them with better evidence-driven shape mechanisms), retain the frozen B material, and compare against the untouched R2.1 side in the same camera/light setup.
