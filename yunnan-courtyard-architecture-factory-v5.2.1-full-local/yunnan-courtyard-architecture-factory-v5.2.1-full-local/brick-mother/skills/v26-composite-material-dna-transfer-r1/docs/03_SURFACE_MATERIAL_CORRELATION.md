# 03 — Surface and Material Correlation

## Field families

- fBm: broad material regions.
- Ridged fBm: hard ridges and erosion edges.
- Turbulence: breakup and weathered irregularity.
- Worley: cell clusters, pore grouping and separation boundaries.
- Domain warp: destroys regular procedural repetition.

## Shared event channels

The same event identity drives several outputs:

```text
cavity event
→ geometry subtraction
→ cavity-dark color
→ higher AO
→ local roughness change
→ wetness preference
→ normal/height response around the rim
```

## Fired-clay reference regions

The selected reference uses broad red, deep-red, carbon/char, ash-grey, oxide/rust, pale mineral and wet/damp regions. These are low-frequency event regions with sharper masks; they are not random per-pixel colors.

## Required channel separation

- `colorSeed` may alter region shape and palette weights, but not geometry.
- `poreSeed` may alter pores, but not broad color identity.
- `waterSeed` may alter runoff and dampness, but not bore locations.
- `detailSeed` may alter microstructure, but not major damage events.

## Output contract

At minimum export:

```text
baseColorWeights
roughness
height
normal
AO
wetness
weathering
mineral
```

A receiving material may remap palettes, but it must preserve event correlation.
