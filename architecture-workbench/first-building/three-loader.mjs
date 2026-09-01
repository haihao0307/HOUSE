let source;
export function initialize(data){source=data.threeUrl;}
export async function resolve(s,c,next){return s==='three'?{url:source,shortCircuit:true}:next(s,c);}
