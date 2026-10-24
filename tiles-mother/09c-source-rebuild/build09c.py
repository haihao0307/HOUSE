from pathlib import Path
import runpy
import json
H=Path(__file__).parent
runpy.run_path(str(H/'build_detail.py'),run_name='__main__')
h=(H/'START_HERE.html').read_text(encoding='utf-8')
h=h.replace('function roofSeats(){','function roofSeats(stepOverride=null){')
h=h.replace('let key=[STUDY.set,STUDY.datum,settings.micStrength,settings.micScale].join', 'let key=[STUDY.set,STUDY.datum,settings.micStrength,settings.micScale,stepOverride].join')
h=h.replace('step=p.cover.body-.003','step=stepOverride??(p.cover.body-.003)')
h=h.replace('slope=.36,ownPurlins=true)=>','slope=.36,ownPurlins=true,stepOverride=null)=>')
h=h.replace('serial=roofSerial++,p=spec(),seat=roofSeats(),','serial=roofSerial++,p=spec(),seat=roofSeats(stepOverride),')
h=h.replace('woodRound(.024,total)', 'woodRound(.024,total*Math.sqrt(1+(rise/step)**2))')
h=h.replace('distance:radius*3.4','distance:radius*3.9')
h=h.replace('cell=.009,bins=new Map()', 'cell=.003,bins=new Map()')
h=h.replace('墙码头 · 填土与瓦层','墙码头 · 砖框与填土')
h=h.replace("else if(e.id==='roundEnd'){let p=spec('D7');", "else if(e.id==='roundEnd'){put('D7-inclined-round-head',roundEnd09C());}else if(false){let p=spec('D7');")
h=h.replace('侧图尺寸对应未解 · 当前仅端身示意','斜端身侧形重建 · 分段尺寸端点待核')
h=h.replace('端身几何对应未解，不能算尺寸复刻完成','斜面、总长、直径与投影高度已入模；分段端点仍待核')
h=h.replace('原题七桁，当前只定位六个明确圆截面，第七位置待核','原题七桁；左檐第七截面部分遮挡，位置为图面近似')
h=h.replace("e.family==='timber'?'榫卯：真实开孔 / 可拆解检查'", "e.family==='timber'?(e.id==='joinery'?'榫卯验证台：真实开孔':'原图木构关系 / 隐藏榫型未确定')")
h=h.replace('function studyDescription(){','function studyDescriptionLegacy(){')
marker=" if(e.family==='frame'){const api="
assert marker in h
dispatch=""" const sourceAPI={put,block,bar,log,tile,trace,makeRoof,workshop:this,roofAlong:run=>fitSourceRoof09C(run,makeRoof,this)};
 const sourceHandled=e.family==='frame'?(e.id==='youChun'?buildYouChun09C(sourceAPI):buildSourceFrame09C(e.id,sourceAPI),true):e.family==='house'?(buildHouse09C(e.id,sourceAPI),true):buildSourceRoof09C(e.id,sourceAPI)||buildSourceJoint09C(e.id,sourceAPI)||buildSourceMasonry09C(e.id,sourceAPI);
 if(sourceHandled){}else if(e.family==='frame'){const api="""
h=h.replace(marker,dispatch)
runpy.run_path(str(H/'trace_ridge09c.py'),run_name='__main__')
modules='const RIDGE_INK09C='+ (H/'ridge_ink09c.json').read_text(encoding='utf8')+';\n'+'\n'.join((H/name).read_text(encoding='utf-8') for name in ['roof_fit09c.js','source_frames09c.js','source_roofs09c.js','round_end09c.js'])
modules+='''
function studyDescription(){const e=currentEntry();
 if(e.family==='timber'&&e.id!=='joinery')return '09C逐图重建。D2、D3按各自挑出与檩位求共同切线；D4保留正面宽度；D6上下两图并列观察，不拼成一个建筑。隐藏榫型、进深和部分坡度未测，当前没有把展示台榫孔强加到原图构件。';
 if(e.family==='frame')return '09C分别转录六种梁架与游椿轮廓；图中柱、梁、短柱、檩各有来源坐标。瓦层沿檩椽基准求搭接，瓦规格采用L9显示方案，不能据此认定L8实物规格。0.8米进深、未注断面、隐藏节点及彩画原色未测。';
 if(e.id==='roundEnd')return 'D7侧图显示斜端面。此处按12.3厘米直径、11厘米投影高推定倾斜，端身连续连接，总长27.8厘米。23.2/19.8厘米尺寸线端点仍有歧义，尚非完整尺寸定稿。';
 return studyDescriptionLegacy();}
'''
h=h.replace('const $=s=>document.querySelector(s),canvas=',modules+'\nconst $=s=>document.querySelector(s),canvas=')
if (H/'roof_seats09c.json').exists():
    seats=json.loads((H/'roof_seats09c.json').read_text(encoding='utf8'))
    fits=[]
    if (H/'SOURCE_GEOMETRY09C.json').exists():
        import math
        report=json.loads((H/'SOURCE_GEOMETRY09C.json').read_text(encoding='utf8'))
        for entry in report['entries']:
            for q in entry['roofFits']:
                a,b=q['from'],q['to'];span=math.hypot(b[0]-a[0],b[2]-a[2])
                fits.append({'set':'D7' if q['source'].startswith('D') else 'L9','span':span,'slope':q['rafter_top_line_slope'],'step':q['step_m'],'rows':q['rows']})
    cache='for(const [k,v] of '+json.dumps(seats)+')ROOF_CACHE.set(k,v);\n'
    # Build keys in JavaScript to preserve the same float-to-string conversion.
    cache+='for(const q of '+json.dumps(fits)+')SOURCE_FIT_CACHE09C.set([q.set,"body",1,1,q.span.toFixed(8),q.slope.toFixed(8)].join("/"),{step:q.step,rows:q.rows});\n'
    h=h.replace('const $=s=>document.querySelector(s),canvas=',cache+'const $=s=>document.querySelector(s),canvas=')
h=h.replace('09B','09C').replace("version:'09'","version:'09C'").replace('同屏 / 全表面 · 压印 · 无望板','原木纹恢复 / 滴水齐接 · 逐图木构')
h=h.replace("['bond','masonry'", "['smallDing','masonry','小丁走 · 不用泥巴','L9','B05'],['bond','masonry'")
wood=runpy.run_path(str(H/'wood_restore09c.py'))
h=wood['adapt'](h)
(H/'START_HERE.html').write_text(h,encoding='utf-8')
print('09C built: source-specific constructions and original axial timber,',len(h),'characters')
