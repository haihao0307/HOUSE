# Tiles Mother 08C — implemented candidate, NOT accepted closeout

Continues exact 08B HTML SHA256 `6b372795deb3f51e80101f88375644fdfa88161bea9a28c1c6376aa58ab8ff7f`. Old fixed workbenches remain intact. No new reference model, texture or runtime dependency.

Changes: one fixed-domain Microscope kernel drives bounded real vertex offsets and existing PBR. Geometry uses fixed mesh-frequency filtering, material uses screen-footprint filtering. Both use the undeformed local carrier and identical tile identity. Native vertex and shadow passes share identical displacement source. Bottom and upper side contact rims are fixed; top relief retreats into the existing shell, front lip retreats inward, mid-thickness side wall recesses. Limits at strength 3: vertical 1.05 mm, front 0.60 mm, side 0.36 mm. These are adapter limits, not measured historic tile dimensions. Shell subdivision is now 40×40, so mobile performance remains unverified.

PBR color and roughness have a separate area, independent color toggle/reset. Shape reset only resets shape. Palette guidance comes from verified Jiangwutang UV statistics: warm/neutral/cool fractions .5600/.3252/.1148. Runtime colors are artistic adaptation; neither exact pixel matching nor physical roughness recovery is claimed.

## Executed checks

- `python build.py`: repeatable single HTML assembly, JS syntax.
- `node qa_geometry.cjs`: displacement limits and protected rims across 3 identities × 3 scales; exact projected triangle contact checks on representative assemblies. Maximum sampled displacement 0.853783 mm; bottom displacement zero. Representative contacts FAIL; see report.
- `node qa_actual.cjs`: actual default roof seed 314159, row0/col0 and corresponding cover. With strength 0, pan/cover penetration 0.522276 mm, rafter/pan penetration 0.309731 mm. At strength 3: 0.500820 mm and 0.309731 mm. These CPU tests show that zero new microshape is insufficient for an absolute contact pass; they do not claim exhaustive all-instance or GPU collision proof.
- `python qa_shader.py`: native Mesa GLES3 compilation and linking, all 4 shaders and both programs pass.
- `node export_mesh.cjs && python qa_render.py`: native GLES raster comparison with exact production shaders, fixed camera and seed. Color, gray silhouette and strength framebuffer changes verified, GL error zero. No browser event, mobile performance, shadow raster or physical iPhone validation inferred.
- Live public browser navigated to initial fixed 08C candidate. Host content notice opened normally. Workbench HTML loaded, but this browser could not establish WebGL2; initialization stopped before event wiring. Therefore interactive and 390×844 rendering QA are blocked, not passed.

## Outstanding gates

1. Reconcile the actual baseline contact failures with frozen seating rules before accepting 08C. Do not silently change SEATS or label negative gaps passed.
2. Run actual WebGL2 desktop and 390×844 browser checks, including shadow invalidation, color/shape controls, close/reopen, resets, age sequence and roof860 performance.
3. User visual approval.

`browserVerified=false`, `publicBrowserVerified=false`, `visualApproved=false`, `productionApproved=false`.

The previous 08B verified candidate remains the accepted continuation baseline. 08C is reviewable implementation work with explicit failed/blocked gates.
