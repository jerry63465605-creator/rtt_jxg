---
name: web-form-datepicker
description: 日期/年月选择器填不动时用（Element-UI .el-date-editor、AntD .ant-calendar-picker）：点了没反应、面板停在年视图、单元格点不动、无法提交。
---

# Web Form Datepicker Filler

## Overview

Chinese recruiting / resume platforms (智联招聘 Moka, 中华英才网, most enterprise HR forms) are built on **Element-UI** or **Ant Design**. Their date pickers are a *three-view state machine*: **day view → click the year header → year view → pick year → month view → pick month → day view → pick day**. Only the final cell click commits the value.

Automating this naively **fails silently**, and the failure looks exactly like "卡住了". Three root causes, all diagnosed in practice (2026-10-13, 智联招聘 / 中国信保 教育经历 — 入学时间):

### Root cause 1 — JS-synthesised clicks do NOT drive the cells

`el.dispatchEvent(new MouseEvent('click'))` **works on the input** (it opens the panel) but is **completely ignored by the year / month / day cells**. The panel never changes view, the field stays empty, and nothing errors — the user sees "点了没反应".

Diagnosis: after a synthetic click on a cell, `panel.innerText` is unchanged (still `2024 年9 月`) and the target cell has **no `selected` class**.

Fix: **cells require a real CDP pointer event.** Use the CLI's `find nth <idx> <sel> click`, never an injected `el.click()`.

### Root cause 2 — CJK selectors are destroyed by the Windows shell

The console is GBK. Passing `input[placeholder='请选择您的入学时间']` on the command line mangles the Chinese into mojibake → `Element not found. Verify the selector is correct`.

Fix: **use ASCII-only class selectors plus numeric indices.**
- field: `.apply-form-date input` (not the placeholder)
- header labels: `.el-date-picker__header-label`
- year cells: `.el-picker-panel.el-date-picker .el-year-table td`
- month cells: `... .el-month-table td`
- day cells: `... .el-date-table td`

Only when JS *must* contain Chinese (e.g. matching a month name or a placeholder) feed it via **`eval --stdin`** with the script in a file — never through argv.

### Root cause 3 — every open creates a NEW panel; closed panels stay in the DOM

`offsetParent === null` marks a dead panel, but the node **remains**. So `.el-year-table td` holds `2 panels × 12 = 24` nodes and the **visible panel is the latter half** (global indices 12–23).

Clicking the *logical* index (year 2026 → index 6) hits the **dead panel**: silent no-op, and the resulting outside-click **closes the whole picker** and discards the entry. This is the most confusing failure mode.

Fix: **before every click, probe the global index among `offsetParent !== null` nodes.** Never compute an index from the panel layout.

## Where this fits in the overall fill order

A section must be filled in this fixed order (user-mandated, 2026-10-13):

```
1. plain text inputs
2. dropdowns / selects   <- web-form-dropdown
3. date pickers          <- THIS SKILL (you come after all dropdowns are done)
4. ask the user
```

Dates are the **last mechanical step**: they need the most careful drive, so do
them when no dropdown popper is competing for DOM focus. Do not start a date
field while a `.el-select-dropdown` / `.ant-cascader-menus` is still open.

## RULE 0 — Decide the VALUE before you touch the picker

**This rule exists because of a real incident (2026-10-13).** The picker was
driven perfectly, but the *value* was invented: 硕士 毕业时间 was filled as
`2026-07-01` — a "2024-09 入学 + 2 年制" arithmetic guess — while the source
document already said `2027-02`. The wrong value was then reported to the user
as "已填 / 已验证". Driving the widget correctly is worthless if the value is
fabricated.

Hard rules for every date field, **before** opening the picker:

1. **Read the source-of-truth document first.** Personal data lives in
   `c:/Users/24968/Desktop/简历/职位申请_简历已知信息.md`. Never fill a date from
   memory, and never from a "typical" assumption.
2. **Never infer a date from 学制 / 常识.** "国内硕士 9 月入学 → 2 年后 7 月毕业",
   "本科四年" etc. are **assumptions, not data**. Overseas programmes break them
   (悉尼大学是南半球学制，8 月入学、2 月毕业；硕士常见 1.5 年制).
3. **If the document gives only year-month** (e.g. `2024-08`, `2027-02`),
   fill **day = 01** (`2024-08-01`, `2027-02-01`). This is the user-agreed
   default. Do not pick the day from a "logical" guess.
4. **If the document and the form disagree, or the document is silent, STOP and
   ask the user.** Do not silently choose.
5. **Report the source, not just the value.** When you say a field is done,
   state where the value came from (e.g. "毕业时间 2027-02-01 ← 文档 §三.1
   预计毕业时间 2027-02，日默认 01").

Quick checklist before driving any date field:

```
[ ] opened 职位申请_简历已知信息.md and located this exact field
[ ] value is copied from the doc, not computed
[ ] only year-month available -> day = 01
[ ] nothing found / conflicting -> asked the user instead of guessing
```

## The Fixed Workflow (per date field)

Follow this exact order. Do not improvise.

```
1. probe_visible_fields()                      # what's empty, what's visible
2. real click the field    -> find nth 0 ".apply-form-date input" click
3. probe panel             -> visible_panel()  # confirm it opened + its view
4. year  : click 年 header -> probe visible .el-year-table td -> click target idx
5. month : click 月 header -> probe visible .el-month-table td -> click target idx
6. day   : probe visible .el-date-table td -> exclude prev/next-month -> click idx
7. read back the input value; if != target, close & redo from step 2
```

Hard rules:

- **Open with a real click on the field**, never `focus()` + keyboard (the picker wants a pointer).
- **Cells: only `find nth <globalIdx> <sel> click`.** A JS click is a silent no-op.
- **Re-probe the global index before EVERY cell click.** Indices shift as views change and as panels accumulate.
- **Never build a selector from a Chinese placeholder on the command line.**
- **Verify by reading `input.value` after the day click.** Empty / stale ⇒ redo whole loop (max 3 attempts).
- **Day numbers repeat** (prev-month / current / next-month). Keep the cell whose class has neither `prev-month` nor `next-month`; use bare `available` / `default`.
- If the year header already shows the target year, **skip the year step** (the panel opened at the last-used date) — but still drive month and day.

## Canonical selector map (Element-UI)

| Thing | ASCII selector |
|---|---|
| the date field input | `.apply-form-date input` (nth 0 = 入学, nth 1 = 毕业) |
| a date field by generic wrapper | `.el-date-editor input` |
| year/month header label | `.el-date-picker__header-label` |
| year cell | `.el-picker-panel.el-date-picker .el-year-table td` |
| month cell | `.el-picker-panel.el-date-picker .el-month-table td` |
| day cell | `.el-picker-panel.el-date-picker .el-date-table td` |
| is-panel-open probe | `.el-picker-panel.el-date-picker` with `offsetParent !== null` |

Month cells are **Chinese** (`一月`…`十二月`); match them inside a `--stdin` script, not on the command line.

## Verification snippet (run after every field)

```python
dp = DatePicker(session="default")
dp.open(".apply-form-date input", nth=0)
dp.set_date(2024, 9, 1)
assert dp.read("请选择您的入学时间") == "2024-09-01"
```

`read()` returns `''` for empty and `'NF'` for not-found — both are failures.

## Common mistakes seen in practice

1. **Using `eval` + `dispatchEvent`** because the panel "opened that way". Opening works; **cells do not**. This is the #1 cause of "卡住了".
2. **Clicking `find nth 6 ".el-year-table td"`** to mean "the 7th year". With two panels in the DOM, index 6 is the *dead* panel → no-op + picker closes.
3. **Passing the Chinese placeholder on the command line** → mojibake → `Element not found`, misleading you into thinking the form is broken.
4. **Assuming the panel opens on today's date.** It opens on the *last used* date (e.g. `2027 年6 月` for a 毕业 field pre-seeded by the form). Always probe the header before driving.
5. **Not excluding `prev-month` / `next-month`** when clicking a day → picks the wrong month.

## References

- `references/diagnosis.md` — how to tell the three root causes apart, with the exact DOM probes.
- `scripts/datepicker.py` — the verified implementation (`DatePicker` class + CLI). Import it; do not rewrite the loop.

## Related skills

- `web-form-dropdown` — for `<select>` / `.el-select` / cascader / `.ant-select` controls. **Use that skill for dropdowns; use this one for date pickers.** Do not mix the two loops.
- `chinahr-form-filler` — Ant Design side of 中华英才网 (its own calendar variant + section save).

## Source of truth

Personal data lives in `c:/Users/24968/Desktop/简历/职位申请_简历已知信息.md`. Read it before filling; never hardcode personal values inside this skill.
