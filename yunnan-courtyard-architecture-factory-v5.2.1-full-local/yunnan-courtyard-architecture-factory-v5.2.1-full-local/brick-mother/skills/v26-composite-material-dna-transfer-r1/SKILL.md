# Brick Mother V2.6 Composite Material DNA Transfer Skill

## Scope

This skill belongs to Brick Mother. It extracts and packages Brick Mother V2.6 methods only. It does not implement, edit, validate or approve another Mother.

## Use when

A receiving Mother needs the method behind the user-selected V2.6 deep-pore/broken-surface reference: real volume loss, multi-scale surface structure and event-correlated material color.

## Read order

1. `00_START_HERE.md`
2. `REFERENCE_PRESET.json`
3. `docs/01_METHOD_ARCHITECTURE.md`
4. `docs/02_GEOMETRY_EVENT_LIBRARY.md`
5. `docs/03_SURFACE_MATERIAL_CORRELATION.md`
6. `docs/04_RECEIVER_HANDOFF.md`
7. `docs/05_QA_GATES.md`
8. `TRANSFER_CONTRACT.json`
9. `src/v26_transfer_kernel.mjs`

## Producer steps

1. Lock the Brick source commit and reference preset.
2. Keep geometry, pore, color, water, weather, inclusion and detail seeds independent.
3. Export normalized fields and event descriptors.
4. Export material-channel links for every event.
5. Package source identity, tests and failure gates.
6. Stop. Do not modify the receiving Mother.

## Receiver steps

1. Declare physical unit mapping and minimum resolvable feature.
2. Bind receiver-owned evidence masks and domain constraints.
3. Choose heightfield, mesh, voxel or SDF representation for each event class.
4. Implement its own performance strategy and QA.
5. Report acceptance independently.

## Required invariant

A receiving implementation must be able to disable the transfer and recover its previous accepted base form. Brick Mother does not own that base form.
