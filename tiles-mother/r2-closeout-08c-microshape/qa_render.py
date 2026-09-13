"""Native GLES raster comparison of exact workbench shaders, not browser QA."""
from qa_shader import *
from PIL import Image,ImageChops,ImageStat
E.eglCreatePbufferSurface.argtypes=[P,P,c.POINTER(I)];E.eglCreatePbufferSurface.restype=P
surf=E.eglCreatePbufferSurface(d,cfg,(I*5)(0x3057,960,0x3056,720,0x3038));assert E.eglMakeCurrent(d,surf,surf,ctx)
p=program();attach(p,shaders['VERT']);attach(p,shaders['FRAG']);link(p)
f('glUseProgram',None,U)(p)
mesh=json.loads((H/'mesh-qa.json').read_text());gen=f('glGenBuffers',None,I,c.POINTER(U));bind=f('glBindBuffer',None,U,U);data=f('glBufferData',None,U,c.c_ssize_t,P,U);enable=f('glEnableVertexAttribArray',None,U);attrib=f('glVertexAttribPointer',None,U,I,U,U,I,P)
for loc,key,size in [(0,'p',3),(1,'n',3),(2,'meta',4)]:
 buf=U();gen(1,c.byref(buf));bind(0x8892,buf);ar=(c.c_float*len(mesh[key]))(*mesh[key]);data(0x8892,c.sizeof(ar),ar,0x88E4);enable(loc);attrib(loc,size,0x1406,0,0,None)
buf=U();gen(1,c.byref(buf));bind(0x8893,buf);ar=(U*len(mesh['idx']))(*mesh['idx']);data(0x8893,c.sizeof(ar),ar,0x88E4)
attr=f('glVertexAttrib4f',None,U,c.c_float,c.c_float,c.c_float,c.c_float)
for i in range(4):attr(3+i,*[1. if j==i else 0. for j in range(4)])
attr(7,mesh['sid'],0,.5,0)
location=f('glGetUniformLocation',I,U,c.c_char_p)
def uf(name,*v):f('glUniform'+str(len(v))+'f',None,I,*([c.c_float]*len(v)))(location(p,name.encode()),*v)
def ui(name,v):f('glUniform1i',None,I,I)(location(p,name.encode()),v)
def mat(name,v):f('glUniformMatrix4fv',None,I,I,U,c.POINTER(c.c_float))(location(p,name.encode()),1,0,(c.c_float*16)(*v))
mat('uVP',mesh['vp']);mat('uLightVP',mesh['vp']);uf('uEye',*mesh['eye']);uf('uLight',-.4,.8,.5);uf('uSurface',.76,.36,.38,0);uf('uColor',.96,-.06,.58,.48);uf('uBio',0,.82,.92,.24);uf('uFinish',.72);uf('uShadowEnabled',0);uf('uShadowTexel',1/1024);ui('uType',0)
f('glViewport',None,I,I,I,I)(0,0,960,720);f('glEnable',None,U)(0x0B71)
images={}
for name,strength,color,diag in [('default',1,.3,0),('off',0,.3,0),('strong',3,.3,0),('gray_off',0,.3,1),('gray_strong',3,.3,1),('color_off',1,0,0),('color_full',1,1,0)]:
 uf('uMicroscope',strength,1,color,.3);ui('uDiagnostic',diag);f('glClearColor',None,c.c_float,c.c_float,c.c_float,c.c_float)(.85,.85,.83,1);f('glClear',None,U)(0x4000|0x0100);f('glDrawElements',None,U,I,U,P)(4,len(mesh['idx']),0x1405,None);f('glFinish',None)();pixels=(c.c_ubyte*(960*720*4))();f('glReadPixels',None,I,I,I,I,U,U,P)(0,0,960,720,0x1908,0x1401,pixels);im=Image.frombytes('RGBA',(960,720),bytes(pixels)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB');im.save(H/('native_'+name+'.png'));images[name]=im
comparison={a+'_to_'+b:sum(ImageStat.Stat(ImageChops.difference(images[a],images[b])).mean)/3 for a,b in [('off','default'),('default','strong'),('gray_off','gray_strong'),('color_off','color_full')]}
report={'method':'Native GLES raster of exact vertex/fragment code and pan geometry, fixed camera and seed, no shadow map','meanRGBDifferences':comparison,'glError':f('glGetError',U)(),'browserVerified':False};(H/'NATIVE_RENDER_QA.json').write_text(json.dumps(report,indent=2));print(report)
