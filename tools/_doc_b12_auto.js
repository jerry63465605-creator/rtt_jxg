/* B12 扩展（auto 计分卡借用）文档 + 顺带修的重复计分 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const lines = [
		'',
		'## 2026-11-06 · B12 扩展：借出的德国「计分阶段 auto」卡在意大利计分阶段自动加分（+ 修掉重复计分）',
		'',
		'- **玩家口径**：15241《瑞典铁矿》/ 15244《丰富的资源》/ 6601《大德意志帝国》被 17732 借走后，',
		'  应在【意大利计分阶段】**自动**按德国部队条件加分，**不需要手动点卡**。',
		'- **原状**：这三张 `auto.trigger_nation = 德国`，`phase_scoring` 里 `trigger_nation !== nation → continue`，',
		'  意大利计分阶段直接跳过；而借用后点它们又被「没有主动发动时机」拒绝 —— 两头都不通。',
		'- **改法**（3 处）：',
		'  1. `phase_scoring` 的 auto 循环：借出当回合，若 `italy_borrow.card_face === cid` 且 `nation === italy_borrow.nation`',
		'     （=借用方），放行并按其归属国（德国）的部队条件结算；同一轮其它国家（含德国本国）跳过 —— **不重复加**；',
		'  2. 15353 拦截收集（`phase_scoring` 入口那段）：计分国为「德国」**或**「借用方」都要问，',
		'     并同样只问被借出的那一张；被拦则本回合该卡不生效；',
		'  3. `uk_enigma_targets`（15328 的候选）也纳入借用方计分阶段的加分记录。',
		'- **顺带修掉一个重复计分 bug**：`phase_scoring` 的拦截前置块里，原来只在 `pending_status_react` 存在时 `return`；',
		'  无人可拦时 `step_status_react` 已**同步重入**算了一遍，外层再往下走 → **同一张卡加两次分**',
		'  （实测 15241 应从 +2 变 +4、15244 +3 变 +6、6601 +1 变 +2）。现在该块**一律 return**。',
		'- **验证**：`tools/_real_test_17732_auto_scoring.js` **9/9**',
		'  A 15241（波罗的海德国海军 + 北欧德国陆军）→ 意大利计分 +2；B 15244（罗斯/乌克兰/中亚各 1 陆军）→ +3；',
		'  C 6601（东欧德国陆军）→ +1；D 未借用 → 不加（基线）；E 借出当回合德国本国计分**跳过**，未借出时照常 +2；',
		'  F 意大利计分阶段 15353 可拦、被拦后不加分；G 跨回合后借用失效。',
		'  回归：`_real_test_17732_borrow_all` 88、`_real_test_15353_status_intercept` 23、',
		'  `test_basic_cards` 288/9、全量冒烟 112 全绿。',
		'- **提交**：`fix(quartermaster): 借出的德国 auto 计分卡在意大利计分阶段自动结算（并修重复计分）`',
		''
	].join('\n')
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B12 扩展：借出的德国') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · B12《德国军事顾问》17732'
		fs.writeFileSync(p, cur.replace(marker, lines + '\n' + marker), 'utf8')
		console.log('fix-log 已插入 B12 扩展')
	}
}

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf('B12 扩展（2026-11-06 完成）') < 0) {
		s += [
			'',
			'### ✅ B12 扩展：借出的 auto 计分卡（2026-11-06 完成）',
			'',
			'- 15241 / 15244 / 6601 被 17732 借出后，在【意大利计分阶段】**自动**按德国部队条件加分（无需点卡）；',
			'  同一轮其它国家跳过，不重复加；15353 在借用方计分阶段同样可拦。',
			'- 真实测试：`tools/_real_test_17732_auto_scoring.js`（9 项）。',
			'- 顺带修：`phase_scoring` 拦截前置块在无人可拦时**重复计分**（15241 +2 → +4）。',
			''
		].join('\n')
		fs.writeFileSync(p, s, 'utf8')
		console.log('todo 已补 B12 扩展')
	} else console.log('todo 已有 B12 扩展')
}
