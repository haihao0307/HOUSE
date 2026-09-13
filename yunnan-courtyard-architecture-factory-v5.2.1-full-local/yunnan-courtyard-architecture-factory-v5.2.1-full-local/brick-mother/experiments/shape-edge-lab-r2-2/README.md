# Brick Mother R2.2 — frozen B baseline / shape-edge entry

This version exists to remove state ambiguity before the next geometry pass.

## Locked material baseline

The user-approved R2.1 B baseline is authoritative:

- microscope: on
- strength: 1
- scale: 1
- heightContribution: 1
- roughnessContribution: 0

R2.2 inherits the immutable repaired R2.1 source at commit `030d84b979a8158d03398aa60da69e8e3315cd40`. The central microscope pole artifact repair is preserved. The R2.1 fixed preview and source are not modified.

The old R2.1 comparison UI started the right panel with an enhanced preset. That historical comparison state is not the user's final baseline. R2.2 removes that startup ambiguity by forcing the inherited page to the B baseline and disabling the material controls/enhanced entry in this inspection surface.

## Geometry scope

No brick dimensions, corner radii, edge wear, deformation, or measured physical accuracy are invented in this pass. The current geometry remains inherited from R2.1. The next geometry pass is limited to shape and edge changes against specific user/reference evidence while preserving the locked material.

Rough stone and adobe remain frozen and are outside this pass.

## Immutable preview

Candidate page source commit: `0d6eb8b72db646574b451e4eda98361f19e0eefa`.

A repository GitHub Actions public smoke test requested the immutable rawcdn.githack URL and checked the R2.2 title, B LOCK marker, and inherited R2.1 source commit. Run `34731872735` completed successfully on 2026-09-13.

This smoke check verifies public delivery and state markers. It does not claim visual approval, full object approval, or production readiness.
