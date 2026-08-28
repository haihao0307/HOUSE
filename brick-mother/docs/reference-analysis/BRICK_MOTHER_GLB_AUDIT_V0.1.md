# Brick Mother GLB 只读结构审计 V0.1

解析器：`brick-mother-glb-inspector/0.1.0`

本报告只测量几何与容器结构。原纹理不进入 Brick Mother 运行时，材料身份仍等待视觉和截面确认。

## 总表

| 文件 | bytes | 世界尺寸 m | 排序比例 | 顶点 | 三角形 | 网格/图元 | UV | 材质/图像 | 异常 |
|---|---:|---|---|---:|---:|---:|---|---:|---:|
| `12th_-14th_century_building_brick.glb` | 3,474,792 | 0.3190 × 0.0815 × 0.1474 | 1.000:0.462:0.256 | 11,130 | 19,390 | 1/1 | TEXCOORD_0 | 1/2 | 1 |
| `brick (1).glb` | 1,172,640 | 25.6025 × 11.1913 × 25.6025 | 1.000:1.000:0.437 | 2,717 | 2,794 | 2/2 | TEXCOORD_0 | 2/1 | 3 |
| `brick.glb` | 4,218,980 | 0.2769 × 0.1151 × 0.4186 | 1.000:0.662:0.275 | 15,898 | 29,996 | 1/1 | TEXCOORD_0 | 1/3 | 0 |
| `clay_brick.glb` | 10,191,844 | 565.9576 × 131.8722 × 563.5750 | 1.000:0.996:0.233 | 104,009 | 180,782 | 2/2 | TEXCOORD_0 | 1/2 | 6 |
| `stone_brick.glb` | 23,979,900 | 0.0142 × 0.0078 × 0.0060 | 1.000:0.551:0.420 | 152,745 | 263,744 | 3/3 | TEXCOORD_0, TEXCOORD_1, TEXCOORD_2, TEXCOORD_3, TEXCOORD_4, TEXCOORD_5, TEXCOORD_6, TEXCOORD_7, TEXCOORD_8, TEXCOORD_9 | 1/4 | 4 |
| `white_wall_texture.glb` | 5,260,124 | 100.0000 × 100.0000 × 100.0000 | 1.000:1.000:1.000 | 38,961 | 76,800 | 1/1 | TEXCOORD_0 | 1/3 | 0 |

## 坐标与单位

六个文件均按 glTF 2.0 约定读取：右手坐标、+Y 向上、单位按米解释。glTF 容器没有独立的单位声明字段，因此尺寸可信度还需要结合实物常识和用户确认。

## 逐文件结果

### 12th_-14th_century_building_brick.glb

- 标题：12th -14th century building brick
- 作者：pasquill (https://sketchfab.com/pasquill)
- 许可：CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- 许可提示：attribution required for redistribution of the source asset
- 证据角色：historic fired or unfired brick evidence pending visual confirmation
- 世界包围盒尺寸：`[0.318959, 0.081495, 0.147397]` m
- PCA 主轴尺寸：`[0.319308, 0.148106, 0.079291]` m
- 顶点/索引/三角形：`11130` / `58170` / `19390`
- 退化三角形/索引边界边/焊接后边界边：`0` / `2964` / `0`
- 索引非流形边/焊接后非流形边：`0` / `16`
- 节点/网格实例/网格/图元：`5` / `1` / `1` / `1`
- UV 集：`['TEXCOORD_0']`
- 材质/纹理/图像：`1` / `2` / `2`
- 扩展：used=`[]` required=`[]`
- 异常：
  - mesh 0 primitive 0 has 16 position-welded non-manifold edges

### brick (1).glb

- 标题：Brick
- 作者：martn00 (https://sketchfab.com/martn00)
- 许可：CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- 许可提示：attribution required for redistribution of the source asset
- 证据角色：generic brick evidence pending visual confirmation
- 世界包围盒尺寸：`[25.602529, 11.191289, 25.602529]` m
- PCA 主轴尺寸：`[33.661792, 29.970427, 13.108503]` m
- 顶点/索引/三角形：`2717` / `8382` / `2794`
- 退化三角形/索引边界边/焊接后边界边：`0` / `1930` / `14`
- 索引非流形边/焊接后非流形边：`0` / `0`
- 节点/网格实例/网格/图元：`8` / `2` / `2` / `2`
- UV 集：`['TEXCOORD_0']`
- 材质/纹理/图像：`2` / `1` / `1`
- 扩展：used=`['KHR_materials_pbrSpecularGlossiness']` required=`['KHR_materials_pbrSpecularGlossiness']`
- 异常：
  - mesh 1 primitive 0 has no TEXCOORD set
  - mesh 1 primitive 0 has 14 position-welded boundary edges
  - absolute scene scale 25.6025 m is implausible for a single brick; use normalized proportions until calibrated

### brick.glb

- 标题：Brick
- 作者：Rigsters (https://sketchfab.com/rigsters)
- 许可：CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- 许可提示：attribution required for redistribution of the source asset
- 证据角色：generic brick evidence pending visual confirmation
- 世界包围盒尺寸：`[0.276937, 0.115101, 0.418595]` m
- PCA 主轴尺寸：`[0.421988, 0.281908, 0.116202]` m
- 顶点/索引/三角形：`15898` / `89988` / `29996`
- 退化三角形/索引边界边/焊接后边界边：`0` / `1792` / `0`
- 索引非流形边/焊接后非流形边：`0` / `0`
- 节点/网格实例/网格/图元：`3` / `1` / `1` / `1`
- UV 集：`['TEXCOORD_0']`
- 材质/纹理/图像：`1` / `3` / `3`
- 扩展：used=`[]` required=`[]`
- 异常：
  - 未发现结构异常

### clay_brick.glb

- 标题：Clay Brick
- 作者：Världskulturmuseerna (https://sketchfab.com/varldskulturmuseerna)
- 许可：CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/)
- 许可提示：non-commercial restriction, keep reference-only
- 证据角色：candidate ADOBE or FIRED_CLAY evidence pending visual confirmation
- 世界包围盒尺寸：`[565.95757, 131.872222, 563.575041]` m
- PCA 主轴尺寸：`[564.206514, 561.687152, 132.493114]` m
- 顶点/索引/三角形：`104009` / `542346` / `180782`
- 退化三角形/索引边界边/焊接后边界边：`4` / `27446` / `23904`
- 索引非流形边/焊接后非流形边：`0` / `2`
- 节点/网格实例/网格/图元：`6` / `2` / `2` / `2`
- UV 集：`['TEXCOORD_0']`
- 材质/纹理/图像：`1` / `2` / `2`
- 扩展：used=`[]` required=`[]`
- 异常：
  - mesh 0 primitive 0 has 11952 position-welded boundary edges
  - mesh 1 primitive 0 has 4 degenerate triangles
  - mesh 1 primitive 0 has 11952 position-welded boundary edges
  - mesh 1 primitive 0 has 2 position-welded non-manifold edges
  - absolute scene scale 565.958 m is implausible for a single brick; use normalized proportions until calibrated
  - source metadata declares a non-commercial license

### stone_brick.glb

- 标题：stone brick
- 作者：LuthBird1 (https://sketchfab.com/LuthBird1)
- 许可：CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- 许可提示：attribution required for redistribution of the source asset
- 证据角色：candidate STONE shape and surface evidence
- 世界包围盒尺寸：`[0.014206, 0.007824, 0.005968]` m
- PCA 主轴尺寸：`[0.01425, 0.007983, 0.006184]` m
- 顶点/索引/三角形：`152745` / `791232` / `263744`
- 退化三角形/索引边界边/焊接后边界边：`0` / `41294` / `38930`
- 索引非流形边/焊接后非流形边：`0` / `0`
- 节点/网格实例/网格/图元：`7` / `3` / `3` / `3`
- UV 集：`['TEXCOORD_0', 'TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3', 'TEXCOORD_4', 'TEXCOORD_5', 'TEXCOORD_6', 'TEXCOORD_7', 'TEXCOORD_8', 'TEXCOORD_9']`
- 材质/纹理/图像：`1` / `4` / `4`
- 扩展：used=`[]` required=`[]`
- 异常：
  - mesh 0 primitive 0 has 13677 position-welded boundary edges
  - mesh 1 primitive 0 has 18032 position-welded boundary edges
  - mesh 2 primitive 0 has 7221 position-welded boundary edges
  - absolute scene scale 0.0142058 m is implausible for a single brick; use normalized proportions until calibrated

### white_wall_texture.glb

- 标题：White wall texture
- 作者：PixelatoR (https://sketchfab.com/pixelator111)
- 许可：CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- 许可提示：attribution required for redistribution of the source asset
- 证据角色：auxiliary plaster or wall-surface reference
- 世界包围盒尺寸：`[100.0, 100.000015, 100.000015]` m
- PCA 主轴尺寸：`[100.001345, 133.325356, 133.324469]` m
- 顶点/索引/三角形：`38961` / `230400` / `76800`
- 退化三角形/索引边界边/焊接后边界边：`0` / `1120` / `0`
- 索引非流形边/焊接后非流形边：`0` / `0`
- 节点/网格实例/网格/图元：`5` / `1` / `1` / `1`
- UV 集：`['TEXCOORD_0']`
- 材质/纹理/图像：`1` / `3` / `3`
- 扩展：used=`[]` required=`[]`
- 异常：
  - 未发现结构异常

## 可进入蒸馏的事实

- 每个文件的世界尺寸、长宽高比例、顶点量、三角形量、UV 集和材质槽结构。
- 轮廓与缺损的几何统计，可用于推导 BrickDNA 的范围和分布。
- 源资产的作者、许可和来源，只用于证据追踪。

## 暂停进入母体的内容

- 原图像、原贴图像素和扫描噪点。
- 仅由文件名推断的材料身份。
- 缺少真实标尺确认时的绝对尺寸。
- 带非商业限制资产的可再分发内容。

## 下一门禁

用中性材质渲染六个参考几何的固定正面、侧面和顶面，叠加统一标尺。完成视觉确认后，再把边角半径、缺口尺度谱、孔洞形状和面部起伏蒸馏为 BrickDNA 参数范围。
