from pathlib import Path
import cv2,numpy as np,json
H=Path(__file__).parent
im=cv2.imdecode(np.fromfile(str(H/'references/L7.jpg'),dtype=np.uint8),cv2.IMREAD_GRAYSCALE)
# Perspective quadrilateral of the visible flower band; keep its ink, not an invented repeat.
src=np.float32([[246,300],[432,312],[432,340],[246,329]])
warped=cv2.warpPerspective(im,cv2.getPerspectiveTransform(src,np.float32([[0,0],[558,0],[558,90],[0,90]])),(559,91))
mask=cv2.adaptiveThreshold(warped,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C,cv2.THRESH_BINARY_INV,25,8)
mask[:4]=0;mask[-4:]=0;mask[:,:4]=0;mask[:,-4:]=0
contours,h=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
polys=[]
for i,c in enumerate(contours):
 if h[0,i,3]>=0 or cv2.contourArea(c)<8:continue
 def ring(c):return cv2.approxPolyDP(c,.6,True).reshape(-1,2).tolist()
 rings=[ring(c)];j=h[0,i,2]
 while j>=0:
  if cv2.contourArea(contours[j])>4:rings.append(ring(contours[j]))
  j=h[0,j,0]
 polys.append(rings)
data={'source':'L7','source_quad_px':src.tolist(),'size':[559,91],'polygons':polys,'status':'rectified visible drawing ink; relief depth and historical color unknown'}
(H/'ridge_ink09c.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf8')
