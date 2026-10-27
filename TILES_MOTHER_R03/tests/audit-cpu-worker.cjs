'use strict';
// Executes the actual source-generated Worker program in an isolated VM with browser API stubs.
// This validates lifecycle and output contracts, NOT live browser or GPU availability.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const base=__dirname+'/../';
const sources=['ray.cjs','cpu-renderer.js','renderer.js'].map(n=>fs.readFileSync(base+n,'utf8'));
const blobs=new Map(),nodes=new Map(),handlers={};let outputs=[],workerPosts=[],terminated=0,revoked=0;
const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id)};
class Blob {constructor(parts){this.source=parts.join('');}}
const URL={createObjectURL(blob){const k='blob:test/'+blobs.size;blobs.set(k,blob.source);return k;},revokeObjectURL(k){blobs.delete(k);revoked++;}};
class Worker {
 constructor(url){this.dead=false;this.scope={Math,Number,Infinity,Uint8ClampedArray,setTimeout,postMessage:data=>{workerPosts.push(data);queueMicrotask(()=>{if(!this.dead)this.onmessage?.({data});});}};vm.createContext(this.scope);vm.runInContext(blobs.get(url),this.scope);}
 postMessage(data){if(!this.dead){const cloned=structuredClone(data);queueMicrotask(()=>this.scope.onmessage({data:cloned}));}}
 terminate(){this.dead=true;terminated++;}
}
const getContextCalls=[],canvas={clientWidth:84,clientHeight:60,width:0,height:0,getContext(type){getContextCalls.push(type);return type==='2d'?{putImageData(img){outputs.push(img)}}:null;}};
const document={body:{dataset:{}},getElementById:node},scope={Math,Number,Infinity,Uint8ClampedArray,Blob,URL,Worker,ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}},document,window:{addEventListener(n,cb){handlers[n]=cb;}},setTimeout};
vm.createContext(scope);vm.runInContext(sources.join('\n')+'\nthis.renderer=new TileRenderer(this.canvas);',Object.assign(scope,{canvas}));
const renderer=scope.renderer;
const record={Object:{size:[.24,.21,.014],bend:0}},camera={target:[0,0,0],distance:.84,pitch:.52,yaw:-.68};
const until=async(test)=>{const end=Date.now()+20000;while(!test()){if(Date.now()>end)throw Error('Timed out waiting for actual Worker output');await new Promise(r=>setTimeout(r,5));}};
(async()=>{
 assert.deepEqual(getContextCalls,['webgl2','2d']);assert.equal(renderer.mode,'CPU analytic rays');
 renderer.render(record,camera);record.Object.bend=.45;renderer.render(record,camera);record.Object.bend=-.9;renderer.render(record,camera);
 await until(()=>outputs.length===1);assert.equal(workerPosts.length,1);assert.equal(workerPosts[0].id,3);assert.equal(renderer.frames,1);assert.equal(document.body.dataset.ready,'true');
 const cover=crypto.createHash('sha256').update(outputs[0].data).digest('hex');assert(new Set(outputs[0].data).size>10);assert.equal(outputs[0].data.length,84*60*4);
 record.Object.bend=0;renderer.render(record,camera);await until(()=>outputs.length===2);const flat=crypto.createHash('sha256').update(outputs[1].data).digest('hex');assert.notEqual(flat,cover);
 handlers.pagehide({persisted:true});assert.equal(terminated,0);assert.equal(revoked,0);record.Object.bend=.45;renderer.render(record,camera);await until(()=>outputs.length===3);assert.equal(renderer.frames,3);
 renderer.worker.onmessage({data:{id:1,w:84,h:60,buffer:outputs[0].data}});assert.equal(outputs.length,3);
 renderer.worker.onerror({message:'test error'});assert.equal(document.body.dataset.ready,'failed');assert.match(node('error').textContent,/test error/);
 handlers.pagehide({persisted:false});assert.equal(terminated,1);assert.equal(revoked,1);
 const result={pass:true,scope:'Real Worker source and CPU fallback classes executed through VM browser stubs, not a live browser test',checks:['WebGL-null selects analytic CPU','Three queued updates deliver only latest id','ImageData has nonuniform opaque pixels','Flat and cover image hashes differ','BFCache persisted pagehide retains usable worker','Stale worker reply ignored','Worker error marks failed','Nonpersisted pagehide releases worker and Blob URL'],frames:outputs.length,pixelsPerFrame:84*60,hashes:{flat,cover}};
 fs.writeFileSync(__dirname+'/CPU_WORKER.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
