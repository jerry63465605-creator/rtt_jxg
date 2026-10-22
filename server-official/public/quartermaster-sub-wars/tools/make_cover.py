#!/usr/bin/env python3
"""军需官 · 次要战场 —— 生成大厅封面（thumbnail / cover）

RTT 上层取图约定（views/head.pug:21、games_library.pug:45）：
    <title_id>/thumbnail.jpg    108x144   （大厅 / 公共列表缩略图）
    <title_id>/cover.1x.jpg     150x200   （详情页封面）
    <title_id>/cover.2x.jpg     300x400   （2 倍率）
PoG 的实测规格即上述尺寸（另有一张 876x1168 的 cover.png 母版）。

素材来源：本模块自带 map.png（4835x1612 世界地图），裁欧洲战区做底图 ——
不引入任何外部版权素材，可安全随模块分发。

用法：
    python tools/make_cover.py             # 默认
    python tools/make_cover.py --blur 8    # 换底图模糊强度

输出会覆盖同名 jpg/png；要改样式请改本脚本后重跑，不要手改生成结果。
"""

import argparse
import os

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAP = os.path.join(ROOT, 'map.png')

MASTER = (876, 1168)   # 3:4 母版

FONT_CANDIDATES = [
    r'C:\Windows\Fonts\msyhbd.ttc',   # 微软雅黑 Bold
    r'C:\Windows\Fonts\msyh.ttc',
    r'C:\Windows\Fonts\simhei.ttf',
    r'C:\Windows\Fonts\arialbd.ttf',
]

GOLD = (255, 212, 121)
WHITE = (246, 246, 243)
GREY = (176, 186, 196)


def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def bg_gradient(size, top=(13, 19, 26), bottom=(38, 55, 70)):
    """深海军蓝竖向渐变底色（不用地图糊满，避免竖裁只截到非洲）。"""
    w, h = size
    strip = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        strip.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return strip.resize((w, h))


def build(blur):
    W, H = MASTER
    base = bg_gradient(MASTER).convert('RGBA')
    d = ImageDraw.Draw(base)

    def center(text, font, y, fill, shadow=True):
        box = d.textbbox((0, 0), text, font=font)
        tw = box[2] - box[0]
        x = (W - tw) // 2
        if shadow:
            d.text((x + 3, y + 3), text, font=font, fill=(0, 0, 0, 160))
        d.text((x, y), text, font=font, fill=fill)

    # ---- 标题 ----
    center('军需官', load_font(152), 112, WHITE)
    center('次 要 战 场', load_font(74), 318, GOLD)
    d.line([(W * 0.28, 442), (W * 0.72, 442)], fill=GOLD, width=4)
    d.line([(W * 0.38, 460), (W * 0.62, 460)], fill=(255, 212, 121, 150), width=2)

    # ---- 世界地图横条（整图缩放，辨识度高）----
    src = Image.open(MAP).convert('RGB')
    sw = W - 2 * 74
    sh = int(src.size[1] * sw / src.size[0])
    strip = src.resize((sw, sh), Image.LANCZOS)
    strip = strip.filter(ImageFilter.GaussianBlur(blur * 0.4))
    strip = ImageEnhance.Brightness(strip).enhance(0.9)
    sx = (W - sw) // 2
    sy = 520
    # 阴影 + 白框（模拟纸地图）
    shadow = Image.new('RGBA', MASTER, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle(
        [sx + 8, sy + 10, sx + sw + 8, sy + sh + 10], fill=(0, 0, 0, 120))
    base = Image.alpha_composite(base, shadow)
    frame = Image.new('RGBA', (sw + 8, sh + 8), (238, 234, 224, 255))
    frame.paste(strip, (4, 4))
    base.paste(frame, (sx - 4, sy - 4))
    d = ImageDraw.Draw(base)

    # ---- 副标题 ----
    center('QUARTERMASTER : SUB WARS', load_font(30), sy + sh + 52, GREY)
    center('轴心 vs 同盟 · 全球补给战', load_font(28), sy + sh + 104, (196, 206, 216))

    # ---- 底部信息 ----
    center('2 人 · 20 回合 · 1941—1945', load_font(28), H - 96, (222, 228, 234))

    # ---- 边框（内白外深）----
    border = Image.new('RGBA', MASTER, (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.rectangle([0, 0, W - 1, H - 1], outline=(8, 12, 16, 255), width=10)
    bd.rectangle([10, 10, W - 11, H - 11], outline=(240, 236, 226, 210), width=3)
    return Image.alpha_composite(base, border).convert('RGB')


def build_thumb():
    """108x144 缩略图单独排版：小字缩下去会糊成噪点，这里只留必要信息。"""
    W, H = 108, 144
    base = bg_gradient((W, H), (15, 22, 29), (34, 49, 63)).convert('RGBA')
    d = ImageDraw.Draw(base)

    def center(text, font, y, fill):
        box = d.textbbox((0, 0), text, font=font)
        tw = box[2] - box[0]
        d.text(((W - tw) // 2, y), text, font=font, fill=fill)

    center('军需官', load_font(31), 7, WHITE)
    center('次要战场', load_font(15), 42, GOLD)
    d.line([(16, 62), (W - 16, 62)], fill=GOLD, width=1)

    src = Image.open(MAP).convert('RGB')
    sw = W - 14
    sh = max(1, int(src.size[1] * sw / src.size[0]))
    base.paste(src.resize((sw, sh), Image.LANCZOS), (7, 72))
    d.rectangle([6, 71, W - 7, 72 + sh], outline=(238, 234, 224, 220), width=1)

    center('2 P · 1941—45', load_font(12), 72 + sh + 12, GREY)

    bd = ImageDraw.Draw(base)
    bd.rectangle([0, 0, W - 1, H - 1], outline=(10, 14, 18, 255), width=2)
    bd.rectangle([2, 2, W - 3, H - 3], outline=(236, 232, 222, 180), width=1)
    return base.convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--blur', type=float, default=4.0)
    args = ap.parse_args()

    if not os.path.exists(MAP):
        raise SystemExit('找不到 map.png：' + MAP)

    master = build(args.blur)
    jobs = [
        ('cover.png', master),
        ('cover.2x.jpg', master.resize((300, 400), Image.LANCZOS)),
        ('cover.1x.jpg', master.resize((150, 200), Image.LANCZOS)),
        ('thumbnail.jpg', build_thumb()),      # 单独排版，不用母版缩放
    ]
    for name, im in jobs:
        p = os.path.join(ROOT, name)
        if name.endswith('.png'):
            im.save(p, 'PNG', optimize=True)
        else:
            im.save(p, 'JPEG', quality=88, optimize=True, subsampling=1)
        print('%-16s %4dx%-4d %6.1f KB' % (name, im.size[0], im.size[1],
                                           os.path.getsize(p) / 1024))


if __name__ == '__main__':
    main()
