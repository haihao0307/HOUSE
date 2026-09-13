# Brick Mother R2.3 reference-shape notes

User-provided reference archive: `砖brick.zip`.

This round uses the archive only as **shape reference**. It does not assert provenance, exact historical dimensions, unit consistency, or permission to import the meshes into production. The production result remains procedural code and preserves the already accepted R2.1 B material.

## Comparable shape observations

Raw GLB units are inconsistent, so absolute dimensions were not averaged. Only normalized envelope ratios and low-frequency silhouette behavior were used.

- `12th_-14th_century_building_brick.glb`: normalized longest : second : thickness ≈ `1 : 0.462 : 0.256`. Strongest useful historic-brick envelope reference in this archive. Long edges are not perfectly parallel; the thickness centerline drifts gently along the long axis, while width remains comparatively stable.
- `brick.glb`: ≈ `1 : 0.662 : 0.275`. Confirms a substantially thinner fired-brick silhouette than the former R2.1 geometry.
- `clay_brick.glb`: principal pieces show thickness ≈ `0.233–0.235` of longest dimension, with low-frequency edge bowing rather than high-frequency jaggedness.
- `brick (1).glb` contains multiple disconnected pieces / scene support geometry and was not used for a direct envelope average.
- `stone_brick.glb` was treated only as an edge/wear side reference, not as the fired-brick body proportion target.
- `white_wall_texture.glb` was excluded from brick body geometry decisions.

## R2.1 geometry issue identified

Former rounded-box half extents were `vec3(1.04, .43, .50)`, giving an envelope near `1 : 0.48 : 0.41` after normalization by the long dimension. The thickness was therefore much heavier than the fired/historic-brick references in the supplied archive.

## R2.3 candidate geometry

The right-hand candidate uses:

- base half extents `vec3(1.04, .265, .480)` → envelope near `1 : 0.46 : 0.255`;
- corner radius reduced from `.075` to `.055` to avoid the inflated soft-box look after thinning;
- a very small long-axis centerline drift and two low-frequency thickness terms;
- a very small width-center drift / width term;
- no new high-frequency shape noise.

The deformation magnitudes stay small relative to the body envelope. Their purpose is to break perfect industrial parallelism while keeping the object unmistakably brick-shaped.

## Frozen material boundary

Both comparison panels use the accepted B baseline:

- microscope: ON
- strength: `1`
- scale: `1`
- heightContribution: `1`
- roughnessContribution: `0`

R2.1 material code, process masks, microscope repair, colors and pores are inherited from fixed source commit `030d84b979a8158d03398aa60da69e8e3315cd40`. This round changes geometry only.
