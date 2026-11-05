/* P3-3 完成：todo 勾选 + fix-log 追加 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('| P3-3 | `view.it_viva` 补"剩余次数" |',
		'| ~~P3-3~~ ✅ | ~~`view.it_viva` 补"剩余次数"~~ —— 已修（`view.it_viva_left` + 顶部提示） |')
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo P3-3 已勾选')
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · P3-3《意大利万岁》下发「剩余额外行动次数」（服务端 + 客户端一行）

- **症状**：16701 生效后只有布尔 \`view.it_viva\`，玩家看不到「本回合还可再行动 1 次」，点一次才发现没机会了。
- **改法**：
  - 服务端 \`view\` 新增 \`it_viva_left: it_italy_viva_left(game, game.current_nation)\`
    （与 \`it_viva_allows\` / 记账点同源，客户端不自己猜）；
  - 客户端在顶部 \`#phase_note\` 追加一行「《意大利万岁》：本回合还可额外行动 N 次」，
    仅在 \`view.it_viva && it_viva_left > 0\` 时出现。
- **验证**：\`tools/_real_test_it_viva_left.js\` **11/11**
  A 未打出→0；B 打出 16701（真实 play_card）→1；C 用掉 1 次（真实建设陆军）→0；
  D 离开出牌阶段→0；E 真 DOM \`#phase_note\` 有/无提示；F 静态守卫 2 条。
  回归：\`test_basic_cards\` 288/9、全量冒烟 112 全绿。版本串 → \`?v=20261105a\`。
- **提交**：\`fix: P3-3《意大利万岁》下发剩余次数并在顶部提示\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('P3-3《意大利万岁》') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · B4 15206'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 P3-3')
	}
}
