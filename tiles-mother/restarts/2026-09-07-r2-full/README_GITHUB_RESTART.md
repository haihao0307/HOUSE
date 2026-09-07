# GITHUB RESTART PROCEDURE

1. Old branch `feature/tiles-mother-v0.1-workbench` is preserved as the pre-restart checkpoint.
2. Restart branch is `feature/tiles-mother-r2-restart-20260907`.
3. The package build workflow assembles the documented source/history set into `Tiles_Mother_R2_Full_Restart_2026-09-07.zip` and commits it back with `[skip ci]`.
4. Work resumes only on the restart branch from the package commit.
5. Each visual candidate remains a single self-contained HTML committed at a fixed SHA; review link uses `raw.githack.com/haihao0307/HOUSE/<fixed-sha>/<path>`.
6. No merge to main, no force push, no rewrite of historical accepted/rejected assets.
7. `visualApproved=false` and `productionApproved=false` until user explicitly accepts the actual final image.
