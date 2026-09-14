# Brick Mother freeze — R2.14.8.1

Date: 2026-09-14

## Frozen current visual baseline

The current frozen brick workbench is R2.14.8.1. It inherits R2.14.8 unchanged except for one micro-trim of only the most extreme long-edge protrusions.

Fixed source commit: `7362f830bcac83a0883e7855fa5d41ee30e52718`
Fixed HTML blob: `19315c0094234f68aad6a1fadc32aeea1725aab6`
Parent baseline R2.14.8 commit: `d8b11f7b200d07e0f1c0afca36b6c5a307398281`

Fixed public preview:
https://rawcdn.githack.com/haihao0307/HOUSE/7362f830bcac83a0883e7855fa5d41ee30e52718/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother/experiments/shape-edge-lab-r2-14/Brick_Shape_Edge_Lab_R2_14_8_1.html

## QA evidence

Browser QA run: `34819437055` — success.
Artifact: `brick-r21481-final-micro-edge-qa`
Artifact id: `10337707214`
Artifact digest: `sha256:da9c20f4f3f9d093edf04b2a732725da1fd26619e5650ca8c630cdee3554dacc`

Measured delta from R2.14.8 under the same front observation:
- mean absolute pixel delta: `0.021644029891452574`
- fraction > 2: `0.0004704630993290787`
- fraction > 6: `0.000442848960890198`

This confirms R2.14.8.1 is a local micro-fix, not a broad rewrite.

## Freeze rule

Do not alter this frozen HTML or reinterpret the supplied scan model as a new brick target. Future brick work, if resumed, must start from this fixed baseline and change only an explicitly named defect.

R2.14.9 is withdrawn and removed from the current branch. It must not be revived as a production candidate.

The failed/transitional R2.14.2–R2.14.7 pages and temporary QA workflows are cleanup targets and are not valid starting points.

## Next production focus

Brick work is paused at this baseline. Next work moves to natural stone. New stone scan/model references may be used to refine stone shape, edge continuity, geological surface structure and material response without modifying the frozen brick baseline.
