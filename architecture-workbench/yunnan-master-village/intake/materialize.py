"""Materialize a hash-verified source handoff, then finalize a complete ZIP.
Only writes inside architecture-workbench/yunnan-master-village.
"""
from pathlib import Path, PurePosixPath
import argparse,base64,hashlib,json,lzma,os,re,shutil,zipfile
ROOT=Path(__file__).resolve().parent.parent
I=ROOT/'intake';V=ROOT/'versions/v0.15.0'
H='Yunnan_Master_and_Village_V0.15.0.html'
ARCHIVE='Yunnan_Master_and_Village_V0.15.0_Full_Restart_2026-09-05.zip'
sha=lambda b:hashlib.sha256(b).hexdigest()

def put(p,data):
 p.parent.mkdir(parents=True,exist_ok=True)
 p.write_bytes(data if isinstance(data,bytes) else data.encode('utf-8'))

def materialize(vendor_path,inline_path):
 index=json.loads((I/'payload.index.json').read_text())
 parts=[]
 for row in index['parts']:
  data=(I/row['file']).read_bytes()
  assert len(data)==row['bytes'] and sha(data)==row['sha256'],row['file']
  parts.append(data)
 packed=base64.b64decode(b''.join(parts),validate=True)
 assert sha(packed)==index['compressed_sha256'] and len(packed)==index['compressed_bytes']
 raw=lzma.decompress(packed);assert len(raw)==index['decompressed_bytes']
 files=json.loads(raw);assert len(files)==index['files']
 meta=json.loads(files['transport/vendor_expected.json'])
 if inline_path:
  inline=Path(inline_path).read_text(encoding='utf-8')
 else:
  source=Path(vendor_path).read_text(encoding='utf-8')
  m=re.search(r'\bexport\s*\{',source);assert m
  body=source[:m.start()].strip()
  assert sha(body.encode())==meta['body_sha256']
  inline=meta['prefix']+body+meta['body_suffix']+files['transport/three_exports.txt']
 assert sha(inline.encode())==meta['inline_sha256']
 for name,text in files.items():
  path=PurePosixPath(name)
  assert not path.is_absolute() and '..' not in path.parts and path.suffix.lower() not in ['.ttf','.otf','.woff','.woff2']
  if name.endswith('.html'):
   assert text.count('@@INLINE_THREE_R162@@')==1
   text=text.replace('@@INLINE_THREE_R162@@',inline)
  put(V/name,text)
 assert sha((V/H).read_bytes())==index['html_sha256']
 assert sha((V/'baseline/Yunnan_Master_and_Village_V0.14.0.html').read_bytes())==index['baseline_sha256']
 put(V/'tools/restart_check.py',(I/'restart_check.py').read_bytes())
 put(V/'qa/restart/INTAKE_VERIFICATION.json',json.dumps({'payload_sha256':index['compressed_sha256'],'html_sha256':index['html_sha256'],'baseline_sha256':index['baseline_sha256'],'payload_files':index['files'],'source_commit':os.environ.get('GITHUB_SHA'),'original_media_in_public_package':False},ensure_ascii=False,indent=2))
 print('MATERIALIZED',V,'HTML',sha((V/H).read_bytes()))

def finalize():
 report=json.loads((V/'qa/restart/report.json').read_text())
 assert report['pass'] and report['rebuild_byte_identical']
 # Preserve original QA separately. Fresh evidence is never represented as the original PNG bytes.
 put(V/'evidence/README.md','''# 冷启动截图\n\n本目录图片由相同 V0.15.0 HTML 在本次归档冷启动中重新截取。它们属于新证据。\n原交付截图的指纹见 qa/ORIGINAL_DELIVERY_INVENTORY.json；完整原交付包仍作为本地基线保存。\n本次截图指纹见 MANIFEST.json，运行资产不依赖这些图片。\n''')
 files=[]
 for p in sorted(V.rglob('*')):
  if p.is_file() and p.name not in ['MANIFEST.json','SHA256SUMS.txt'] and '__pycache__' not in p.parts:
   b=p.read_bytes();files.append({'path':p.relative_to(V).as_posix(),'bytes':len(b),'sha256':sha(b)})
 manifest={'schema':'yunnan-master-full-handoff-v1','version':'0.15.0','archive_date':'2026-09-05','source_commit':os.environ.get('GITHUB_SHA'),'runtime':H,'runtime_sha256':sha((V/H).read_bytes()),'file_count':len(files),'files':files,'approvals':{x:False for x in ['measurementTruthApproved','constructionTruthApproved','historicReconstructionApproved','visualApproved','productionApproved']}}
 put(V/'MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2))
 put(V/'SHA256SUMS.txt','\n'.join(r['sha256']+'  '+r['path'] for r in files)+'\n'+sha((V/'MANIFEST.json').read_bytes())+'  MANIFEST.json\n')
 packages=ROOT/'packages';packages.mkdir(exist_ok=True);archive=packages/ARCHIVE
 with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for p in sorted(V.rglob('*')):
   if p.is_file() and '__pycache__' not in p.parts:
    zi=zipfile.ZipInfo('Yunnan_Master_and_Village_V0.15.0_Restart/'+p.relative_to(V).as_posix(),date_time=(2026,9,5,0,0,0));zi.compress_type=zipfile.ZIP_DEFLATED;zi.external_attr=0o100644<<16
    z.writestr(zi,p.read_bytes())
 with zipfile.ZipFile(archive) as z:assert z.testzip() is None
 receipt={'version':'0.15.0','archive':ARCHIVE,'archive_bytes':archive.stat().st_size,'archive_sha256':sha(archive.read_bytes()),'html':H,'html_sha256':manifest['runtime_sha256'],'included_files':len(files)+2,'original_delivery_bytes_preserved_for_code':True,'fresh_evidence':True,'cold_start_passed':True,'public_site_deployed':False,'branch':'feature/yunnan-component-studio-v1','pr_number':13,'source_commit':os.environ.get('GITHUB_SHA')}
 put(packages/(ARCHIVE+'.sha256'),receipt['archive_sha256']+'  '+ARCHIVE+'\n')
 put(ROOT/'CURRENT.json',json.dumps(receipt,ensure_ascii=False,indent=2))
 put(ROOT/'RESTART_START_HERE.md','''# 小李：云南建筑生产线重启\n\n当前冻结版本：V0.15.0。\n\n先读取 `CURRENT.json` 核对压缩包及 HTML 指纹，再读取 `versions/v0.15.0/RESTART_START_HERE.md`。\n完整包位于 `packages/'''+ARCHIVE+'''`。\n单文件工作台位于 `versions/v0.15.0/Yunnan_Master_and_Village_V0.15.0.html`。\n归档保留施工骨架、知识、原始 QA、基线、重建源码与冷启动证据。\n下一轮从此基线继续，禁止覆盖旧快照或把未核准的测量与历史信息升级为真值。\n只在 `feature/yunnan-component-studio-v1` 分支工作，PR #13 保持 Draft、open、未合并；不修改 main、gh-pages、Brick Mother 冻结资产和其他生产线。\nGitHub 归档与公开网站部署分开记录。此包未宣布公网部署。\n''')
 print(json.dumps(receipt,ensure_ascii=False,indent=2))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--vendor');p.add_argument('--inline-vendor');p.add_argument('--finalize',action='store_true');a=p.parse_args()
 if a.finalize:finalize()
 else:
  assert a.vendor or a.inline_vendor,'Provide pinned vendor source'
  materialize(a.vendor,a.inline_vendor)
