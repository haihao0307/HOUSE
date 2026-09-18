# 05 — QA Gates

## Determinism

Same source identity, seeds, controls and scale mapping must reproduce the same event descriptors and channel fields.

## Seed isolation

- Change color seed: geometry hash unchanged.
- Change pore seed: pore event hash changes.
- Change water seed: geometry hash unchanged.
- Change shape seed: base warp changes while event-family controls remain valid.

## Geometry truth

- Deep pores include mouth and bore.
- Rim chips are separate from the bore.
- Large erosion affects silhouette/section where visible.
- Disable transfer: accepted base form returns.
- Protected mask: exact zero transfer geometry delta.

## Material correlation

- Cavity darkening follows cavity identity.
- AO increases in true cavities.
- Wetness follows flow/cavity logic.
- Fresh break color follows chips and erosion bites.
- Color-only black circles fail.

## Scale and repetition

- Event radius distribution includes micro, medium and large families.
- No visible regular cellular lattice.
- No whole-object sandpaper noise.
- Event density is bounded by object size and budget.

## Performance

Measure separately:

- event generation time;
- mesh/SDF extraction time;
- GPU material cost;
- idle redraw cost;
- near/far LOD cost.

## Approval boundary

Passing this package's tests proves only the transfer kernel is internally consistent. It does not approve a receiving Mother's output.
