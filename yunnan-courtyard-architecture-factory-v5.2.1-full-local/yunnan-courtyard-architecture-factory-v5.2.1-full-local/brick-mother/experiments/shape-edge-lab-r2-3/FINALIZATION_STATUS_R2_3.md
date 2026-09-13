# Brick Mother R2.3 — finalization candidate

Date: 2026-09-13
Branch: `codex/brick-r22-frozen-b-shape-workbench`
Immutable preview source commit: `c1c67bb21f30b2ff0a7a9a32e160e19eb8ecc5a2`

## What changed

R2.3 is the reference-informed geometry closing pass requested by the user. It keeps the accepted R2.1 B material frozen and changes only the brick body envelope/edge behavior.

- left panel: former R2.1 shape for comparison;
- right panel: R2.3 reference-informed shape;
- approximate normalized right-panel envelope: `1 : 0.46 : 0.255`;
- reduced over-thick former body;
- slightly smaller corner radius;
- low-frequency centerline/edge drift only;
- no high-frequency geometry noise;
- no external GLB is shipped or imported into the production result.

## Material lock

B baseline remains:

- microscope ON
- strength 1
- scale 1
- heightContribution 1
- roughnessContribution 0

Material/process source remains fixed at `030d84b979a8158d03398aa60da69e8e3315cd40`.

## Public QA

Workflow `Brick R2.3 Public Smoke`, run `34733933732`, completed successfully. It verified the immutable R2.3 public page, the target geometry constants, the geometry-only lock marker, and availability of the frozen R2.1 source used by the page.

This technical success is not a substitute for user visual approval. Until the user explicitly accepts the appearance, `visualApproved=false` and `productionApproved=false` remain the correct state.

## Immutable public preview

`https://rawcdn.githack.com/haihao0307/HOUSE/c1c67bb21f30b2ff0a7a9a32e160e19eb8ecc5a2/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/shape-edge-lab-r2-3/Brick_Shape_Edge_Lab_R2_3.html`

Old R1/R2/R2.1/R2.2 assets remain untouched. If the user accepts this visual result, freeze R2.3 rather than rewriting its immutable preview.
