/* B28：fix-log + todo 登记 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-07 · B28 调试面板新增「损耗 x / 复原 x」与「阵营分数 ±」',
	'',
	'- **需求**：调试卡牌面板加"损耗 x / 复原 x"（复原 = 最近进弃牌堆的 x 张按序回牌库顶，只对当前国家）；',
	'  调试阶段面板加"分数增加/减少"。',
	'- **服务端**（`rules.js`）：新增 `debug_attrition {n}`（复用 `attrition_cards`，带真实副作用）、',
	'  `debug_restore {n}`（discard 末尾 n 张按序 unshift 回牌库顶）、',
	'  `debug_score {faction, delta}`（axis/allies 总分，可负）；非法参数一律拒绝并写日志。',
	'- **带外豁免**：debug 动作此前会走到 `clear_armed_offer_for_side` 把本方 armed 窗口清掉，',
	'  现统一豁免（不清窗口 / 不放行拦截队列 / 不作废分步与气球炸弹），与 status_instant 既有口径一致。',
	'- **客户端**：卡牌面板加"损耗/复原"两个输入+按钮（只作用于当前国家）；',
	'  阶段面板加"阵营 + N + 加/减"。版本串 bump → `20261107b`。',
	'- **验证**：`tools/_real_test_debug_tools.js` 14 项、`tools/_dom_test_debug_tools.js` 8 项；',
	'  文档 `docs/change-debug-tools.md`。',
	'- **回归**：`test_basic_cards` 288/9、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const P = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(P, 'utf8')
if (s.indexOf('B28 调试面板新增') < 0) {
	const i = s.indexOf('---\r\n\r\n')
	if (i >= 0) { s = s.slice(0, i + 7) + entry + s.slice(i + 7); fs.writeFileSync(P, s, 'utf8') }
}
console.log('fix-log =', fs.readFileSync(P, 'utf8').indexOf('B28 调试面板新增') >= 0)

{
	const T = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(T, 'utf8')
	const block = [
		'',
		'### ✅ B28. 调试面板：卡牌「损耗 x / 复原 x」+ 阶段「阵营分数 ±」',
		'',
		'- 服务端 `debug_attrition` / `debug_restore` / `debug_score`；复原 = 最近进弃牌堆的 x 张按序回牌库顶；',
		'  只对当前国家执行（法国/中国按委托落到控制国）。',
		'- 调试动作统一"带外"：不清 armed 窗口、不放行拦截队列、不作废分步/气球炸弹。',
		'- 文档 `docs/change-debug-tools.md`；测试 14 + 8 项；客户端版本串 `20261107b`。',
		'',
	].join('\n')
	if (u.indexOf('B28. 调试面板') < 0) {
		u = u.replace(/\s*$/, '\n') + block
		fs.writeFileSync(T, u, 'utf8')
	}
	console.log('todo =', fs.readFileSync(T, 'utf8').indexOf('B28. 调试面板') >= 0)
}
