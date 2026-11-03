import io, re

p = r'C:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\cards.js'
src = io.open(p, encoding='utf-8').read()

names = ['奇袭塔兰托', '萨宾行动', '地中海基地',
         '布莱切利园', '敦刻尔克大撤退', '加拿大进入动员',
         '特种空勤团突袭机场', '保持冷静', '皇冠上的明珠',
         '告法国人民书', '道丁系统', '抵抗万岁']

chunks = re.split(r'\{\s*"id"\s*:', src)
for c in chunks[1:]:
    m = re.match(r'\s*(\d+)', c)
    cid = m.group(1) if m else '?'

    def f(k, s=c):
        mm = re.search(r'"%s"\s*:\s*"([^"]*)"' % k, s)
        return mm.group(1) if mm else ''
    nm = f('name')
    hit = any(t in nm for t in names)
    if hit:
        print('%s  《%s》  type=%-8s nation=%s ops=%s img=%s' % (
            cid, nm, f('type') or '(空)', f('nation'), f('ops'), f('img') or '(无)'))
