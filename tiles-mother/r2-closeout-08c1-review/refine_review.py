from pathlib import Path
import re, subprocess, json, hashlib
H=Path(__file__).parent
h=(H/'source-08C.html').read_text(encoding='utf-8')
assert '08C.1' not in h
h=h.replace('08C','08C.1')
h=h.replace('<button id="settings" aria-expanded="true">色彩 / 参数</button>', '<button id="shapePanel">微形态</button><button id="pbrPanel">PBR 色彩</button><button id="settings" aria-expanded="true">全部参数</button>')
h=h.replace('aria-label="Microscope PBR 瓦面控制"','aria-label="Microscope 微形态"')
h=h.replace('恢复本版','恢复形态')
h=h.replace('<p id="micValues"', '<div class="presets" aria-label="同镜头形态对照"><button data-shape="0">关闭对照</button><button data-shape="1">默认 1×</button><button data-shape="3">增强 3×</button></div><p class="tiny">切换仅改变起伏强度，保留镜头、种子和色彩。</p><p id="micValues"')
h=h.replace('<button data-special-view="close">近景</button>', '<button data-special-view="close">瓦面近景</button>')
h=h.replace("else if(mode==='close'){await option('scene','wood');await option('year',10);fit('close')}", "else if(mode==='close'){if(settings.scene!=='pan')await option('scene','pan');fit('iso');camera.distance*=.62;requestRender()}")
h=h.replace("$('#pbrToggle').onclick=", "document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{option('micStrength',Number(b.dataset.shape));refreshMicroscope()});\n $('#pbrToggle').onclick=")
h=h.replace("$('#micValues').textContent=", "document.querySelectorAll('[data-shape]').forEach(b=>{const active=Number(b.dataset.shape)===settings.micStrength;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});\n $('#micValues').textContent=")
h=h.replace("$('#settings').onclick=", "function openControls(id){$('#panel').hidden=false;$('#settings').setAttribute('aria-expanded','true');document.getElementById(id).scrollIntoView({block:'start'});}\n $('#shapePanel').onclick=()=>openControls('microscopeControls');$('#pbrPanel').onclick=()=>openControls('pbrControls');\n $('#settings').onclick=")
h=h.replace("if(e.key==='Escape')$('#panel').hidden=true", "if(e.key==='Escape'){$('#panel').hidden=true;$('#settings').setAttribute('aria-expanded','false')}")
h=h.replace("canvas.onpointerup=canvas.onpointercancel=e=>drag.delete(e.pointerId);", "canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>drag.delete(e.pointerId);window.addEventListener('blur',()=>drag.clear());")
# Higher octave weights remain zero after this threshold; skip expensive trig only.
h=h.replace('float weight=1.-smoothstep(.8,2.4,span*s);','if(span*s>=2.4)break;\n  float weight=1.-smoothstep(.8,2.4,span*s);')
h=h.replace('</head>', '<style>#pbrControls{scroll-margin-top:40px;padding-top:12px;border-top:1px solid #5e716a28}#microscopeControls{scroll-margin-top:40px}header .tools{gap:4px}.presets{flex-wrap:wrap}@media(max-width:700px){.brand{max-width:145px}.brand small{letter-spacing:0}.tools button{padding:7px 6px;font-size:10px}header .tools{right:8px}#settings{display:none}}</style></head>')
h=h.replace('R2 收尾候选 08C.1 · Microscope + PBR','08C.1 · 微形态 / 独立 PBR')
h=h.replace('<div id="smallstats"></div>', '<div id="smallstats"></div><div class="tiny">形态审阅版 · 屋面接触尚未验收</div>')
(H/'START_HERE.html').write_text(h,encoding='utf-8')
(H/'syntax.js').write_text(re.search(r'<script>(.*?)</script>',h,re.S)[1],encoding='utf-8')
subprocess.run(['node','--check',str(H/'syntax.js')],check=True)
(H/'syntax.js').unlink()
print(json.dumps({'version':'08C.1','sha256':hashlib.sha256(h.encode()).hexdigest(),'bytes':len(h.encode())}))

