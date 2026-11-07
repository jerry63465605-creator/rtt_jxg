---
name: web-form-dropdown
description: AntD/Element 下拉、级联、日期面板"点了不生效/打开错的下拉/选了不回填"时用；含 agent-browser 驱动与提交校验。
---

# Web Form Dropdown Filler

## Overview

Chinese recruiting/resume platforms (智联招聘 Moka, 中华英才网, and most enterprise HR forms) are built on **Ant Design** or **Element-UI**. Their dropdowns fail in a very specific way when automated naively: the click "succeeds" but the value never commits, or the **wrong (stale) dropdown panel** opens and you select into it.

Root causes, all diagnosed in practice:

1. **`.el-select` / `.ant-select` count ≠ `input` count.** Locating a dropdown by "the Nth input" hits the wrong control. Element-UI renders a hidden `input` per select plus inner inputs; the visual control and the DOM input are not 1:1 across the page.
2. **Poppers are reused and kept in the DOM.** After switching fields, old `.el-select-dropdown` / `.ant-cascader-menus` nodes remain (display:none or still visible) and the "last visible panel" heuristic can grab an outdated one.
3. **JS `.click()` is often not enough.** Element-UI listens for real pointer events (`mousedown`/`mouseup`). Use the CLI's **native click**, not an injected `el.click()`.
4. **Cascading dependencies.** 教育类型 → 学历 → 学位: the option list of a child field is fetched after the parent changes, so an empty option list usually means "fill the parent first", not "the picker is broken".
5. **Date pickers commit only on the last cell click** and reset the panel between year/month/day, so a plain "set value" never works.

This skill encodes the fixed workflow that avoids all of the above.

## Where this fits in the overall fill order

A section must be filled in this fixed order (user-mandated, 2026-10-13):

```
1. plain text inputs    <- you are the LAST mechanical step before dates
2. dropdowns / selects  <- THIS SKILL
3. date pickers         <- web-form-datepicker
4. ask the user
```

So: **finish all plain text first**, then run this skill over every dropdown in
the section, and only then move on to date pickers. Do not interleave — each
opened popper leaves stale DOM that the next category must not trip over.

## The Fixed Workflow (per dropdown)

Follow this exact order. Do not improvise.

```
1. close_all_dropdowns()            # body click + Escape x2
2. tag_by_placeholder("请选择您的学历")   # mark the ONE target input
3. native click [data-dd="1"]        # CLI click, real pointer events
4. visible_opts()                    # read the option texts
5. pick_exact("硕士研究生")            # exact-text click (char-code match)
6. read_value("请选择您的学历")         # read back
7. if value != target -> retry (max 3)      # each attempt re-runs 1-6
```

Hard rules:

- **Locate by placeholder, never by global input index.** The placeholder is the only stable identity.
- **Always clean stale poppers first** (step 1). This is what prevents "wrong dropdown opened".
- **Always use native click** for opening and for picking when possible.
- **Always read back and verify.** A silent no-op is the #1 failure mode; verifying is the only defense.
- **Retry as a whole loop**, not just the pick — a stale panel may need a fresh open.
- **If the option list is empty**, treat it as a **dependency problem**: fill the parent field first, then retry.
- **Exact match only.** Use `===` on trimmed text; substring matching picks "硕士" for "硕士研究生" style collisions. When writing the target in a script, encode it as char codes so encoding never corrupts it.

## Cascader (multi-level, Ant Design)

For `.ant-cascader-menus` (province→city→district, 学科→专业, 技能→子类):

- Each opened cascader owns its own `.ant-cascader-menus` container. When several were opened, prefer matching **by option text across visible containers**, not by container index.
- Click level by level; **the panel must re-render before the next level's options exist** (`menu` count increases). Wait ~0.9s between levels.
- Closing: `Escape` then `body.click()`. `Escape` alone does not always remove the popper.
- Some cascaders expose a **search box**: typing a keyword filters options, which is far more reliable than scrolling — but only when the control is a searchable cascader.

## Date / Month Pickers

**Do not handle date pickers with this skill's loop.** Use the dedicated
`web-form-datepicker` skill instead (`scripts/datepicker.py`). Date pickers have
their own hard requirements this skill does not cover:

- cells ignore JS-synthesised clicks — they need a **real CDP click**;
- panels are **duplicated in the DOM** once closed, so cell indices must be
  resolved from the *visible* subset;
- the view is a three-step state machine (year → month → day).

Short version if you cannot load that skill: the picker commits **only after
the final cell click**, panels are stateful, and you must read the value back.

## Verification Snippet (run after every field)

```python
def read_value(ph_part):
    js = """(function(ph){
    var a=[...document.querySelectorAll('input,select,textarea')];
    for(var i=0;i<a.length;i++){
      if((a[i].placeholder||'').indexOf(ph)>=0 && a[i].offsetParent!==null) return (a[i].value||'(空)');
    }
    return 'NF';})( %s )""" % json.dumps(ph_part)
    return ev(js)
```

## References

- `references/diagnosis.md` — how to diagnose which of the 5 root causes you are hitting, with the DOM probes that reveal it (control↔input mapping, stale popper inventory, aria/ownership attributes).
- `references/platforms.md` — per-platform notes: 智联招聘/Moka (Element-UI), 中华英才网 (Ant Design), and the observed option texts for 学历/学位/年级排名/海外经历.
- `scripts/dropdown.py` — the verified implementation. Import it; do not rewrite the loop.

## Related skills

- **`web-form-datepicker`** — REQUIRED for every date / month / year picker
  (`.el-date-editor`, `.ant-calendar-picker`). Its `scripts/datepicker.py` owns
  the year→month→day drive and the duplicate-panel index resolution. Do not
  attempt date fields with this skill.
- `chinahr-form-filler` — Ant Design side of 中华英才网 (cascader menus,
  calendar, section save). Use it for that site; use this skill as the general,
  framework-agnostic dropdown workflow.

## Source of truth

Personal data lives in `c:/Users/24968/Desktop/简历/职位申请_简历已知信息.md`. Read it before filling; never hardcode personal values inside this skill.
