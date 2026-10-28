# House / Wood Mother — R01 candidate

Status: NUMERIC_CHECKED / BROWSER_BLOCKED. Public Site v3 published by coordinator; no rendered wood verified. Not an accepted replacement or final delivery.

## Task anchor
- Target: new isolated shared Wood Mother under HOUSE; old timber, Tiles, Brick, A4 untouched.
- Reference: marialarsson/procedural_knots; algorithm notes in ../wood-research/WOOD_MOTHER_ALGORITHM_SPEC.zh-CN.md.
- Primary defect: no shared 3D growth-time field for knot/end-grain/longitudinal samples.
- New source: index.html, authored 2026-10-28 after task dispatch.
- Shape: analytic box/cylinder ray intersection; local material coordinate is fixed, no authoritative object mesh.
- Wood field: radial trunk growth time + branch support + stable smooth minimum. This is an explicitly simplified original migration candidate, NOT paper replication. Strict reference fidelity gate remains unpassed.
- Color/roughness: original noise+annual-band palette; GGX direct light with dielectric F0=.04. No measured species calibration, no anisotropy, no height displacement, no original images, no Adobe nodes, no CC-BY-SA copied code.
- Local model units, not measured physical wood dimensions. Time 2026-10-28; Location UNKNOWN.

## Verification
`python test_field.py`: 10,001 finite probes including axis, unchanged field outside branch support, small cut-step continuity passed. CPU mirror, not GPU shader proof.
`python qa.py`: failed before browser startup: sandbox socket not permitted. Escalated launch failed with bwrap infrastructure error at protected path; no path access attempted. CUA file:// navigation explicitly denied. Standard local HTTP was not reachable across execution/browser environments and was stopped. Official managed sites-preview start timed out; sites-preview status returned stopped. Do not replace preview infrastructure. Do not retry denied route or claim rendering succeeded.

## Counts
- Full standalone HTML: 11,713 UTF-8 B including inline source attribution/license and explicit WebGL1/2 diagnostics; exact public v3 HTML.
- Fragment shader: 3,743 UTF-8 B including intersection, wood, lighting; not pure Mother size.
- Current material numeric uniforms kh/kr/rings: 3 float32 = 12 B theoretical packed payload. Knot toggle, pose, TLO, shape, cut, seed/schema and shared shader excluded. No claim complete instance is12B.
- No external runtime dependency; source contains full-screen raster triangle to launch pixel rays, not object triangles.

## Next
1. Real GPU/browser compile, controls, desktop/mobile viewport and file:// offline gate.
2. Independent reviewer reference fidelity and first-look comparison; current candidate cannot self-promote.
3. Only then authorized existing preview publication, HTTP200/current version/browser recheck and PUBLICATION_PROOF shareAllowed.
4. Current HOUSE Pages copies nested courtyard package only. New top-level folder is not deployment by itself. Do not modify workflow or existing project just for convenience.

## Mandatory gates
- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改候选源码；生产源未提交；
- [ ] 用户看到的是可交互三维工作台；
- [ ] 画面来自实时三维运行时（尚未运行验证）；
- [ ] 公网固定链接和真实浏览器已验证；
- [x] 如果只有截图而没有工作台，本轮判定失败。

## Independent review repairs
Reviewer study_wood_knot_functions identified GLSL atan(0,0) and misleading fiber claim. Both corrected in local post-v1 revision; high-frequency noise now fades to its average when pixel footprint is too wide (conservative heuristic, not analytically filtered noise). GPU tests remain required. Public v3 includes these fixes and explicit diagnostics. Cloud CUA confirmed WebGL2 unavailable and WebGL1=false; do not repeat in that environment.

## Post-visual-review bounded candidate
Public v3 baseline was truly rendered in sandboxed Chrome156 WebGL2 software ANGLE/SwiftShader: 16 frames, GL0, no page errors and all tested controls passed. Evidence CI40620928866. Review found framing cropped ends and uniform bands below material fidelity target. Current candidate is12,652B, camera distance8.8 with endgrain button; monotone age mapping q+.12sin(1.618q), lower-contrast asymmetric latewood, growth-correlated fine marks and shared microscopic H with surface finite-difference normals. Not physical fiber direction/BSDF. Current changed HTML not yet published. CI font installation affects runner only; old models/other workbenches unchanged.
