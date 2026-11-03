import os
from PIL import Image, ImageDraw

base = 'c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/cards_tts'
out = os.path.join(base, 'uk')
os.makedirs(out, exist_ok=True)

sheets = {
    '1': 'sheet_9258118311078123598.png',
    '2': 'sheet_9694408580419002679.png',
}
NW, NH = 10, 7
cellW, cellH = 384, 576
thumb = 96

for tag, fname in sheets.items():
    path = os.path.join(base, fname)
    im = Image.open(path).convert('RGB')
    W, H = im.size
    assert (W, H) == (NW*cellW, NH*cellH), (W, H)
    # contact sheet
    cs = Image.new('RGB', (NW*thumb, NH*thumb), (30, 30, 30))
    d = ImageDraw.Draw(cs)
    saved = 0
    for r in range(NH):
        for c in range(NW):
            x, y = c*cellW, r*cellH
            cell = im.crop((x, y, x+cellW, y+cellH))
            # blank detection: std dev of pixels
            px = list(cell.getdata())
            n = len(px)
            avg = [sum(p[i] for p in px)/n for i in range(3)]
            var = sum((p[0]-avg[0])**2 + (p[1]-avg[1])**2 + (p[2]-avg[2])**2 for p in px)/n
            std = var**0.5
            is_blank = std < 8
            label = f'{tag}_r{r}c{c}'
            if not is_blank:
                op = os.path.join(out, f'uk{tag}_r{r}c{c}.png')
                cell.save(op)
                saved += 1
            # thumbnail on contact sheet
            t = cell.resize((thumb, thumb))
            cs.paste(t, (c*thumb, r*thumb))
            d.text((c*thumb+2, r*thumb+2), f'{tag}r{r}c{c}', fill=(0,255,0) if not is_blank else (255,80,80))
    cs.save(os.path.join(out, f'uk{tag}_contact.png'))
    print(f'sheet {tag} ({fname}): saved {saved} non-blank cells -> {out}')
print('DONE')
