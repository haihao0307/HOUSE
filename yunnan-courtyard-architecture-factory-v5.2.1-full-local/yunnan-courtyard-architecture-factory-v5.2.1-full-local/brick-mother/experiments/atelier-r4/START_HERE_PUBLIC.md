# Brick Mother R4 public handoff

2026-09-06. This round is public delivery of the user-reviewed R4, not a new material revision.

## Real production starting point

Use web/generated-src/app.js, kernel.js, renderer.js and index.template.html. Their SHA256 values in web/RELEASE.json match the corresponding files in the actual user-reviewed Brick_Mother_R4_Full_Source.zip. The public stylesheet is separately named and intentionally compact.

Do not resume from the older src/ files or build_web.py as if they were the reviewed standalone. The first public build used those older files, failed shader startup, and was not published. The hash-checked recovery builder lives in .github/brick-public-source-repair/build_accepted_r4.py. The first failed artifact is retained as evidence, not as an accepted release.

Candidate build run: 34018035520. Materialized commit: 9d72a371cf235c099cea8fa5e5919d5360abb8cf. Public HTML SHA256: d7ed5db0c389029b359fcb51894f8e3600de4d25670964f284f35f480172cf00, 69628 bytes.

Public entry: https://haihao0307.github.io/HOUSE/brick-mother/experiments/atelier-r4/web/
Deployment run: 34018175440. Live HTTPS/browser verification run: 34018175491. At this note's creation, deployment and exact public HTTP identity have succeeded, while the independent live browser workflow is still running. Consult its final result before claiming completion.

## User feedback to preserve

The user positively reviewed the newer brick material, adobe progress and straw embedding. Irregular rubble shape is accepted directionally; keep it. Layered stone should stay as-is for now. This feedback is partial, not overall humanVisualApproved or productionApproved.

Outstanding material work:

1. Distinguish kiln-aged brick from ordinary fired brick. Preserve the accepted fired-brick appearance; develop separate meaningful kiln-region/color/roughness controls instead of just changing the label or uniformly darkening everything.
2. Straw shell/blade edges are not sufficiently visible. The reviewed kernel still uses a closed six-sided elliptical section, flattened for strips and blades. It has no independently modeled open shell edge, inner face, torn rim, or local rolled lip. This is a geometry/normal organization limitation; simply making fibers brighter will not provide the missing rim.
3. Coarse dressed stone reads as cement. The present stone shader combines a broad blue-gray/warm field, a shared microscope detail field and procedural mineral/seam masks. This is not a calibrated lithology model. Next experiment should fix a reference and separate intact face, fresh fracture, weathered face and local mineral response without changing accepted silhouettes or using extra lighting to hide the problem.
4. Pebble material remains wrong. Its present branch still applies a generic multi-scale detail field to a rounded body. Keep the accepted shape, but derive the surface from an explicitly selected reference rock and its worn/abraded presentation. Do not force every pebble to a glossy plastic surface.

The term used by the user was 稻草壳. Previous explicit removal of complete grain husks is still protected in this published version, where riceHusks=0. Straw split sheaths/blades and rice-grain hulls need separate identities. Do not reintroduce whole grain husks merely because a straw rim needs improvement. If a grain-hull branch is subsequently requested, it needs its own morphology and embedding checks.

## Sources actually reviewed for this investigation

User's uploaded isolated stems and straw-in-soil reference images, plus the reviewed R4 source. Images do not provide calibrated dimensions or reflectance.

FAO, The anatomy and physical properties of the rice grain, THE HULL: the grain hull has two joined parts and a longitudinal interlocking fold. This supports keeping grain hull morphology distinct from a cylindrical straw stem; it does not identify every small fragment in the user's images.
https://www.fao.org/4/x5048e/x5048E02.htm

US National Park Service, Minerals: mineral color, luster, cleavage and fracture characteristics differ. This supports separating material regions instead of treating all rocks as uniformly rough gray concrete; the exact stone in the reference has not been scientifically identified.
https://www.nps.gov/subjects/geology/minerals.htm

Epic, Physically Based Materials: Base Color, Roughness, Metallic and Specular have separate roles. Having GGX code alone does not verify the complete stone material.
https://dev.epicgames.com/documentation/en-us/unreal-engine/physically-based-materials-in-unreal-engine

These observations are research and a next-edit plan. No straw rim, new kiln color model or pebble material fix is claimed in this public R4 release.

## Permanent delivery checks

Lead user delivery with a working HTTPS interactive page. Attachments are backups. Verify the unauthenticated public response, text/html content type, exact source identity and live-browser material switching before saying published. Seven choices must remain visible on desktop and mobile, with small headings and an object-first view.

Only one renderer runs at a time. Preserve pause/idle and worker cancellation. Do not activate the expired overnight task or Make scenario. Preserve all frozen historical assets, main, release and gh-pages source branches, and keep PR15 open/Draft/unmerged.

The user's delivery requirement was posted to Xiaoma coordinator issue62 comment5557554705 and the five existing collection issues. Posted is not proof of other Mothers reading or publishing.
