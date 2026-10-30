# Convert the guide PNGs (module info/) to WebP, matching 1.webp / 2.webp convention.
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
INFO = os.path.normpath(os.path.join(
    HERE, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'info'))

NAMES = ['national_skills.png', 'card_types.png', 'units_supply.png', 'toolbar_guide.png']

for n in NAMES:
    src = os.path.join(INFO, n)
    if not os.path.exists(src):
        print('MISSING', src)
        continue
    dst = os.path.join(INFO, n.replace('.png', '.webp'))
    im = Image.open(src)
    im.save(dst, 'WEBP', quality=82, method=6)
    print('{} {:.0f} KB -> {} {:.0f} KB'.format(
        n, os.path.getsize(src) / 1024,
        os.path.basename(dst), os.path.getsize(dst) / 1024))
