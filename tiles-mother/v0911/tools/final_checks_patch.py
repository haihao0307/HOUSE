"""Idempotent refinement of scenario meaning and specimen surface comparison."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'source/field_geometry.js';s=p.read_text()
s=s.replace("const years=state.year,seed=state.seed,kind=", "const years=state.care==='maintained'?0:state.year,seed=state.seed,kind=")
s=s.replace(":waveMaterial(kind,1,state.initialAge+years),m=new THREE.Mesh", ":studyClayMaterial(kind,1,state.initialAge+state.year),m=new THREE.Mesh")
s=s.replace("fieldLabReport={year:years,tile:","fieldLabReport={year:state.year,exposureYears:years,care:state.care,tile:")
s=s.replace('state.initialAge+years','state.initialAge+state.year')
p.write_text(s)
p=root/'source/wave_material.js';s=p.read_text()
s=s.replace("fieldTileDemand(m.userData.waveKind||'pan',state.year,state.seed,state.rainInput,state.loadFactor)","fieldTileDemand(m.userData.waveKind||'pan',state.care==='maintained'?0:state.year,state.seed,state.rainInput,state.loadFactor)")
p.write_text(s)
p=root/'qa/browser.py';s=p.read_text()
if 'actualPairAudit' not in s:
 s=s.replace("   d=snap(name,view);q=d['roof']['contacts'];", "   d=snap(name,view);d['actualPairAudit']=page.evaluate((root.parent/'v099/qa/audit_runtime.js').read_text());assert not d['actualPairAudit']['penetrations'] and not d['actualPairAudit']['geometryFailures'],d['actualPairAudit'];q=d['roof']['contacts'];")
if '16_maintained_lab' not in s:
 s=s.replace("  report['functionalPassed']=True;report['performanceGatePassed']=False", """  page.set_viewport_size({'width':1440,'height':960})
  d=snap('16_maintained_lab',{'scene':'fracture','specimen':'both','year':10,'care':'maintained','waveSurface':True})
  assert d['field']['exposureYears']==0 and not d['field']['tile']['failed'] and not d['field']['wood']['failed'],'maintenance scenario wrongly aged as neglected'
  a=snap('17_fracture_legacy',{'scene':'fracture','specimen':'tile','year':8,'care':'abandoned','waveSurface':False,'mossEnabled':False})
  bb=snap('18_fracture_wave',{'scene':'fracture','specimen':'tile','year':8,'care':'abandoned','waveSurface':True,'mossEnabled':False})
  assert a['perf']['renderer']['triangles']==bb['perf']['renderer']['triangles']
  from PIL import ImageChops
  assert ImageChops.difference(Image.open(out/'17_fracture_legacy.png').convert('RGB'),Image.open(out/'18_fracture_wave.png').convert('RGB')).getbbox(),'surface switch did not change rendered appearance'
  snap('19_roof_fifteen',{'scene':'roof','year':15,'care':'abandoned','waveSurface':True,'mossEnabled':True})
  report['functionalPassed']=True;report['performanceGatePassed']=False""")
p.write_text(s)
print('maintenance comparison and specimen material switch connected; tests extended')
p=root/'qa/performance.py';s=p.read_text()
s=s.replace('if(query)g.endQuery(ext.TIME_ELAPSED_EXT);','if(query){g.endQuery(ext.TIME_ELAPSED_EXT);g.flush();}')
s=s.replace('performance.now()+10000','performance.now()+5000')
p.write_text(s)
