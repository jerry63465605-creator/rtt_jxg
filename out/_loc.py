import io

p = r'C:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars\cards.js'
lines = io.open(p, encoding='utf-8').read().split('\n')

targets = ['15349', '12503', '12504']
for t in targets:
    for i, l in enumerate(lines):
        if '"id": %s,' % t in l or '"id": %s' % t in l:
            print('===== id %s  起始行 %d =====' % (t, i + 1))
            for k in range(i, min(i + 10, len(lines))):
                print('%d: %s' % (k + 1, lines[k]))
            print()
            break
