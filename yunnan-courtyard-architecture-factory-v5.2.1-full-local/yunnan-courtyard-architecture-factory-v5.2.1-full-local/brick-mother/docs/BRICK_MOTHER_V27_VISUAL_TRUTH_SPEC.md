# Brick Mother V2.7 Visual Truth Specification

## 1. Reference identity

This specification freezes the user supplied three material reference image as the V2.7 visual truth target.

Reference attachment label: `ChatGPT Image 2026年8月29日 14_45_43.png`

Reference dimensions: `2048 x 682`

Reference SHA256: `f439b732f9b62584dac96ad5b4ab19dc77d48105d4b092cc21b064ee59c27cfb`

Reference order:

1. Left specimen: fired historical masonry
2. Centre specimen: natural stone
3. Right specimen: fibre reinforced adobe

The image is a material calibration truth asset. Historical production brick dimensions remain available as a separate geometry mode. V2.7 shall add a near square benchmark specimen mode for direct material comparison.

## 2. V2.6 gap diagnosis

V2.6 established deterministic material families, deep pores, broken pore rims, neutral lighting and standalone delivery. Its visible output still has five major gaps.

1. The silhouette remains close to a smooth elongated box.
2. Fine noise is distributed too evenly across the whole surface.
3. Large geological and construction events are weak.
4. Cavities are isolated and rounded, with limited broken rims, undercuts and internal structure.
5. Fired brick, stone and adobe differ mainly through palette and small detail density. Their structural formation logic needs stronger separation.

The V2.7 target uses broad fractures, layered plates, material specific delamination, undercut cavities and multiple scales of relief. Fine texture supports those events and never becomes the primary form.

## 3. Quantitative image targets

Values below were measured from the user supplied reference after excluding the black background.

| Family | Mean sRGB | Mean luminance | Luminance standard deviation | Luminance P10 | Luminance P50 | Luminance P90 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Fired masonry | 0.449, 0.294, 0.197 | 0.320 | 0.151 | 0.108 | 0.323 | 0.516 |
| Natural stone | 0.345, 0.325, 0.293 | 0.327 | 0.156 | 0.106 | 0.332 | 0.530 |
| Adobe | 0.496, 0.351, 0.218 | 0.372 | 0.168 | 0.126 | 0.395 | 0.578 |

Measured absolute band energy across Gaussian radii 1, 2, 4, 8, 16 and 32 pixels is approximately `0.022 to 0.032` for the truth image. V2.6 final evidence is approximately `0.005 to 0.012` across the same bands. V2.7 must increase readable structure at every scale through event geometry, material masks and lighting response.

The target is not a request for more random grain. The target is a stronger hierarchy of coherent forms.

## 4. Shared formation hierarchy

Each material family shall use the following hierarchy.

### 4.1 Macro structure

Target contribution: 40 to 50 percent of visible relief.

Required operators:

1. Asymmetric specimen silhouette
2. Broad missing plates
3. Large compression or fracture zones
4. Edge spalls and corner loss
5. One to three dominant directional events
6. Deep cavities with irregular mouths and internal occlusion

### 4.2 Meso structure

Target contribution: 30 to 40 percent of visible relief.

Required operators:

1. Layered flakes
2. Fracture branches
3. Material dependent aggregates
4. Secondary cavity clusters
5. Undercut ledges
6. Local erosion shelves
7. Broken pore rims

### 4.3 Micro structure

Target contribution: 15 to 25 percent of visible relief.

Required operators:

1. Fine pores
2. Mineral grains
3. Short fibre fragments
4. Hairline cracks
5. Roughness variation
6. Micro normal detail

Micro structure must be masked by macro and meso events. Uniform full surface speckle is prohibited as the dominant visual feature.

## 5. Fired masonry graph

The fired masonry family shall reproduce the following visible mechanisms.

1. Red brown fired body with cooler dark fired crust zones
2. Broad iron rich oxide patches
3. Sparse pale mineral or salt deposits
4. Thin delaminated surface plates
5. Blackened cavity floors and broken edges
6. Mixed cavity sizes, including several large holes, medium voids and fine pores
7. Rough torn edges around major holes
8. Local grey mineral aggregate zones
9. High roughness with restrained highlights
10. Warm colour concentration around exposed fired layers

Large holes shall be connected to surrounding fracture or delamination events. Perfect circles and uniformly distributed spherical pores are prohibited.

## 6. Natural stone graph

The natural stone family shall reproduce the following visible mechanisms.

1. Cool grey, blue grey, warm grey and restrained brown mineral zones
2. A dominant diagonal or curved shear band
3. Layered bedding plates with different thicknesses
4. Jagged fracture intersections
5. Deep shadowed undercuts beneath broken strata
6. Pale mineral seams and dark cavity seams
7. Local granular fracture without full surface grain repetition
8. Asymmetric broken edges and corner loss
9. Broad midtone readability
10. High roughness and low specular response

Stone shall use directional geology. Isotropic cloud noise alone cannot define the structure.

## 7. Adobe graph

The adobe family shall reproduce the following visible mechanisms.

1. Warm ochre clay body with dark damp and cooler compressed zones
2. Large compacted clay flakes and layered plates
3. Long straw fibres, chopped fibres and husk fragments
4. Fibre bundles that cross plate boundaries
5. Pullout channels and missing fibre cavities
6. Ragged torn edges around exposed fibres
7. Uneven compaction density
8. Small aggregate grains embedded within the clay
9. Local collapse zones with broken plate stacks
10. Matte dusty response with restrained wet patches

Fibres shall vary in length, thickness, burial depth, direction and clustering. A uniform scatter of identical short strands is prohibited.

## 8. Benchmark specimen and camera

V2.7 shall add `benchmark-slab` as a dedicated calibration geometry mode.

Target properties:

1. Near square frontal face
2. Visible left side thickness
3. Rounded and damaged outer edges
4. Front face fills approximately 72 to 88 percent of the frame height
5. Camera yaw approximately 8 to 16 degrees
6. Camera pitch approximately 2 to 8 degrees
7. Dark neutral background
8. No floor grid in evidence captures
9. Soft upper left key light
10. Low intensity cool fill and subtle rim light

The historical brick mode remains available for architectural production. Evidence review shall use the benchmark specimen so material quality can be assessed without distance and aspect ratio distortion.

## 9. Geometry implementation contract

The V2.7 geometry runtime shall introduce material specific event fields.

Required event families:

1. `macroPlateLoss`
2. `shearBand`
3. `beddingLayer`
4. `delaminationPlate`
5. `undercutShelf`
6. `cavityCluster`
7. `fractureBranch`
8. `edgeSpall`
9. `fiberBundle`
10. `fiberPulloutChannel`
11. `compactionFlake`
12. `mineralSeam`

Each event must be deterministic from seed DNA. Geometry, albedo, roughness, normal and ambient occlusion shall share the event masks.

## 10. Material channel contract

Required correlated channels:

1. Base colour
2. Macro event mask
3. Meso event mask
4. Cavity and undercut mask
5. Roughness
6. Micro normal
7. Ambient occlusion
8. Mineral event mask
9. Moisture and weathering mask
10. Fibre and pullout mask for adobe

Cavity floors shall darken through occlusion and material response. Bright painted rings around holes are prohibited.

## 11. Fail closed visual gates

V2.7 evidence fails when any condition below is present.

1. Smooth box silhouette dominates the specimen.
2. The three families share the same fracture layout.
3. Fine noise reads before macro structure.
4. Large cavities have clean circular mouths.
5. Stone has no dominant directional geology.
6. Adobe fibres remain too small to read at the default closeup.
7. Fired masonry lacks black fired zones, pale minerals or broad oxide patches.
8. Luminance standard deviation remains below 0.11 in any final material evidence image.
9. The specimen occupies less than 70 percent of frame height.
10. Grid lines or interface panels obscure the material evidence.
11. Final, albedo, cavity and normal captures do not share identical seed DNA.
12. Any manual approval flag becomes true without user visual approval.

## 12. Evidence matrix

The continuous V2.7 workflow shall capture the following evidence for all three families.

1. Final material
2. Base colour
3. Cavity and undercut
4. Surface normal
5. Macro event field
6. Meso event field

Each capture shall use `1600 x 1000` or larger, identical camera framing, identical seed DNA and benchmark specimen mode.

Automatic QA shall report:

1. Image byte size
2. Image hash
3. Frame occupancy
4. Luminance mean and standard deviation
5. P10, P50 and P90 luminance
6. Multi scale band energy
7. Event counts by family
8. Deep cavity count
9. Undercut shelf count
10. Fibre bundle count for adobe

## 13. Approval state

The user supplied image is now the visual truth target for V2.7.

Current approvals remain:

1. Fired masonry visual approval: false
2. Natural stone visual approval: false
3. Adobe visual approval: false
4. Production approval: false

V1.0 remains frozen. PR 15 remains open, Draft and unmerged during V2.7 development.
