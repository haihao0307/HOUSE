#!/usr/bin/env python3
"""Build only the architecture-workbench directory. Never rewrite legacy assets."""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil
from pathlib import Path

BASE='bcaee173302f224051711f223d8f9e40b98ae73a'
APP='yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local'
HERE=Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,obj):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def strict_json(s):
 def pairs(values):
  obj={}
  for k,v in values:
   if k in obj:raise ValueError('duplicate key: '+k)
   obj[k]=v
  return obj
 return json.loads(s,object_pairs_hook=pairs,parse_constant=lambda x:(_ for _ in ()).throw(ValueError(x)))

METHOD=[
 ('共同世界观与边界','对象涵盖形态、结构、材料、环境与历史。已知机制、近似模型、艺术化示意与未知因素分别标记。共同原则的改变需要审批。'),
 ('一个对象的统一定义','S(t) 保存对象状态；Render 只负责观察。对象身份、版本、种子、初始条件、事件历史、求解设置和来源锁共同决定可复现结果。'),
 ('先建立因果关系，再安排细节','先表达驱动场、边界与过程状态，再派生多个输出。共享原因不等于把一张噪波原样复制到所有通道。过程的单位、尺度、校准与失效条件需要声明。'),
 ('形态、结构与材质协同生成','轮廓、厚度、深孔、缝隙和遮挡需要对应表示方式。母体保存生成知识，孩子保存独立身份和经历，局部修改不能污染家族默认值。'),
 ('噪波的统一使用规范','噪波控制量、单位、坐标、空间尺度、时间相关性、范围、来源与不确定性必须明确。种子由稳定对象和过程命名空间派生，禁止逐帧重置。'),
 ('时间是状态演化的输入','physicalTime、solverStep、displayTime 分开。快放不改变物理过程。损伤独立持久保存，回退通过重放或检查点恢复，未标定年龄清楚标作示意。'),
 ('Landscape Mother 的专门边界','原始 DEM、来源身份、单位与原生间距保持锁定。源真值、推导层和近景程序细节分开。本建筑窗口仅登记这条跨线边界，不改动地形线。'),
 ('从 Substance 3D Designer 蒸馏方法','学习可复用算子、参数暴露、方向与幅度控制、继承隔离及分层诊断。教程先做最小复现和本领域适配，再记录测试和限制。'),
 ('Brick Mother 知识交换的当前证据','原文记录的是当时 PR #15 的元数据快照；正文引用的旧 head 与实际 head 分开。跨窗口交换依靠版本文件与回执，不能由聊天承诺代替。'),
 ('统一展示与灯光体系','同一对象提供中性检查、工作室打光、诊断。主光、辅光、轮廓光独立控制。展示不得改写对象源状态；公开入口需要真实访问和构建身份。'),
 ('所有 Mother 的统一生产步骤','先读本线最新交接、仓库和领域约束，再保存基线；定义对象、结构、环境、历史和产物，三模式检查后交由用户判断。只在授权范围工作。'),
 ('JSON 硬性控制的层次','文档、JSON/Schema、运行时语义校验共同存在。固定共同规则与领域参数分离。保存文件不能代替接入。官方 Schema 和校验器当前仍待接收。'),
 ('运行时与视觉验收清单','检查原因关闭、家族隔离、历史重放、帧率一致、源真值、边界与三模式。桌面和移动端分别验证，缺失或跳过不能汇总为通过。'),
 ('给其他 Mother 与 Codex 的接入指令','先核对本线状态，不立即大范围改代码。最小对象闭环需要真实代码、当前构建测试和回执；人工批准继续为 false，冻结资产不自动再生成。'),
 ('本次实际交付状态','原文只说明方法文件、JSON、Schema和校验器的交付及当地28项配置检查。它未证明任何接收仓库完成运行接入。本工作台不继承那些测试结论。'),
 ('来源与适用说明','外部资料只支撑原文对应的技术事实；世界观、治理、接口与灯光建议属于本项目设计。参数示例不自动成为已标定的自然定律。'),
 ('最终共同原则','先定义对象和真实约束，再定义原因、关系与历史。让变化进入完整状态，让展示呈现结果，让证据决定是否通过。母体与孩子分别保存知识与经历。')]
CN_TITLES={
 'YN-LIT-1992-NAXI-01':'纳西居住与建筑技术调查（一）',
 'YN-LIT-1994-NAXI-02':'纳西、摩梭与普米调查（二）',
 'YN-LIT-1999-DALI-RENLIYI':'大理仁里邑住生活与住宅空间',
 'YN-LIT-1999-MENGLIAN-DAI':'云南孟连傣族住居空间',
 'YN-LIT-2023-LEJU-YIKEYIN':'昆明乐居村一颗印与新住宅',
 'YN-LIT-2026-SHIPING-HEYUAN':'石屏古城合院的居住与改修',
 'YN-LIT-2024-BAI-TIMBER-HBIM':'白族传统木构参数化 HBIM',
 'YN-LIT-2023-COURTYARD-SPATIAL-DATABASE':'云南合院空间数据库',
 'YN-LIT-2025-DIQING-TUSI-MANORS':'迪庆土司庄园建筑形制'}
USES={
 'YN-LIT-1992-NAXI-01':('地区背景、住宅个案与术语线索','建筑细节不足，不单独决定构件尺寸或节点。'),
 'YN-LIT-1994-NAXI-02':('永宁住居、家族与空间关系','局部平剖只作案例线索，书目年份口径继续待核。'),
 'YN-LIT-1999-DALI-RENLIYI':('白族房间使用、方位与住宅更新','住生活研究不替代木构测绘与材料记录。'),
 'YN-LIT-1999-MENGLIAN-DAI':('傣族住宅的空间层级与地区比较','保持背景资料身份，不推广为全云南构造。'),
 'YN-LIT-2023-LEJU-YIKEYIN':('39栋新住宅与传统空间的延续、改变','样本建造于1972至2021年，不能直接当作1940年代真值。'),
 'YN-LIT-2026-SHIPING-HEYUAN':('合院使用、所有与后期加建的辨认','重点是当代变化，原始构造仍需个案资料。'),
 'YN-LIT-2024-BAI-TIMBER-HBIM':('对象、属性、关系、方法与装配组织','参数化模型不证明真实榫卯、尺寸精度或历史准确性。'),
 'YN-LIT-2023-COURTYARD-SPATIAL-DATABASE':('19项字段和CAD/GIS编号关联','仅收到论文；432套原始测绘未取得，比例定义不可混用。'),
 'YN-LIT-2025-DIQING-TUSI-MANORS':('迪庆土司庄园的地区和案例比较','限定土司庄园；第12页层高表文矛盾仍待核，重复上传不加证据权重。')}
DIST=[('间数与用途','结构间数、房间数量、房间用途分别记录。'),('方向与尺寸','面阔轴距、进深分段、构件外包与通行净尺寸分别记录。'),('墙体与显示','真实墙体主体、有证据的材料分层、辅助显示背板分别记录。'),('年代与状态','建造、测绘拍摄、修缮加建、目标表现年代分别记录。'),('材料身份','土坯、夯土、烧结砖、石材、砌缝材料与抹灰分别认识。'),('资料与批准','收存、阅读、运行验证、视觉批准、生产批准分别登记。')]

def build(app:Path, repo:Path|None=None):
 if repo is not None:
  docs=repo/"reference-library/yunnan/blueprint-v1"
  content="\n\n".join((docs/n).read_text(encoding="utf-8") for n in ["README.md","MOTHER_LINE_CONNECTIONS.md","SOURCES_AND_CASES.md"])
  (HERE/"knowledge").mkdir(exist_ok=True)
  (HERE/"knowledge/BLUEPRINT_V1.md").write_text(content,encoding="utf-8")
 system=read(app/'data/system_v5_2_1.json'); registry=read(app/'component-studio/data/knowledge/yunnan-architecture-literature-registry-v1.json');modules=read(app/'component-studio/data/modules.json')['modules']
 policy= strict_json((HERE/'data/MOTHER_UNIFIED_POLICY_V1.0.0.json').read_text());assert policy['version']=='1.0.0'
 records=[]
 for rec in registry['records']:
  r=dict(rec);r['displayTitle']=CN_TITLES.get(r['id'],r['title']);r['useSummary'],r['limitSummary']=USES.get(r['id'],('支持资料','用途待核'));records.append(r)
 topics=[{'id':x['id'],'title':x['name'],'question':x['question'],'output':x['output'],'source':'原系统 data/system_v5_2_1.json · logicOrder'} for x in system['logicOrder']]
 snapshot={'version':'0.1.0','knowledgeFrameworkVersion':'1.0.0','basisCommit':BASE,'methodologySource':'用户提供 MOTHER_UNIFIED_EVOLUTION_METHOD_V1.0.0(1).md','methodologyRepresentation':'17节内容提要和§12.1规则转存；原MD字节未取得，不伪造原件哈希','topics':topics,'records':records,'modules':modules,'methodSections':[{'number':i+1,'title':a,'summary':b} for i,(a,b) in enumerate(METHOD)],'distinctions':[{'title':a,'text':b} for a,b in DIST],'sourceGradesChanged':False,'visualApproved':False,'productionApproved':False}
 dump(HERE/'data/knowledge-snapshot.json',snapshot)
 deps=['vendor/three/three.module.js','vendor/three/controls/OrbitControls.js','threejs/YunnanCourtyardProduction.js','threejs/YunnanMaterialFactory.js','threejs/v544/YunnanMaterialFactory.js','threejs/YunnanWallSurfaceSystem.js','threejs/YunnanRoofSurfaceSystem.js','threejs/YunnanSurfaceProfiles.js','data/production/yunnan_surface_weathering_seed_v5_5_0.json']
 manifest={'workbenchVersion':'0.1.0','blueprintFrameworkVersion':'1.0.0','policyVersion':'1.0.0','policyState':policy['policyState'],'sourceCommit':os.environ.get('GITHUB_SHA',BASE),'repository':'haihao0307/HOUSE','branch':'feature/yunnan-component-studio-v1','runId':os.environ.get('GITHUB_RUN_ID'), 'legacySourceCommit':'b1bacf6040dfde8acd223234c24325e5b494c993','basePublicationRun':33460600944,'scope':'architecture-workbench-only','policySha256':digest(HERE/'data/MOTHER_UNIFIED_POLICY_V1.0.0.json'),'officialSchemaSha256':None,'officialValidatorSha256':None,'methodologyOriginalSha256':None,'localGuardVersion':'0.1.0','coreRulesChanged':False,'evolutionRuntimeIntegrated':False,'threeModeViewerImplemented':True,'crossMotherRuntimeIntegrated':False,'visualApproved':False,'productionApproved':False,'dependencies':[{'path':p,'sha256':digest(app/p)} for p in deps], 'sourceRegistrySha256':digest(app/'component-studio/data/knowledge/yunnan-architecture-literature-registry-v1.json'),'sourceSystemSha256':digest(app/'data/system_v5_2_1.json'),'blueprintHandoffSha256':digest(HERE/'knowledge/BLUEPRINT_V1.md')}
 dump(HERE/'data/build.json',manifest)
 paths=[p for p in HERE.rglob('*') if p.is_file() and '__pycache__' not in str(p) and '/evidence/' not in str(p) and p.name!='file-manifest.json']
 dump(HERE/'file-manifest.json',{'version':'0.1.0','files':{str(p.relative_to(HERE)):digest(p) for p in sorted(paths)}})
 print(json.dumps({'built':str(HERE),'topics':len(topics),'references':len(records),'modules':len(modules),'sourceCommit':manifest['sourceCommit'],'policySha256':manifest['policySha256']},ensure_ascii=False))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--app-root',type=Path,required=True);parser.add_argument('--repository-root',type=Path);args=parser.parse_args();build(args.app_root,args.repository_root)
