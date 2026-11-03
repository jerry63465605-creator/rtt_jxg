import difflib, sys
cur, snap = sys.argv[1], sys.argv[2]
a = open(cur, encoding='utf-8').read().splitlines()
b = open(snap, encoding='utf-8').read().splitlines()
print('当前行数', len(a), ' 卷影行数', len(b))
diff = list(difflib.ndiff(a, b))
add = sum(1 for x in diff if x.startswith('+ '))
rem = sum(1 for x in diff if x.startswith('- '))
print('相对当前: 卷影多出(应保留)行', add, ' 当前多出行', rem)
print('===== unified diff (前120行) =====')
for line in list(difflib.unified_diff(a, b, '当前HEAD', '卷影副本', lineterm=''))[:120]:
    print(line)
