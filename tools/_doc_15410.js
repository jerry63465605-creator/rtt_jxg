/* 15410 修复：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const lines = [
		'',
		'## 2026-11-05 · 15410《武士道》guard 窗口回弹（陆军死不了）+ 挂起日志 undefined（服务端）',
		'',
		'- **症状**（真实测试 `tools/_real_test_15410_bushido.js` 复现）：',
		'  1. 日本陆军（带空军）被攻击 → 先挂 `guard`（保护卡）✅ 正常；',
		'  2. 选「不使用保护卡」→ 进 `defend`；再选「不代受」→ **又回到 `guard`**，如此往复，',
		'     被攻击的陆军**永远死不了**（玩家实测"好像改过、不确定"）；',
		'  3. 日志出现「移除敌方undefined（undefined）」。',
		'- **根因**：',
		'  - `resolve_battle` 的 **defend 段**重放 `do_battle` 时**没带 `guard_done`**；',
		'    `do_battle` 的判据是 `if (!opt.guard_done && !opt.kv2_done)`，于是 guard 分支再次武装 ——',
		'    15410 仍在手里、条件仍满足 → 无限 `guard ↔ defend` 循环（对照：guard 通过那条重放是带 `guard_done: true` 的）；',
		'  - `do_battle` 的 **defend 挂起出口**没带 `removed_type / removed_nation`，调用方 `battle_desc()` 取到 undefined。',
		'- **改法**（2 处）：',
		'  1. defend 段重放的 `opt` 增加 `guard_done: true`（走到 defend 说明 guard 已表态）；',
		'  2. defend 挂起 `return` 补 `removed_type: vType, removed_nation: vNation`。',
		'  - 顺带核实：`guard_card_candidates()` **本来就有**代价可付性过滤（`cost.discard` 的 `filter` 池不足即跳过），',
		'    所以"付不起也弹空窗口"**不是缺陷**；测试里已改成"纯函数级验证 + 起手有响应卡的正常路径"两条断言。',
		'- **验证**：`tools/_real_test_15410_bushido.js` **18/18**',
		'  A guard 先于 defend（不互抢）；B 打出 15410 → 陆军保住、卡进弃牌堆、进 defend；',
		'  C 不代受收尾 → 陆军/空军都在、无残留；D 不使用保护卡 → 进 defend → 不代受 → **陆军被移除**（修复点）；',
		'  E 起手有响应卡正常挂 guard + 付不起代价时 15410 不进候选；F 静态守卫 3 条。',
		'  回归：`test_basic_cards` 288/9、全量冒烟 112 全绿。',
		'- **提交**：`fix(quartermaster): 15410 武士道 guard 回弹（defend 重放漏 guard_done）+ 战斗日志 undefined`',
		''
	].join('\n')
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('15410《武士道》guard 窗口回弹') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · B10 空军被移除的时点'
		fs.writeFileSync(p, cur.replace(marker, lines + '\n' + marker), 'utf8')
		console.log('fix-log 已插入 15410')
	}
}

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf('15410 已完成（2026-11-05）') < 0) {
		s += [
			'',
			'### ✅ 15410《武士道》guard 窗口回弹（2026-11-05 完成）',
			'',
			'- 复现与修复见 `docs/fix-log-2026-11.md`；真实测试 `tools/_real_test_15410_bushido.js`（18 项）固化。',
			'- 关键 root cause：`resolve_battle` 的 defend 段重放 `do_battle` 漏 `guard_done` → guard 反复武装。',
			'- 顺带核实 `guard_card_candidates` 已有代价可付性过滤，"空 guard 窗口"不是缺陷。',
			''
		].join('\n')
		fs.writeFileSync(p, s, 'utf8')
		console.log('todo 已补 15410 完成备注')
	} else console.log('todo 已有备注')
}
