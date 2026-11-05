/* S3 标记为低优先级并跳过 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')
const i = s.indexOf('### S3')
if (i < 0) { console.log('未找到 S3 标题'); process.exit(0) }
const lineEnd = s.indexOf('\n', i)
const heading = s.slice(i, lineEnd)
if (/跳过/.test(heading)) { console.log('已是跳过状态：', heading); process.exit(0) }
s = s.slice(0, i) + '### \u23ec S3. 运行期失败时 attrition 代价不回滚（低优先级 · 玩家裁定跳过）' + s.slice(lineEnd)

const note = [
	'',
	'> **S3 裁定（2026-11-05）**：玩家确认属**低优先级需求，直接跳过**。',
	'> 依据：S2-b（代价前移预检）已把“注定失败”的情况挡在扣代价之前，剩下的运行期失败极少见；',
	'> 而回滚 attrition 还要连带回退 17847《消耗战》的加分，风险/收益不划算。',
	'>',
	'> 若将来要恢复，方案要点：',
	'> ① 扣代价处捕获 _paidLoss = attrition_cards(...)；',
	'> ② 失败分支调用 undo_attrition(game, payer, _paidLoss) —— 按 id 从 game.discard 摘出、依原顺序 unshift 回 game.decks；',
	'> ③ 同时回退 su_attrition_score() 已加的分；',
	'> ④ 只在 !r.ok && !r.pending 时回滚；洗过牌时顺序无法精确还原（日志注明）。',
	''
].join('\n')

s += note
fs.writeFileSync(p, s, 'utf8')
console.log('S3 已标记跳过')
