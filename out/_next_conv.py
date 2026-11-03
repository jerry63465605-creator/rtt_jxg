import io, os, json, re, datetime

base = (r'C:\Users\24968\AppData\Local\CodeBuddyExtension\Data\24f303d3-eb71-49fb-'
        r'8bf2-cfa15a7486c5\CodeBuddyIDE\24f303d3-eb71-49fb-8bf2-cfa15a7486c5')
mdir = os.path.join(
    base,
    r'history\221579c440ffd2effd2072fa22597ef5\24d0b84a4c86495380f843f211122905\messages')

rows = []
for fn in os.listdir(mdir):
    if not fn.endswith('.json'):
        continue
    p = os.path.join(mdir, fn)
    try:
        st = os.stat(p)
        j = json.load(io.open(p, encoding='utf-8'))
    except Exception:
        continue
    if j.get('role') != 'user':
        continue
    text = ''
    try:
        inner = json.loads(j.get('message', ''))
        for c in inner.get('content', []):
            if c.get('type') == 'text':
                text += c.get('text', '')
    except Exception:
        text = str(j.get('message', ''))
    mq = re.search(r'<user_query>(.*?)</user_query>', text, re.S)
    q = mq.group(1).strip() if mq else ''
    q = re.sub(r'\s+', ' ', q)
    if not q:
        continue
    dt = datetime.datetime.fromtimestamp(st.st_mtime)
    rows.append((dt, fn, q))

rows.sort()
lo = datetime.datetime(2026, 10, 17, 15, 50)
hi = datetime.datetime(2026, 10, 17, 20, 0)
print('=== 10-17 15:50 ~ 20:00 的用户提问 ===')
for dt, fn, q in rows:
    if lo <= dt <= hi:
        print('[%s] %s' % (dt.strftime('%H:%M'), q[:170]))
