from pathlib import Path
from urllib.request import urlopen
root=Path(__file__).resolve().parents[1]/'assets'
sources={
 'manrope.ttf':'https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/Manrope%5Bwght%5D.ttf',
 'cormorant.ttf':'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf',
 'cormorant-italic.ttf':'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf',
 'OFL-Manrope.txt':'https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt',
 'OFL-Cormorant.txt':'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt'
}
for filename,url in sources.items():
    with urlopen(url,timeout=30) as response:
        (root/filename).write_bytes(response.read())
    print(filename,(root/filename).stat().st_size)
