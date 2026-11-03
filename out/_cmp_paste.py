import io, re

p = r'C:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\cards.js'
src = io.open(p, encoding='utf-8').read()
chunks = re.split(r'\{\s*"id"\s*:', src)

cards = {}
for c in chunks[1:]:
    m = re.match(r'\s*(\d+)', c)
    cid = m.group(1) if m else '?'

    def f(k, s=c):
        mm = re.search(r'"%s"\s*:\s*"([^"]*)"' % k, s)
        return mm.group(1) if mm else ''
    cards[cid] = {'name': f('name'), 'type': f('type'), 'nation': f('nation'),
                  'img': f('img'), 'deck': f('deck')}

print('磁盘 cards.js 卡数:', len(cards))
print('\n--- 关键 id 现状 ---')
for cid in ['15349', '15350', '15351', '15352', '15353', '15354', '12503', '12504']:
    c = cards.get(cid)
    if c:
        print('  %s  《%s》  type=%-8s img=%s' % (cid, c['name'], c['type'], c['img']))
    else:
        print('  %s  (不存在)' % cid)

print('\n--- 这两个名字在磁盘里有吗 ---')
for nm in ['地中海基地', '特种空勤团', '萨宾行动', '奇袭塔兰托']:
    hit = [(k, v['name'], v['type']) for k, v in cards.items() if nm in v['name']]
    print('  %s: %s' % (nm, hit if hit else '(没有)'))

print('\n--- 磁盘英国 EFFECT 全表 ---')
eff = [(k, v['name']) for k, v in cards.items() if v['nation'] == '英国' and v['type'] == 'EFFECT']
for k, n in sorted(eff, key=lambda x: int(x[0])):
    print('  %s  《%s》' % (k, n))
print('  共 %d 张' % len(eff))
