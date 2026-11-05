/* S3 标记跳过：文档里 S3 只以表格行存在 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')
const before = s

s = s.replace('| **S3** | 战斗/状态卡"运行期失败"时 `attrition` 仍不回滚 |',
	'| ~~**S3**~~ \u23ec | ~~战斗/状态卡"运行期失败"时 `attrition` 仍不回滚~~（**低优先级，玩家裁定跳过**） |')

s = s.replace('| 15 | **S3** | 运行期失败时 `attrition` 回滚（S2-b 的漏网） | 牌库回滚 + 计分回退 | 中高 | 5 | 需改 `su_attrition_score` |',
	'| 15 | ~~**S3**~~ \u23ec | 运行期失败时 `attrition` 回滚（**跳过**：低优先级） | — | — | — | S2-b 已挡住主路径 |')

if (s === before) {
	console.log('未命中任何 S3 行')
	process.exit(0)
}

const note = [
	'',
	'> **S3 裁定（2026-11-05）**：玩家确认属**低优先级需求，直接跳过**。',
	'> 依据：S2-b（代价前移预检）已把“注定失败”的情况挡在扣代价之前，剩下的运行期失败极少见；',
	'> 回滚 attrition 还要连带回退 17847《消耗战》的加分，风险/收益不划算。',
	'> 若将来恢复：扣代价处捕获 `_paidLoss = attrition_cards(...)`；失败分支 `undo_attrition()` 按 id 从 discard 摘出、依原顺序 unshift 回 decks；',
	'> 同时回退 `su_attrition_score()` 的加分；只在 `!r.ok && !r.pending` 时回滚（洗过牌则顺序无法精确还原，日志注明）。',
	''
].join('\n')

if (s.indexOf('S3 裁定（2026-11-05）') < 0) s += note
fs.writeFileSync(p, s, 'utf8')
console.log('S3 已标记跳过')
