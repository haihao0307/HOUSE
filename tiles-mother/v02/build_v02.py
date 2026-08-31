"""Rebuild V0.2 from the exact V0.1 procedural core and readable reference sources."""
from pathlib import Path
import argparse,base64,hashlib,json,re
parser=argparse.ArgumentParser();parser.add_argument('--baseline',required=True);parser.add_argument('--runtime',required=True);parser.add_argument('--out',required=True);args=parser.parse_args()
root=Path(__file__).resolve().parent
baseline=Path(args.baseline).read_bytes()
assert hashlib.sha256(baseline).hexdigest()=='87ed9f2e1a4a668f8c85547a959694dab4be0c103e7bc43eb0b93b91f1c5b4ec', 'V0.1 core mismatch'
html=baseline.decode()
html=html.replace("const VERSION='0.1.0';", "const VERSION='0.2.0';")
html=html.replace('V0.1 · 参考待校准','V0.2 · 多格式资料台')
html=html.replace('<title>Tiles Mother · 瓦作与瓷砖实验室</title>','<title>Tiles Mother V0.2 · 模型与瓦作工作台</title>')
html=html.replace('参考图、三维母体、独立种子与可携带的协作记录。','GLB、FBX、多格式参考资料、三维母体与完整协作包。')
html=html.replace('<button id="knowledgeBtn">','<button id="jumpRefs">放入资料</button><button id="knowledgeBtn">',1)
html=html.replace('保存协作记录','保存协作包')
html=html.replace('accept="application/json,.json"','accept="application/json,.json,application/zip,.zip"')
a=html.index('<aside class="rail reference-rail"');b=html.index('</aside>',a)+len('</aside>')
html=html[:a]+(root/'reference-desk.html').read_text()+html[b:]
html=html.replace('</style>',(root/'reference-desk.css').read_text()+'\n</style>',1)
a=html.index('function openDB()');b=html.index('function openModal(',a)
html=html[:a]+(root/'reference-desk.js').read_text()+'\n'+html[b:]
a=html.index(" $('dropzone').onclick",html.index('function wire(){'));b=html.index('\n}',a)
html=html[:a]+' wireReferences();'+html[b:]
html=html.replace("function closeModal(id){$(id).classList.add('hidden');activeModal=null;}","function closeModal(id){$(id).classList.add('hidden');activeModal=null;if(id==='modelModal')restoreModelStage();}")
html=html.replace(".map(r=>({...r,url:URL.createObjectURL(r.blob)}))",'.map(normalizeRef)')
html=html.replace(" document.body.dataset.appInitialized='true';", " attachReferenceAPI();\n document.body.dataset.appInitialized='true';")
html=html.replace('图片和笔记暂留当前页面','原文件和笔记暂留当前页面')
html=html.replace('参考图与工作记录仍可使用。','参考资料与协作包仍可使用。')
html=html.replace('参考图片和笔记会保留。','参考资料和笔记会保留。')
modal='<div class="modal hidden" id="modelModal" role="dialog" aria-modal="true" aria-labelledby="modelModalTitle"><div class="dialog model-dialog"><button class="close small" data-close="modelModal">关闭</button><div class="eyebrow">Reference model / 3D</div><h2 id="modelModalTitle">参考模型</h2><div class="model-dialog-body" id="modelModalBody"></div></div></div>'
html=html.replace('<script id="field-reference">',modal+'\n<script id="field-reference">',1)
runtime=Path(args.runtime)
assert hashlib.sha256((runtime/'reference-runtime.js').read_bytes()).hexdigest()==json.loads((runtime/'manifest.json').read_text())['files']['reference-runtime.js']['sha256']
assets={}
for path in ['vendor/draco/gltf/draco_wasm_wrapper.js','vendor/draco/gltf/draco_decoder.wasm','vendor/basis/basis_transcoder.js','vendor/basis/basis_transcoder.wasm']:
 p=runtime/path;assets[p.name]=base64.b64encode(p.read_bytes()).decode()
injected='<script id="tm-decoder-assets" type="application/json">'+json.dumps(assets,separators=(',',':'))+'</script>\n<script id="tm-reference-runtime">'+(runtime/'reference-runtime.js').read_text().replace('</script','<\\/script')+'</script>\n'
html=html.replace('<script id="tiles-mother-app">',injected+'<script id="tiles-mother-app">',1)
licenses='Three.js (MIT)\n'+(runtime/'THREE-LICENSE.txt').read_text()+'\nfflate (MIT)\n'+(runtime/'FFLATE-LICENSE.txt').read_text()+'\nDraco and Basis Universal (Apache-2.0)\n'+(root/'APACHE-2.0.txt').read_text()
html=html.replace('</body>', '<!-- THIRD PARTY NOTICES\n'+licenses.replace('--','- -')+'\n-->\n</body>')
html=html.replace('目前尚未收到瓦片实物参考。','初始预设尚未依据瓦片实物完成校准。')
html=html.replace('原图单独保存，用于对照和记录。','原图、原始模型及其他格式分别保存，用于对照和记录。')
html=html.replace('照片不直接贴到瓦片上。','参考模型和照片保持独立，程序化母体参数不会被导入操作覆盖。')
out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(html)
manifest={'version':'0.2.0','baselineSHA256':hashlib.sha256(baseline).hexdigest(),'indexSHA256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'runtimeVersion':{'three':'0.180.0','fflate':'0.8.2'},'visualApproved':False,'productionApproved':False}
(out.parent/'build-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
