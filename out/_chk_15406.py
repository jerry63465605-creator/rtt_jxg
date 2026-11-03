import io, os
p = os.path.join(
    r'C:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars',
    'rules.js')
lines = io.open(p, encoding='utf-8').read().split('\n')

# do_battle 定义行 (1-based)
start = None
for i, l in enumerate(lines):
    if l.startswith('function do_battle'):
        start = i
        break
print('do_battle 起始行:', start + 1 if start is not None else '未找到')

end = None
for i in range(start + 1, min(start + 900, len(lines))):
    if lines[i] == '}':
        end = i
        break
print('do_battle 结束行:', end + 1 if end is not None else '?')

print('\n--- do_battle 函数体内 refresh 出现 ---')
hits = [(j + 1, l.strip()[:100]) for j, l in enumerate(lines)
        if start <= j <= (end if end else start + 500) and 'refresh' in l]
if hits:
    for ln, t in hits:
        print('  L%d: %s' % (ln, t))
else:
    print('  (无)')

print('\n--- 参考卡 16801 哈尔西 块内 refresh / do_battle ---')
for idx, l in enumerate(lines):
    if "'16801'" in l or '"16801"' in l:
        print('块起始 L%d' % (idx + 1))
        for k in range(idx, min(idx + 70, len(lines))):
            if 'refresh' in lines[k] or 'do_battle' in lines[k]:
                print('  L%d: %s' % (k + 1, lines[k].strip()[:100]))
        break

print('\n--- 15406 块(9219起)内 refresh ---')
h2 = [(j + 1, l.strip()[:100]) for j, l in enumerate(lines)
      if 9218 <= j <= 9316 and 'refresh' in l]
if h2:
    for ln, t in h2:
        print('  L%d: %s' % (ln, t))
else:
    print('  (无)')
