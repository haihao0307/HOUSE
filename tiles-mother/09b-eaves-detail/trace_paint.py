from pathlib import Path
import cv2,json,numpy as np
H=Path(__file__).parent
im=cv2.imdecode(np.fromfile(str(H/'references/L8.jpg'),dtype=np.uint8),cv2.IMREAD_COLOR)[45:1025,800:1525]
regions={'band0':[114,193,632,233],'band1':[116,258,632,291],'band2':[115,302,632,337]}
out={}
for key,(x0,y0,x1,y1) in regions.items():
 g=cv2.cvtColor(im[y0:y1,x0:x1],cv2.COLOR_BGR2GRAY)
 mask=cv2.adaptiveThreshold(g,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,17,9)
 contours,h=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
 polys=[]
 if h is not None:
  for i,c in enumerate(contours):
   if h[0,i,3]>=0 or cv2.contourArea(c)<1.5:continue
   def ring(c):return (cv2.approxPolyDP(c,.35,True).reshape(-1,2)+np.array([x0,y0])).tolist()
   rings=[ring(c)];j=h[0,i,2]
   while j>=0:
    if cv2.contourArea(contours[j])>1:rings.append(ring(contours[j]))
    j=h[0,j,0]
   polys.append(rings)
 out[key]={'roi':regions[key],'polygons':polys,'status':'source black ink, not original paint color or carved relief'}
(H/'paint-curves.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Paint regions',len(out),'polygons',sum(len(x['polygons'])for x in out.values()))
