/* B26-b：文档追加 + fix-log + todo 备注 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

/* ① 追加到 docs/change-17505-17513.md */
{
	const P = path.join(ROOT, 'docs', 'change-17505-17513.md')
	let s = fs.readFileSync(P, 'utf8')
	const sec = [
		'',
		'## 8. B26-b 补充：17505 的「可打出」高亮与实打不同源（只改 17505）',
		'',
		'### 8.1 现象（玩家提问："这俩卡的客户端高亮可打出时点有问题吗？"）',
		'',
		'| 卡 | 判定来源 | 结论 |',
		'|---|---|---|',
		'| **17513** | 有 `CARD_TRIGGERS`（`conditional` + `has_used_status`）→ `trigger_ready` 会校验行动方 | ✅ 高亮正确（无已发动状态卡/敌方回合都是灰的） |',
		'| **17505** | **没有**时点声明 → `check_phase_for_card` 走「未声明时点 EFFECT = 随时可打」兜底（**不校验行动方**） | ❌ 敌方回合仍亮"可打出"，点了被 play_card 的行动方闸门拒 |',
		'',
		'实测（`tools/_probe_b26_highlight2.js`）：',
		'',
		'```',
		'美国·出牌/资源/弃牌阶段：hand_ready=true  实打=成功',
		'德国回合（对手）：       hand_ready=true  实打=被拒「现在轮到【德国】行动，同盟暂不能打牌」  ← 漂移',
		'```',
		'',
		'### 8.2 为什么不能"统一改兜底"',
		'',
		'全库只有 2 张 EFFECT 没声明时点：`17505` 与 **`17805 红色管弦乐队`**。',
		'而 17805 的卡面是「**任一出牌阶段开始时**，选择场上 1 张德国[状态卡]…」——',
		'它本来就是 **敌方回合**（`nation_turn_start` + `watch:true` 的 armed 窗口）要亮的。',
		'所以在 `check_phase_for_card` 的兜底里加"行动方"校验会误伤它。',
		'',
		'### 8.3 改法（只动 17505，声明式）',
		'',
		'```js',
		"/* 17505 P-51 野马：本方回合任意阶段装载（不限制阶段，但不能在对手回合装） */",
		"CARD_TRIGGERS['17505'] = { kind: 'conditional', nation: '美国' }",
		'```',
		'',
		'- `conditional` 分支：只校验「本方阵营回合」+ 可选 `cond`；不带 `cond` 即只看回合；',
		'- 不限制阶段 → 资源/弃牌阶段依旧可装载（与被动物修正语义一致）；',
		'- `play_card` 里 17505 的特例在时点校验之前 return，**实际打出路径零变化**；',
		'- 17805 **不加声明**，保持原有"随时可打 + 敌方回合窗口"行为。',
		'',
		'### 8.4 验证 `tools/_real_test_hand_ready_17505.js`（13 项）',
		'',
		'```',
		'A ★★ 17505 本方出牌阶段：hand_ready=true 且实打成功',
		'B ★  17505 本方资源/弃牌阶段：仍亮且能打（口径不变）',
		'C ★★ 17505 敌方回合：hand_ready.ok=false，实打仍被拒（高亮与实打一致）',
		'D ★★ 17805 敌方回合：hand_ready 仍 true，且 armed 窗口能真实发动（「请做出选择」）',
		'E ★  17513 四态回归（有/无已发动 × 本方/敌方回合）',
		'F 静态守卫：17505 已声明、17805 仍未声明',
		'```',
		'',
		'回归：`_real_test_17505_17513` 16、`_dom_test_us_wartime_cancel` 4、',
		'`test_basic_cards` 288/9、全量冒烟 112 全绿。',
		'',
	].join('\n')
	if (s.indexOf('## 8. B26-b 补充') < 0) {
		s = s.replace(/\s*$/, '\n') + sec
		fs.writeFileSync(P, s, 'utf8')
	}
	console.log('change 文档 §8 =', fs.readFileSync(P, 'utf8').indexOf('## 8. B26-b 补充') >= 0)
}

/* ② fix-log */
{
	const entry = [
		'## 2026-11-07 · B26-b 17505 的「可打出」高亮与实打不同源（只改 17505，不动 17805）',
		'',
		'- **现象**：德国回合时，美国手里的 17505《P-51 野马》仍显示"可打出"（hand_ready.ok=true），',
		'  点下去被 play_card 的行动方闸门拒绝 —— 「亮着但打不出」。',
		'- **根因**：17505 没有 `CARD_TRIGGERS` 声明，`check_phase_for_card` 走「未声明时点 EFFECT = 随时可打」',
		'  的兜底，**不校验行动方**；而 `play_card` 会校验。',
		'- **为什么不统一改兜底**：17805《红色管弦乐队》同样没声明，但卡面是「任一出牌阶段开始时」触发，',
		'  **敌方回合本来就该亮**（`nation_turn_start` + watch 窗口），统一加校验会误伤它。',
		'- **改法**：只给 17505 补声明 `CARD_TRIGGERS[\'17505\'] = { kind: \'conditional\', nation: \'美国\' }`',
		'  （本方回合任意阶段；不带 cond 即只校验回合），17805 保持原样。',
		'- **验证**：`tools/_real_test_hand_ready_17505.js` 13 项（含 17805 敌方回合仍可发动）；',
		'  `_real_test_17505_17513` 16、DOM 4、`test_basic_cards` 288/9、全量冒烟 112 全绿。',
		'',
		'---',
		'',
	].join('\n')
	const P = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	let s = fs.readFileSync(P, 'utf8')
	if (s.indexOf('B26-b 17505 的「可打出」高亮') < 0) {
		const i = s.indexOf('---\r\n\r\n')
		if (i >= 0) {
			s = s.slice(0, i + 7) + entry + s.slice(i + 7)
			fs.writeFileSync(P, s, 'utf8')
		}
	}
	console.log('fix-log =', fs.readFileSync(P, 'utf8').indexOf('B26-b 17505 的「可打出」高亮') >= 0)
}

/* ③ todo：B26 追加备注 */
{
	const P = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(P, 'utf8')
	const tag = '- **B26-b（2026-11-07）**：17505 的"可打出"高亮此前在**敌方回合**仍亮（点了被拒）——已修：'
	if (s.indexOf('B26-b（2026-11-07）') < 0) {
		s = s.replace('### ✅ B26. 17505《P-51 野马》/ 17513《战时生产委员会》——已修（3 处 + 注册表，见 docs/change-17505-17513.md）',
			'### ✅ B26. 17505《P-51 野马》/ 17513《战时生产委员会》——已修（3 处 + 注册表 + 高亮同源）\n\n' +
			tag + '给 17505 补 `CARD_TRIGGERS` 声明（本方回合任意阶段）；17805 红色管弦乐队保持"敌方回合可打"不变。')
		fs.writeFileSync(P, s, 'utf8')
	}
	console.log('todo =', fs.readFileSync(P, 'utf8').indexOf('B26-b（2026-11-07）') >= 0)
}
