#!/usr/bin/env python3
"""Run the unchanged V0.1 workbench tests at their retained workspace URL."""
import argparse,functools,json,subprocess,sys,threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
p=argparse.ArgumentParser();p.add_argument('--site',type=Path);p.add_argument('--url');p.add_argument('--output',type=Path,required=True);p.add_argument('--expected-sha',required=True);a=p.parse_args()
server=None
if a.url:url=a.url
else:
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(SimpleHTTPRequestHandler,directory=str(a.site.resolve())))
 threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/architecture-workbench/workspace.html'
try:
 result=subprocess.run([sys.executable,str(Path(__file__).with_name('browser_qa.py')),'--url',url,'--output',str(a.output),'--expected-sha',a.expected_sha])
 f=a.output/'browser-report.json'
 if f.exists():
  report=json.loads(f.read_text());report['kind']='archived-workspace-public-http' if a.url else 'archived-workspace-staged-http';report['routeAdapterOnly']=True;f.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
finally:
 if server:server.shutdown()
sys.exit(result.returncode)
