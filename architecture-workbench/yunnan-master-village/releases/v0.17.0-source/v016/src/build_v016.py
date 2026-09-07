from pathlib import Path
import hashlib,json,re,argparse
BASE_SHA='0978fd5c669f9008a68ee76ae49f7f18a64bb69f914e5ac85b4dafb201f1feb1'
HERE=Path(__file__).resolve().parent
def build(base:Path,out:Path):
 raw=base.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=BASE_SHA:raise ValueError('V0.15.1 baseline identity mismatch')
 if base.resolve()==out.resolve():raise ValueError('Refusing to overwrite V0.15.1')
 text=raw.decode('utf-8');js=(HERE/'visual_v016.js').read_text();css=(HERE/'visual_v016.css').read_text()
 hook='window.YKY={materialBridge:mb151,'
 if text.count(hook)!=1:raise ValueError('Cannot locate unique YKY hook')
 text=text.replace(hook,js+'\nwindow.YKY={visual:visual16,materialBridge:mb151,',1)
 text=text.replace('</head>','<style id="visual16-style">\n'+css+'\n</style></head>',1)
 hook='requestAnimationFrame(animate);window.YKY.ready=true;'
 if text.count(hook)!=1:raise ValueError('Cannot locate unique startup hook')
 text=text.replace(hook,"if(!params.has('stage'))visual16.hero();\n"+hook,1)
 text=re.sub(r'<title>[^<]*</title>','<title>小李 · 滇中营造 V0.16.0 · 光与木</title>',text,count=1)
 text=text.replace('<span class="version">V0.15.1</span>','<span class="version">V0.16.0</span>',1)
 text=text.replace('一颗印<span>楼梯实走、开门通行与前院庆功 · 逻辑保真</span>','滇中营造<span>光与木 · 一颗印营造工作台</span>',1)
 text=text.replace('CRAFT, PEOPLE & EVERYDAY LIFE','YUNNAN · THE ART OF BUILDING',1)
 out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(text.encode())
 receipt={'version':'0.16.0','base_sha256':BASE_SHA,'html_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'html_bytes':out.stat().st_size,
 'source_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [HERE/'visual_v016.js',HERE/'visual_v016.css',Path(__file__)]},
 'public_site_deployed':False,'visualApproved':False,'productionApproved':False,'measurementTruthApproved':False}
 out.with_suffix('.build.json').write_text(json.dumps(receipt,indent=2)+'\n');return receipt
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('baseline',type=Path);p.add_argument('output',type=Path);a=p.parse_args();print(json.dumps(build(a.baseline,a.output),indent=2))
