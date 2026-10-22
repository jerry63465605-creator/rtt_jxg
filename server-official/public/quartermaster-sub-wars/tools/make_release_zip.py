#!/usr/bin/env python3
"""军需官 · 次要战场 —— 打测试服发布包

只收【运行必需】文件；开发残留（tools/ _test*.js rules.js.bak-* cards_tts/ 等）
一律不进包。图片只收 .webp（原 png 母版留在仓库，不进包），封面收 jpg + png。

用法：
    python tools/make_release_zip.py                      # 输出到仓库根目录
    python tools/make_release_zip.py --out D:/pkg.zip     # 指定路径

zip 内顶层目录固定为 quartermaster-sub-wars/，对方解压到 server/public/ 即可。
"""

import argparse
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TOP = 'quartermaster-sub-wars'

ROOT_FILES = [
    'rules.js', 'cards.js', 'data.js', 'layout.js',
    'play.html', 'play.js', 'play.css',
    'about.html', 'create.html', 'title.sql',
    'map.webp',
    'thumbnail.jpg', 'cover.1x.jpg', 'cover.2x.jpg', 'cover.png',
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(
        os.path.dirname(ROOT), 'quartermaster-sub-wars-release.zip'))
    args = ap.parse_args()
    out = args.out

    if os.path.exists(out):
        os.remove(out)

    n = 0
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as z:
        for f in ROOT_FILES:
            p = os.path.join(ROOT, f)
            if not os.path.exists(p):
                raise SystemExit('缺少运行文件：' + f)
            z.write(p, TOP + '/' + f)
            n += 1

        cards = os.path.join(ROOT, 'cards')
        for f in sorted(os.listdir(cards)):
            if f.lower().endswith('.webp'):
                z.write(os.path.join(cards, f), TOP + '/cards/' + f)
                n += 1

        info = os.path.join(ROOT, 'info')
        for f in sorted(os.listdir(info)):
            if f.lower().endswith('.webp') or f == 'rules.html':
                z.write(os.path.join(info, f), TOP + '/info/' + f)
                n += 1

    print('输出 %s' % out)
    print('文件 %d 个  体积 %.1f MB' % (n, os.path.getsize(out) / 1024 / 1024))

    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        print('顶层 =', sorted(set(x.split('/')[0] for x in names)))
        print('反斜杠条目 =', len([x for x in names if '\\' in x]))
        print('png 条目 =', len([x for x in names if x.lower().endswith('.png')]))
        print('cards =', len([x for x in names if x.startswith(TOP + '/cards/')]),
              ' info =', len([x for x in names if x.startswith(TOP + '/info/')]))
        print('CRC =', 'OK' if z.testzip() is None else 'BAD')


if __name__ == '__main__':
    main()
