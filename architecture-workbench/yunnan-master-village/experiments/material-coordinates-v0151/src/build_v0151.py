"""Build a reversible material-only candidate from the immutable V0.15.0 HTML."""
from pathlib import Path
import argparse, hashlib, json, re
BASE_SHA='bdd566b7c1817a21c9fc136e23b53adaa1c018adaa6e4aa25a43ef292aaedae9'
HERE=Path(__file__).resolve().parent
STYLE='''<style id="mb151-style">
#mb151-panel {font-size:12px; max-width:245px; padding:9px; border:1px solid #a5bca8; border-radius:8px; background:#f5f6ecef; color:#25362c;}
#mb151-panel summary {cursor:pointer; font-weight:600;}
#mb151-panel label,#mb151-panel small {display:block;margin-top:8px;line-height:1.5;}
#mb151-panel select,#mb151-panel button {display:block; width:100%; min-height:36px; margin-top:7px; box-sizing:border-box; font-size:12px;}
@media(max-width:600px){#mb151-panel{max-width:190px;} #mb151-panel select,#mb151-panel button{min-height:38px;}}
</style>'''
def build(base:Path,out:Path)->dict:
    raw=base.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=BASE_SHA:
        raise ValueError('V0.15.0 fingerprint mismatch; refusing to patch another baseline')
    if out.resolve()==base.resolve():raise ValueError('Refusing to overwrite frozen baseline')
    text=raw.decode('utf-8');bridge=(HERE/'material_bridge_v0151.js').read_text(encoding='utf-8')
    hook='window.YKY={getCirculationProbe:'
    if text.count(hook)!=1:raise ValueError('Ambiguous application injection point')
    text=text.replace(hook,bridge+'\nwindow.YKY={materialBridge:mb151,getCirculationProbe:',1)
    text=text.replace('</head>',STYLE+'\n</head>',1)
    # Only version labelling changes outside the additive layer.
    text=re.sub(r'<title>[^<]*</title>','<title>小李 · 云南建筑 V0.15.1 · 木纹坐标试验</title>',text,count=1)
    text=text.replace('<span class="version">V0.15.0</span>','<span class="version">V0.15.1</span>',1)
    out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(text.encode('utf-8'))
    receipt={'version':'0.15.1','base_sha256':BASE_SHA,'html_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
        'html_bytes':out.stat().st_size,'bridge_sha256':hashlib.sha256(bridge.encode()).hexdigest(),
        'public_site_deployed':False,'visualApproved':False,'productionApproved':False}
    out.with_suffix('.build.json').write_text(json.dumps(receipt,indent=2)+'\n')
    return receipt
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('baseline',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
    print(json.dumps(build(a.baseline,a.output),indent=2))
