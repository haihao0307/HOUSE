from pathlib import Path
import json
here=Path(__file__).parent
p=Path('G:/小妈/知识体系/研究/瓦作关系库.json')
d=json.loads(p.read_text(encoding='utf-8'))
catalog=json.loads((here/'OBJECT_DEFINITIONS.json').read_text(encoding='utf-8'))['catalog']
for part in d['parts']:
    ids=[c['id'] for c in catalog if part['id'] in c['parts']]
    if ids:
        part['replica_status']='provisional_3d_study_not_faithful_replica'
        part['geometry']={'rule_file':str(here/'study.js'),'definitions_file':str(here/'OBJECT_DEFINITIONS.json'),'catalog_ids':ids,'version':'09','mesh_is_disposable':True}
        part['dimensions_verified']=False
d['comparison']['D7']['cover_height_1_cm']=3.5
d['comparison']['D7']['height_1_note']='2026-10-24局部放大后由旧暂读5.5更正为暂读3.5；仍非独立测量'
d['completion']['provisional_3d_study']=True
d['completion']['faithful_3d_replication']=False
d['completion']['all_dimension_transcription']=False
d['versions']=[{'id':'09','directory':str(here),'catalog_count':38,'status':'research_preview_not_accepted_production','baseline_08D_unchanged':True}]
p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
note=Path('G:/小妈/知识体系/研究/瓦作材料构件与连接知识库.md')
s=note.read_text(encoding='utf-8')
heading='## 2026-10-24 · 09研究模型接续'
if heading not in s:
    s+='\n\n'+heading+'\n\n已建立38条可旋转研究条目，路径 `G:/HOUSE/tiles-mother-measured-09-20261024`。关系库已关联规则与对象定义；不再是全部未实现状态，但未提升为精确复刻或生产接受。D7的H1经局部放大暂读3.5cm，替代此前暂读5.5cm，仍待核。圆瓦当侧图尺寸对应尚未求解，脊饰目前是图示轮廓的深度示意而非圆雕复原；屋面/木瓦接触尚未验收。08D保持原状。\n'
    note.write_text(s,encoding='utf-8')
print('Updated geometry links for',sum(bool(x['geometry']) for x in d['parts']),'parts; faithful replication remains false.')
