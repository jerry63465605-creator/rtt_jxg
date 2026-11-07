# Platform notes

## 智联招聘 / Moka (sinosure.zhaopin.com, mokahr-hosted forms)

Framework: **Element-UI (Vue 2)**.

- Controls: `.el-select` (single select), `.el-cascader`, `.el-date-editor`.
- Popper class: `.el-select-dropdown`; menus: `.el-cascader-menus`.
- Inputs carry a **placeholder** that is the field's label — use it as identity:
  - `请选择您的所受教育类型`
  - `请选择您的学历`
  - `请选择您的学位`
  - `请选择您的年级排名`
  - `请选择您是否有海外学习经历`
  - `请选择您的入学时间` / `请选择您的毕业时间`
  - `请填写学校全称`
- Observed forms have **several add-row forms coexisting**; only one is expanded.
  Count visible controls before acting; hidden clones share placeholders.

### Observed option texts (as of 2026-10)

**教育类型**: 全日制统分统招 | 海外留学 | ... (8 options)

**学历** (8): 博士研究生 | MBA/EMBA | 硕士研究生 | 本科 | 大专 | 中专/中技 | 高中 | 初中及以下

**学位** (7, appears only after 学历 is set): 博士 | MBA | 硕士 | 双学士 | 学士 | 其他 | 无

**年级排名** (5): 前5% | 前10% | 前20% | 前30% | 其他

**是否有海外学习经历** (2): **有 | 无**  ← not 是/否

### Field relationships

- 学历 → 学位 is **cascading**; 学位 options are empty until 学历 is committed.
- 教育类型 = 海外留学 unlocks the overseas fields (国家/地区 etc.).

### Date behaviour

- 入学时间 / 毕业时间 are **day-level** pickers (year → month → day).
- The year table is paginated by decade; clicking the year header switches the panel.
- After a month click the panel may auto-dismiss; read back the input to confirm.

## 中华英才网 (applyjob.chinahr.com)

Framework: **Ant Design**. See the `chinahr-form-filler` skill for the full workflow:
- cascaders: `.ant-cascader-menus` per control, index-mapped
- calendar: `.ant-calendar`, year/month selects, `.ant-calendar-tbody td`
- section save buttons matched by text

Use this skill's **dropdown workflow** there too: locate by identity (placeholder / label
text), clean stale panels, native click, exact match, read back.

## General Ant Design notes

- Select popper: `.ant-select-dropdown`; cascader: `.ant-cascader-menus`.
- The global `document.querySelectorAll('input')` includes many non-visible helper inputs
  (search fields, hidden mirrors) — never index by position.
- Real clicks matter; Ant components also listen for `mousedown`.
