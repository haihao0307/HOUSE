function crackSegments(g,seed,level,matrix=new THREE.Matrix4()){
  if(!level)return [];const proxy=makeProxy(g),p=g.userData.profile,w=(p.widthEave+p.widthRidge)*.5,out=[],n=level===2?3:1;
  for(let branch=0;branch<n;branch++){const cx=(hash01(seed,branch,18)-.5)*w*.40,cz=(hash01(seed,branch,21)-.5)*p.length*.48,a=hash01(seed,branch,27)*Math.PI*2,len=(.018+hash01(seed,branch,31)*.045)*(level===2?1.3:1);let previous=null;
    for(let k=0;k<=10;k++){const d=(k/10-.5)*len,x=cx+Math.cos(a)*d+Math.sin(k*1.6+branch)*.0006,z=cz+Math.sin(a)*d,y=proxy.height(x,z);if(!Number.isFinite(y)){previous=null;continue;}const v=new THREE.Vector3(x,y+.00016,z).applyMatrix4(matrix);if(previous)out.push(...previous.toArray(),...v.toArray());previous=v;}
  }return out;
}
function crackLines(vertices){if(!vertices.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const m=new THREE.LineBasicMaterial({color:0x242927,transparent:true,opacity:.62,depthWrite:false});const line=new THREE.LineSegments(g,m);line.userData.kind='tile-batch';return line;}
