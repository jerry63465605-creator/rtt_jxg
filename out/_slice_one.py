import os, sys
from PIL import Image, ImageDraw

base = 'c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/cards_tts'
fname = sys.argv[1]            # sheet filename
tag = sys.argv[2]              # label prefix, e.g. 'su'
outdir = sys.argv[3] if len(sys.argv)>3 else os.path.join(base, tag)
os.makedirs(outdir, exist_ok=True)

NW, NH = 10, 7
cellW, cellH = 384, 576
thumb = 96

im = Image.open(os.path.join(base, fname)).convert('RGB')
W,H = im.size
assert (W,H)==(NW*cellW, NH*cellH), (W,H)

cs = Image.new('RGB',(NW*thumb,NH*thumb),(30,30,30))
d = ImageDraw.Draw(cs)
saved=0
grid=[]
for r in range(NH):
    row=[]
    for c in range(NW):
        x,y=c*cellW,r*cellH
        cell=im.crop((x,y,x+cellW,y+cellH))
        px=list(cell.getdata()); n=len(px)
        avg=[sum(p[i] for p in px)/n for i in range(3)]
        var=sum((p[0]-avg[0])**2+(p[1]-avg[1])**2+(p[2]-avg[2])**2 for p in px)/n
        s=var**0.5
        row.append(round(s,1))
        blank = s<8
        if not blank:
            cell.save(os.path.join(outdir,f'{tag}_r{r}c{c}.png')); saved+=1
        t=cell.resize((thumb,thumb)); cs.paste(t,(c*thumb,r*thumb))
        d.text((c*thumb+2,r*thumb+2),f'r{r}c{c}',fill=(0,255,0) if not blank else (255,80,80))
    grid.append(row)
cs.save(os.path.join(outdir,f'{tag}_contact.png'))
print(f'{fname}: saved {saved} non-blank cells')
for row in grid: print(' '.join(f'{v:6.1f}' for v in row))
