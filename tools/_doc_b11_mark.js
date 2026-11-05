/* B11 勾选（按文档实际文本） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')
const before = s
s = s.replace('| B11 | 17729 卡佩里尼 / 17535 租借法案 | 捞出来/让权打出的建设陆军，不触发对应的 after_* 状态卡（15247 贵在行动） |',
	'| ~~B11~~ ✅ | 17729 卡佩里尼 / 17535 租借法案 | 已修（2026-11-05）：链停一步 + 窗口归属豁免（真实测试 18 项） |')
s = s.replace('### B11. 17729《卡佩里尼》/ 17535《租借法案》：被捞/被让权打出的建设，不触发对应状态卡',
	'### ✅ B11. 17729《卡佩里尼》/ 17535《租借法案》：被捞/被让权打出的建设，不触发对应状态卡（已修）')
s = s.replace('| 16 | **B11** | 17729/17535：被捞/被让权打出的建设不触发状态卡 | 下沉到 `build_piece` 原子层 | 高 | 6 | 影响所有建设路径，需全量回归 |',
	'| 16 | ~~**B11**~~ ✅ | 17729/17535：被捞/被让权打出的建设不触发状态卡 | 已修：链停一步（复用事件卡分步机）+ `status_instant_covers` 豁免 | 中 | 18 |')
if (s === before) { console.log('未命中 B11 文本'); process.exit(0) }
fs.writeFileSync(p, s, 'utf8')
console.log('B11 已勾选')
