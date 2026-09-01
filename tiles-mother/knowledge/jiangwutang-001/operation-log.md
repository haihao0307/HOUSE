# Jiangwutang tiles local analysis operation log

Date: 2026-09-01, Asia/Shanghai

## Source and safety

- Source used: `E:\讲武堂瓦片精细.zip`
- Source was opened read-only. It was not copied into this repository, Git history, a public page, or a new archive.
- ZIP identity was recomputed before analysis: 58,671,527 bytes; SHA256 `ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365`.
- ZIP central-directory CRC and streaming reads of every non-directory entry passed.
- The earlier JSON, review note and contact/texture/UV evidence were copied under the `initial-*` names unchanged for preservation.

## Local parse sequence

1. Extract the ZIP to a temporary directory outside the repository, preserving the original directory names.
2. Run `parse_fbx.mjs` with the bundled Node.js runtime and Three.js `0.180.0`:

   ```powershell
   node parse_fbx.mjs <temporary-source>\讲武堂瓦片精细\01.fbx <temp-output>\fbx-parse.json <temp-output>\mesh-data.json
   ```

   The parser uses a metadata-only texture handler so browser `ImageLoader` is not invoked. Geometry, UVs, normals and material texture relationships are parsed from the FBX; PNG pixels are read independently with Pillow.

3. Run `analyze_effective_regions.py` with the bundled Python 3.12 runtime, NumPy and Pillow:

   ```powershell
   python analyze_effective_regions.py --zip E:\讲武堂瓦片精细.zip --source-dir <temporary-source> --mesh-json <temp-output>\mesh-data.json --prior-json initial-analysis.json --out-dir .
   ```

## Effective-region calculation

- The mask is a native-resolution rasterization of every loaded FBX UV triangle.
- Image coordinates use `U -> X` and `V -> Y` with `Y=(1-V)*(height-1)`.
- A pixel is valid when one or more UV triangles cover it. Coverage counts are retained to measure overlap.
- No thumbnail, padding, dilation, erosion, alpha expansion, inpainting or hand-edited mask was used.
- Diffuse RGB statistics retain covered dark/black texels as observed image data; pixels outside the mesh UV union are excluded.
- Diffuse alpha is reported separately. The effective region is entirely opaque; the outside region is also mostly opaque, so alpha does not define the UV boundary.
- Normal source mode is RGBA. The analysis converts it explicitly to RGB for normal decoding, reports alpha separately, and uses exact equality plus separate per-channel ±1 and ±2 tolerances for `[128,128,255]`.
- Native block summaries use 8, 32 and 128 pixel blocks; all source pixels are first read at native resolution. These are image-space scales, not real-world dimensions.
- Surface-area weighting samples one native diffuse texel at each triangle UV centroid and weights it by the loaded 3D triangle area. This reduces UV stretch bias but is not a per-pixel surface integral.
- The local evidence crop is raw source pixels selected from a 1024×1024 diffuse window with high effective-mask fraction and high native luminance variation. Its exact diffuse and corresponding normal coordinates are recorded in `analysis.json`.

## Status gates

`sourceReadVerified=true`; `modelParsed=true`; `texturesDecoded=true`; `featureExtractionComplete=true`; `comparisonRecorded=true`; `programmaticReplicationComplete=false`; `distillationComplete=false`; `temporaryCopiesRemoved=false`; `visualApproved=false`; `productionApproved=false`.

The local temporary source copy remains until review and programmatic comparison are complete. Only the user's explicit E: original is the long-term source of truth; it is outside any cleanup scope.

## J1 correction and candidate material

- The actual Normal PNG was read as RGBA. The analysis now records the original file mode and an explicit RGB conversion mode separately; alpha is measured independently. It is not correct to describe the original file as RGB/no-alpha.
- The weighted RGB summary now uses a deterministic discrete weighted percentile when triangle-area weights are provided. `test_weighted_stats.py` checks a synthetic distribution whose weighted median differs from its unweighted median.
- Source identity, ZIP CRC/stream reads, extracted entry size/hash and PNG decode are validated before the analysis JSON is written. A failure exits without a success-state JSON.
- V0.3 uses only derived observations and first-party procedural code. It does not load the original FBX, full Diffuse, full Normal or ZIP at runtime. The UI keeps a legacy V0.2 material fallback and leaves visual/production approval false.
- Real local and public Chrome QA passed from `v03/browser_qa_v03.py`: both roof families have three distinct variants, camera operations preserve geometry hashes, albedo/final channels render, V0.2 fallback remains selectable, reload preserves V0.3 state, and mobile WebGL2 has no horizontal overflow. Public readback is recorded in `qa-v03/publication.json` and `qa-v03/public-browser-report.json`; visual and production approval remain false.

## J1 V0.5 candidate implementation

- Remote branch was re-read before implementation and fast-forwarded to `f7650361b7b783745b47154848dc0974705855c8`; no force push or history rewrite was used.
- The V0.5 build is generated deterministically from the exact V0.4 entry blob at `f7650361b7b783745b47154848dc0974705855c8`, then adds only first-party V0.5 modules and configuration. The original E: source identity remains 58,671,527 bytes with SHA256 `ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365`.
- `test_core.cjs` passed 14 tests with 28 roof records and 36 surface contact records. The browser run passed 35 checks in real Chromium with WebGL2; it also checked V0.2 fallback, import/storage/CRC roundtrip, reload, mobile layout, no page/console/request errors, and seven evidence screenshots.
- Contact correction: cover centers are placed on the pan seam; cover-seat evidence samples the generated cover underside against pan top-surface bands. The measured nearest distances are candidate evidence only. Front/back longitudinal fits remain clearance evidence and are not historical validation.
- Browser QA is now `true` in the V0.5 candidate status. Public readback remains `false` until the controlled Pages workflow completes and the published HTML/modules are read back by HTTP and browser.
- Governance remains truthful: policy version `1.0.0` was read, exact shared schema/validator identity was not received, and no Brick Mother baseline object was modified or claimed as revalidated.
