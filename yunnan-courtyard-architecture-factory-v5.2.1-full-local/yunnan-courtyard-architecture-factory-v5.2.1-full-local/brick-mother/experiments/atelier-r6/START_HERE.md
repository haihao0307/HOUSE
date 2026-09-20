# Brick Mother R6: finished materials and meaningful controls

Date: 2026-09-06. Continue on feature/brick-mother-v2.0-composite-material-dna only, PR15 open/Draft/unmerged. R5, R4 and frozen V2.6/V2.7.5 remain unchanged. This round responds to the user's latest request to improve materials while consulting Xiaoma.

## Clean, verified source

Use src/kernel.js, src/renderer.js, src/app.js, src/index.template.html and src/style.css in this directory. Run python build.py. No remote asset, texture photograph or imported model is loaded at runtime. The upgrade scripts under .github/brick-r6 are provenance and assembly tools, not runtime dependencies.

Source commit: b4b5f4f3dad128ccdceaf63f8fc6ffbfac45ea78.
Materialized commit: 5a95653efdf2d099536bec17bf9a3453640d2bb2.
Verified candidate run: 34023284083, artifact9986319641.
HTML: 78835 bytes, SHA256 32c09833cedb01c1cbae6fb04faea6e9322112e92f07252baedd3b27bf7cc76d.
Planned public entry: https://haihao0307.github.io/HOUSE/brick-mother/experiments/atelier-r6/web/
At this note's creation public R6 deployment has not yet been requested. A later PUBLIC_RELEASE_RECEIPT must confirm public availability.

## Actual study and collaboration

Read Xiaoma fixed commit1fc23df1dd253d4785e05b19154cf443b4636ced: SKILL_INDEX.md and skills/surface-and-volume-optics/SKILL.md under docs/mother_coordination/learning-r1-20260905. Sent specific questions to HOUSE#16 comment5558050420 about material-mask meaning, cached field evaluation, control response and bounded hard-stone defaults. A later reread found no independent reply. Reading/sending does not establish Xiaoma approval.

Read original English sources:

1. Adobe Histogram Scan: mask position/coverage and transition contrast. Adopted separate char coverage and red-clay controls.
https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/filters/adjustments/histogram-scan

2. Adobe Non Uniform Directional Warp: independent intensity and direction inputs. Retained our own continuous three-dimensional local sampling transformation and GPU coordinate cache, not a reproduction of Adobe node source.
https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/filters/effects/non-uniform-directional-warp

3. Adobe Slope Blur: gradient-organized direction, min/max behavior and sample cost. Studied only; did not add its iterative native node algorithm to each rendered pixel.
https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/filters/blurs/slope-blur

4. Adobe PBR Guide Part2: keep base color, roughness, metallic, normal and height roles separate. R6 retains GGX/Smith/Fresnel and linear-color handling, but has not implemented complete OpenPBR or measured reflectance fitting.
https://www.adobe.com/learn/substance-3d-designer/web/the-pbr-guide-part-2

5. FAO rice grain anatomy, hull: two parts joined at a longitudinal fold. New small embedded pieces represent open shell valves with inner/outer surfaces and a connecting rim. Not a complete anatomical model, no rice kernel. Nominal lengths0.042 to0.072 are synthetic scene units, not measured millimeters.
https://www.fao.org/4/x5048e/x5048E02.htm

6. BGS rock and weathering references: mineral structure, history and environment matter; density alone does not determine weathering.
https://www.bgs.ac.uk/discovering-geology/rocks-and-minerals/rock-rumble/
https://www.bgs.ac.uk/discovering-geology/geological-processes/weathering/

7. Geological Society metamorphic examples: slate cleavage, gneiss bands and marble texture differ. Gneiss compositional banding does not automatically prove mechanical weakness at every band.
https://www.geolsoc.org.uk/ks3/gsl/education/resources/rockcycle/page3459.html

8. NPS and USGS counterexamples: granite can undergo granular breakdown, rounding, exfoliation or deep alteration along fractures. R6's hard-fracture preset limits this particular masonry presentation, not every natural granite history. Do not copy landscape-scale cavities into a small building stone without scale evidence.
https://www.nps.gov/places/geological-trail-station-1.htm
https://www.usgs.gov/media/images/lake-mead-weathering-and-erosional-history-granite

No Substance application was installed or run. User reference photographs remain visual guides, not calibration. The six older GLB reference binaries were not recovered or rescanned this round.

## Implemented changes

Visible interface shows finished material only. Seven material-family buttons remain visible. There are no public gray/basecolor/normal diagnostic switches. Six camera directions remain for inspecting real objects.

Fired brick is red dominant with a low default char mask. Kiln-aged brick is a second fired-clay appearance preset with separately controlled local kiln coloration and roughness, not a mutually exclusive historical brick class.

Adobe has variable edge radius, slight plane asymmetry and bounded recession rather than uniformly swelling rounded corners. Straw quantity and small grain-hull quantity are independently controlled. The newest explicit user request restores small hulls in R6, while zero-hull R5 is preserved. Hulls have inner bowl, outer wall and connected rim, with body anchoring and six-face distribution.

Seven rock appearance recipes: granite, sandstone, basalt, quartzite, slate, gneiss and marble. Default ordinary dressed/rubble stones use sandstone. Hard-fracture presets for granite/basalt/quartzite reduce deep soft-looking cutters and use shallower chips. Layered shapes use explicit, adjustable bed separation. Changing masonry rock type selects a matching structural envelope; changing pebble rock type keeps the rounded mesh and changes the surface.

Geometry-dependent controls: local damage, shape relief, edge wear, chisel, applicable strata, pebble roundness, straw density and hull density. Surface-only controls: red, char, kiln color, tone, color variation, minerals, microrelief, frequency, roughness, polish, wetness and local sampling strength. Irrelevant controls are hidden. Shape/damage/color/fiber/detail seed layers retain separate locks.

Granite no longer runs a 27-neighbor crystal search at every fragment. Finite continuous fields are reused with different material-channel remaps. The first granite preview had concentric mineral halos from nested scalar thresholds; final quartz and dark-region masks use different fields. Shader programs are cached per rock type, and sampling coordinates are cached independently of camera motion. Idle rendering stops; obsolete workers are cancelled. This is a rendering-efficiency change, not a claim that formulas have zero cost.

## Actual final checks

Final CI built the exact source hashes and ran real HTTP in Chromium/Xvfb/ANGLE SwiftShader.

Geometry:56 family/shape/seed configurations, plus11 additional deterministic, isolation, hull and envelope checks. Finite arrays, indices and defined degeneracy threshold pass; mesh edges have two uses. Four rock-specific extreme comparisons and all7 rock profiles are in reports. This does not establish full self-intersection freedom for all parameters.

Final extracted adobe mesh:1637 sampled anchor points inside, including68 hull anchors;24 outside controls correctly rejected. One seed4517 at resolution72,227 straw parts and68 hulls. Complete shell/strand-volume intersection is not proven by these finite points.

UI:79 parameter/family pairs for the default7 families tested at two values. Screenshots include only the canvas with parameter drawer closed; label changes cannot count as output. Geometry inputs must change mesh hash; surface inputs must preserve it. All79 pass. Added21 interaction checks include7 distinct rock outputs, conditional strata visibility, slate-rubble geometry response, real pointer/wheel, preset/camera roundtrip, pause and390x844/844x390 layouts. This is not exhaustive across every rock and parameter combination.

Six6-second software-rendering windows:desktop1200x820 at763200pixels approximately6.00/6.33/7.00fps for fired/granite-dressed/pebble; mobile-size390x844 at248040pixels approximately16.66/17.66/14.00fps. Each had at least30frames and25 unique positions. Programs, coordinate bakes and geometry stayed unchanged while rotating. No real user-device or mobile-GPU performance claim.

Failure retained:one stronger-layering long stone exceeded the old grid guard and had6 boundary edges. Expanded stone guard to0.28 and others to0.18 nominal units, with unchanged sampling spacing, then reran the matrix. No failed shape was deleted. Local pre-final tests and images are labeled separately in the source backup; final CI evidence is authoritative for final-source checks.

## Remaining limits

Visual approval of actual stone/brick color and shell morphology remains pending. Fine patterns, local soot shape, very small hulls and grain contrast may need further refinement. Recipes are bounded artistic approximations; no universal weathering law, botanical accuracy or geological classification validation is claimed. humanVisualApproved=false,productionApproved=false.

Public link is the primary delivery after exact anonymous HTTP and live-browser verification. Source ZIP is backup. Do not restart expired overnight tasks, change frozen assets or other Mothers, or treat a technical test as user visual approval.
