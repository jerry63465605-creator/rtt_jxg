# Diagnosis — why the date picker "卡住了"

Three independent causes produce the same user-visible symptom ("点了没反应").
Run the probes below in order; the first one that fires tells you which cause
you are hitting.

All probes are run as **files piped into `agent-browser eval --stdin`**, never
as command-line arguments (see Cause 2).

---

## Probe A — is the panel even open, and which view is it on?

```js
(() => {
  var ps = document.querySelectorAll('.el-picker-panel.el-date-picker');
  var vis = [];
  ps.forEach(function (p) {
    if (p.offsetParent === null) return;
    var r = p.getBoundingClientRect();
    vis.push({ left: Math.round(r.left), top: Math.round(r.top),
               txt: (p.innerText || '').slice(0, 80).replace(/\n/g, '|') });
  });
  return JSON.stringify({ visiblePanels: vis });
})()
```

Read the result:

| `visiblePanels` | meaning |
|---|---|
| `[]` | panel closed — the last click landed *outside* (see Cause 3) or hit a dead cell |
| 1 entry, text `2024 年9 月` | **day view** |
| 1 entry, text `2024 年` + `一月…十二月` | **month view** |
| 1 entry, text `2020 年 - 2029 年` | **year view** |

Also: **how many nodes** exist in total vs visible?

```js
(() => {
  var a = document.querySelectorAll('.el-picker-panel.el-date-picker .el-year-table td');
  var n = 0; a.forEach(function (t) { if (t.offsetParent !== null) n++; });
  return 'total=' + a.length + ' visible=' + n;
})()
```

`total = 24, visible = 12` is the normal **two-panel** situation. Any click you
compute as a "layout index" will be off by the dead-panel offset.

---

## Cause 1 — synthetic clicks are ignored by the cells

**Symptom:** the field is still empty, but the panel *did* open when you
clicked the input. No error anywhere.

**Probe:** click the year header with JS, then read the panel text:

```js
(() => {
  var l = null;
  document.querySelectorAll('.el-date-picker__header-label').forEach(function (x) {
    if (x.offsetParent !== null && /年/.test(x.textContent)) l = x;
  });
  if (!l) return 'no year label';
  var r = l.getBoundingClientRect();
  var o = { bubbles: true, cancelable: true, view: window,
            clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
  l.dispatchEvent(new MouseEvent('mousedown', o));
  l.dispatchEvent(new MouseEvent('mouseup', o));
  l.dispatchEvent(new MouseEvent('click', o));
  return 'dispatched';
})()
```

Then re-run Probe A. If the panel is **still on day view**, you have confirmed
Cause 1: **synthetic events do not drive this widget.** Switch to
`find nth <idx> <sel> click`.

**Discriminator:** the input-click *works* with synthetic events but the cells
*do not*. That asymmetry is the signature of Cause 1. If even opening the panel
failed, you probably have Cause 2.

---

## Cause 2 — CJK selector mangled by the shell

**Symptom:** `Element not found. Verify the selector is correct and the element
exists in the DOM.` — yet the element is plainly there in the inspector.

**Probe:** compare what the shell actually delivered. In PowerShell, running

```powershell
npx agent-browser eval "document.querySelector(\"input[placeholder='请选择您的入学时间']\") && 'ok'"
```

often reports a syntax/element error, while the same string inside a script file
fed through `--stdin` succeeds. The console code page (GBK / cp936) re-encodes
the CJK on the way through `argv`.

**Fix:** never put CJK in argv.
- Prefer ASCII class selectors (see the selector map in SKILL.md).
- When CJK is unavoidable (month names, placeholder matching), write a `.js`
  file and pipe it:

```powershell
$js = Get-Content -LiteralPath 'c:\path\_probe.js' -Raw -Encoding UTF8
$js | npx --yes agent-browser --session-name default eval --stdin
```

**Corollary:** write probe scripts to an **ASCII-only path** (e.g.
`c:\Users\...\rtt\_probe.js`). A CJK directory name (like `简历`) can itself be
mangled in `-LiteralPath` on some consoles.

---

## Cause 3 — dead duplicate panel eats the click

**Symptom:** you click what you believe is the right cell; **nothing happens
and the picker closes**. Re-opening shows the panel back at its previous date.

**Probe:** find where a given value lives globally, split by visibility:

```js
(() => {
  var all = document.querySelectorAll('.el-picker-panel.el-date-picker .el-year-table td');
  var hit = [];
  all.forEach(function (td, i) {
    if ((td.textContent || '').trim() === '2026')
      hit.push({ globalIdx: i, visible: td.offsetParent !== null });
  });
  return JSON.stringify(hit);
})()
```

Expected output — note **two** hits:

```json
[{"globalIdx":6,"visible":false},{"globalIdx":18,"visible":true}]
```

Index 6 is the **dead** panel. Clicking it does nothing useful and dismisses
the picker. **You must use index 18.**

**Fix:** always resolve the index from the visible subset:

```js
(function(sel, want){
  var all = document.querySelectorAll(sel);
  var out = [];
  for (var i=0;i<all.length;i++){
    if (all[i].offsetParent===null) continue;
    var t=(all[i].textContent||'').trim();
    if (!t || (want && want.length && want.indexOf(t)<0)) continue;
    out.push({i:i,t:t,c:String(all[i].className).slice(0,40)});
  }
  return JSON.stringify(out);
})(SELECTOR, TARGETS)
```

---

## Post-mortem of the 2026-10-13 incident

Field: 智联招聘 / 中国信保 教育经历 → 研究生 → 入学时间.
Value needed: `2024-09-01`.

Sequence that *failed*:

1. Synthetic click on the input → panel opened at `2023 年9 月`.
2. Synthetic click on the year header → **no view change**.
3. Synthetic click on `2024` → **no selection**.
4. `find nth 6`.el-year-table td` click` → year changed to 2024 (visible panel
   happened to be the *only* one at that moment) → month view.
5. `find nth 8 ".el-month-table td" click` → picked 九月.
6. `find nth 7 ".el-date-table td" click` → **`2024-09-01` committed.** ✓

The *second* field exposed Cause 3: after step 6 there were now **two** panels
in the DOM. `find nth 6 ".el-month-table td"` for July hit the **dead** panel →
no-op → outside-click closed the picker → value stayed empty. Re-probing the
visible subset gave the true global index (18), and the click committed.

Layered fix that now works reliably:
`real click field` → `probe visible panel` → `probe visible cells` →
`click global index` → `read back value`.

---

## Second failure in the same incident — the VALUE was invented (Cause 4)

The picker worked, but the **value** was fabricated. This is a separate class of
bug and the more dangerous one, because it fails *silently and confidently*.

What happened:

- 硕士 · 入学时间 was filled as `2024-09-01`. Source doc said `2024-08`
  (悉尼大学 南半球学制, 8 月开学). Filled 9 月 by "domestic default" assumption.
- 硕士 · 毕业时间 was filled as `2026-07-01`. Source doc said `2027-02`.
  This value was **pure arithmetic** ("2024-09 入学 + 2 年制 → 2026-07"), not
  data. Nothing in any source produced `2026-07-01`.
- Both were then reported to the user as "已填 / 已验证" — a fabricated value
  presented as a verified fact.

Why it is easy to miss: the widget-level verification (`read()` returns a
non-empty string) **passes**. The DOM says the field is filled. Only a
comparison against the source document reveals it is wrong.

Prevention — see **RULE 0** in SKILL.md. In short:

1. Read `职位申请_简历已知信息.md` **before** opening any picker.
2. Copy the date; never compute it from 学制 or "common practice".
3. Only year-month given → **day = 01**.
4. Doc silent or contradicts the form → **ask, do not guess**.
5. When reporting, cite the source line, not just the value.

Discriminator to remember:

| symptom | cause | fix |
|---|---|---|
| field empty, panel unchanged | Cause 1/3 (click never landed) | real CDP click on visible-panel index |
| field filled, but wrong date | **Cause 4 (value invented)** | read the source doc; RULE 0 |
