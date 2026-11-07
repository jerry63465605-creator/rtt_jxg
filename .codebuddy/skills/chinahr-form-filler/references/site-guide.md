# Site Guide — applyjob.chinahr.com form internals (observed)

Target form: `https://applyjob.chinahr.com/apply/form/job?projectId=6a82a408f6bf3d0ac213d518&jobId=6a8aafb032985e09882d5ff6`
(中华英才网 / Ant Design based single-page application. Login required — real person logs in.)

## DOM / widgets

- All form controls are ordinary `input`, `select`, `textarea`. Enumerate with
  `document.querySelectorAll('input,select,textarea')` and address by index.
- **Indexes are volatile**: opening a new section / adding a list row / saving re-renders
  and shifts indexes. Always re-probe before acting.
- Cascader (multi-level picker) renders `.ant-cascader-menus` popups; each opened control
  owns its own container. `input.ant-cascader-input[N]` ↔ `.ant-cascader-menus[N]`.
- Calendar is antd `DatePicker`: class `.ant-calendar`, year selector
  `.ant-calendar-year-select`, month selector `.ant-calendar-month-select`,
  day cells `.ant-calendar-tbody td` (exclude cells with class `last-month`/`next-month`).
- 保存 buttons: visible `button` whose trimmed innerText starts with 保 (U+4FDD); click the
  last one in the current section. Validation errors surface in `[class*=error]`,
  `.ant-form-explain` elements (visible).
- List "add" rows: some sections use a `<p>` or `<div>`/`<span>` with text 添加… (clickable);
  IT skills use an `<em>添加</em>` button. Both are matched via `click_paragraph` /
  `click_add_em`.

## Section order & observed row layouts

The page shows one giant vertical form. After login the assistant opens sections one by one,
fills, and clicks 保存 per section.

### 1. 教育经历 (Education)
- School field is a searchable select. Sydney Uni was selected by typing
  `悉尼大学` (or picking from dropdown; confirm with screenshot).
- Observed row inputs (master education row, 0-based over all inputs at that time):
  - school / 学历 / 学制 / 入学 年-月 / 毕业 年-月 …
  - idx 36 (approx) = 学院/院系 text → value `Faculty of Engineering`
  - idx 38 (approx) = 主修专业 cascader → path: 研究生 → 工学 → (计算机类) → 计算机科学与技术
    - note: 专业类别 dropdown and 主修专业 dropdown are adjacent; do NOT confuse. The
      master-level row has 高考录取批次 dropdown that must be ignored (Escape it).
  - idx 40 (approx) = 主修课程及成绩 → `数据库系统管理、数据结构、计算机网络架构`
  - 学号 often required (user must supply).
- Add second education row (北京邮电大学 本科) as needed by re-clicking the section 添加.

### 2. 实习工作经历 (Internship) — addable list
Click 添加实习工作经历 (`click_paragraph("添加实习工作经历")`), a new row is appended.
Relative offsets from the row's first input (`base = row_first_index`):
- `base+0` 工作类别 cascader → `实习（未毕业在校生兼职或实习）`
- `base+1` 开始日期 (year-month-day calendar)
- `base+2` 结束日期
- `base+3` 单位/公司名称
- `base+4` 职位名称
- `base+5` 离职原因 → `实习结束`
- `base+6` 工作职责 textarea — **must be ≤ 200 chars** (else save fails with a length error)
- Required but no form field before save: 证明人 / 证明人单位及职务 / 联系电话
  (validation error appears on save; user must provide these values)

After adding the 2nd internship row, total inputs jumped by ~10; `base = inputs_count - 10`
worked at that time, but verify by diffing before/after input lists.

### 3. 社会及校园活动经历 (Campus/social activity) — addable list
Adding the row appends exactly one textarea at the new end of the input list (`idx = n-1`).
Description (≤200 chars typically) for 翰轩棋社:

> 翰轩棋社策划负责人（2019.09-2021.01）：作为社团核心成员参与校围棋队建设，选拔优秀棋手参加重大赛事；按中国象棋赛事积分制独立负责社团数据统计，记录参赛人数与分数，策划比赛晋级规则；组织校内棋类运动会。

(Length-check on save; trim if rejected.)

### 4. IT技能 (IT skills) — max 3 rows, each row = cascader + calendar + cascader
- Row fields (observed when filling skill rows): idx 51 技能 cascader, idx 52 使用时间
  (calendar start), idx 53 熟练程度 cascader — indexes move between rows; probe each time.
- Skill cascader option tree (as seen): top-level categories include `Web Develop`;
  opening it reveals concrete skills such as `Python`, `Java`. Other categories include
  `Database` etc. (dump via `last_menu_items` / reading menu panels).
- Proficiency cascader options include `熟练` (also 了解/掌握/精通-style levels; probe to confirm).
- Each skill row has its own cascader container index (11th cascader ≈ skill name of row 1,
  12th ≈ proficiency of row 1, etc. — verify each session).

### 5. Remaining sections (not yet completed)
语言能力 / 其他情况 / 亲属 / 报名信息 — fill from resume data doc when reached; 语言能力
can carry CET-6. 报名/亲属 require user-provided values where marked in the live data doc.

## Option strings used (exact)

- 工作类别: `实习（未毕业在校生兼职或实习）`
- 学院: `Faculty of Engineering`
- 专业路径 (硕士): `研究生` → `工学` → (submenu) pick item containing 计算机 →
  pick exact 计算机科学与技术 (confirm via screenshot; Chinese option text, use char-code matching)
- 离职原因: `实习结束`
- 熟练程度: `熟练`
- IT skill name path: `Web Develop` → `Python` | `Java`
