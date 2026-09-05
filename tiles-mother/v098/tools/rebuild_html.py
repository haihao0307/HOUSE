from pathlib import Path
import re,argparse
p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');a=p.parse_args()
r=Path(__file__).resolve().parents[1];html=r/'START_HERE.html';source=(r/'source/app.js').read_text(encoding='utf-8');h=html.read_text(encoding='utf-8')
pattern=r'(<script type="module">)(.*?)(</script>)'
m=list(re.finditer(pattern,h,re.S));assert len(m)==1, 'Expected exactly one inline module'
old=m[0].group(2).strip()
if a.check:
 assert old==source.strip(), 'HTML/source mismatch'
 print('HTML/source match')
else:
 new=h[:m[0].start(2)]+chr(10)+source+chr(10)+h[m[0].end(2):]
 html.write_text(new,encoding='utf-8');print('HTML rebuilt. Re-run QA and regenerate hashes before release.')
