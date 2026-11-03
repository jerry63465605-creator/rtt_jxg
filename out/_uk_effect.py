import io, re

p = r'C:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\cards.js'
src = io.open(p, encoding='utf-8').read()

chunks = re.split(r'\{\s*"id"\s*:', src)
cards = []
for ch in chunks[1:]:
    mid = re.match(r'\s*(\d+)', ch)

    def f(k, s=ch):
        m = re.search(r'"%s"\s*:\s*"([^"]*)"' % k, s)
        return m.group(1) if m else ''
    cards.append((mid.group(1) if mid else '?', f('name'), f('type'), f('nation'), f('img')))

print('解析到卡块:', len(cards))

uk = [c for c in cards if '英' in c[3]]
print('英国卡总数:', len(uk))

from collections import Counter
print('\n=== 英国卡类型分布 ===')
for t, n in Counter(c[2] for c in uk).most_common():
    print('  %-10s %d' % (t or '(空)', n))

eff = [c for c in uk if c[2] == 'EFFECT']
print('\n=== 英国增强卡 (EFFECT) 共 %d 张 ===' % len(eff))
for cid, name, typ, nation, img in sorted(eff, key=lambda x: int(x[0])):
    print('  %s  《%s》  img=%s' % (cid, name, img or '(无)'))
