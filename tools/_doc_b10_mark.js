/* B10 勾选（按文档实际文本） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')
const before = s
s = s.replace('| B10 | 17811 雅科夫列夫设计局 | 时点错：应在「消灭陆军之前」给窗口（打设计局→放空军→再免死） |',
	'| ~~B10~~ ✅ | 17811 雅科夫列夫设计局 | 已修（2026-11-05）：空军移除统一派发 + 抵消后可重新代受（真实测试 25 项） |')
s = s.replace('### B10. 17811《雅科夫列夫设计局》：时点应在「消灭陆军之前」',
	'### ✅ B10. 17811《雅科夫列夫设计局》：时点应在「消灭陆军之前」（已修）')
s = s.replace('| 17 | **B10** | 17811《设计局》时点提前到"消灭陆军之前" | 动 `eliminate_piece` 顺序 | 高 | 5 | 回归 21 张 `piece_removed` |',
	'| 17 | ~~**B10**~~ ✅ | 17811《设计局》时点提前到"消灭陆军之前" | 已修：空军移除统一派发 + 抵消后可重新代受 | 中高 | 25 |')
if (s === before) { console.log('未命中 B10'); process.exit(0) }
fs.writeFileSync(p, s, 'utf8')
console.log('B10 已勾选')
