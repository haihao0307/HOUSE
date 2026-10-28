"""Run identical camera/material diagnostics on one bounded medium-scale candidate."""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
s=(root/'diagnostic-lane/run.py').read_text()
s=s.replace("evidence=root/'ci/evidence/diagnostic'", "evidence=root/'ci/evidence/medium-comparison'")
s=s.replace("src=(root/'index.html').read_text()", "src=(root/'diagnostic-lane/candidate.html').read_text()")
s=s.replace("assert sha=='a3dcee04302b87a4f37d1045d82b71478c5b2ceaa6a65ca955c523fbafabbb61'", "assert sha=='"+hashlib.sha256((root/'diagnostic-lane/candidate.html').read_bytes()).hexdigest()+"'")
# Primary diagnostic now measures medium layer; bump delta remains total combined normal.
s=s.replace('probe=\'\'\'if(diagnostic>0){vec3 fp=detailCoord(p);', 'probe=\'\'\'if(diagnostic>0){vec3 fp=mediumCoord(p);')
s=s.replace("'baseline_sha256':sha", "'candidate_sha256':sha,'baseline_sha256':'a3dcee04302b87a4f37d1045d82b71478c5b2ceaa6a65ca955c523fbafabbb61','diagnostic_primary_band':52")
s=s.replace("  assert not result['errors'];", """  page.set_viewport_size({'width':1280,'height':900});page.evaluate('woodDiagnostic(0,8.8)')
  for label,js in [('endgrain','document.querySelector(\"#endgrain\").click()'),('cut-through-knot','document.querySelector(\"#reset\").click();let e=document.querySelector(\"#cut\");e.value=.45;e.dispatchEvent(new Event(\"input\"))'),('cylinder','let c=document.querySelector(\"#cut\");c.value=.7;c.dispatchEvent(new Event(\"input\"));let e=document.querySelector(\"#shape\");e.value=1;e.dispatchEvent(new Event(\"input\"))')]:
   frame=page.evaluate('woodQA.frames');page.evaluate('()=>{'+js+'}');page.wait_for_function('(f)=>woodQA.frames>f',arg=frame);page.screenshot(path=str(evidence/(label+'.png')))
  assert page.evaluate('woodQA.error')==0
  assert not result['errors'];""")
exec(compile(s,str(root/'diagnostic-lane/run.py'),'exec'))
