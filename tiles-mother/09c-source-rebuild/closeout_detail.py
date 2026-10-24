from pathlib import Path
import json
H=Path(__file__).parent;K=Path('G:/小妈/知识体系')
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
receipt=read(H/'PUBLISH_RECEIPT.json');browser=read(H/'PUBLIC_BROWSER_QA.json');detail=read(H/'PUBLIC_DETAIL_BROWSER_QA.json')
assert browser['url']==receipt['public_preview'] and detail['url']==receipt['public_preview']
assert len(browser['entries'])==49 and not browser['errors'] and not browser['responses'] and all(not e['glError'] and '09B' in e['caption'] for e in browser['entries'])
assert detail['pass'] and browser['mobile']['sourceLoaded'] and not browser['mobile']['overflow']
receipt['public_browser_verified']=True;receipt['public_catalog_count']=49;receipt['public_core_interactions_verified']=['catalog selection','source images','mobile layout','deck on/off','underside view']
(H/'PUBLISH_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
p=K/'研究/瓦作关系库.json';d=read(p)
for part in d['parts']:
 g=part.get('geometry')
 if isinstance(g,dict) and g.get('version')!='09B':
  part.setdefault('geometry_history',[]).append(g)
  part['geometry']={**g,'version':'09B','rule_file':str(H/'study.js'),'repair_rule_file':str(H/'repair.js'),'detail_rule_file':str(H/'detail.js'),'definitions_file':str(H/'OBJECT_DEFINITIONS.json')}
 if part['id']=='T07':
  part['name']='圆钱 · 椽头护面、花瓣与回纹边';part['carrier']='rafter end';part['fixing']='central nail hole; fastener sizes unknown';part['required_features']=['中心钉孔','放射花瓣','外圈回纹','背面贴护椽端'];part['weatherproof_guarantee']=False
for key in ['刘姓祠堂','响应寺']:
 if key not in d['regions']['云南']['cases']:d['regions']['云南']['cases'].append(key)
d['versions']=[v for v in d['versions'] if v['id']!='09B']+[{'id':'09B','directory':str(H),'catalog_count':49,'status':'detail_research_preview_not_user_accepted','public_preview':receipt['public_preview'],'public_browser_verified':True,'full_historical_replica':False,'full_structural_validation':False}]
d['detail09B']['public_preview']=receipt['public_preview'];d['detail09B']['public_browser_verified']=True
p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['研究/瓦作材料构件与连接知识库.md','学习运行记录.md']:
 p=K/name;t=p.read_text(encoding='utf-8');line='\n09B固定公网预览（49条目、资源和核心交互已在此URL实开复验）：'+receipt['public_preview']+'\n'
 if receipt['public_preview'] not in t:p.write_text(t+line,encoding='utf-8')
print(json.dumps({'public_verified':True,'url':receipt['public_preview'],'entries':49}))
