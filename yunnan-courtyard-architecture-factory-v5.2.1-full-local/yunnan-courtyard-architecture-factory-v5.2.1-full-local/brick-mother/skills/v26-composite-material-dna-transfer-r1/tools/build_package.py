#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, hashlib, json, shutil, tempfile, zipfile
from pathlib import Path

PACKAGE_ROOT = 'BRICK_MOTHER_V26_COMPOSITE_MATERIAL_DNA_TRANSFER_R1_2026-09-18'
ZIP_NAME = PACKAGE_ROOT + '.zip'
FIXED_TIME = (2026, 9, 18, 0, 0, 0)

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def copy_path(src: Path, dst: Path) -> None:
    if src.is_dir(): shutil.copytree(src, dst)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

def main() -> None:
    ap=argparse.ArgumentParser()
    ap.add_argument('--skill-root', type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument('--out-dir', type=Path, default=None)
    args=ap.parse_args()
    skill=args.skill_root.resolve()
    out=(args.out_dir or (skill/'dist')).resolve(); out.mkdir(parents=True,exist_ok=True)
    brick_root=skill.parents[1]
    source_html=brick_root/'brick-mother-standalone-v2.6.html'
    if not source_html.exists(): raise SystemExit(f'missing source: {source_html}')
    required=['00_START_HERE.md','SKILL.md','REFERENCE_PRESET.json','TRANSFER_CONTRACT.json','SOURCE_LOCK.json','TEST_REPORT.json','docs','src']
    with tempfile.TemporaryDirectory() as td:
        stage=Path(td)/PACKAGE_ROOT; stage.mkdir()
        for rel in required: copy_path(skill/rel, stage/rel)
        chunks=[skill/'reference'/f'V26_THUMB_{i:02d}.b64' for i in (1,2,3)]
        data=base64.b64decode(''.join(p.read_text(encoding='ascii').strip() for p in chunks))
        ref=stage/'reference'/'V26_DEEP_PORE_BROKEN_CHILD_REFERENCE_THUMB.jpg'; ref.parent.mkdir(parents=True,exist_ok=True); ref.write_bytes(data)
        full_ref=skill/'reference'/'V26_DEEP_PORE_BROKEN_CHILD_REFERENCE.jpg'
        if full_ref.exists(): copy_path(full_ref, stage/'reference'/'V26_DEEP_PORE_BROKEN_CHILD_REFERENCE.jpg')
        copy_path(source_html, stage/'source'/'brick-mother-standalone-v2.6.html')
        info={
          'schema':'brick-mother.v26.transfer-package/1','packageRoot':PACKAGE_ROOT,
          'producer':'Brick Mother','boundary':'knowledge transfer only; receiving Mother owns implementation',
          'sourceCommit':'cfdda86c60076a0418fe1922075ddaa34cb8019c3',
          'sourceBlobSha1':'f64c65d87dc418bf1a923a4cf332b449efbe0eb9',
          'referenceProfile':'old-pbr-fired','referenceChild':'深孔破碎子代',
          'visualAcceptance':False,'productionReady':False
        }
        (stage/'PACKAGE_INFO.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        manifest=[]
        for p in sorted(stage.rglob('*')):
            if p.is_file() and p.name!='MANIFEST.sha256':
                manifest.append(f'{sha256_bytes(p.read_bytes())}  {p.relative_to(stage).as_posix()}')
        (stage/'MANIFEST.sha256').write_text('\n'.join(manifest)+'\n',encoding='utf-8')
        zip_path=out/ZIP_NAME
        with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as zf:
            for p in sorted(stage.rglob('*')):
                if not p.is_file(): continue
                arc=(Path(PACKAGE_ROOT)/p.relative_to(stage)).as_posix()
                zi=zipfile.ZipInfo(arc,FIXED_TIME); zi.compress_type=zipfile.ZIP_DEFLATED; zi.external_attr=0o100644<<16
                zf.writestr(zi,p.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
        receipt={
          'schema':'brick-mother.v26.transfer-package-receipt/1','file':ZIP_NAME,
          'bytes':zip_path.stat().st_size,'sha256':sha256_bytes(zip_path.read_bytes()),
          'payloadFiles':sum(1 for p in stage.rglob('*') if p.is_file()),
          'sourceCommit':info['sourceCommit'],'referenceThumbnailSha256':sha256_bytes(data),
          'boundary':'Brick Mother package only; no receiving-Mother implementation included'
        }
        receipt_path=out/(ZIP_NAME+'.receipt.json'); receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(receipt,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
