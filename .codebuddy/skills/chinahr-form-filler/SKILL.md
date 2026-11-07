---
name: chinahr-form-filler
description: 在中华英才网等中文招聘站自动填简历/申请表时用（含分段表单续填、JS 注入、字段定位）。
---

# Chinahr Form Filler

## Overview

Automates filling of long, multi-section recruitment application forms (target site: `applyjob.chinahr.com/apply/form/job?...`), built with Ant Design (antd) widgets: text inputs, cascaders (专业/城市/技能选择), calendar pickers, radio groups, add-list rows, and per-section 保存 buttons.

All DOM driving is done via the `agent-browser` CLI (`--session-name chr`) plus JS evaluated in the page. Because page opens in a real headed browser and requires login, a human user must log in first; automation then fills the rest.

## Workflow Decision Tree

- User gives a NEW form URL to fill from resume → go to **Step 1**
- User wants to CONTINUE an already-open chinahr session (same URL) → verify session still logged in (screenshot), then go to **Step 3**
- Filling fails on Chinese text / quoting / encoding → read **references/pitfalls.md** and use the Python helpers (never paste Chinese through the CLI directly)
- Need to know which DOM fields exist now (indices shift each page load) → run the probe snippets in **Step 3**

## Step 1 — Open headed session and let the user log in

1. Ensure the browser is open headed so the human can log in:
   `agent-browser --headed --session-name chr open "<form-url>"`
2. Ask the user to log in (QR/account). Never request passwords. Wait for explicit confirmation.
3. Verify: take a screenshot `agent-browser --session-name chr screenshot <tmp.png>` and view it.

The single executable path to always call (avoids cmd-wrapper mangling of JS):
`C:\Users\24968\AppData\Roaming\npm\node_modules\agent-browser\bin\agent-browser-win32-x64.exe`
(helpers in `scripts/form_bot.py` default to this path.)

## Step 2 — Load the user's known data

Read the live user-data document first — it is the source of truth the user edits:
- `c:/Users/24968/Desktop/简历/职位申请_简历已知信息.md`

Fallback embedded copy: `references/resume-data.md`.
If neither exists, extract resume text from `c:/Users/24968/Desktop/简历/周健睿 cs.pdf` (see `references/resume-data.md` for extraction recipe).

## Step 3 — Map the current DOM before filling

Field indices are NOT stable between page loads / after adding list rows. Re-probe every session:

1. Snapshot element refs and structure:
   `agent-browser --session-name chr snapshot -i`
2. Probe current input list (run via `scripts/form_bot.py` `eval_js`):
   ```js
   (function(){var a=document.querySelectorAll('input,select,textarea');
   return JSON.stringify([...a].map(function(el,i){return {i:i,tag:el.tagName,ph:(el.placeholder||'').slice(0,10),ro:el.readOnly,cls:(el.className||'').toString().slice(0,25)};}));})()
   ```
3. Identify form "sections" (教育经历/实习工作经历/社会及校园活动经历/IT技能/语言能力/其他情况…) by clicking their 添加 (<p> or <em> text "添加…") buttons and watching how many new inputs appear.
4. For list sections (education/internship/skill rows): capture the index of the FIRST input of the newly added row, then derive the rest by offset from it (see `references/site-guide.md` for the observed row layouts and offsets).

## Step 4 — Fill values

### RULE 0 — Fixed fill ORDER for every section (user-mandated, 2026-10-13)

Always fill a section in this order. Do **not** interleave:

```
1. plain text inputs      (直接填空: 学校名称/专业/院系/证明人姓名/课程…)
2. dropdowns / selects    (下拉框: 受教育类型/学位/学历/年级排名…)   -> web-form-dropdown skill
3. date pickers           (日期: 入学时间/毕业时间/出生日期)          -> web-form-datepicker skill
4. ask the user           (不确定的内容: 任何拿不准、文档没有、多义、需裁定的项)
```

Why this order matters:
- **Text first**: cheap, no panel state, and it clears the easy majority before any
  popup machinery starts.
- **Dropdowns before dates**: dropdowns can set values that *gate* later fields
  (cascading deps). They also leave stale poppers; the date picker is a separate
  widget that is more sensitive to being clicked while a popper is open.
- **Dates last among the mechanical steps**: they need the most careful
  drive (real CDP click + visible-panel index probing) and should be done when
  nothing else is competing for DOM focus.
- **Ask the user at the END**: batch every uncertainty into ONE question set
  rather than interrupting per-field. Never guess a value to keep moving.

Do not batch across the categories either: finish all the plain text in a
section before touching any dropdown, etc. Re-probe indices after each category
(the DOM shifts when panels/poppers are opened).

Before filling any value, resolve it from the source-of-truth doc — never infer
(it is RULE 0 of `web-form-datepicker` and applies to every field type):
`c:/Users/24968/Desktop/简历/职位申请_简历已知信息.md`.

### Mechanics

Prefer writing a small temp `.py` script that imports `scripts/form_bot.py` and calls its helpers; run it with `python -X utf8`. NEVER pass Chinese text through the CLI command line directly.

Core helpers in `scripts/form_bot.py` (API documented in-file):
- `eval_js(js)` — evaluate JS, returns trimmed string/JSON-unwrapped value
- `fill(idx, text)` — set value of Nth input/select/textarea + fire input/change (native setter)
- `click_input(idx)`, `click_selector(css)`
- Cascader: `pick_after_click(input_idx, [level1, level2, ...])` (global visible-menu matching), `pick_menu_in(container_idx, target)`, `last_menu_items()`, `pick_text_global(target)`
- Calendar: `pick_date(input_idx, year, month, day)`
- `radio(idx)`, `close_menu()`, `screenshot(path)`, `save_section()`, `read_errors()`

Rules of thumb while filling:
- Ant Design cascader inputs render one popup `div.ant-cascader-menus` per open control. Prefer `pick_after_click`/`pick_text_global` (matches across all visible containers). When index-mapped picking is required, `input.ant-cascader-input[i]` ↔ `.ant-cascader-menus[i]`.
- Calendar day cells can lag: `pick_date` retries internally. If it still fails, press Escape and call `pick_date` again.
- After picking, press Escape to close dropdowns before interacting elsewhere.
- Save each section promptly with `save_section()`; read back any validation errors with `read_errors()`; screenshot to confirm before moving on.

## Step 5 — Save, verify, iterate per section

1. `save_section()` clicks the last visible 保存 button and reports errors.
2. `read_errors()` lists visible validation messages (e.g. "请输入证明人", "最多200字").
3. Screenshot and visually check via `read_file` (PNG) before proceeding.
4. When a whole section is done, move to next; update the live data document with fill progress.

## References

- `references/site-guide.md` — observed DOM layout, cascader option trees (school / major / IT skill categories / proficiency), row field offsets, label→index mapping notes, option strings (exact Chinese/English text used).
- `references/pitfalls.md` — encoding, quoting, subprocess, cascader-container, calendar-day and add-row pitfalls with exact fixes.
- `references/resume-data.md` — structured resume content of 周健睿 (from `周健睿 cs.pdf`) incl. extraction recipe.
- `scripts/form_bot.py` — reusable automation module. Copy/import from a temp runner script; keep the temp scripts under the user home dir (e.g. `C:\Users\24968\_xxx.py`) and clean them up afterwards.

## Data source of truth

Keep personal/recruitment data ONLY in the live user doc
`c:/Users/24968/Desktop/简历/职位申请_简历已知信息.md`.
When the user adds data there during a session, update `references/resume-data.md` to stay in sync.
