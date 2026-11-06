/* B21：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · B21 状态卡拦截窗口重复询问 + 窗口提示泄露',
	'',
	'- **玩家报**：状态拦截窗口在计分/弃牌阶段两次重复询问，日志"疑似可见"。',
	'- **探针**（`tools/_probe_react_once.js`）：同一张 15241 在一次计分里被问 2 次',
	'  （`supply→scoring` 与 `scoring→discard` 各开一窗），日志「可打出 1 张增强卡」连刷 3 行。',
	'- **根因**：① `advance_phase` 用 `{silent:true}` 重算 `phase_scoring`，但拦截前置块没区分 silent；',
	'  ② `offer_armed_effects` 无条件把「【X】可打出 N 张增强卡」写进双方共享的 `game.log`（对手可见）。',
	'- **改法**：① 拦截块加 `!opts.silent`；② 窗口提示只在 `_out[0].nation === game.current_nation` 时落日志。',
	'- **验证**：`tools/_real_test_status_react_once.js` 8 项（计数 / 无泄漏 / 本方仍提示 / 只结算一次 / 静态守卫）；',
	'  设计文档 `docs/change-status-react-once.md`。',
	'- **回归**：15353 23、15328 11、15352 11、17732 auto 11、17732 借用 88、',
	'  `test_basic_cards` 288/9、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B21 状态卡拦截窗口重复询问') < 0) {
	const i = s.indexOf('---\r\n\r\n')
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + 7) + entry + s.slice(i + 7)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log =', fs.readFileSync(p, 'utf8').indexOf('B21 状态卡拦截窗口重复询问') >= 0)

{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	u = u.replace('### B21. 状态拦截窗口在计分/弃牌阶段重复询问两次 + 日志泄露',
		'### ✅ B21. 状态拦截窗口在计分/弃牌阶段重复询问两次 + 日志泄露 —— 已修')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo B21 =', fs.readFileSync(t, 'utf8').indexOf('✅ B21') >= 0)
}
