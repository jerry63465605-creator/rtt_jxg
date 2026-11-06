/* B10 部分回退：fix-log + todo 待办（写入后回读校验） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · B10 部分回退：撤销「抵消后挂起 + 补机再代受」，战斗时序复原',
	'',
	'- **触发**：真实盘面排查发现——`抵消成立` 时 `pending_battle.stage` 被置为新增的 `after_air_loss`，',
	'  而 `pending_wait_nation()` 的兜底把它当成"等防守方"，于是 `game.active` 被切成防守方；',
	'  `resume_after_air_loss()` 收尾时直接 `game.pending_battle = null`（没走 `battle_reconcile_active`），',
	'  操作权**永久停在防守方**、`battle_return_active` 残留 —— 表现为「对方被点亮、自己只剩 log」。',
	'- **玩家裁定**：空军代死属战斗底层机制，不在这种地方冒险，回退到 17811 改动前的战斗时序。',
	'- **回退内容**（只撤"挂起再代受"这一层）：',
	'  1. `resolve_battle` 的 counter 分支恢复：双方空军移除后 **victim 立即移除**（再由 `battle_reconcile_active` 归还操作权）；',
	'  2. 删除 `resume_after_air_loss()` 及 `exports.action` 里对它的调用；删除 `after_air_loss` 这个 stage。',
	'- **保留内容**（纯增量、无时序风险）：',
	'  · `remove_air_with_piece_removed()` / `dispatch_air_removed_window()`：空军三种死法（代受成立/抵消成立/无处撤离）仍派发 `piece_removed`；',
	'  · `game.pending_air_dispatch` 排队（两国各掉 1 架时窗口不互相覆盖）；',
	'  · 17811 / 17808 的 `watch: true`。',
	'  因此 17811 仍能在"空军已被移除"之后开窗补机，只是**战后生效**、不再能救回本场战斗。',
	'- **验证**：新增 `tools/_real_test_battle_air_return.js`（**26 项**）',
	'  A 日美常规：发起 → 美国代受 → 日本抵消 → 美国陆军**立即**被移除（底层原行为）；',
	'  B `active` 轨迹：发起后 Allies → 代受后 Axis → 抵消后 **Axis**，`battle_return_active=null`；',
	'  C 抵消后行动方标志 `propose_rollback` 只在 Axis；',
	'  D 代受成立 → 陆军存活、操作权归还；E 不代受 → 陆军+空军都被移除、操作权归还；',
	'  F 17811：苏联空军被移除后仍开窗、战后可补 1 支；不产生战斗挂起；',
	'  G 无 `pending_battle` / `battle_return_active` / `pending_air_dispatch` 残留；H 静态守卫。',
	'  `_real_test_b10_design_bureau.js` 已按新语义改写（20 项全过）。',
	'  回归：`test_basic_cards` 288/9、15353 拦截 23、15210 11、15228 12、15226 14、17732 借用 88、全量冒烟 112 全绿。',
	'- **新增待办**：',
	'  1. 17811 在**抵消路径**的窗口会被 victim 的 `piece_removed` 派发覆盖（同一 `when`、不同国家）—— 掉了飞机但设计局没得打；',
	'  2. 「战斗内补机代受（补机代死）」若要保留，需单独立项设计（战斗内插队窗口），不得再改动 victim 的移除时机。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B10 部分回退') < 0) {
	const marker = '---\r\n\r\n'
	const i = s.indexOf(marker)
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + marker.length) + entry + s.slice(i + marker.length)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log 回读：', fs.readFileSync(p, 'utf8').indexOf('B10 部分回退') >= 0 ? 'OK' : 'FAIL')

/* todo */
{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	if (u.indexOf('17811：抵消路径窗口被覆盖') < 0) {
		u += [
			'',
			'### B16. 17811《雅科夫列夫设计局》：抵消路径的窗口被 victim 派发覆盖（2026-11-06 登记）',
			'',
			'- 现象：`抵消成立` 时，空军先死（本该开 17811 窗口），紧接着 victim 的 `piece_removed` 派发',
			'  以同一个 `when` 覆盖了该窗口 → 玩家**掉了飞机却打不出设计局**。',
			'- 根因：`offer_armed_effects` 以 `when` 为唯一键合并窗口；`remove_air_with_piece_removed` 里虽有',
			'  `pending_air_dispatch` 排队，但 **victim 的派发走的是另一段代码**（不排队）。',
			'- 方案（未实施）：把 victim 的 `piece_removed` 派发也统一走"有同 `when` 窗口则排队"的逻辑，',
			'  或让 `offer_armed_effects` 按 `when + piece_nation` 分键。',
			'',
			'### B17. 17811「战斗内补机代受（补机代死）」——需单独立项（2026-11-06 登记）',
			'',
			'- 原 B10 曾实现"抵消后不立刻打死 victim → 原地补机可再次代受"，实测导致 `game.active` 卡在防守方，',
			'  已按玩家裁定回退（见 fix-log 2026-11-06）。',
			'- 若要恢复该体验，**不得再改 victim 的移除时机**；应设计"战斗内插队窗口"独立机制',
			'  （空军被移除 → 暂停战斗 → 补机 → 回到 defend 阶梯），并单独立项、单独测试。',
			'',
			'### B18. `pending_battle = null` 直写点审计（2026-11-06 登记）',
			'',
			'- `rules.js` 现有 12 处直接 `game.pending_battle = null`，其中部分未跟 `battle_reconcile_active()`，',
			'  有"归还漏掉 → active 卡住"的同类风险（本次 `after_air_loss` 就是这样踩的）。',
			'- 方案：逐处核对，统一改成"清空 + `battle_reconcile_active(game)`"，或封装 `clear_pending_battle()`。',
			''
		].join('\n')
		fs.writeFileSync(t, u, 'utf8')
	}
	console.log('todo 回读：', fs.readFileSync(t, 'utf8').indexOf('B16.') >= 0 ? 'OK' : 'FAIL')
}
