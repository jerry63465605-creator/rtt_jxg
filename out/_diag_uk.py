import os
from PIL import Image
import statistics

base = 'c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/cards_tts'
NW, NH = 10, 7
cellW, cellH = 384, 576

for tag, fname in {'1':'sheet_9258118311078123598.png','2':'sheet_9694408580419002679.png'}.items():
    im = Image.open(os.path.join(base, fname)).convert('RGB')
    stds = []
    grid = []
    for r in range(NH):
        row = []
        for c in range(NW):
            x,y=c*cellW,r*cellH
            cell=im.crop((x,y,x+cellW,y+cellH))
            px=list(cell.getdata())
            n=len(px)
            avg=[sum(p[i] for p in px)/n for i in range(3)]
            var=sum((p[0]-avg[0])**2+(p[1]-avg[1])**2+(p[2]-avg[2])**2 for p in px)/n
            s=var**0.5
            row.append(round(s,1))
        grid.append(row)
    print(f'=== sheet {tag} std map ===')
    for row in grid:
        print(' '.join(f'{v:6.1f}' for v in row))
    flat=[v for row in grid for v in row]
    print('min',min(flat),'max',max(flat),'median',statistics.median(flat))
    print('non-blank(std>=8):',sum(1 for v in flat if v>=8))
    print()
