from pathlib import Path
import json, shutil, cv2, numpy as np, hashlib

HERE=Path(__file__).parent
SRC=Path('G:/kunming/云南建筑资料')
BASE=Path('G:/HOUSE/tiles-mother-08d-20260914/START_HERE.html')
sources={**{f'D{i}':f'古建筑测绘_{i}_Disorder_来自小红书网页版.jpg' for i in range(2,8)},**{f'L{i}':f'文献馆 _ 刘致平 昆明东北乡古建筑图录_{i}_WDC_来自小红书网页版.jpg' for i in [4,5,7,8,9]}}
(HERE/'references').mkdir(exist_ok=True)
manifest=[]
for key,name in sources.items():
    p=SRC/name
    shutil.copyfile(p,HERE/'references'/f'{key}.jpg')
    manifest.append(dict(id=key,file=f'references/{key}.jpg',original=name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),authority='user_supplied_repost_image_not_verified_original_edition'))

# These are source-plane line contours, not inferred sculptural depth.
# Keep coordinates and holes as curves. Meshes are generated only at runtime.
rois={
 'seal':('L9',[139,126,325,314],.130,'round'),
 'seeds':('L9',[367,127,555,313],.130,'round'),
 'flower':('L9',[599,127,789,315],.130,'round'),
 'rosette':('L9',[825,134,1013,315],.130,'round'),
 'dripFloral':('L9',[80,303,380,497],.215,'drip'),
 'dripBeast':('L9',[428,307,731,530],.215,'drip'),
 'dragonTail':('L7',[138,87,260,295],.30,'silhouette'),
 'fish':('L7',[331,88,493,275],.30,'silhouette'),
 'beastHead':('L7',[583,45,773,181],.30,'silhouette'),
 'beastSide':('L7',[744,286,884,426],.30,'silhouette'),
 'immortal':('L7',[519,387,557,446],.13,'silhouette'),
 'horse':('L7',[622,414,672,462],.13,'silhouette'),
 'guardian':('L7',[42,620,262,889],.40,'silhouette'),
}
trace={}
# Hand-delineated source-plane boundaries prevent labels and adjacent roof lines
# from being misidentified as parts of the ornament. No depth is inferred here.
outlines={
 'dripFloral':[(96,307),(108,323),(137,337),(176,346),(221,350),(264,345),(305,334),(341,318),(361,307),(375,316),(376,337),(367,362),(355,379),(342,383),(334,405),(314,421),(297,429),(284,448),(263,463),(243,476),(231,492),(218,480),(200,472),(182,459),(171,442),(151,431),(140,412),(131,401),(115,395),(104,380),(101,366),(90,354),(84,336),(85,320)],
 'dripBeast':[(433,325),(443,317),(463,327),(493,339),(532,348),(573,352),(613,348),(657,337),(688,322),(710,312),(720,322),(728,344),(725,369),(717,391),(703,408),(690,415),(682,439),(663,459),(640,468),(628,487),(604,499),(579,512),(569,524),(557,508),(539,497),(518,486),(506,469),(484,460),(468,442),(459,420),(444,411),(436,394),(431,366)],
 'guardian':[(111,629),(126,641),(144,626),(163,635),(180,627),(199,629),(214,640),(211,659),(199,674),(199,691),(189,710),(179,738),(195,762),(218,772),(255,822),(224,855),(249,869),(259,885),(225,886),(209,872),(178,876),(165,862),(156,878),(139,877),(137,854),(116,850),(105,876),(84,886),(60,882),(65,861),(46,875),(46,855),(64,816),(72,780),(87,750),(83,727),(96,711),(107,708),(105,677),(109,653)],
 'dragonTail':[(141,287),(153,254),(156,235),(172,213),(163,199),(153,181),(141,179),(140,170),(149,169),(147,155),(140,145),(143,139),(155,147),(159,135),(151,120),(155,113),(168,124),(181,115),(181,104),(174,96),(178,90),(190,98),(191,111),(205,111),(208,97),(214,99),(216,115),(226,118),(233,106),(239,110),(237,128),(250,139),(257,169),(254,189),(243,208),(233,223),(237,242),(251,259),(250,270),(223,270),(218,290),(195,285),(179,278),(163,291)],
 'fish':[(335,258),(347,242),(356,239),(358,224),(349,207),(354,194),(379,191),(381,169),(384,143),(381,111),(393,96),(409,91),(421,91),(430,96),(425,110),(429,122),(447,127),(457,147),(471,160),(471,188),(462,208),(443,224),(451,229),(479,230),(492,246),(486,252),(472,243),(464,263),(431,262),(407,253),(382,254),(356,260)],
 'beastHead':[(595,48),(611,56),(628,63),(652,68),(669,80),(689,83),(703,75),(718,82),(716,91),(739,91),(756,97),(768,107),(758,125),(745,127),(743,147),(731,159),(719,177),(693,174),(682,164),(657,170),(640,157),(628,145),(614,128),(599,111),(588,89),(586,64)],
 'beastSide':[(750,370),(749,356),(758,344),(775,338),(795,335),(808,325),(823,323),(836,309),(852,289),(866,290),(878,300),(879,330),(884,349),(874,368),(869,391),(873,421),(847,422),(833,411),(816,411),(810,395),(809,380),(788,373),(770,363),(759,361)],
 'immortal':[(519,441),(527,432),(527,418),(532,410),(532,399),(536,396),(538,388),(542,392),(544,404),(543,416),(548,427),(555,443)],
 'horse':[(624,457),(630,446),(628,433),(623,426),(629,417),(639,415),(647,425),(652,431),(665,434),(670,443),(668,460),(661,460),(661,448),(651,448),(650,459),(643,459),(642,447),(637,446),(632,459)]
}
for key,(sid,box,width,kind) in rois.items():
    # Work in the displayed reference coordinate frame (1280 or 1253 wide).
    im=cv2.imdecode(np.fromfile(SRC/sources[sid],dtype=np.uint8),cv2.IMREAD_COLOR)
    target=(1278,1080) if sid=='L9' else (1253,1080)
    im=cv2.resize(im,target)
    x0,y0,x1,y1=box; gray=cv2.cvtColor(im[y0:y1,x0:x1],cv2.COLOR_BGR2GRAY)
    mask=cv2.adaptiveThreshold(gray,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,31,12)
    if key in outlines:
        roi_poly=np.array([[x-x0,y-y0] for x,y in outlines[key]],np.int32)
        domain=np.zeros_like(mask);cv2.fillPoly(domain,[roi_poly],255)
        mask=cv2.bitwise_and(mask,domain)
    contours,hierarchy=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
    paths=[]
    for i,c in enumerate(contours):
        if cv2.contourArea(c)<2.5: continue
        p=cv2.approxPolyDP(c,.55,True).reshape(-1,2)
        if len(p)<3:continue
        if kind=='round' and any(((x-(x1-x0)/2)/((x1-x0)/2))**2+((y-(y1-y0)/2)/((y1-y0)/2))**2>1.06 for x,y in p): continue
        paths.append(dict(points=[[round((float(x)-(x1-x0)/2)*width/(x1-x0),6),round(((y1-y0)/2-float(y))*width/(x1-x0),6)] for x,y in p],hole=bool(hierarchy[0,i,3]>=0)))
    trace[key]=dict(source=sid,source_box_px=box,reference_image_size=target,width_m=width,height_m=width*(y1-y0)/(x1-x0),kind=kind,curves=paths,method='adaptive ink contour with 0.55 source-pixel simplification; source lines only',depth_status='unknown; adjustable illustrative extrusion')
    if key in outlines: trace[key]['outline']=[[round((x-(x0+x1)/2)*width/(x1-x0),6),round(((y0+y1)/2-y)*width/(x1-x0),6)] for x,y in outlines[key]]
(HERE/'source-curves.json').write_text(json.dumps(trace,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(HERE/'sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

h=BASE.read_text(encoding='utf-8')
h=h.replace('Tiles Mother · R2 收尾候选 08D','Tiles Mother · 09 云南图纸重建研究版')
h=h.replace('08D · 瓦面 / 边口 / 气孔','09 · 云南 / 图纸重建研究版')
h=h.replace('<nav id="scenes">', '<nav id="scenes" hidden>')
h=h.replace('<button id="shapePanel">微形态</button>','<button id="evidenceToggle">图纸 / 尺寸</button><button id="shapePanel" hidden>微形态</button>')
h=h.replace('08D 形态候选 · 屋面接触待验收','09 · 图示尺寸转录 / 未知深度可调 / 非测量定稿')
h=h.replace('<script>','<script>\nconst SOURCE_CURVES='+json.dumps(trace,ensure_ascii=False,separators=(',',':'))+';\n',1)
module=(HERE/'study.js').read_text(encoding='utf-8')
h=h.replace('const $=s=>document.querySelector(s),canvas=',module+'\nconst $=s=>document.querySelector(s),canvas=')
h=h.replace('scene:\'pan\',seed:314159','scene:\'study\',seed:314159')
h=h.replace('micStrength:1.6,micScale:1,micColor:.30','micStrength:0,micScale:1,micColor:.30')
h=h.replace('workshop=new Workshop(renderer)','workshop=new StudyWorkshop(renderer)')
h=h.replace("$('#caption').textContent=names[settings.scene]","$('#caption').textContent=names[settings.scene]")
h=h.replace("$('#busy').hidden=true;document.body.dataset.ready='true';resolve(true);","studyUpdate();$('#busy').hidden=true;document.body.dataset.ready='true';resolve(true);")
h=h.replace("init();\n", "init();\ninitStudy();\n")
h=h.replace("version:'r2-closeout-08D-microshape-pbr'","version:'09-yunnan-source-study'")
h=h.replace('data-special-view="section"','data-view="front"').replace('data-special-view="close"','data-view="close"')
h=h.replace('>断面</button>','>正面</button>')
h=h.replace("if(view==='edge')", "if(view==='front'){camera.pitch=.001;camera.yaw=0;}\n if(view==='edge')")
h=h.replace('<body>','<body>'+(HERE/'study-ui.html').read_text(encoding='utf-8'))
h=h.replace('</head>','<style>'+(HERE/'study.css').read_text(encoding='utf-8')+'</style></head>')
(HERE/'START_HERE.html').write_text(h,encoding='utf-8')
for name in ['MOTHER_OBJECT_DEFINITION_RULE_2026-09-09.md','MOTHER_PUBLIC_PREVIEW_DELIVERY_RULE_2026-09-08.md']:
    shutil.copyfile(Path('G:/小妈')/name,HERE/name)
print(json.dumps({'sources':len(manifest),'trace_parts':len(trace),'curves':sum(len(x['curves']) for x in trace.values()),'html_bytes':(HERE/'START_HERE.html').stat().st_size}))
