"""Build minimal deployment archives; never include env or sessions."""
from pathlib import Path
import zipfile,json,hashlib
root=Path(__file__).resolve().parents[1]
out=root/'artifacts'/'cloud';out.mkdir(parents=True,exist_ok=True)
entries={'callback':'callback.handler','intake':'intake.handler','catalog':'catalog.handler','worker':'worker.handler'}
manifest=[]
for name,entry in entries.items():
 target=out/('biruza-'+name+'.zip')
 files=[root/'bot'/(name+'.js'),root/'bot'/'package.json',root/'bot'/'seed.json',*sorted((root/'bot'/'src').glob('*.js'))]
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
  for file in files:archive.write(file,file.relative_to(root/'bot'))
 manifest.append({'file':target.name,'entry':entry,'runtime':'nodejs22','sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('Created four archives without environment, credentials or customer data.')
