# -*- coding: utf-8 -*-
"""解析 do_action 的 action 分支，产出拆分清单"""
import io
import re

BASE = r'C:\Users\24968\Desktop\rtt\server-official\public\quartermaster-sub-wars'
txt = io.open(BASE + r'\rules.js', encoding='utf-8', errors='replace').read()
lines = txt.split('\n')

# --- 1) 定位 do_action 函数体（括号计数） ---
m = re.search(r'^function do_action\s*\(', txt, re.M)
fstart = m.start()
i = txt.index('{', fstart)
depth = 0
j = i
while j < len(txt):
    c = txt[j]
    if c == '{':
        depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0:
            break
    j += 1
fend = j
body = txt[fstart:fend]
body_start_line = txt[:fstart].count('\n') + 1
body_end_line = txt[:fend].count('\n') + 1

out = []
out.append('do_action 位置：第 %d 行 ~ 第 %d 行（共 %d 行）'
           % (body_start_line, body_end_line, body_end_line - body_start_line + 1))

# --- 2) 找 if (action === 'xxx') 分支 ---
# 同时处理 if (action === 'a' || action === 'b')
pat = re.compile(r"if\s*\(\s*action\s*===\s*'([^']+)'(.*?)\)\s*\{", re.S)
hits = []
for mm in pat.finditer(body):
    # 该 if 的绝对行号
    ln = body[:mm.start()].count('\n') + body_start_line
    # 提取所有 || 连接的 action 名
    seg = mm.group(0)
    names = re.findall(r"action\s*===\s*'([^']+)'", seg)
    hits.append({'line': ln, 'names': names, 'pos': mm.start()})

out.append('\n=== if (action === ...) 分支：%d 处 ===' % len(hits))

# --- 3) 每处分支的行数（到下一个分支或函数末尾） ---
rows = []
for k, h in enumerate(hits):
    endpos = hits[k + 1]['pos'] if k + 1 < len(hits) else len(body)
    ln = body[h['pos']:endpos].count('\n')
    rows.append((h['line'], '+'.join(h['names']), ln))

total = sum(r[2] for r in rows)
out.append('这些分支合计 %d 行，占 do_action 的 %.1f%%' % (total, total * 100.0 / (body_end_line - body_start_line + 1)))

out.append('\n=== 按行数降序（前 30） ===')
for ln, name, sz in sorted(rows, key=lambda r: -r[2])[:30]:
    tag = name if len(name) < 46 else name[:43] + '...'
    out.append('  L%-6d %-46s %5d 行' % (ln, tag, sz))

out.append('\n=== 按行数升序（后 20，可能是小分支） ===')
for ln, name, sz in sorted(rows, key=lambda r: r[2])[:20]:
    out.append('  L%-6d %-46s %5d 行' % (ln, name[:46], sz))

# --- 4) 是否有多 action 合并的分支 ---
multi = [r for r in rows if '+' in r[1]]
out.append('\n=== 合并了多个 action 的分支：%d 处 ===' % len(multi))
for ln, name, sz in multi[:12]:
    out.append('  L%-6d %s  (%d 行)' % (ln, name, sz))

# --- 5) 函数开头的共享前置逻辑 ---
first_if = hits[0]['pos'] if hits else 0
prelude = body[:first_if]
out.append('\n=== do_action 开头的共享逻辑（第一个 if 之前）：%d 行 ===' % prelude.count('\n'))
for ln in prelude.split('\n')[:22]:
    out.append('  | ' + ln[:100])

# --- 6) 函数结尾（最后一个分支之后） ---
last_if = hits[-1]['pos'] if hits else 0
tail = body[last_if:]
last_brace = tail.rfind('}')
tail_after = tail[:last_brace]
out.append('\n=== 最后一个分支之后的收尾逻辑：%d 行 ===' % tail_after.count('\n'))
for ln in tail_after.split('\n')[-16:]:
    out.append('  | ' + ln[:100])

# --- 7) 统计 action 名总数 ---
allnames = []
for h in hits:
    allnames.extend(h['names'])
out.append('\n=== action 名总数：%d 个（去重后 %d） ===' % (len(allnames), len(set(allnames))))

io.open(BASE + r'\_audit_doaction.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('written', len(out), 'lines')
