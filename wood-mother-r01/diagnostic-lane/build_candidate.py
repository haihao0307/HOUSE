from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
s=(root/'index.html').read_text();assert hashlib.sha256(s.encode()).hexdigest()=='a3dcee04302b87a4f37d1045d82b71478c5b2ceaa6a65ca955c523fbafabbb61'
s=s.replace('float microHeight(vec3 p,float detailWeight){return .0005*(noise(detailCoord(p))-.5)*detailWeight;}', '''// Independent medium band; same local growth volume, not physical fiber directions.
vec3 mediumCoord(vec3 p){float r=length(p.xz);vec2 a=p.xz/max(r,.08);float t=growth(p);return vec3(t*52.+a.x*2.+.35*noise(vec3(t*6.,p.y*.7,a.y*3.)),p.y*2.2,a.y*3.);}
float microHeight(vec3 p,float fineWeight,float mediumWeight){return .0005*(noise(detailCoord(p))-.5)*fineWeight+.0018*(noise(mediumCoord(p))-.5)*mediumWeight;}''')
s=s.replace('float h=microHeight(p,detailWeight);float dx=(microHeight(p+t*stepSize,detailWeight)-h)/stepSize,dy=(microHeight(p+b*stepSize,detailWeight)-h)/stepSize;', 'vec3 mf=fwidth(mediumCoord(p));float mw=1.-smoothstep(.15,.8,max(max(mf.x,mf.y),mf.z));float h=microHeight(p,detailWeight,mw);float dx=(microHeight(p+t*stepSize,detailWeight,mw)-h)/stepSize,dy=(microHeight(p+b*stepSize,detailWeight,mw)-h)/stepSize;')
s=s.replace('float streak=smoothstep(.52,.84,fine);base*=1.-.075*streak;', 'vec3 mp=mediumCoord(p),mf=fwidth(mp);float mw=1.-smoothstep(.15,.8,max(max(mf.x,mf.y),mf.z));float medium=mix(.5,noise(mp),mw);float streak=smoothstep(.52,.84,fine);float midStreak=smoothstep(.52,.84,medium);base*=1.-.075*streak-.18*midStreak;')
s=s.replace('+.06*(fine-.5)+.035*(macro-.5)', '+.06*(fine-.5)+.09*(medium-.5)+.035*(macro-.5)')
s=s.replace('R01 · 算法研究候选', 'R01 · 中尺度对照候选（未发布）')
p=root/'diagnostic-lane/candidate.html';p.write_text(s)
print(len(s.encode()),hashlib.sha256(s.encode()).hexdigest())
