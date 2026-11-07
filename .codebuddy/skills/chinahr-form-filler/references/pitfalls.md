# Pitfalls & exact fixes (learned the hard way)

## 1. Chinese text through the Windows command line gets mangled

PowerShell + `agent-browser ... eval "...中文..."` corrupts CJK (cmd wrapper / code page).
**Fix:** never paste Chinese via CLI. Always run a `.py` runner that imports
`form_bot` and calls `eval_js` / `fill` / `pick_*`; run `python -X utf8 runner.py`.
`js_str()` emits ASCII-only `\uXXXX` escapes; menu matching uses char-code predicates
(`menu_pred`) — both are encoding-proof.

## 2. Calling `agent-browser` via the npm `.cmd` wrapper breaks JS

`agent-browser.cmd` is a batch file; arguments like `(function(){...})()` get split and
the JS arrives corrupted (errors like `✗`, syntax errors).
**Fix:** call the real exe directly:
`C:\Users\24968\AppData\Roaming\npm\node_modules\agent-browser\bin\agent-browser-win32-x64.exe`
`form_bot.run()` already does this and always appends `--session-name chr`.

## 3. `subprocess` with the npm wrapper also fails

Even in Python, spawning the `.cmd` adds a shell layer. Use the exe path
(`CHINAHR_AB` env override available in `form_bot.py`). Decode output as utf-8.

## 4. Multiple cascader popups coexist — wrong container selected

When several pickers were opened in sequence, several `.ant-cascader-menus` divs stay in
the DOM (some hidden). Naive "take the last menu" clicks the wrong (hidden/old) one and the
value doesn't change — the previous item is silently overwritten or nothing happens.
**Fixes:**
- `pick_text_global(target)`: scan ALL containers, rank visible first, click the matching `li`.
- Index-mapped picking (`pick_menu_in(ci, ...)`): only valid while each `input.ant-cascader-input`
  maps 1:1 to `.ant-cascader-menus[ci]`. After save/new rows the count changes — re-probe.
- Escape between dropdowns to keep only one open.

## 5. Date "day" cell click silently fails (timing)

Ant calendar is animated; clicking the day too early does nothing, and `pick_date` returns
`'nf day'` even though the date-picker panel is open.
**Fix:** `pick_date()` already retries the day cell up to 4 times with small busy-waits.
If it still returns `nf day`, press Escape and call `pick_date` again. If the *input* shows
only year/month (e.g. `2025-01`), antd DatePicker mode allows partial — acceptable when the
field is year-month only.

## 6. Wrong section opened (e.g. 高考录取批次 instead of 主修专业)

Adjacent read-only dropdowns look identical. Verifying by screenshot after each cascader pick
is mandatory before continuing. Escape and retry on the correct control.

## 7. Indexes shift after any save / add / re-render

Hard-coding `input[41]` etc. across steps breaks once a section saves (list collapses,
rows re-order) or a new row is added.
**Fix:** for each step re-run `inputs_json()` (or count) and re-derive indexes from
before/after diff; store `base` as the first index of the newly added row.

## 8. Multi-row list overwrite: clicking "add" actually edited row 1

When an earlier row is still "open/editing", clicking 添加 again sometimes fills the SAME
row with new data (contents of previous row get overwritten) or the click returns `nf`
because the button moved.
**Fix:** always `save_section()` after finishing each row, verify the row saved (screenshot),
then click 添加 again. Confirm inputs count increases by the expected delta.

## 9. Section save validation shows generic errors

After clicking 保存, visible `.ant-form-explain` / `[class*=error]` list problems such as
- 工作职责不能超过200字 → shorten textarea text and save again.
- 证明人/证明人单位及职务/联系电话 required → user-provided data (see live data doc).
Read them with `read_errors()` and screenshot before guessing.

## 10. Buttons/sections match by TEXT, use char codes

Section add buttons and 保存 buttons are matched by exact innerText. Matching Chinese text
inside a JS string requires `\uXXXX` or char-code checks (never raw CJK in a python-file JS
string is fine too since file is utf-8 — the raw CJK lives in the .py file, not the CLI;
both `click_paragraph` and `menu_pred` are safe).

## 11. Login session state

The automation can't log in. Start headed (`--headed`), let the user log in, confirm with a
screenshot. Reusing `--session-name chr` across commands keeps one browser profile/page.
