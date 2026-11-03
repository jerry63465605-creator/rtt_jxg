import io, os, json, re, datetime

base = (r'C:\Users\24968\AppData\Local\CodeBuddyExtension\Data\24f303d3-eb71-49fb-'
        r'8bf2-cfa15a7486c5\CodeBuddyIDE\24f303d3-eb71-49fb-8bf2-cfa15a7486c5')
mdir = os.path.join(
    base,
    r'history\221579c440ffd2effd2072fa22597ef5\24d0b84a4c86495380f843f211122905\messages')

lo = datetime.datetime(2026, 10, 17, 16, 40)
hi = datetime.datetime(2026, 10, 17, 17, 35)

cands = []
for fn in os.listdir(mdir):
    if not fn.endswith('.json'):
        continue
    p = os.path.join(mdir, fn)
    try:
        dt = datetime.datetime.fromtimestamp(os.stat(p).st_mtime)
    except Exception:
        continue
    if not (lo <= dt <= hi):
        continue
    try:
        j = json.load(io.open(p, encoding='utf-8'))
    except Exception:
        continue
    text = ''
    try:
        inner = json.loads(j.get('message', ''))
        for c in inner.get('content', []):
            if c.get('type') == 'text':
                text += c.get('text', '')
    except Exception:
        continue
    if not text:
        continue
    cands.append((dt, j.get('role'), text))

cands.sort()
print('窗口内消息数:', len(cands))
KW = ('playable', 'us_replay', '17528')
shown = 0
for dt, role, text in cands:
    low = text.lower()
    if not any(k.lower() in low for k in KW):
        continue
    # 抽取关键词周边片段
    snips = []
    for kw in KW:
        for m in re.finditer(re.escape(kw), text, re.I):
            a = max(0, m.start() - 160)
            b = min(len(text), m.end() + 220)
            snips.append(text[a:b].replace('\n', ' | '))
            if len(snips) >= 3:
                break
        if len(snips) >= 3:
            break
    if not snips:
        continue
    print('\n===== [%s] role=%s =====' % (dt.strftime('%H:%M'), role))
    for s in snips[:2]:
        print('   ...' + s[:380] + '...')
    shown += 1
    if shown >= 14:
        print('\n(已达上限，先显示前 14 条)')
        break
