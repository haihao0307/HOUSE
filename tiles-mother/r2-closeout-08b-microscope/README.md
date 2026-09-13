# Tiles Mother 08B · Microscope → existing PBR

This is the existing 08A workbench with a tile-surface integration, NOT a new geometry system or a revived R2-11. All old fixed previews remain unchanged.

## Source and limits

Yohei Nishitsuji's author-written article publishes the complete January 18, 2025 Macroscopic microscope shader:
https://tympanus.net/codrops/2025/02/18/rendering-the-simulation-theory-exploring-fractals-glsl-and-the-nature-of-reality/

The inner kernel is `cos(dot(cos(xi.zyy*s),cos(xi.xyx*s)))/s` for the 17 dyadic scales 1 through 65536. This work uses that kernel and its analytic chain derivative. It follows the user's recorded coordinate convention `xi1=-q.z/length(q)` without an additional minus one. The original ray-march step, view ray and illumination are not tile material code. No separate, unverified rotation-pivot schedule has been invented or falsely attributed to the author. The old note saying cores 3/4 were pending is not treated as a reason to leave a verified published kernel disconnected from the surface.

The tile-domain offset, unit conversion, slider density, mean centering, footprint filtering, slope limit and PBR amplitudes are explicit adapter settings, not claimed original rotation constants or physical measurements. No Blender runtime, model import, image texture, new noise, stroke, colony or decorative pore generator was added to the intact tile path.

## Preservation and use

08A source is materialized at build time using the unchanged 07 bytes (SHA256 d101a20b0290cc20a148d65f64dfad1c4a00d402143e2492508138566100200b). The delivered START_HERE.html is a self-contained assembled page, not a network loader and not a browser-side string replacement.

build.py asserts byte identity for geometry, vertex/depth shaders, roof state/workshop, camera fit and pointer handling. Wood's existing helper remains only for wood; material controls do not rebuild geometry. Existing age, repair and geometric moss systems are retained. The visible color mask on moss-bearing tile surfaces now reads the same Microscope field instead of the withdrawn tile pattern functions.

Existing material panel: Microscope strength 0–3, scale 0.5–3, color variation 0–1; PBR roughness response is under its small detail disclosure. Default values are 1 / 1 / 0.30 / 0.30. Reset and copy-values are provided. Turning height off cannot restore old incisions because those intact-tile functions are absent.

## Verification

Run `python build.py`, then `python qa_browser.py --local --output <directory>`. GitHub Actions also opens the exact fixed HTTPS version, tests the rendered framebuffer, sliders, control resets, scenes, years, geometry invariants and 390×844 touch-layout. Browser emulation is not actual iPhone/Safari hardware testing. Public verification is only true when the corresponding QA artifact says passed. Do not infer visual approval or production approval from tests.

visualApproved=false; productionApproved=false.
