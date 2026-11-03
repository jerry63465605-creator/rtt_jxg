import io, re, os

q = r'C:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars'
cards_src = io.open(os.path.join(q, 'cards.js'), encoding='utf-8').read()
rules_src = io.open(os.path.join(q, 'rules.js'), encoding='utf-8').read()

ids = [15349, 15350, 15351, 15352, 15353, 15354, 15355, 15356,
       12503, 12504, 15448,
       17851, 17852, 17853, 17854, 17855,
       17750, 17751]

# 从 cards.js 取名字/类型/文字
info = {}
for c in re.split(r'\{\s*"id"\s*:', cards_src)[1:]:
    m = re.match(r'\s*(\d+)', c)
    if not m:
        continue
    cid = m.group(1)

    def f(k, s=c):
        mm = re.search(r'"%s"\s*:\s*"([^"]*)"' % k, s)
        return mm.group(1) if mm else ''
    if int(cid) in ids:
        info[int(cid)] = (f('name'), f('type'), f('nation'), f('text'))

print('%-7s %-4s %-9s %-6s %-30s %s' % ('id', '国', '类型', 'rules', '卡名', '文字(节选)'))
print('-' * 120)
for cid in ids:
    n = rules_src.count("'%d'" % cid) + rules_src.count('"%d"' % cid)
    name, typ, nat, text = info.get(cid, ('(缺失)', '?', '?', ''))
    impl = ('已实现(%d)' % n) if n else '未实现'
    t = text[:38]
    print('%-7d %-4s %-9s %-9s %-30s %s' % (cid, nat[:2], typ, impl, name[:28], t))
