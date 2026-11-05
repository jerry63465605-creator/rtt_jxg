/* B1 完成：todo 勾选 + fix-log 追加 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('### B1. 15228《高速公路》：收回陆军后，驻留其上的空军没被处理',
		'### ✅ B1. 15228《高速公路》：收回陆军后，驻留其上的空军没被处理（已修）')
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo B1 已勾选:', s.indexOf('✅ B1.') >= 0)
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · B1《高速公路》/《西伯利亚大铁路》收回陆军时处理载体空军（服务端）

- **症状**：15228《高速公路》把德国陆军全部收回后，原来停在陆军头上的**空军留在原地**（没撤离也没消灭）。
- **根因**：\`railroad_recall()\` 只对 \`piece_type==='army'\` 的棋子 \`remove_piece\`，完全没处理该格空军。
- **口径**（玩家确认）：**有相邻本国海军 → 空军撤离到该格（不要求该海军补给）；没有 → 随陆军一起被消灭**。
  同格不可能同时有陆军+海军（非法布阵），故不考虑同格海军。
- **改法**（\`railroad_recall\` 一处，同时覆盖 15228 / 17827）：删陆军前先算该格空军——
  相邻（\`get_connections\` 按阵营）找到本国海军则改 \`game.location[air]\`（不触发 \`piece_removed\`），
  否则 \`remove_piece(game, who, air)\`（保留移除窗口语义，如 17811/15330）。
- **验证**：\`tools/_real_test_15228_air.js\` **12/12**
  A 无相邻海军→空军被消灭且日志说明；B 相邻海军（**故意不 grant_supply**）→撤离到该海域、日志含"撤离"；
  C 相邻海军是敌方的→不算、空军被消灭；D 17827 苏联版同款（同一原子）；E 静态守卫 3 条。
  回归：\`test_basic_cards\` 288/9、全量冒烟 112 全绿。
- **提交**：\`fix(quartermaster): B1 收回陆军时按相邻海军处理载体空军（15228/17827）\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B1《高速公路》/《西伯利亚大铁路》') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · B7《施佩伯爵》'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 B1')
	}
}
