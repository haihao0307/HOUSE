"""Diagnostic only: remove comments/nonessential whitespace, preserve identifiers.
Restricted to these checked JS sources; not a general-purpose minifier.
"""
import pathlib,json,subprocess
root=pathlib.Path(__file__).resolve().parent
names=['a-constant.cjs','b-constant-path-section.cjs','contract.cjs','material.cjs','tlo-factory.cjs']
def compact(s):
 out=[];i=0;space=False
 while i<len(s):
  c=s[i]
  if s.startswith('//',i):
   j=s.find('\n',i);i=len(s) if j<0 else j+1;space=True;continue
  if s.startswith('/*',i):
   j=s.index('*/',i+2);i=j+2;space=True;continue
  if c.isspace():space=True;i+=1;continue
  if space and out and ((out[-1][-1].isalnum() or out[-1][-1] in '_$') and (c.isalnum() or c in '_$') or out[-1][-1]+c in ['++','--','//']):out.append(' ')
  space=False
  if c in "'\"`":
   quote=c;j=i+1
   while j<len(s):
    if s[j]=='\\':j+=2;continue
    if s[j]==quote:j+=1;break
    j+=1
   out.append(s[i:j]);i=j;continue
  out.append(c);i+=1
 return ''.join(out)
out=root/'normalized';out.mkdir(exist_ok=True)
counts={}
for n in names:
 data=compact((root/n).read_text());(out/n).write_text(data);counts[n]=len(data.encode());subprocess.run(['node','--check',str(out/n)],check=True,capture_output=True)
script="""const assert=require('assert/strict'),p=require('./instances.json');for(const n of ['a-constant.cjs','b-constant-path-section.cjs']){const a=require('./'+n).create(p.shape.size,p.shape.bend,p.shape.edges),b=require('./normalized/'+n).create(p.shape.size,p.shape.bend,p.shape.edges);for(let j=0;j<1000;j++){let u=j%101===100?.88:-.94+1.82*(j%101)/100,t=(j%97)/96,q=(j%11)/10;assert.deepEqual(a.position(u,t,q),b.position(u,t,q));}}const T=require('./normalized/tlo-factory.cjs').createRules(require('./normalized/a-constant.cjs'),'A');T.create(require('./instance-A.json')).evaluate(0,.5,.5);"""
subprocess.run(['node','-e',script],cwd=root,check=True,capture_output=True)
report={'method':'Comments and nonessential whitespace removed, original identifiers retained. Syntax checked and 2000 positions byte-equal as JS numbers; diagnostic only, not a general minifier.','files':counts,'completeClosureBytes':{k:counts[n]+counts['contract.cjs']+counts['material.cjs']+counts['tlo-factory.cjs'] for k,n in [('A','a-constant.cjs'),('B','b-constant-path-section.cjs')]},'warning':'Identifier choice and implementation factoring still affect counts; no claim of algorithmic minimum.'}
(root/'NORMALIZED.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
