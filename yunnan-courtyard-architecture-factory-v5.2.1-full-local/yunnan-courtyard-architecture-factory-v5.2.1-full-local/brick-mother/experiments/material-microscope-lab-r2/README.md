# Brick Mother · Material Microscope Lab R2

2026-09-12. Extends the B/Process material in the R1 handoff supplied at commit a354d0d4a9c6a3ac2429e65620428539799b6e90. The user explicitly instructed this task to proceed to completion after the previous cleanup boundary was explained. This authorizes this isolated Brick experiment; it does not declare unrelated cleanup complete or restore revoked tools.

## Changes

Four live, keyboard-accessible controls adjust microscope strength, sampling scale, height contribution and roughness contribution. Both contributions use the same fragment-level microscope field; roughness is modulated by the existing skin process mask. No additional independent noise source is introduced.

Left/top shows the R1 B parameter baseline. Right/bottom shows the adjustable B material. The rejected oldMaterial branch is absent. Both panels use identical geometry, material coordinates, camera and lighting. The brick silhouette is unchanged; height is surface-normal perturbation, not silhouette displacement. The R1 SDF geometry is a visualization, not a measured physical object.

Enhanced preset: strength=2, scale=1, height=1.5, roughness=1. Restore R1: 1,1,1,0. These are experimental values, not calibrated measurements or user-approved final appearance. The microscope switch only affects the adjustable panel; it preserves slider values and removes both microscopic contributions while retaining process structure. Height, roughness and formation-mask diagnostics display linear values without beauty tone mapping. Desktop is side-by-side; narrow screens stack the panels. Rendering occurs on interaction/resize, not continuously when idle.

## Validation

QA uses real Chrome/WebGL2 with SwiftShader, screenshots and pixel comparisons, not only DOM assertions. It checks matched baseline panels, per-channel effects, strength/scale effects, unaffected formation masks, OFF/zero equivalence, control independence, reset, keyboard, camera interaction, mobile layout and missing-WebGL fallback. Beauty equivalence allows a mean 0.01/255 numerical/rendering variation; panel comparison allows 0.02/255. Height/roughness/mask independence remains exact. Automated QA is not human visual approval or a hardware GPU performance benchmark.

Run the accompanying `qa_r2.py` with a preview URL to repeat public checks. The test requires Python, playwright, numpy, Pillow and Chrome. It opens an isolated headless browser. See LOCAL_QA.json for the local run; public evidence and the immutable delivery URL are recorded in the continuation receipt after publication.

## Preserved boundaries

Irregular rubble stone and adobe remain frozen. No existing family DNA or published R1 file was edited. No revoked skill was loaded or restored. The original handoff ZIP and extracted tree remain intact. humanVisualApproved=false; productionApproved=false.

Next work: final fired-brick material/shape acceptance remains outstanding. Body, edge and chip refinement follows material evaluation and is outside this control-only version. Preserve this version and issue any further experiment at a separate fixed-commit HTTPS URL.

The original public-preview and Mother object-definition rules are included alongside this file and must accompany subsequent handoffs.
