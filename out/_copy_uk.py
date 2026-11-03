import os, shutil, hashlib

q = r'C:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars'
tts = os.path.join(q, 'cards_tts', 'uk')
cards = os.path.join(q, 'cards')

# 识图确认的映射: card_id -> 切片文件
mapping = {
    15349: 'uk2_r0c0.png',   # 萨宾行动 (EVENT)
    15350: 'uk1_r0c0.png',   # 奇袭塔兰托 (EFFECT)
    15351: 'uk3_r0c6.png',   # 敦刻尔克大撤退
    15352: 'uk3_r0c5.png',   # 布莱切利园
    15353: 'uk3_r0c9.png',   # 保持冷静·继续前进
    15354: 'uk3_r0c7.png',   # 加拿大进入动员
    15355: 'uk3_r0c8.png',   # 特种空勤团突袭机场
    15356: 'uk2_r0c1.png',   # 地中海基地 (STATUS)
}


def md5(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(65536), b''):
            h.update(b)
    return h.hexdigest()


for cid in sorted(mapping):
    src = os.path.join(tts, mapping[cid])
    dst = os.path.join(cards, 'crop_%d.png' % cid)
    if not os.path.exists(src):
        print('!! 源缺失 %s' % mapping[cid])
        continue
    before = md5(dst) if os.path.exists(dst) else '(新建)'
    shutil.copyfile(src, dst)
    status = '覆盖' if before != '(新建)' else '新建'
    same = (before == md5(dst))
    print('crop_%d.png  <- %-14s %s %s' % (
        cid, mapping[cid], status, '(内容未变)' if same else ''))
