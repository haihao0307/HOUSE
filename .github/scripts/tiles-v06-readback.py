#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, os, time, urllib.request

url = os.environ.get('TM_V06_URL', 'https://haihao0307.github.io/HOUSE/tiles-mother/?v=0.6.0')
manifest = json.loads(Path('/tmp/tm-v06/candidate/tiles-mother/v06/build-manifest.json').read_text())
out = Path(os.environ.get('TM_V06_READBACK', '/tmp/tm-v06/publication.json'))
result = {
    'schema': 'tiles-mother-v06-publication', 'url': url, 'version': '0.6.0',
    'sourceCommit': os.environ['GITHUB_SHA'], 'workflowRun': os.environ['GITHUB_RUN_ID'],
    'verified': False, 'visualApproved': False, 'productionApproved': False,
    'distillationComplete': False,
}
for attempt in range(18):
    try:
        request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'TilesMother-v06-readback'})
        with urllib.request.urlopen(request, timeout=35) as response:
            data = response.read()
            result.update(httpStatus=response.status, contentType=response.headers.get('Content-Type'), bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        assert result['httpStatus'] == 200
        assert 'text/html' in result['contentType']
        assert result['sha256'] == manifest['indexSHA256']
        assert len(data) == manifest['bytes']
        result['verified'] = True
        break
    except Exception as error:
        result['lastError'] = str(error)
        if attempt == 17:
            raise
        time.sleep(8)
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
