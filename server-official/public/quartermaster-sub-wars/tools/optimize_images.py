#!/usr/bin/env python3
"""军需官 · 次要战场 —— 图片素材批量转 WebP

背景（2026-10-22 实测）：
  · cards/ 452 张 384x576 RGBA PNG，平均 400 KB/张，合计 176.5 MB；
    但前端只按 120x180 显示、悬停放大 250x375 —— PNG 无损在这里纯浪费。
  · 抽样 12 张 alpha 全不透明，透明通道完全没用上。
  · 转 WebP q85 后：34 KB/张，452 张合计约 15 MB（省 91%），卡面小字仍清晰。
  · map.png 2566 KB -> 340 KB；info/ 五张规则图 1769 KB -> 259 KB。

用法：
    python tools/optimize_images.py                # 全部（cards + map + info）
    python tools/optimize_images.py --quality 82   # 换质量
    python tools/optimize_images.py --only cards   # 只转某一类

原则：
  · 只新增 .webp，**不删除原 .png**（原图作母版留在仓库，发布包排除即可）。
  · 卡片文件名保持不变，仅扩展名从 .png 换成 .webp —— 前端
    play.js:card_img_url() 统一替换后缀，cards.js 的 img 字段无需改动。
  · 图片 URL 换了扩展名即天然破缓存，不需要再加 ?v=。
"""

import argparse
import os
import sys
import time

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)          # quartermaster-sub-wars/
CARDS = os.path.join(ROOT, 'cards')
INFO = os.path.join(ROOT, 'info')
MAP = os.path.join(ROOT, 'map.png')


def convert(src, dst, quality):
    """转单张：统一转 RGB（alpha 实测全不透明），存 WebP。返回 (原字节, 新字节)。"""
    im = Image.open(src)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    im.save(dst, 'WEBP', quality=quality, method=6)
    return os.path.getsize(src), os.path.getsize(dst)


def run(files, quality, label):
    if not files:
        print('[%s] 没有可转换的 PNG' % label)
        return 0, 0
    old_sum = new_sum = 0
    t0 = time.time()
    for i, src in enumerate(files, 1):
        dst = os.path.splitext(src)[0] + '.webp'
        o, n = convert(src, dst, quality)
        old_sum += o
        new_sum += n
        if i % 50 == 0 or i == len(files):
            print('  %s %d/%d ...' % (label, i, len(files)))
    dt = time.time() - t0
    print('[%s] %d 张  %.1f MB -> %.1f MB  省 %.1f%%  用时 %.1fs' % (
        label, len(files), old_sum / 1024 / 1024, new_sum / 1024 / 1024,
        (1 - new_sum / max(old_sum, 1)) * 100, dt))
    return old_sum, new_sum


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quality', type=int, default=85)
    ap.add_argument('--only', choices=['cards', 'map', 'info', 'all'], default='all')
    args = ap.parse_args()

    if not os.path.isdir(CARDS):
        sys.exit('找不到 cards/ 目录：' + CARDS)

    total_old = total_new = 0

    if args.only in ('cards', 'all'):
        files = sorted(os.path.join(CARDS, f) for f in os.listdir(CARDS)
                       if f.lower().endswith('.png'))
        o, n = run(files, args.quality, 'cards')
        total_old += o
        total_new += n

    if args.only in ('map', 'all') and os.path.exists(MAP):
        o, n = run([MAP], args.quality, 'map')
        total_old += o
        total_new += n

    if args.only in ('info', 'all') and os.path.isdir(INFO):
        files = sorted(os.path.join(INFO, f) for f in os.listdir(INFO)
                       if f.lower().endswith('.png'))
        o, n = run(files, args.quality, 'info')
        total_old += o
        total_new += n

    if total_old:
        print('\n合计 %.1f MB -> %.1f MB（省 %.1f%%，质量 q%d）' % (
            total_old / 1024 / 1024, total_new / 1024 / 1024,
            (1 - total_new / total_old) * 100, args.quality))
    print('原 .png 已保留（发布包排除即可）。')


if __name__ == '__main__':
    main()
