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
- Normal is RGB with no alpha. The `[128,128,255]` check uses exact equality and separate per-channel ±1 and ±2 tolerances.
- Native block summaries use 8, 32 and 128 pixel blocks; all source pixels are first read at native resolution. These are image-space scales, not real-world dimensions.
- Surface-area weighting samples one native diffuse texel at each triangle UV centroid and weights it by the loaded 3D triangle area. This reduces UV stretch bias but is not a per-pixel surface integral.
- The local evidence crop is raw source pixels selected from a 1024×1024 diffuse window with high effective-mask fraction and high native luminance variation. Its exact diffuse and corresponding normal coordinates are recorded in `analysis.json`.

## Status gates

`sourceReadVerified=true`; `modelParsed=true`; `texturesDecoded=true`; `featureExtractionComplete=true`; `comparisonRecorded=true`; `programmaticReplicationComplete=false`; `distillationComplete=false`; `temporaryCopiesRemoved=false`; `visualApproved=false`; `productionApproved=false`.

The local temporary source copy remains until review and programmatic comparison are complete. Only the user's explicit E: original is the long-term source of truth; it is outside any cleanup scope.
