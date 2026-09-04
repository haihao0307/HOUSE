# Brick Mother V2.7.5 Performance Diagnosis V1

## Measurement identity

- Workflow run: `33829732628`
- Evidence artifact: `9921387461`
- Trigger head: `4e550b1bd5ecdc42b324046c00807b27b1965ec6`
- Frozen core blob: `7b10389cb9367f7423619262820883cc94b07a61`
- Browser path: Chromium with SwiftShader software WebGL
- Runs per case: 2
- Hardware GPU benchmark: false

The measurements identify relative startup phases. They do not establish production-device FPS targets.

## Measured startup phases

| Case | DOM content loaded | First paint | WebGL context | Program link | Geometry batch time shown by runtime | Ready wall time |
|---|---:|---:|---:|---:|---:|---:|
| Standalone, one fired-clay hero | median 1.38 s | median 2.51 s | median 0.92 s | median 1.02 s | 13.94 to 16.52 s | median 16.63 s |
| Standalone, three material families | median 0.78 s | median 0.41 s | median 0.42 s | median 0.62 s | 33.95 to 34.36 s | median 34.95 s |
| Modular, one fired-clay hero | median 0.15 s | median 0.47 s | median 0.62 s | median 0.68 s | 14.54 to 14.65 s | median 27.44 s, high variance |
| Modular, three material families | median 0.15 s | median 0.55 s | median 0.66 s | median 0.83 s | 34.56 to 37.01 s | median 36.69 s |

The one-specimen path generates 41,460 triangles and 14 formation events. The three-family path generates 84,280 triangles and 42 formation events.

## Findings

### Primary bottleneck: synchronous procedural geometry

`buildCurrentBatch()` calls `buildMesh()` sequentially on the main thread. The runtime does not mark itself ready until every selected family has completed. One specimen consumes roughly 14 to 16.5 seconds in software execution. Three families consume roughly 34 to 37 seconds.

The page therefore reaches DOM, first paint, WebGL context creation and shader linking much earlier than usable material geometry. Network transfer and HTML packaging are secondary at this stage.

### Secondary bottleneck: unconditional frame rendering

The retained renderer calls `draw()` in every animation frame even when:

- the camera is still,
- auto-rotation is disabled,
- no controls changed,
- no geometry changed,
- no diagnostic channel changed.

The material shader contains multiple three-dimensional noise families, Gaea operators, Worley evaluation, weathering fields, formation-event loops and three material draws. Continuous software rendering can occupy the renderer after the page reports ready. This also caused optional full-page evidence screenshots to exceed 10 to 30 seconds while all runtime identity checks had already passed.

### Packaging comparison

The standalone file transfers about 235 KB as one document. The modular entry transfers about 17 KB of HTML and approximately 228 KB across eight resources. Both reach first paint and WebGL setup well before geometry completion. Changing packaging alone cannot solve the observed wait.

## Correct optimization sequence

### P0. Stop idle rendering

Create an additive candidate from the frozen core. Replace unconditional animation frames with explicit invalidation after:

- mesh installation,
- camera drag or zoom,
- resize,
- debug-channel change,
- profile or control change,
- auto-rotation start and stop.

Pixel equivalence against the frozen core is mandatory. The original core remains unchanged and default.

### P1. Progressive visible result

Generate and show the retained fired-clay hero first. Mark the canvas interactive as soon as the hero is installed. Generate stone and adobe after the first usable frame. The loading curtain must not cover an already valid hero specimen.

### P2. Move geometry generation off the main thread

Move deterministic `buildMesh()` work to a Web Worker. Transfer typed-array buffers rather than clone them. Keep profile, seed, control, level and quality identity explicit in the message contract.

### P3. Cache deterministic canonical geometry

Cache generated typed arrays by a content key containing:

- runtime and geometry version,
- profile ID,
- all seed layers,
- all geometry-affecting controls,
- specimen level,
- quality tier.

A cache hit can display the exact retained geometry immediately. A control or seed change invalidates only the affected key.

### P4. Preserve visual output during every performance change

Every candidate must compare:

- same seed,
- same profile,
- same geometry controls,
- same camera,
- same lighting,
- same diagnostic channel,
- same viewport,
- exact or documented-tolerance canvas pixels.

No material, geometry, lighting or color simplification is permitted as a performance shortcut.

## Current status

- Baseline measurement: complete
- Frozen V2.7.5 modified: no
- P0 on-demand candidate: under automated private review
- P1 progressive hero: not started
- P2 geometry worker: not started
- P3 deterministic cache: not started
- Human visual approval: false
- Production approval: false
