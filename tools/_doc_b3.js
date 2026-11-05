/* B3 完成：todo 勾选 + fix-log 追加 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('### B3. 15407《秋水火箭战斗机》：变成自动了，应为可选',
		'### ✅ B3. 15407《秋水火箭战斗机》：改为玩家选目标（已修）')
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo B3 已勾选:', s.indexOf('✅ B3.') >= 0)
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · B3《秋水火箭战斗机》改为玩家选目标（服务端）

- **症状**：15407 打出后由服务端**自动挑第一支**敌机消灭（玩家："变成自动了，应该可选"）。
- **根因**：\`ECHO_EFFECTS['15407'].run\` 里 \`for (const p in game.piece_nation)\` 遍历，
  命中第一支就 \`seize_air(...)\` 立即结算；既无选择也无确认。
- **改法**（照抄 15408/15355 的"选项 + 重发"通道）：
  - 新增 \`qiushui_targets(game)\`：与【日本空军】同格或相邻地区的敌方空军（含 via 发起机）；
  - \`event_card_needs\` 增加 \`faceId === '15407'\` 分支：未带 \`choice\` 时下发 options（每架敌机一项）；
  - \`run\` 改为按 \`ctx.arg.choice\` 取 \`cands[choice]\` 精确消灭；未选/越界明确拒绝。
  - 顺带确认：\`seize_air(..., {by:'card'})\` **不触发中立国参战**（2026-10-30 修复仍在）。
- **验证**：\`tools/_real_test_15407_qiushui.js\` **14/14**
  A 打出 → 下发 2 个 option 且两架敌机都还在；B 带 choice:0 → **只消灭选中那支**、另一架存活；
  C 无合法目标 → 明确拒绝、无残留；D 越界 choice → 拒绝且不消灭；E 不打出（可选性）敌机全在；F 静态守卫 4 条。
  回归：\`_smoke_jp_effect\`（用例已改为两步，PASS=134 FAIL=0）、\`test_basic_cards\` 288/9、全量冒烟 112 全绿。
- **提交**：\`fix(quartermaster): B3 秋水改为玩家选目标（need:choice 两步）\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B3《秋水火箭战斗机》') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · B5《丘克群岛》'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 B3')
	}
}
