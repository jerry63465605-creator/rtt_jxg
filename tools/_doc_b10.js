/* B10 完成：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	const before = s
	s = s.replace('### B10. 17811《雅科夫列夫设计局》：窗口应在"消灭陆军之前"',
		'### ✅ B10. 17811《雅科夫列夫设计局》：窗口应在"消灭陆军之前"（已修：空军移除统一派发 + 抵消后可重新代受）')
	s = s.replace('| 17 | **B10** | 17811《设计局》时点提到"消灭陆军之前" | 动 `eliminate_piece` 顺序 | 高 | 5 |',
		'| 17 | ~~**B10**~~ ✅ | ~~17811《设计局》时点提到"消灭陆军之前"~~ | 已修：空军移除统一派发 + 抵消后可重新代受 | 中高 | 25 |')
	if (s === before) console.log('todo: 未命中 B10 文本（可能已是勾选状态）')
	fs.writeFileSync(p, s, 'utf8')
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const lines = [
		'',
		'## 2026-11-05 · B10 空军被移除的时点 + 抵消后可「重新代受」（服务端）',
		'',
		'- **症状**：苏联陆军【带空军】被德国（同样带空军）攻击，空战让苏联空军阵亡后，',
		'  手里的 17811《雅科夫列夫设计局》**完全没有窗口**；抵消成立时陆军当场被移除，',
		'  也没有「补机再代受」的机会。',
		'- **根因**（探针 `_probe_b10_design_bureau.js` 实测）：',
		'  1. 代受成立 / 抵消成立 / 「空军无处撤离」三条路径**只 delete 空军**，从不派发 `piece_removed`；',
		'  2. 17811 / 17808 **缺 `watch:true`** —— 敌方回合掉机时被 `actorNation !== 苏联` 直接跳过（与 15311/15351 不对称）。',
		'- **改法**：',
		'  1. 新增 `remove_air_with_piece_removed()` + `dispatch_air_removed_window()`：空军的三种死亡路径统一走三路派发（对称，谁掉飞机给谁开窗）；',
		'  2. `offer_armed_effects` 以 `when` 为唯一键合并窗口 → 新增 `game.pending_air_dispatch` 排队，两国各掉 1 架时逐张派发、不互相覆盖；',
		'  3. `resolve_battle` 的 counter 分支：抵消成立时**不立刻**移除 victim，改为 `pending_battle.stage = "after_air_loss"`；',
		'     由 `resume_after_air_loss()` 在所有窗口清空后决定——原地有新机则**重新代受**，否则按原结果移除；',
		'  4. `air_used` 记录已用过的空军（每支只能用一次），保证有限收敛；',
		'  5. 17811 / 17808 补 `watch: true`。',
		'- **验证**：`tools/_real_test_b10_design_bureau.js` **25/25**',
		'  A 代受成立→17811 开窗、陆军仍在；B 原地补机成功；C 抵消成立→victim 挂起 + 双方开窗；',
		'  D 原地补机→自动重新代受→陆军保住；E 相邻补机→不代受→陆军被移除；F 不发动→陆军被移除；G 无卡→不开窗；H 静态守卫。',
		'  回归：`test_basic_cards` 288/9、B11 18、15353 23、15228 12、17747 16、15206 12、15210 11、',
		'  `_smoke_air_retreat_restore` 72、`_smoke_17734_15336_order` 14（派发点计数 4→5）、`_smoke_piece_id_unified` 16、全量冒烟 112 全绿。',
		'- **文档**：`docs/change-b10-air-removed.md`（探针结论 / 改法 / 测试矩阵 / 已知边界）',
		'- **提交**：`fix(quartermaster): B10 空军被移除统一派发 + 抵消后可重新代受`',
		''
	].join('\n')
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B10 空军被移除的时点') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · B11《卡佩里尼》'
		fs.writeFileSync(p, cur.replace(marker, lines + '\n' + marker), 'utf8')
		console.log('fix-log 已插入 B10')
	}
}
