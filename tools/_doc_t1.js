/* T1 完成：todo 勾选 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')
const before = s
s = s.replace('| T1 | `piece_removed` 系列 20 张卡 | 逐卡核对「国家 / 兵种 / 地区」三问 |',
	'| ~~T1~~ ✅ | `piece_removed` 系列 22 张卡 | 已审计（`docs/audit-piece-removed.md`）：watch 全齐、三路径派发齐全、无判据矛盾 |')
s = s.replace('### T1. `piece_removed` 系列 20 张卡逐卡核对（国家 / 兵种 / 地区）',
	'### ✅ T1. `piece_removed` 系列逐卡核对（已完成，见 docs/audit-piece-removed.md）')
s = s.replace('| 18 | **T1** | `piece_removed` 20 张逐卡核对 | 只读，量大 | 低但耗时 | 每卡 3-5 |',
	'| 18 | ~~**T1**~~ ✅ | `piece_removed` 逐卡核对 | 已完成（22 张，只读审计） | — | — |')
if (s === before) { console.log('未命中 T1 文本'); process.exit(0) }
fs.writeFileSync(p, s, 'utf8')
console.log('T1 已勾选')
