/* P3-1：补 17532/17550 的通道说明 + todo 完成备注 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'audit-need-piece.md')
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf('17532') < 0) {
		s += [
			'## 4. 补充：15000 段的事件卡分步（17532 / 17550 等）',
			'',
			'待办里提到的 17532《战区移动》/ 17550 等，**不走** armed 的 `need:\'piece\'`，',
			'而是走 `event_card_needs()` → `pending_event_targets` 的 `need:\'piece\'`（框架行：rules.js 18829 / 18909 / 19067 / 19131）。',
			'客户端该通道有 `submit_event_piece`（✅ 支持），并已有 `_real_test_15315_alamein.js`（21 项）作为真实背书的同族实现。',
			'',
			'因此三条通道的最终结论：',
			'',
			'| 通道 | 客户端支持 | 真实测试背书 | 使用该通道的卡 |',
			'|---|---|---|---|',
			'| armed（`armed_offers.pending`） | ✅ | `_real_test_15355_sas_airfield`（36） | 15355 / 15406 / 16801 / 16802 / 17511 / 17708 / 17808 / 17809 |',
			'| event-multistep（`pending_event_targets`） | ✅ | `_real_test_15315_alamein`（21） | 15315 / 15316 / 17532 / 17550 等 |',
			'| echo-run（`pending_echo`） | ❌ 缺 `step===\'piece\'` 分支 | —（无卡使用） | 目前 0 张（15407 已迁 choice） |',
			''
		].join('\n')
		fs.writeFileSync(p, s, 'utf8')
		console.log('已补 17532/17550 通道说明')
	} else console.log('已有 17532 说明')
}

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf('P3-1 已完成（2026-11-05）') < 0) {
		s += [
			'',
			'### ✅ P3-1 `need:\'piece\'` 点击链批量审计（2026-11-05 完成）',
			'',
			'- 产出：`docs/audit-need-piece.md`（3 条通道 + 8 张 armed 卡 + 框架通道 + 真实测试证据）。',
			'- 结论：**armed 与 event-multistep 两条通道均可点、且有真实测试背书**（15355 36 项 / 15315 21 项）；',
			'  `echo-run` 的 piece 分支客户端缺失，但目前无卡使用（15407 已迁 `need:\'choice\'`）。',
			'- 后续新增 echo+piece 卡时，需先给 `update_pending_echo_box` 补 `step===\'piece\'` 分支。',
			''
		].join('\n')
		fs.writeFileSync(p, s, 'utf8')
		console.log('todo 已补 P3-1 完成备注')
	} else console.log('todo 已有备注')
}
