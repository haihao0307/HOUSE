from pathlib import Path
import json,hashlib
H=Path(__file__).parent
receipt=json.loads((H/'PUBLISH_RECEIPT.json').read_text(encoding='utf-8'))
public=json.loads((H/'PUBLIC_BROWSER_QA.json').read_text(encoding='utf-8'))
repair=json.loads((H/'PUBLIC_REPAIR_QA.json').read_text(encoding='utf-8'))
if public['errors'] or public['responses'] or not repair['pass'] or len(public['entries'])!=39:raise SystemExit('Public browser acceptance incomplete')
receipt['public_browser_verified']=True
receipt['verification']={'entries':39,'webgl_errors':0,'mobile_viewport':[390,844],'real_phone_tested':False,'micro_vertices_moved':repair['micro']['movedVertices'],'joint_void_ray_test':True,'roof_contact_boundary_samples':6,'historical_replica_verified':False}
receipt['html_sha256']=hashlib.sha256((H/'START_HERE.html').read_bytes()).hexdigest()
(H/'PUBLISH_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
library=Path('G:/小妈/知识体系/研究/瓦作关系库.json')
d=json.loads(library.read_text(encoding='utf-8'))
entry={'id':'09A','directory':str(H),'catalog_count':39,'status':'repair_research_preview_not_user_accepted','baseline_08D_unchanged':True,'version_09_preserved':True,'public_preview':receipt['public_preview'],'public_browser_verified':True,'validation_scope':'closed tile shells; sampled roof triangle contacts; actual timber mortise void; browser interaction','full_historical_replica':False,'full_structural_validation':False}
d['versions']=[v for v in d.get('versions',[]) if v.get('id')!='09A']+[entry]
for part in d['parts']:
    old=part.get('geometry')
    if old and old.get('version')=='09':
        part.setdefault('geometry_history',[]).append(old)
        part['geometry']={**old,'version':'09A','rule_file':str(H/'study.js'),'repair_rule_file':str(H/'repair.js'),'definitions_file':str(H/'OBJECT_DEFINITIONS.json')}
    if part['id']=='A02' and part.get('geometry'):
        ids=part['geometry']['catalog_ids']
        if 'joinery' not in ids:ids.append('joinery')
d['updated']='2026-10-24'
library.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
doc=Path('G:/小妈/知识体系/研究/瓦作材料构件与连接知识库.md')
section='''

## 2026-10-24 · 09A回退修复与条件规则

用户指出09的漏面、关闭Microscope几何、瓦片悬空/穿插、木纹坐标错误。09A恢复08D薄壳与17层场，独立小头肩部沿横截面取厚度；不能把拓扑闭合直接等同于无自交，也不能把程序化材质的漏面误判为UV贴反。

瓦间距必须包含薄壳厚度导致的截面外扩；按上口宽摆放会使板瓦底部相穿。屋面接触要使用实际位移后的几何，不能只验未扰动基形。09A按三角投影求纵向搭接与左右支承，六组强度/尺度/来源样本通过；0.05 mm容差和0.5 mm支承阈值是模型验收条件，不是测量误差、施工标准或受力证据。

木材接入已保留的原PBR母体，顺纹参考轴必须随构件方向走，端纹与切口分开。源圆柱的侧面绕序在当前背面剔除模式下与声明法线相反，09A只在接收层修正；保留原材质字段及源文件，不把可用来源代码当作无需检查的正确性证明。宏观表面位移在端部和榫眼周边收敛，切口尺寸不被材质扰动吞掉。

榫卯验证台使用实际空榫眼和缩肩榫头。孔内射线零交点、孔旁实体射线两交点；展示截面相差1 mm。该证据证明模型中有空腔及参数配合，不证明D2/D3/D4/D6原建筑的具体榫型。一般榫卯背景来源为沈阳故宫博物院《古建保护常识》（2023-07-31，https://www.sypm.org.cn/xinwen_2/1.html），不能外推为云南本案节点尺寸。

39条目公网浏览器复验通过，包含底面、拆解、实际顶点变化和390×844布局；未做真手机GPU验收。完整历史构造、雕饰背面/深度、部分尺寸端点与全部次级连接仍未完成验证；08D与09保持原状。09A尚未获得用户视觉接受。

固定预览：PREVIEW_URL
实现与证据：`G:/HOUSE/tiles-mother-09a-repair-20261024`。
'''.replace('PREVIEW_URL',receipt['public_preview'])
text=doc.read_text(encoding='utf-8')
if '## 2026-10-24 · 09A回退修复与条件规则' not in text:doc.write_text(text+section,encoding='utf-8')
print(json.dumps({'public_verified':True,'version':'09A','library_parts':len(d['parts']),'preview':receipt['public_preview']},ensure_ascii=True))
