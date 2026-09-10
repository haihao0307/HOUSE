from pathlib import Path
import re, hashlib

ROOT=Path(__file__).resolve().parents[2]
src=ROOT/'tiles-mother/r2-closeout-04-direct/START_HERE.html'
s=src.read_text('utf-8')
expected='7734bdb8bf9913feedd7c69ad0fa95de71ff1f93f866d74685c53549ae6bd311'
sha=hashlib.sha256(s.encode()).hexdigest()
if sha!=expected: raise SystemExit(f'unexpected 04 direct source {sha}')

def replace_function(src,name,repl):
    token=name+'('
    p=src.find(token)
    if p<0: raise SystemExit('missing '+name)
    start=src.rfind('\n',0,p)+1
    b=src.find('{',p)
    depth=0; quote=None; esc=False
    for i in range(b,len(src)):
        c=src[i]
        if quote:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: quote=None
            continue
        if c in ('\"',"'",'`'): quote=c; continue
        if c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0:
                return src[:start]+repl+src[i+1:]
    raise SystemExit('unclosed '+name)

s=s.replace('<title>Tiles Mother · R2 收尾候选 04</title>','<title>Tiles Mother · R2 收尾候选 05</title>',1)
s=s.replace('R2 收尾候选 04 · 去规则材质 / 菌落式微表面 / 可退出参数面板','R2 收尾候选 05 · 移动端连续有机材质 / 静态退出面板',1)
s=s.replace('材质与失养 · R2 收尾 04','材质与失养 · R2 收尾 05',1)
s=s.replace('本版继续锁定候选02/03的瓦形与色调，只去除规则纹理，增加片级—矿物区—局部菌落的非均匀组织，并修复手机参数面板退出。','本版锁定02/03的瓦形与色调；把04过重的噪波域改为移动端友好的连续方向波场，保留片级—矿物区—菌落—稀疏孔蚀层级。',1)

warp=r'''vec3 ceramicWarp(vec3 p,float seed){
 vec2 x=p.xz;
 float a=seed*.0137;
 vec2 d1=vec2(cos(a),sin(a)),d2=vec2(cos(a*1.71+1.1),sin(a*1.71+1.1));
 float u=dot(x,d1),v=dot(x,d2);
 float w1=sin(u*13.0+1.05*sin(v*8.0+a));
 float w2=sin(v*17.0+.72*sin(u*10.0-a*.63));
 x+=d2*(w1*.0027)+d1*(w2*.0016);
 p.x=x.x;p.z=x.y;return p;
}'''
s=replace_function(s,'vec3 ceramicWarp',warp)

colony=r'''float ceramicColony(vec3 p,float seed){
 vec2 x=p.xz;
 float a=seed*.0173;
 vec2 d1=vec2(cos(a),sin(a)),d2=vec2(cos(a*1.83+1.7),sin(a*1.83+1.7));
 float u=dot(x,d1),v=dot(x,d2);
 float broad=.5+.5*sin(u*18.0+1.35*sin(v*11.0+a)+.33*sin((u+v)*7.0-a));
 float middle=.5+.5*sin(v*43.0+1.05*sin(u*29.0-a*.7)+.41*sin((u-v)*21.0+a));
 float rim=.5+.5*sin(u*83.0+v*67.0+1.25*sin(v*31.0+a));
 float island=smoothstep(.45,.73,broad*.66+middle*.34);
 return clamp(island*(.64+.36*smoothstep(.38,.72,rim)),0.,1.);
}'''
s=replace_function(s,'float ceramicColony',colony)

# Add a cheap non-simplex material macro field for ceramic colour zones.
insert='''\nfloat ceramicWave(vec3 p,float seed,float scale){\n vec2 x=p.xz;float a=seed*.0119;\n vec2 d1=vec2(cos(a),sin(a)),d2=vec2(cos(a*1.57+2.1),sin(a*1.57+2.1));\n float u=dot(x,d1),v=dot(x,d2);\n float f=.56*sin(u*scale+a)+.31*sin(v*scale*.67+1.08*sin(u*scale*.31-a))+.13*sin((u-v)*scale*.43+a*.7);\n return clamp(.5+.5*f,0.,1.);\n}\n'''
marker='float tileIdentity(float seed){return fract(sin(seed*12.9898+78.233)*43758.5453);}'
if marker not in s: raise SystemExit('tileIdentity missing')
s=s.replace(marker,marker+insert,1)

# Ceramic branch: low and mid colour structure no longer exposes simplex tetrahedral cells.
old="if(uType!=3){macro=n3(q*17.3);middle=mix(.5,n3(q*63.7+vec3(8.1,1.7,3.8)),band(fp,63.7));}"
new="if(uType!=3){macro=n3(q*17.3);middle=mix(.5,n3(q*63.7+vec3(8.1,1.7,3.8)),band(fp,63.7));} if(uType==0){macro=ceramicWave(q,seed+11.,17.0);middle=mix(.5,ceramicWave(q,seed+29.,57.0),band(fp,57.0));}"
if old not in s: raise SystemExit('macro span missing')
s=s.replace(old,new,1)
s=s.replace('float fired=n3(q*8.2+vec3(8.1,2.6,5.4));','float fired=ceramicWave(q,seed+47.,8.5);',1)
s=s.replace("float coolBroad=n3(q*4.7+vec3(4.7,8.2,1.3)+vec3(tileId*2.3,0.,tileId*1.7));\n   float coolMid=n3(q*16.9+vec3(1.9,5.6,9.1)+vec3(colony*.11));","float coolBroad=ceramicWave(q,seed+73.+tileId*19.,5.2);\n   float coolMid=ceramicWave(q,seed+101.+colony*13.,18.0);",1)
s=s.replace("+.12*ceramicColony(q,seed);","+.12*colony;",1)

# Remove dynamic panel injector from 04; use a static, deterministic control.
s=re.sub(r'<script id="r2-closeout04-ui-runtime">.*?</script>\s*','',s,flags=re.S)
s=re.sub(r'<style id="r2-closeout04-ui-fix">.*?</style>\s*','',s,flags=re.S)
css='''<style id="r2-closeout05-ui">\n#panelClose{float:right;position:sticky;top:0;z-index:20;min-width:48px;min-height:42px;margin:-7px -5px 6px 10px;background:#f6f7f2f2;border:1px solid #334a4322;border-radius:11px}\n@media(max-width:700px){#panel{max-height:58svh!important;overflow:auto!important;overscroll-behavior:contain!important}}\n</style>\n'''
s=s.replace('</head>',css+'</head>',1)
needle='<aside class="panel" id="panel" hidden><h3>材质与失养 · R2 收尾 05</h3>'
repl='<aside class="panel" id="panel" hidden><button id="panelClose" type="button" aria-label="关闭色彩与参数">关闭</button><h3>材质与失养 · R2 收尾 05</h3>'
if needle not in s: raise SystemExit('panel opening missing')
s=s.replace(needle,repl,1)

# Bind close in the existing init path; no observer and no post-load DOM search.
bind="$('#settings').onclick=()=>{let p=$('#panel');p.hidden=!p.hidden;$('#settings').setAttribute('aria-expanded',String(!p.hidden))};$('#home').onclick=()=>fit();"
newbind="$('#settings').onclick=()=>{let p=$('#panel');p.hidden=!p.hidden;$('#settings').setAttribute('aria-expanded',String(!p.hidden))};$('#panelClose').onclick=()=>{let p=$('#panel');p.hidden=true;$('#settings').setAttribute('aria-expanded','false')};$('#home').onclick=()=>fit();"
if bind not in s: raise SystemExit('settings binding missing')
s=s.replace(bind,newbind,1)

s=s.replace("version:'R2-closeout-04'","version:'R2-closeout-05'",1)
s=s.replace("surface:'tile identity -> mineral regions -> colony clusters -> sparse pores'","surface:'tile identity -> directional mineral regions -> colony clusters -> sparse pores; mobile-safe'",1)
s=s.replace("version:'r2-closeout-02',settings,camera","version:'r2-closeout-05',settings,camera",1)
s=s.replace("window.TilesClean={version:'r2-closeout-02'","window.TilesClean={version:'r2-closeout-05'",1)

required=['R2 收尾候选 05','ceramicWave(','ceramicColony(','id="panelClose"',"version:'R2-closeout-05'",'DecompressionStream']
for x in required[:-1]:
    if x not in s: raise SystemExit('missing '+x)
if 'DecompressionStream' in s: raise SystemExit('launcher returned')
if 'MutationObserver' in s: raise SystemExit('dynamic panel injector returned')

out=ROOT/'tiles-mother/r2-closeout-05-mobile/START_HERE.html'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(s,'utf-8')
print('bytes',out.stat().st_size)
print('sha256',hashlib.sha256(out.read_bytes()).hexdigest())
