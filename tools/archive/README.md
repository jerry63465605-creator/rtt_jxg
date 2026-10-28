# tools/archive —— 已废弃的冒烟脚本

这里存放**测试的机制已经被整体移除/重做**、无法通过改断言修复的脚本。
放在 `archive/` 而不是删除，是为了留档：需要时能看到当年的用例意图。

`tools/_run_smoke_report.js` 只扫 `tools/_smoke_*.js`，**不会**执行本目录。

---

## 归档清单

| 脚本 | 归档日期 | 原因 |
|---|---|---|
| `_smoke_17805_wait.js` | 2026-10-28 | 整文件测「17805 红色管弦乐队」的 `su_red_ask` / `su_red_use` / `su_red_pick` / `su_red_decline` / `resolve_red` 状态机。该机制已整体重做为 **armed 跨阵营让权**（`_handoff_base`，见 `rules.js` 7095-7120 注释），上述行动名与 `su_red_ask` 字段在服务端**已不存在**，脚本每次加载即 `TypeError`。17805 的现行行为由 `_smoke_su_purge_handoff.js` / `_smoke_armed_handoff.js` 覆盖。 |

## 恢复方式

若将来该机制被重新引入，把脚本移回 `tools/` 即可重新纳入冒烟。
