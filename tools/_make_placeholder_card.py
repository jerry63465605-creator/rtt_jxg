#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""【D1 / P1】DIY 前奏卡占位卡图生成（管理员上传用，纯色模板）

读 out/prelude_diy.json 的 specs，为每张卡生成：
    cards/diy_<id>.png    母版（保留 PNG，与 optimize_images.py 口径一致）
    cards/diy_<id>.webp   前端实际使用（play.js CARD_IMG_EXT = ".webp"）

规格：
  · 384x576 RGB，与既有 494 张卡图一致
  · 国家徽章色沿用 event-cards-preview.html 的 .actor[data-a=...]（中国回退 #444）
  · 内容：国家色条 + DIY 角标 + 卡名 + 词条文本 + 底部 id/deck/type
  · WebP q85 method=6，与模块 tools/optimize_images.py 一致

用法：
    python tools/_make_placeholder_card.py
    python tools/_make_placeholder_card.py --file out/prelude_diy.example.json
    python tools/_make_placeholder_card.py --out-dir <临时目录>   # 测试用

只写卡图文件，不改 cards.js / rules.js / play.js，不接引擎。
"""
import argparse
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
CARDS_DIR = os.path.join(
    ROOT, 'server-official', 'public', 'quartermaster-sub-wars', 'cards')
DEFAULT_FILE = os.path.join(ROOT, 'out', 'prelude_diy.json')

W, H = 384, 576
NATION_COLORS = {
    '英国': '#2d5a8a', '法国': '#5a2d5a', '德国': '#4a4a55',
    '日本': '#8a2d2d', '苏联': '#b22222', '意大利': '#6b21a8',
    '美国': '#1e3a5f', '中国': '#444444',
}
FALLBACK_COLOR = '#444444'
FONT_CANDIDATES = [
    'C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/simhei.ttf', 'C:/Windows/Fonts/simsun.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]


def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    raise RuntimeError('找不到可绘制中文的 TrueType 字体；请检查系统字体路径')


def wrap(draw, text, font, max_w):
    """按像素宽度逐字换行（中文等宽，不用分词）"""
    lines, cur = [], ''
    for ch in str(text):
        if ch == '\n':
            lines.append(cur)
            cur = ''
            continue
        t = cur + ch
        if cur and draw.textlength(t, font=font) > max_w:
            lines.append(cur)
            cur = ch
        else:
            cur = t
    if cur:
        lines.append(cur)
    return lines


def draw_card(spec, out_dir, fonts):
    nation = spec.get('nation', '')
    color = NATION_COLORS.get(nation, FALLBACK_COLOR)
    cid = spec['id']
    name = spec.get('name') or ('DIY ' + str(cid))
    tokens = spec.get('tokens') or []
    text = spec.get('text') or '。'.join(str(t) for t in tokens)

    img = Image.new('RGB', (W, H), '#f4f1e8')
    d = ImageDraw.Draw(img)
    f_nation, f_name, f_body, f_small, f_diy = fonts

    d.rectangle([0, 0, W, 74], fill=color)
    d.rectangle([6, 6, W - 7, H - 7], outline='#2b2b2b', width=3)
    d.text((20, 40), nation, font=f_nation, fill='#ffffff', anchor='lm')
    d.rounded_rectangle([W - 98, 16, W - 16, 58], radius=8,
                        fill='#ffffff', outline=color, width=2)
    d.text((W - 57, 37), 'DIY', font=f_diy, fill=color, anchor='mm')

    y = 106
    for ln in wrap(d, name, f_name, W - 56)[:3]:
        d.text((W // 2, y), ln, font=f_name, fill='#1b1b1b', anchor='ma')
        y += 40
    d.line([28, y + 10, W - 28, y + 10], fill=color, width=2)

    y += 34
    for ln in wrap(d, text, f_body, W - 64)[:12]:
        d.text((32, y), ln, font=f_body, fill='#333333')
        y += 30

    d.line([28, H - 66, W - 28, H - 66], fill='#bbbbbb', width=1)
    d.text((W // 2, H - 38),
           'DIY-%s   %s / %s' % (cid, spec.get('deck', ''), spec.get('type', '')),
           font=f_small, fill='#666666', anchor='mm')

    png = os.path.join(out_dir, 'diy_%s.png' % cid)
    webp = os.path.splitext(png)[0] + '.webp'
    img.save(png)
    img.save(webp, 'WEBP', quality=85, method=6)
    return png, webp


def main():
    ap = argparse.ArgumentParser(description='DIY 前奏卡占位卡图生成')
    ap.add_argument('--file', default=DEFAULT_FILE, help='上传 spec JSON 路径')
    ap.add_argument('--out-dir', default=CARDS_DIR, help='卡图输出目录')
    args = ap.parse_args()

    with open(args.file, 'r', encoding='utf-8') as fh:
        raw = json.load(fh)
    specs = raw if isinstance(raw, list) else raw.get('specs', [])
    if not specs:
        print('没有可生成的 spec', file=sys.stderr)
        return 1

    os.makedirs(args.out_dir, exist_ok=True)
    fonts = (load_font(26), load_font(30), load_font(20), load_font(17), load_font(20))
    made = []
    for spec in specs:
        made.append(draw_card(spec, args.out_dir, fonts))
    print('已生成 %d 张占位卡图（PNG + WebP）：' % len(made))
    for png, webp in made:
        print('  %s / %s' % (os.path.basename(png), os.path.basename(webp)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
