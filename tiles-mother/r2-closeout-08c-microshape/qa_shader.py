"""Native Mesa GLES shader compile/link gate. This is not a browser test."""
import ctypes as c,os,re,json
from pathlib import Path
os.environ['EGL_PLATFORM']='surfaceless'
E=c.CDLL('libEGL.so.1'); P=c.c_void_p; I=c.c_int; U=c.c_uint
E.eglGetDisplay.argtypes=[P];E.eglGetDisplay.restype=P
E.eglInitialize.argtypes=[P,c.POINTER(I),c.POINTER(I)];E.eglInitialize.restype=U
E.eglBindAPI.argtypes=[U];E.eglBindAPI.restype=U
E.eglChooseConfig.argtypes=[P,c.POINTER(I),c.POINTER(P),I,c.POINTER(I)];E.eglChooseConfig.restype=U
E.eglCreateContext.argtypes=[P,P,P,c.POINTER(I)];E.eglCreateContext.restype=P
E.eglMakeCurrent.argtypes=[P,P,P,P];E.eglMakeCurrent.restype=U
E.eglGetProcAddress.argtypes=[c.c_char_p];E.eglGetProcAddress.restype=P
d=E.eglGetDisplay(None);major=I();minor=I();assert E.eglInitialize(d,c.byref(major),c.byref(minor));assert E.eglBindAPI(0x30A0)
attrs=(I*9)(0x3040,0x40,0x3033,1,0x3024,8,0x3023,8,0x3038);cfg=P();n=I();assert E.eglChooseConfig(d,attrs,c.byref(cfg),1,c.byref(n)) and n.value
ctx=E.eglCreateContext(d,cfg,None,(I*3)(0x3098,3,0x3038));assert ctx and E.eglMakeCurrent(d,None,None,ctx)
def f(name,rest,*args):return c.CFUNCTYPE(rest,*args)(E.eglGetProcAddress(name.encode()))
create=f('glCreateShader',U,U);source=f('glShaderSource',None,U,I,c.POINTER(c.c_char_p),c.POINTER(I));compile=f('glCompileShader',None,U);get=f('glGetShaderiv',None,U,U,c.POINTER(I));log=f('glGetShaderInfoLog',None,U,I,c.POINTER(I),c.c_char_p)
program=f('glCreateProgram',U);attach=f('glAttachShader',None,U,U);link=f('glLinkProgram',None,U);getp=f('glGetProgramiv',None,U,U,c.POINTER(I));logp=f('glGetProgramInfoLog',None,U,I,c.POINTER(I),c.c_char_p)
H=Path(__file__).resolve().parent;html=(H/'START_HERE.html').read_text();shaders={};records=[]
for name,t in [('VERT',0x8B31),('FRAG',0x8B30),('DEPTH_VERTEX',0x8B31),('DEPTH_FRAGMENT',0x8B30)]:
 s=re.search(r'const '+name+r'=`(.*?)`;',html,re.S)[1].encode();p=c.c_char_p(s);handle=create(t);source(handle,1,c.byref(p),None);compile(handle);status=I();get(handle,0x8B81,c.byref(status));buff=c.create_string_buffer(8192);log(handle,8192,None,buff);records.append({'shader':name,'passed':bool(status.value),'log':buff.value.decode()});shaders[name]=handle
for a,b in [('VERT','FRAG'),('DEPTH_VERTEX','DEPTH_FRAGMENT')]:
 p=program();attach(p,shaders[a]);attach(p,shaders[b]);link(p);status=I();getp(p,0x8B82,c.byref(status));buff=c.create_string_buffer(8192);logp(p,8192,None,buff);records.append({'program':a+' + '+b,'passed':bool(status.value),'log':buff.value.decode()})
report={'method':'Native Mesa surfaceless GLES3, compile/link only','checks':records,'passed':all(x['passed'] for x in records),'browserVerified':False};(H/'SHADER_QA.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));assert report['passed']
