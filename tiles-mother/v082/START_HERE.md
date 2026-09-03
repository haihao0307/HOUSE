# Tiles Mother V0.8.2 mobile recovery

Date: 2026-09-03
Production line: Tiles Mother only
Work branch: feature/tiles-mother-v0.1-workbench
Starting remote head: fb4e6220a33d8f9ff5d7f8d82bc5edf88cbc3bde
Input: Tiles_Mother_V081_MobileSafe_PBR_Workbench.html supplied in the active conversation.

## Confirmed source defects

The mobile color-variation control recreated a material without rebuilding its vertex-color attributes. The portrait camera fit did not use the horizontal field of view. Single-tile view used the desktop mesh budget. Build work remained synchronous inside an initial animation-frame callback. Runtime failure reporting was disabled once the first ready flag was set. The mobile orientation display reported an offline result while per-triangle checks were deferred. The cover-seat inspection selected pan columns 1 and 2 for seam 1, although that seam rests between columns 0 and 1.

## Current implementation scope

Cooperative per-tile generation, stale-build invalidation, asynchronous shader compilation when supported, visible WebGL failure and restoration, portrait bounds fitting, bounded single-tile mesh, actual mobile color-channel updates, and an exhaustive triangle-orientation check. Preserve the existing 12 pan tiles plus 16 cover tiles, no roof pedestal, independent seeds, fired-clay color range, PBR material channels, and 0 to 150 year controls. Relationship diagnostics remain paired-surface sampling, not an exhaustive triangle-collision proof.

## Publication protection

Never modify main, gh-pages, Brick Mother branches or frozen assets. Restore the latest proven complete Pages artifact before overlaying only tiles-mother paths. Fail closed if the current base artifact cannot be proven. Verify exact public bytes and actual browser identity before calling the URL delivered. Keep source staging and publication states separate.

## Validation honesty

Local browser checks use Chromium with SwiftShader and a mobile viewport. They do not constitute an actual iPhone Safari test. An installation attempt for the separate WebKit test runtime failed due to DNS access; no WebKit pass is claimed. Static fallback snapshots are labelled static and never count as a live 3D frame.

visualApproved=false
productionApproved=false
distillationComplete=false
publicationStatus=pending
