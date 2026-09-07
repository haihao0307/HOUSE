# PACKAGE BUILD SPEC

The GitHub workflow should include these recoverable paths when present:

- `tiles-mother/AGENTS.md`
- `tiles-mother/CURRENT_BASELINE.json`
- `tiles-mother/CURRENT_CANDIDATE.json`
- `tiles-mother/RESTART_START_HERE.md`
- `tiles-mother/JIANGWUTANG_SOURCE_RECEIPT.json`
- `tiles-mother/v098/`
- `tiles-mother/v099/`
- `tiles-mother/v0910/`
- `tiles-mother/v0911/`
- `tiles-mother/r2-progress-01/`
- `tiles-mother/clean-02/`
- `tiles-mother/knowledge/`
- `tiles-mother/experiments/`
- `tiles-mother/releases/`
- `tiles-mother/restarts/2026-09-07-r2-full/` excluding the generated ZIP itself.

It also downloads the fixed Xiaoma R2 SKILL/TEACHBACK/lab from commit `0fcb4d6...`, writes SHA256 checksums and a manifest, zips the result, verifies the ZIP, uploads an Actions artifact and commits the ZIP back to the restart branch.
