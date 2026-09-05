// Workbench guard V0.1.0. This is a local preview guard, not the missing upstream validator.
export const VERSION='0.1.0';
export const APPROVALS=Object.freeze({visualApproved:false,productionApproved:false,userRecord:null});
export function fail(message){throw new Error(message);}
export function exactKeys(object,keys,name='对象'){
  if(!object || Object.getPrototypeOf(object)!==Object.prototype)fail(`${name}必须是普通对象`);
  const actual=Object.keys(object).sort(),expected=[...keys].sort();
  if(actual.length!==expected.length||actual.some((v,i)=>v!==expected[i]))fail(`${name}含未知或缺少字段`);
}
export function finiteNumber(n,min,max,label){if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)fail(`${label}超出声明范围`);}
export function deepFreeze(v){if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(deepFreeze);}return v;}
export function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
export async function sha256(bytes){const data=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');}
let pinnedPolicy=null;
export async function loadPinnedPolicy(url,expectedHash){
 const r=await fetch(url,{cache:'no-store'});if(!r.ok)fail(`共同规则读取失败 ${r.status}`);
 const bytes=await r.arrayBuffer();if(await sha256(bytes)!==expectedHash)fail('共同规则文件哈希不匹配，已阻止预览');
 const p=JSON.parse(new TextDecoder().decode(bytes));
 if(p.policyId!=='MOTHER_UNIFIED_EVOLUTION_POLICY'||p.version!=='1.0.0')fail('共同规则版本不匹配');
 pinnedPolicy=canonical(p);return deepFreeze(p);
}
export function assertPolicy(policy){if(!pinnedPolicy||canonical(policy)!==pinnedPolicy)fail('共同规则已变化，操作被阻止');}
export function validateLights(p){
 exactKeys(p,['rotation','key','fill','rim'],'灯光设置');finiteNumber(p.rotation,-180,180,'灯组方位');
 for(const id of ['key','fill','rim']){const v=p[id];exactKeys(v,['enabled','intensity','color'],id);if(typeof v.enabled!=='boolean')fail('灯开关必须是布尔值');finiteNumber(v.intensity,0,4,'灯强度');if(typeof v.color!=='string'||!/^#[0-9a-f]{6}$/i.test(v.color))fail('灯颜色必须是sRGB十六进制');}return p;
}
export function validateResearchRecord(p){
 exactKeys(p,['packetType','schemaVersion','notes','attachments'],'研究记录');
 if(p.packetType!=='blueprint-research-notes'||p.schemaVersion!=='1.0.0')fail('研究记录版本不匹配');
 if(typeof p.notes!=='string'||p.notes.length>100000)fail('笔记内容无效或过长');if(!Array.isArray(p.attachments)||p.attachments.length>2000)fail('附件清单无效');
 for(const a of p.attachments){exactKeys(a,['name','bytes','sha256','storage'],'附件记录');if(typeof a.name!=='string'||a.name.length>500)fail('附件名无效');finiteNumber(a.bytes,0,104857600,'附件大小');if(!/^[0-9a-f]{64}$/.test(a.sha256)||a.storage!=='browser-local')fail('附件身份无效');}
 return p;
}
export function assertNoApproval(p){if(p.visualApproved!==false||p.productionApproved!==false)fail('本研究工作台不能授予生产或视觉批准');return true;}
