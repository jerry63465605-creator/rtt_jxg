/* T1 勾选（按文档实际文本） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')
const before = s
s = s.replace('| **T1** | `piece_removed` 系列 20 张卡逐卡核对「国家/兵种/地区」三问 | 17543 雷达已完成，其余未核 |',
	'| ~~**T1**~~ ✅ | `piece_removed` 系列 22 张卡逐卡核对「国家/兵种/地区」三问 | 已完成：`docs/audit-piece-removed.md`（watch 全齐 / 三路径派发齐全 / 无判据矛盾） |')
s = s.replace('| 18 | **T1** | `piece_removed` 20 张逐卡核对（国家/兵种/地区） | 只读审计，量大 | 低（只读）但耗时 | 每卡 3-5 | 需先出清单 |',
	'| 18 | ~~**T1**~~ ✅ | `piece_removed` 逐卡核对（国家/兵种/地区） | 已完成：22 张只读审计，清单落在 `docs/audit-piece-removed.md` | — | — |')
if (s === before) { console.log('未命中 T1'); process.exit(0) }
fs.writeFileSync(p, s, 'utf8')
console.log('T1 已勾选')
