# 复用函数短回执（09C未验收）

2026-10-24，09B未获用户接受；09C仍在检查，不得提升为母函数定稿。

- 08D圆弧壳与微形态：G:/HOUSE/tiles-mother-08d-20260914/START_HERE.html 中 tilePoint / tileN / ceramic。后续09C以 tilePoint08D 保留其旧函数，调用点在 repair.js 的 tilePoint。08D没有独立小头。
- 独立小头：G:/HOUSE/tiles-mother-09c-source-rebuild-20261024/repair.js 中 tilePoint、tileN、shellMesh；依赖 STUDY、spec、PROFILE、ACTIVE_COVER、tilePoint08D、ceramic、allSurfaceOffset、tileHand、Mesh 与数学工具。spec在study.js。不是可以只复制单个函数就运行的独立模块。
- 法向厚度：08D ceramic沿tileN偏移生成内外壳；09C先保留这一构造，再沿shellMesh/apply微形态变形。显示缓冲不作持久对象身份。
- 当前木纹恢复入口：wood_restore09c.py 适配已打包START_HERE.html；确切源为 G:/HOUSE/tiles-mother-measured-09-20261024/START_HERE.html 的轴向场，CPU wood09Noise及颜色/法线共用局部木材参考架。该脚本说明内的恢复来源比“PBR木材”泛称更精确。不要采用09B warm preset作为用户要求恢复的配方。
- 木材几何入口 woodBox / woodRound / woodProfile 位于最终START_HERE.html；原木材母体vendor快照在文件夹内保留，但其暖色着色路径已不是09C当前恢复的显示配方。
- 暂缓：09B压印接头、09C未测厚度/背面、D7与L9显示截面、L7脊部假设，不得替代七层塔或福冈瓦已验证实形。D7/L9是两组不同来源，不能当通用瓦形。
- 09C没有正式独立API包；最终页面为打包程序。需要独立模块化时应显式提取依赖并另做验证，不能把HTML内部函数名称为已经发布的稳定接口。
