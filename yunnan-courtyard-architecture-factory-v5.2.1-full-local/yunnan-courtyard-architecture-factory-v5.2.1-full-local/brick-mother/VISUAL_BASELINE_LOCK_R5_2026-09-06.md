# Brick Mother visual baseline lock

Date: 2026-09-06.

User feedback: R6 materially regressed in both texture and color after R5 had approached an acceptable direction. Therefore R5 becomes the only current visual baseline. R6 remains preserved only as a failed comparison and source of isolated technical ideas. It must not be used as the material starting point for the next visual version.

## Locked visual baseline

Public R5: https://haihao0307.github.io/HOUSE/brick-mother/experiments/atelier-r5/web/
Expected R5 HTML SHA256: 83b36384cc6eed0416a3c57d1340926bf84651b0656c777f2f68b6983ef63428.

Preserve the R5 accepted-direction observations already expressed by the user: brick surface direction substantially improved; adobe surface and embedded straw were approaching useful; irregular rubble silhouette direction substantially improved; pebble reflectance/material direction had begun to improve. These are partial observations, not overall human visual approval.

## R6 status

R6 is a visual regression in texture and color. Preserve it for audit only. Do not inherit its seven-lithology shader wholesale, its default color remaps, or its expanded control defaults into the next production candidate.

Potentially reusable R6 components must be copied one at a time behind an A/B gate: connected controls, worker cancellation, coordinate/program caching, small hull geometry concept, and bounded hard-stone geometry experiments. Each item remains opt-in and must prove it does not degrade the R5 visual baseline.

## Mandatory change rule

One visual hypothesis per candidate. Freeze object family, seed, geometry where applicable, camera, framing, lighting, exposure, display transform and all unrelated controls. Change only the target mechanism.

Before implementation, state the expected visible improvement and a concrete failure condition. After implementation, render R5 and candidate under exactly the same observation state. Any candidate that is visually worse, shifts unrelated color/roughness, or weakens a previously accepted direction is rejected and not promoted.

No broad shader rewrite after a user says the result is close to success. No new material family or parameter expansion until existing baseline materials are stable. Research can continue separately without automatically entering the production shader.

## QA hierarchy

1. Functional QA: buttons and parameters actually change their intended outputs.
2. Isolation QA: surface-only changes do not rebuild geometry; geometry changes do not silently alter unrelated material defaults.
3. Visual-regression QA: candidate must retain or improve the R5 appearance under fixed A/B conditions.
4. User visual review: only the user can approve the final appearance.

Passing levels 1 or 2 never counts as passing level 3. Pixel difference alone proves only that the image changed; it does not prove improvement.

## Immediate next work

Return to R5 source for visual work. First target only one material at a time. Recommended order: fired brick color range, kiln variation separation, adobe silhouette plus embedded inclusions, dressed/rubble stone material response, then pebble material variation. Keep stone geometry that the user already considered directionally correct unless a specific shape defect is being tested.

Use Xiaoma and external study as research inputs. Distill methods into isolated tests before production integration. Do not let a newly learned technique replace an existing near-successful material merely because it is newer or more sophisticated.

R5 remains publicly accessible and untouched. PR15 stays open, Draft, unmerged. humanVisualApproved=false. productionApproved=false.
