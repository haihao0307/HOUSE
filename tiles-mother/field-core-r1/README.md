# Tiles Mother 原生场 R1

2026-09-06。按用户明确的从头重做授权建立独立候选，并按用户补充的 Macroscopic microscope 方法收敛。打开 START_HERE.html；源码 material.js 中的 microCell/microSpectrum 有独立强度与开关，可同机位观察宏观显微层。新程序不加载、补丁修改或依赖旧版Tiles业务代码，V0.9.11及更早恢复文件保留。

实现为自己的FieldCore、FieldGeometry、FieldMaterial、应用控制和一份HTML模板。第三方平台为Three.js r180及随包fflate，许可在reference/LICENSE_NOTICE.md。物体没有UV属性，没有图像颜色图或法线贴图采样；几何法线与函数解析梯度仍作为数学方向参与WebGL光照。没有宣称零GPU、零几何或替代所有图形学。

source/material.js从Macroscopic microscope提炼有限的多尺度复合三角函数子表达，按材料坐标、固定相位、方向、幅度与范围重组；仅保留三个受预算限制的层级，不移植原作完整径向世界、raymarch、发光或动画。陶瓦、木纤维、苔团使用独立材料配方，不能把一个灰度无差别复制到所有通道。宏观显微层开关不改几何、支承或损伤快照，碎片继承母体材料坐标。

瓦片是封闭薄壳与独立暖土胎断面；木材有方向纤维、局部细裂及非平面端口；苔团使用不规则极坐标轮廓、渐薄边界和真实几何，无矩形裁切。但木断口仍是形态试件，未求解真实断裂扩展；苔团及微细表面真实感仍需实物审阅。

三片、木材试件、48片截取、860片屋面都可交互。860片为440板瓦+420筒瓦；新48片为L形截取27+21，和旧24+24构型不同。筒瓦纵向相位向檐口偏移45mm属于新装配候选，未标为地方实测。统一18×6固定瓦壳模板，720三角形，小样和屋面不按相机距离切换LOD。光照改为新的解析近似，未恢复旧实时阴影/环境贴图，故新旧耗时不能作为同画质纯优化比较。

0至15年为用户指导的潮湿失养情景；快照配方给3年初期漏瓦、5年增加、7年明显损失、10年严重失支。椽与梁失效会影响所托瓦。当前没有中途修复事件账本、材料物性标定或碎片地面堆积，不能把几何移除说成完整物理坍塌。

python tools/build.py从当前源码和独立reference/runtime.b64重建。bootstrap_vendor.py仅在第一次缺平台库时从已校验冻结HTML提取第三方脚本，提取后不再需要旧HTML。运行node qa/math.cjs、node qa/geometry.cjs、node qa/contact.cjs；qa/file_smoke.py独立验证file协议入口。自动通过不产生人工接受。

## 读取来源

小妈固定提交5fddf3c8504fbc86c85bcde33307bb39b089c4d0，docs/mother_coordination/learning-r1-20260905下FUNCTION_LESSON_01.md、DISTILLATION_CORE.md、FUNCTION_APPLICATION_MAP.md、references/MACROSCOPIC_MICROSCOPE_ROCK_DETAIL.md。

原作者Yohei Nishitsuji，2025-02-18文章Macroscopic microscope小节及作者Art页已直接读取：
https://tympanus.net/codrops/2025/02/18/rendering-the-simulation-theory-exploring-fractals-glsl-and-the-nature-of-reality/
https://yoheinishitsuji.com/art

本线吸收数学组织方法并自写实现，没有运行原作品或推定整件作品许可。小妈独立审阅仍待回复。实际完成范围及未过性能门槛见FINAL_STATUS.json、DELIVERY_STATUS.md。无公网部署，无生产批准。
