/* 17811 特例：fix-log 条目 + todo 更新（B17） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · 17811《雅科夫列夫设计局》特例：抵消后「原地补机保护陆军」（含再抵消）',
	'',
	'- **玩家口径**：陆战中「防守方代受 + 进攻方抵消」后，若防守方手里有 17811 且能在原地部署，',
	'  应**直接询问**是否用新飞机保护这支陆军；新机代受后**进攻方仍可再抵消**；',
	'  只有进攻方不再抵消，新机才算保护成功。其它空军死亡窗口照常派发。',
	'- **实现**（详见 `docs/change-17811-bureau-guard.md`）：新增 `bureau_wait` 阶段 + 4 个助手',
	'  （`bureau_card_for` / `strip_bureau_offers` / `maybe_ask_bureau` / `finalize_victim_after_bureau`），',
	'  状态机 `counter → bureau_wait → defend(新机) → counter → …`，`bureau_depth ≤ 2`、`air_used` 记录已用空军。',
	'- **触发严格限定 4 条**：陆战 / victim 未保护 / 手里有 17811 / **原地**可部署；任一不满足即走原逻辑。',
	'- **生死**：进攻方不抵消 → 新机死、陆军活；再抵消 → 新机死、进攻方第二架死、陆军死；',
	'  补在相邻地区 → 不算保护（陆军死、新机活）。',
	'- **验证**：`tools/_real_test_17811_bureau_guard.js` **21 项**（A~F）；',
	'  连带更新 `_real_test_b10_design_bureau.js`（21 项，C 段改为"没有设计局"的原时序）与',
	'  `_real_test_air_piece_removed_dispatch.js`（16 项，A 段改为 bureau_wait + 不发动收尾）。',
	'  回归：`battle_air_return` 26、15353 23、17732 88、15228 12、15210 11、秋水 14、B11 18、',
	'  `test_basic_cards` 288/9、`_smoke_17734_15336_order` 14（battle 派发点 4→5）、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('17811《雅科夫列夫设计局》特例') < 0) {
	const marker = '---\r\n\r\n'
	const i = s.indexOf(marker)
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + marker.length) + entry + s.slice(i + marker.length)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log 回读：', fs.readFileSync(p, 'utf8').indexOf('17811《雅科夫列夫设计局》特例') >= 0 ? 'OK' : 'FAIL')

/* todo：B17 状态更新 */
{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	const before = u
	u = u.replace('### B17. 17811「战斗内补机代受（补机代死）」——需单独立项（2026-11-06 登记）',
		'### ✅ B17. 17811「战斗内补机代受」——已按特例实现（2026-11-06 完成，见 docs/change-17811-bureau-guard.md）')
	u = u.replace('- 若要恢复该体验，**不得再改 victim 的移除时机**；应设计"战斗内插队窗口"独立机制',
		'- 已实现（特例）：仅 17811、仅陆战、仅"抵消 + 原地可部署"时进入 `bureau_wait`；\n' +
		'  新机代受后进攻方仍可再抵消，`bureau_depth ≤ 2`。真实测试 `_real_test_17811_bureau_guard` 21 项。\n' +
		'- 原设计约束（保留作参考）：**不得再改 victim 的移除时机**；应设计"战斗内插队窗口"独立机制')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo 回读：', fs.readFileSync(t, 'utf8').indexOf('✅ B17') >= 0 ? 'OK' : 'FAIL', '（变更:', u !== before, '）')
}
