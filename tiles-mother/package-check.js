/* Tiles Mother transfer diagnostics. Reads only explicitly selected local files. */
'use strict';
(() => {
const MiB=1024*1024, LIMIT=512000000, decoder=new TextDecoder('utf-8',{fatal:true});
const modelExt=new Set(['glb','gltf','fbx','obj','stl','ply','dae','3mf']);
const imageExt=new Set(['png','jpg','jpeg','webp','tga','dds','ktx','ktx2','exr','hdr','tif','tiff','bmp','avif']);
const ext=s=>String(s||'').split('.').pop().toLowerCase();
const format=n=>n>=1024**3?(n/1024**3).toFixed(2)+' GiB':n>=MiB?(n/MiB).toFixed(2)+' MiB':n>=1024?(n/1024).toFixed(1)+' KiB':n+' B';
const tick=()=>new Promise(r=>setTimeout(r,0));
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crcUpdate(c,a){for(const v of a)c=crcTable[(c^v)&255]^(c>>>8);return c;}
function ensure(ok,message){if(!ok)throw Error(message);}
function checkAbort(signal){if(signal?.aborted)throw new DOMException('检查已停止，原件未修改。','AbortError');}
function safePath(s){ensure(typeof s==='string'&&s.length>0&&s.length<4096,'ZIP 内的文件名无效。');ensure(!s.includes('\0')&&!s.startsWith('/')&&!s.includes('\\')&&!/^[a-z]:/i.test(s)&&!s.split('/').some(x=>x==='..'||x==='.'),'ZIP 包含不安全的文件路径。');return s;}
async function slice(file,a,n){ensure(Number.isSafeInteger(a)&&Number.isSafeInteger(n)&&a>=0&&n>=0&&a+n<=file.size,'ZIP 文件被截断或偏移越界。');return new Uint8Array(await file.slice(a,a+n).arrayBuffer());}
async function directory(file){
 ensure(file.size>=22&&file.size<0xffffffff,'文件过小或超过当前 ZIP32 检查范围。');
 const tail=await slice(file,Math.max(0,file.size-65557),Math.min(file.size,65557)),d=new DataView(tail.buffer);let end=-1;
 for(let p=tail.length-22;p>=0;p--){if(d.getUint32(p,true)===0x06054b50&&p+22+d.getUint16(p+20,true)===tail.length){end=p;break;}}
 ensure(end>=0,'未找到完整 ZIP 结束目录，文件可能未完整保存。');
 ensure(d.getUint16(end+4,true)===0&&d.getUint16(end+6,true)===0,'当前检查器不合并分卷 ZIP。');
 const count=d.getUint16(end+10,true),size=d.getUint32(end+12,true),offset=d.getUint32(end+16,true);
 ensure(count!==65535&&size!==0xffffffff&&offset!==0xffffffff,'ZIP64 需要单独处理，保留原包即可。');
 ensure(d.getUint16(end+8,true)===count&&count<=10000&&size<=16*MiB,'ZIP 目录数量或大小超出安全范围。');
 ensure(offset+size<=file.size-tail.length+end,'ZIP 目录位置无效。');
 const raw=await slice(file,offset,size),v=new DataView(raw.buffer),files=[],names=new Set();let p=0,total=0;
 for(let i=0;i<count;i++){
  ensure(p+46<=raw.length&&v.getUint32(p,true)===0x02014b50,'ZIP 中央目录损坏。');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),crc=v.getUint32(p+16,true),compressed=v.getUint32(p+20,true),bytes=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),local=v.getUint32(p+42,true);
  ensure(!(flags&1),'这是加密 ZIP，检查器不会尝试解密。');ensure(v.getUint16(p+34,true)===0,'ZIP 使用跨卷目录。');
  ensure(bytes!==0xffffffff&&compressed!==0xffffffff&&local!==0xffffffff,'此 ZIP 条目需要 ZIP64。');
  ensure(p+46+nl+extra+comment<=raw.length,'ZIP 文件名或扩展记录被截断。');
  const name=safePath(decoder.decode(raw.subarray(p+46,p+46+nl)));ensure(!names.has(name),'ZIP 有重复路径：'+name);names.add(name);
  ensure([0,8].includes(method),'ZIP 压缩方法暂未支持：'+method);
  total+=bytes;ensure(bytes<=512*MiB&&total<=2300*MiB,'展开内容超过本检查器的安全范围。');
  ensure(!(bytes>10*MiB&&bytes/Math.max(1,compressed)>1000),'ZIP 的展开比例异常，已停止以保护浏览器。');
  const header=await slice(file,local,30),h=new DataView(header.buffer);
  ensure(h.getUint32(0,true)===0x04034b50&&h.getUint16(8,true)===method&&h.getUint16(6,true)===flags,'ZIP 局部头与目录不一致。');
  const localName=decoder.decode(await slice(file,local+30,h.getUint16(26,true)));ensure(localName===name,'ZIP 局部文件名与目录不一致。');
  const begin=local+30+h.getUint16(26,true)+h.getUint16(28,true);ensure(begin+compressed<=offset,'ZIP 文件内容与目录重叠。');
  if(method===0)ensure(compressed===bytes,'未压缩条目的长度不一致。');
  files.push({name,flags,method,crc,compressed,bytes,local,begin});p+=46+nl+extra+comment;
 }
 ensure(p===raw.length,'ZIP 目录有无法解释的尾部数据。');
 const ranges=[...files].sort((a,b)=>a.local-b.local);for(let i=1;i<ranges.length;i++)ensure(ranges[i].local>=ranges[i-1].begin+ranges[i-1].compressed,'ZIP 文件内容发生重叠。');
 return {files,total};
}
async function hashBlob(blob,signal,progress){const hash=new globalThis.TilesReceiptSHA256();let n=0;for(let p=0;p<blob.size;p+=MiB){checkAbort(signal);const a=await slice(blob,p,Math.min(MiB,blob.size-p));hash.update(a);n+=a.length;progress?.(n/blob.size);await tick();}return hash.hex();}
async function readEntry(file,item,{signal,collect=false,onBytes}={}){
 checkAbort(signal);let stream=file.slice(item.begin,item.begin+item.compressed).stream();
 if(item.method===8){ensure(typeof DecompressionStream==='function','浏览器暂不支持此压缩包的解码，请用较新的 Chrome 或 Edge。');stream=stream.pipeThrough(new DecompressionStream('deflate-raw'));}
 const reader=stream.getReader(),hash=new globalThis.TilesReceiptSHA256(),chunks=[];let bytes=0,crc=0xffffffff,k=0;
 try{for(;;){checkAbort(signal);const {value,done}=await reader.read();if(done)break;bytes+=value.length;ensure(bytes<=item.bytes&&(!collect||bytes<=4*MiB),'解包大小超出目录声明或清单上限。');hash.update(value);crc=crcUpdate(crc,value);if(collect)chunks.push(value);onBytes?.(value.length);if(++k%8===0)await tick();}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 ensure(bytes===item.bytes,'文件内容被截断：'+item.name);ensure(((crc^0xffffffff)>>>0)===item.crc,'CRC 校验失败：'+item.name);
 let data;if(collect){data=new Uint8Array(bytes);let p=0;for(const a of chunks){data.set(a,p);p+=a.length;}}
 return {bytes,sha256:hash.hex(),crcVerified:true,data};
}
function sizeAssessment(bytes){return {packageBytes:bytes,chatSizeReferenceBytes:LIMIT,withinConservativeChatSize:bytes<=LIMIT,chatAcceptanceGuaranteed:false,limitBasis:'512 MB, conservatively interpreted as 512000000 bytes; type and account limits also apply'};}
async function inspect(file,options={}){
 const report={schema:'tiles-mother-transfer-diagnostic',version:'1.0.0',checkedAt:new Date().toISOString(),fileName:String(file.name||'collaboration.zip'),...sizeAssessment(file.size),senderFileReadable:false,zipDirectoryVerified:false,manifestPresent:false,referenceCount:0,modelCount:0,imageCount:0,files:[],warnings:[],errors:[],packageIntegrityVerified:false,referencePayloadPresent:false,chatReceiverReadVerified:false,modelParsingVerified:false,distillationComplete:false,temporaryCopiesRemoved:false,visualApproved:false,productionApproved:false};
 const update=(phase,progress=0)=>options.onProgress?.({phase,progress});
 try{
  ensure(file instanceof Blob,'需要选择本地 ZIP 文件。');report.senderFileReadable=true;update('正在读取 ZIP 目录');
  const dir=await directory(file);report.zipDirectoryVerified=true;report.archiveEntryCount=dir.files.length;report.uncompressedBytes=dir.total;
  if(!report.withinConservativeChatSize)report.warnings.push('协作包超过按十进制计算的 512 MB，可能超过聊天单文件限制。请先发送这份小报告。');
  const manifestEntry=dir.files.find(x=>x.name==='workspace.json');report.manifestPresent=!!manifestEntry;
  if(!manifestEntry){report.warnings.push('包里没有顶层 workspace.json。这可能是普通模型包，尚不能按 Tiles Mother 协作包核对。');report.files=dir.files.filter(x=>!x.name.endsWith('/')).map(x=>({filename:x.name,bytes:x.bytes,status:'directory-only'}));report.modelCount=report.files.filter(x=>modelExt.has(ext(x.filename))).length;report.imageCount=report.files.filter(x=>imageExt.has(ext(x.filename))).length;return report;}
  ensure(manifestEntry.bytes<=4*MiB,'协作清单超过 4 MiB，已保留原件并停止。');
  const manifestData=await readEntry(file,manifestEntry,{signal:options.signal,collect:true}),manifest=JSON.parse(decoder.decode(manifestData.data));
  ensure(manifest.schema==='tiles-mother-collaboration'&&Array.isArray(manifest.referenceFiles),'workspace.json 不符合 V0.2 协作清单结构。');
  ensure(manifest.referenceFiles.length<=2000,'参考条目数超出工作台范围。');
  report.workspaceSHA256=manifestData.sha256;report.workspaceVersion=manifest.version;report.exportedAt=manifest.exportedAt||null;report.referenceCount=manifest.referenceFiles.length;report.referencePayloadPresent=report.referenceCount>0;
  const map=new Map(dir.files.map(x=>[x.name,x])),seen=new Set(['workspace.json']),hashGroups=new Map();let done=0;
  for(const r of manifest.referenceFiles){
   checkAbort(options.signal);const path=safePath(r.archivePath);ensure(!seen.has(path),'清单重复引用路径：'+path);seen.add(path);
   const row={filename:String(r.filename||path),relativePath:String(r.relativePath||r.filename||path),archivePath:path,declaredBytes:r.size,expectedSHA256:typeof r.sha256==='string'?r.sha256:null,kind:r.kind||'unknown',profile:r.type||'unknown',source:String(r.source||'').slice(0,500),notes:String(r.notes||'').slice(0,6000),status:'pending'};report.files.push(row);
   if(modelExt.has(ext(row.filename)))report.modelCount++;if(imageExt.has(ext(row.filename)))report.imageCount++;
   update('校验 '+row.filename,done/Math.max(1,dir.total));
   try{const item=map.get(path);ensure(item&&!item.name.endsWith('/'),'清单声明的原文件缺失。');const result=await readEntry(file,item,{signal:options.signal,onBytes:n=>{done+=n;update('校验 '+row.filename,done/Math.max(1,dir.total));}});Object.assign(row,{bytes:result.bytes,actualSHA256:result.sha256,crcVerified:true});row.sizeMatches=Number.isSafeInteger(r.size)&&r.size===result.bytes;row.hashMatches=typeof r.sha256==='string'&&/^[a-f0-9]{64}$/i.test(r.sha256)&&r.sha256.toLowerCase()===result.sha256;row.status=row.sizeMatches&&row.hashMatches?'verified':'mismatch';if(row.status!=='verified')report.errors.push(row.filename+'：大小或 SHA256 与清单不符。');const group=hashGroups.get(result.sha256)||[];group.push(row.relativePath);hashGroups.set(result.sha256,group);}
   catch(error){if(error.name==='AbortError')throw error;row.status='error';row.error=String(error.message);report.errors.push(row.filename+'：'+error.message);}
  }
  report.unlistedEntries=dir.files.filter(x=>!x.name.endsWith('/')&&!seen.has(x.name)).map(x=>x.name);if(report.unlistedEntries.length)report.errors.push('ZIP 有未列入协作清单的文件，尚未核验这些额外文件。');
  report.duplicateByteGroups=[...hashGroups.values()].filter(x=>x.length>1);report.nestedArchives=report.files.filter(x=>['zip','7z','rar'].includes(ext(x.filename))).map(x=>({filename:x.filename,bytes:x.bytes||x.declaredBytes}));
  if(report.nestedArchives.length)report.warnings.push('协作包包含原始压缩包。原包与展开文件同时收存时，会重复占用空间；本次不删除它们。');
  if(report.duplicateByteGroups.length)report.warnings.push('发现 '+report.duplicateByteGroups.length+' 组字节完全相同的参考文件。');
  if(!report.referenceCount)report.warnings.push('这是一份只有参数的空参考记录，没有模型或贴图原件。');
  if(report.referenceCount&&!report.modelCount)report.warnings.push('清单没有识别到 GLB、FBX 等模型扩展名，请检查所选资料。');
  update('计算整个协作包的 SHA256',0);report.packageSHA256=await hashBlob(file,options.signal,p=>update('计算整个协作包的 SHA256',p));
  report.packageIntegrityVerified=report.referenceCount>0&&report.errors.length===0&&report.files.every(x=>x.status==='verified');update('检查结束',1);
 }catch(error){report.cancelled=error.name==='AbortError';report.errors.push(String(error.message));report.packageIntegrityVerified=false;}
 return report;
}
function summary(r){return ['Tiles Mother 协作包检查',r.fileName,'包大小：'+r.packageBytes+' bytes（'+format(r.packageBytes)+'）','清单中的参考文件：'+r.referenceCount,'模型：'+r.modelCount+'；图片 / 贴图：'+r.imageCount,'本机逐文件完整性：'+(r.packageIntegrityVerified?'通过':'尚未通过'),'聊天端已读到原件：未确认','模型解析与材质蒸馏：未完成','现在允许删除未学习的原件：否',...r.warnings.map(s=>'提示：'+s),...r.errors.map(s=>'问题：'+s)].join('\n');}
globalThis.TilesPackageCheck={inspect,summary,sizeAssessment,directory,version:'1.0.0'};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);let report=null,controller=null,busy=false;
function show(r){report=r;$('results').classList.remove('hidden');$('packageSize').textContent=format(r.packageBytes);$('referenceCount').textContent=r.referenceCount;$('modelCount').textContent=r.modelCount;$('imageCount').textContent=r.imageCount;$('resultTitle').textContent=r.packageIntegrityVerified?'原文件在包内，逐文件校验通过':'检查已完成，需要核对提示';$('conclusion').className='status '+(r.errors.length?'fail':r.packageIntegrityVerified?'':'warn');$('conclusion').textContent=r.packageIntegrityVerified?'本机读取完成：清单中的原文件都在包内，大小与 SHA256 一致。聊天端是否收到仍待确认。':r.errors.join('\n')||r.warnings[0]||'尚未验证包内原文件。';$('warnings').textContent=r.warnings.join('\n');$('summary').textContent=summary(r);$('fileRows').replaceChildren();for(const f of r.files){const tr=document.createElement('tr');for(const text of [f.relativePath||f.filename,format(f.bytes??f.declaredBytes??0),f.status==='verified'?'字节校验通过':f.error||f.status]){const td=document.createElement('td');td.textContent=text;tr.append(td);}$('fileRows').append(tr);}document.body.dataset.checkComplete='true';}
async function run(file){if(!file||busy)return;busy=true;controller=new AbortController();$('progressArea').classList.remove('hidden');$('results').classList.add('hidden');document.body.dataset.checkComplete='false';$('cancel').disabled=false;try{show(await inspect(file,{signal:controller.signal,onProgress:({phase,progress})=>{$('progressText').textContent=phase;$('progress').value=progress;}}));}finally{busy=false;controller=null;$('packageFile').value='';$('progressArea').classList.add('hidden');}}
$('drop').onclick=()=>{if(!busy)$('packageFile').click();};$('drop').onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();$('drop').click();}};$('packageFile').onchange=e=>run(e.target.files[0]);
document.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();$('drop').classList.add('drag');}});document.addEventListener('drop',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='none';$('drop').classList.remove('drag');run(e.dataTransfer.files[0]);}});$('drop').ondragleave=()=>$('drop').classList.remove('drag');$('cancel').onclick=()=>{controller?.abort();$('cancel').disabled=true;};
$('saveReport').onclick=()=>{if(!report)return;const b=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='Tiles_Mother_Transfer_Check_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);};
$('copySummary').onclick=async()=>{if(!report)return;try{await navigator.clipboard.writeText(summary(report));$('copySummary').textContent='摘要已复制';}catch{$('summary').parentElement.open=true;$('summary').focus();}};
document.body.dataset.inspectorReady='true';
})();
