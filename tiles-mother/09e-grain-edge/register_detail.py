from pathlib import Path
import json
H=Path(__file__).parent
K=Path('G:/小妈/知识体系')
section='''

## 2026-10-24 · 09B 檐口身份与细节修订

用户重发L9副本、L8、L5、L4后重新逐图核查。L9与副本SHA256一致（fa9c890e77299c0c2c80c00a149b96c1cd97e0cfcfe5e882c9ebfa568e2ba1eb），不是第二份独立证据。文件序号与原书图号分开：L8含图7刘姓祠堂原状图及图8响应寺大殿游椿及彩画；L4/L5的孟宅仍独立。

1. 三种勾头分别连筒瓦端；两种滴水连板瓦下端；圆钱贴护椽头，用中心钉孔固定。圆钱不能再作为筒瓦端头的同类替代。L9上方圆钱及钉孔字样与用户指认相互支持；直径、厚度、钉长与背面均未实测。遮护端木不能推出绝对防水、防腐或免维护。
2. 09B的勾头/滴水与载瓦为同一闭合边界；重叠接合区去除内部盖面。浮雕为原图墨线控制的连续压印高度面，不是悬浮泥条；这种显示方法不证明原件深度。圆钱有真实孔，钉与木椽为独立对象。
3. 默认无望板的展示方案为挂瓦条及局部灰座，可切换望板与连续灰背；支承方案及尺寸仍为研究假设，不能仅由线稿确定为当地通例。砖作有灰缝是用户要求的变体，不能覆盖L9“小丁走”旁“不用泥巴”的图注。
4. L8登记六种不同梁架，另建游椿条目。原题“三柱六架七桁”当前只可靠定位六个圆截面，第七位置为null，不能为凑数添加无支承檩。平面像素用于比例观察，不是测量误差已知的现场尺寸。显示进深0.8 m不能推成完整开间。梁架目前为木架剖面研究，花饰外形与所有榫眼尚未完整复刻。
5. 图8梁枋上的三道原图墨线与门洞里独立彩画样式分开；黑白线稿不能推出历史彩色。门上标“格子门（拆除）”，不把内嵌样式图误装为一扇真实复合门。
6. 木材沿保留PBR母体取粗/中纹理与裂纹场进入真实位移，端面与接头附近收敛。颜色、法线及几何共用参考架；浏览器GPU读回为实际采样证据，Node无GPU分支不能当同等验证。

实现：`G:/HOUSE/tiles-mother-09b-detail-20261024`。08D、09、09A保持原状。当前不是全图精确复刻、结构计算、自然风雨验证或用户视觉接受；公网交付状态以09B的PUBLISH_RECEIPT及PUBLIC_*检查为准。
'''
topic=K/'研究/瓦作材料构件与连接知识库.md'
t=topic.read_text(encoding='utf-8')
t=t.replace('首轮已完成六图关系索引、共同材料/三类定义、必备小头规则及未知项。尚未完成全图尺寸抄录、地区形制定名、精确曲面、实体接触、渲染实现或结构验证。','首轮完成关系索引；截至09B已实现研究渲染及部分薄壳/接触检查（详见下方版本记录）。全图尺寸抄录、地区形制定名、完整精确复刻与结构验证仍未完成。')
if '## 2026-10-24 · 09B 檐口身份' not in t:t+=section
topic.write_text(t,encoding='utf-8')
regional=K/'研究/地域建筑构造体系.md'
t=regional.read_text(encoding='utf-8').replace('当前45项目录的 geometry 均为 null、replica_status 均为 not_implemented。','初始45项目录曾均未实现；截至09B，已关联各版研究对象与检查，未证实完整形体仍保留null，不将显示模型升级为精确复刻。')
if '09B檐口身份' not in t:t+='\n\n09B檐口身份及L8梁架/游椿修订见《瓦作材料构件与连接知识库》同日章节。勾头—筒瓦、滴水—板瓦、圆钱—椽头必须保留三种载体，刘姓祠堂、响应寺、孟宅不可合并。\n'
regional.write_text(t,encoding='utf-8')
queue=K/'学习队列.md';t=queue.read_text(encoding='utf-8')
if 'SL-YUNNAN-ARCH-LIB-1024 / 09B' not in t:t+='\n2026-10-24 SL-YUNNAN-ARCH-LIB-1024 / 09B：已修订圆钱钉孔及三载体、区分L8文件号和图7/8、加入六梁架与游椿研究并保留彩画样式边界；继续缺口为第七桁定位、雕饰侧背深度、全部榫卯与基层实证。不得把未知项补成事实，不新建调度。\n'
queue.write_text(t,encoding='utf-8')
log=K/'学习运行记录.md';t=log.read_text(encoding='utf-8')
if '09B 檐口身份与细节修订' not in t:t+=section
log.write_text(t,encoding='utf-8')
p=K/'研究/瓦作关系库.json';data=json.loads(p.read_text(encoding='utf-8'))
data['detail09B']={'directory':str(H),'sourceL8':'references/L8.jpg','cases':['刘姓祠堂','响应寺','孟宅保持独立'],'end_carriers':{'three_goutou':'cover tile','two_drips':'pan tile','round_coin':'rafter end with central nail'},'frame7_unlocated_purlin':None,'depth_backside_error':None,'historical_verified':False,'user_visual_accepted':False}
p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
(H/'LEARNING_UPDATE.md').write_text(section,encoding='utf-8')
print('Updated topic, region, queue, run log, relation library; no Codex memory modified')
