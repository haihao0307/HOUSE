"""Deterministic public-page packaging correction; runtime and material code unchanged."""
from pathlib import Path
import sys
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
p=root/'source/shell.html';s=p.read_text()
assert '<link rel="icon"' not in s
p.write_text(s.replace('<head>', '<head><link rel="icon" href="data:,">',1))
p=root/'qa/verify_browser.py';s=p.read_text()
s=s.replace('errors=[];checks=[];cases=[];responses=[]', 'errors=[];checks=[];cases=[];responses=[];httpFailures=[];failedRequests=[]')
old=" pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'favicon' not in m.text else None)"
new=""" def monitor(page):
  page.on('pageerror',lambda e:errors.append({'kind':'pageerror','text':str(e)}))
  page.on('console',lambda m:errors.append({'kind':'console','text':m.text,'location':m.location}) if m.type=='error' else None)
  page.on('response',lambda r:httpFailures.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  page.on('requestfailed',lambda r:failedRequests.append({'url':r.url,'failure':r.failure}))
 monitor(pg)"""
assert old in s;s=s.replace(old,new)
s=s.replace(" if url:mp.goto(url,wait_until='load',timeout=120000)"," monitor(mp)\n if url:\n  mr=mp.goto(url,wait_until='load',timeout=120000);mh=hashlib.sha256(mr.body()).hexdigest();assert mh==expected;responses.append({'url':mr.url,'status':mr.status,'sha256':mh,'viewport':'mobile'})")
s=s.replace(" glerror=pg.evaluate('TilesClean.renderer.gl.getError()');assert glerror==0;assert not errors,errors", " (out/'NETWORK.json').write_text(json.dumps({'errors':errors,'httpFailures':httpFailures,'failedRequests':failedRequests},ensure_ascii=False,indent=2))\n glerror=pg.evaluate('TilesClean.renderer.gl.getError()');assert glerror==0;assert not errors,errors;assert not httpFailures,httpFailures;assert not failedRequests,failedRequests")
s=s.replace("'errors':errors,'glError'", "'errors':errors,'httpFailures':httpFailures,'failedRequests':failedRequests,'glError'")
p.write_text(s)
print('Inline empty favicon; stronger desktop/mobile network assertions; no runtime JS changed.')
