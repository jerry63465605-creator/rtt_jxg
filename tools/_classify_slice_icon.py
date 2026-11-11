# 只读：按右上角图标区域特征，区分 PRELUDE(书本图标) / ARMAMENT(其它图标) 切图
# 用法：python tools/_classify_slice_icon.py
import os, sys
try:
    from PIL import Image
except ImportError:
    print("NO_PIL"); sys.exit(2)

ROOT = os.path.join(os.path.dirname(__file__), '..', 'out', 'cards_sliced')

def stats(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    # 右上角图标区（书本/武器徽记所在）
    box = (int(w*0.70), int(h*0.02), int(w*0.97), int(h*0.18))
    crop = im.crop(box)
    px = list(crop.getdata())
    n = len(px)
    white = sum(1 for r, g, b in px if r > 195 and g > 195 and b > 195)
    gray = sum(1 for r, g, b in px if abs(r-g) < 18 and abs(g-b) < 18 and 90 < r < 200)
    dark = sum(1 for r, g, b in px if r < 70 and g < 70 and b < 70)
    return w, h, white/n, gray/n, dark/n

sheets = [int(x) for x in sys.argv[1:]] or [180, 183]

targets = []
for sheet in sheets:
    for r in range(7):
        for c in range(10):
            p = os.path.join(ROOT, 'sheet%d_r%d_c%d.png' % (sheet, r, c))
            if os.path.exists(p) and os.path.getsize(p) > 50000:
                targets.append((sheet, r, c, p))

print('有效切片 %d 张' % len(targets))
print('%-22s %-6s %-6s %-6s %-6s' % ('file', 'white', 'gray', 'dark', 'guess'))
for sheet, r, c, p in targets:
    w, h, ww, gg, dd = stats(p)
    # 前奏卡：右上角徽记含较多白色（书本）与灰色边框
    guess = 'PRELUDE?' if ww > 0.22 else ('ARMAMENT?' if dd > 0.15 else '?')
    print('%-22s %-6.2f %-6.2f %-6.2f %s' % ('sheet%d_r%d_c%d' % (sheet, r, c), ww, gg, dd, guess))
