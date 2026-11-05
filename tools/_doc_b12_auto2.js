/* B12 扩展口径修正：借出回合各加一次 + 术语（回合 vs 轮次） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const lines = [
		'',
		'## 2026-11-06 · B12 扩展口径修正：借出「回合」里意大利与德国各加一次（术语：回合 ≠ 轮次）',
		'',
		'- **术语对齐**（玩家口径）：`回合` = **一个国家**的回合（`game.turn` 前进一格）；',
		'  `轮次` = 6 个国家回合走完一圈。所以「本回合内可用」= 该国家回合内。',
		'- **口径修正**：借出后**不吞掉归属国**的计分 ——',
		'  · 意大利的回合（借用生效那一个 `game.turn`）：意大利计分阶段 +N；',
		'  · 德国自己的回合（另一个 `game.turn`，借用已自然失效）：德国计分阶段再 +N；',
		'  · 一轮次内合计**两次**（各加一次）。',
		'- **改法**：去掉上一版加的「借出当回合跳过归属国计分」守卫（`phase_scoring` 的 auto 循环、',
		'  以及 15353 拦截收集块各一处）；借用方仍通过 `_ibMine` 放行 `trigger_nation` 不匹配的卡。',
		'- **验证**：`tools/_real_test_17732_auto_scoring.js` **10/10**',
		'  A/B/C 意大利回合分别 +2/+3/+1；D 未借用基线不加；',
		'  E ★★ 意大利回合 +2、德国回合再 +2、一轮次合计 4（各加一次）；',
		'  F 15353 在意大利计分阶段可拦；G 跨 `game.turn` 借用失效。',
		'  回归：`_real_test_17732_borrow_all` 88、`_real_test_15353_status_intercept` 23、',
		'  `test_basic_cards` 288/9、全量冒烟 112 全绿。',
		''
	].join('\n')
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('借出「回合」里意大利与德国各加一次') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-06 · B12 扩展：借出的德国'
		fs.writeFileSync(p, cur.replace(marker, lines + '\n' + marker), 'utf8')
		console.log('fix-log 已插入口径修正')
	}
}

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	const oldTxt = '- 15241 / 15244 / 6601 被 17732 借出后，在【意大利计分阶段】**自动**按德国部队条件加分（无需点卡）；\n  同一轮其它国家跳过，不重复加；15353 在借用方计分阶段同样可拦。'
	const newTxt = '- 15241 / 15244 / 6601 被 17732 借出后，在【意大利计分阶段】**自动**按德国部队条件加分（无需点卡）。\n  口径：术语「回合」= 一个国家回合、「轮次」= 6 国一圈；**借出回合各加一次**——意大利回合 +N、德国自己的回合再 +N。\n  15353 在借用方计分阶段同样可拦。'
	if (s.indexOf('同一轮其它国家跳过') >= 0) {
		s = s.replace(oldTxt, newTxt)
		fs.writeFileSync(p, s, 'utf8')
		console.log('todo 口径已修正')
	} else console.log('todo 已是新口径或未命中')
}
