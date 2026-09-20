# Brick Mother R5: rounded brick and independent rock recipes

Date: 2026-09-06. Current task: user asked to reduce exaggerated brick/adobe damage, round worn edges, and research varied stone/pebble materials independently. This is an isolated review candidate beside unchanged R4.

## Rebuildable entry

Use this directory's src/kernel.js, src/renderer.js, src/app.js, src/index.template.html and src/style.css. Run python build.py. The clean files are materialized and verified against exact SHA256 targets. The .github/brick-r5/changes records are build provenance, not runtime dependencies. Do not resume from the mismatched older R4/src files.

Source commit: 7390c27e83995e4f68f703d6476f40a35ef1e38a. Materialized commit: c77190dd37a00149d488a343eef0f5135f0fb686. Build run34020663493/artifact9985400524 passed numerical and real local HTTP browser checks.

R5 URL: https://haihao0307.github.io/HOUSE/brick-mother/experiments/atelier-r5/web/
R4 comparison: https://haihao0307.github.io/HOUSE/brick-mother/experiments/atelier-r4/web/

Live verification is run34020830754; this note was created while that run was pending. Consult the later PUBLIC_RELEASE_RECEIPT before claiming live verification. Expected R5 HTML SHA256:83b36384cc6eed0416a3c57d1340926bf84651b0656c777f2f68b6983ef63428,80401 bytes. R4 expected SHA256:d7ed5db0c389029b359fcb51894f8e3600de4d25670964f284f35f480172cf00.

## Actual reference scope

User's brick-pile, three-material and straw photos were reviewed again. An earlier index lists six GLB files in 砖brick (2).zip: 12th_-14th_century_building_brick.glb, brick (1).glb, brick.glb, clay_brick.glb, stone_brick.glb, white_wall_texture.glb. The original archive/GLB bytes were not recovered in this round. No real scan, original-model dimensions, inverse fit or calibrated reflectance is claimed.

Research read in full on the relevant sections:
- British Geological Survey, Rock Rumble: basalt, granite, sandstone, limestone and pebble descriptions. https://www.bgs.ac.uk/discovering-geology/rocks-and-minerals/rock-rumble/
- BGS, Rocks and minerals: distinct interlocked crystals versus cemented sediment grains; Peterhead granite photograph and its feldspar/quartz/biotite interpretation. https://www.bgs.ac.uk/discovering-geology/rocks-and-minerals/
- US National Park Service, Earthen Architecture FAQs: water and wind-driven particles erode adobe grains; the appearance is not literal melting. https://home.nps.gov/articles/000/earthen-architecture-faqs.htm
- Irish Universities GeoLab/Open University, M06 Garnetiferous Quartzite: one specific sample with quartz/garnet/feldspar. Sample properties are not generalized to every quartzite. https://www.virtualmicroscope.org/content/m06-garnetiferous-quartzite

Source images are not runtime textures. All numeric material values in this candidate are synthetic appearance choices and remain uncalibrated.

## Implemented changes

Fired, kiln and adobe normal presets now use retained broad faces, wider rounded edges, reduced corner disturbance, fewer shallow cavities and smooth void blending. Heavy damage remains an explicit separate preset. Edge-wear parameter is separate from fine surface detail. This is a parameterized appearance model, not a year-by-year erosion simulator.

Dressed, rubble, layered and pebble position/normal/index arrays match R4 exactly in the same-input checks. Material recipes are separate: granite interlocking mineral regions; sandstone fine cemented grain; basalt dark compact fine matrix; quartzite pale dense aggregate. Worn pebbles attenuate micro-relief while retaining the parent material pattern. Layered stone defaults to the R4 material. Lithology changes do not rebuild geometry.

Material programs are specialized lazily by selected lithology and cached. Camera rotation does not regenerate geometry, coordinates or shader programs. Granite's cell support bound prunes unnecessary neighbor hashes; this is an implementation bound within the defined local 27-cell search, not a proof of global Voronoi correctness or guaranteed GPU speed.

Six-face straw embedding retained. Whole grain husks remain disabled. Open sheath walls, torn rim and curved blade lip are still a later task; this round does not claim their geometry was remade.

## Actual checks and limitations

56 matrix configurations at resolution72: finite values, valid indices, nondegenerate triangles at the defined threshold and two-use mesh edges. Additional repeat/parameter/extreme-input checks. Four rock-family geometry identity checks preserve R4.

Independent ray-parity tests against the final extracted body mesh:1956 anchor points in one adobe sample are inside;24 outside controls are rejected. This is finite point evidence, not a whole-strand volume/contact proof.

Local and CI each executed 29 browser interaction checks:7 families,4 distinct rock outputs, fixed geometry through material changes,6 faces, real pointer/wheel, pause/idle, presets,390x844 and844x390 layouts. Local landscape-header overflow was fixed and retested; first failure remains in the user package. CI uses real HTTP; local environment used set_content because navigation policies differed.

Performance remains separately scoped. Final local SwiftShader 1280x860 windows were approximately5.17/2.33/3.83fps for fired/dressed/pebble. CI local-HTTP windows were approximately7.00/6.83/8.33fps. This variability does not establish user-device performance or a completed multi-window production gate. Measurements and environment identities are retained; no claim that small HTML makes computation free.

## Continue safely

Keep R4 and earlier frozen originals. Only work on feature/brick-mother-v2.0-composite-material-dna; PR15 open/Draft/unmerged. No changes to main, release, gh-pages source branches, canonical data or other Mothers. No expired Make loop is restarted.

User reviews final shapes/colors. Granite mineral regions can still look too uniform, pebble responses need reference review, straw rim is unfinished and original six GLBs remain unavailable. humanVisualApproved=false,productionApproved=false. Lead delivery with verified public HTTPS; attachments only back up source/evidence.
