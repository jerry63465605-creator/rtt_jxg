/* 把 B6 / B4 记为已完成（todo 勾选 + fix-log 追加两条） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

/* ① todo：给 B6 / B4 标题打勾 */
{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('### B6. 15233 / 17725《掠夺》：应排除「友方大本营」',
		'### ✅ B6. 15233 / 17725《掠夺》：应排除「友方大本营」（已修 `c7f0a91`）')
	s = s.replace('### B4. 15206《轰炸伦敦》：只数了 1 个地区（应为「不列颠」2 地区）',
		'### ✅ B4. 15206《轰炸伦敦》：只数了 1 个地区（已修，改为 `radius:2`）')
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo 已勾选 B6/B4')
}

/* ② fix-log 追加 */
{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · B4 15206《轰炸伦敦》只数 1 个地区 → 改为「不列颠半径 2」（服务端）

- **症状**：卡面「\`<不列颠>\`2 地区内每有 1 支德国空军，该经济战损耗数 +2」，实际最多只算 1 格上的空军。
- **根因**：\`run\` 用 \`space_id('不列颠')\` + 单格遍历；本图「不列颠」只有 1 格（id=2，相邻仅 北海），
  \`REGION_GROUPS\` 里也没有这个组 → 2 跳内的其余德国空军完全不计。
- **改法**：与美军「轰炸行动」同口径 —— \`count_pieces(game, { space:'不列颠', radius:2, types:['air'], nation:'德国' })\`
  （\`radius\` 走几何邻接 BFS，含本格 + 1~2 跳）。
- **验证**：\`tools/_real_test_15206_london.js\` **12/12**
  A 1 跳 1 支→2 张；B **2 跳** 1 支→仍 2（证明是范围）；C 3 跳外→skip 且不扣代价；
  D 半径内 2 支→4 张；E 0 支→不损耗；F 目标非英国→不开窗；G 静态守卫 2 条。
  回归：\`test_basic_cards\` 288/9（与基线一致）、全量冒烟 112 全绿。
- **提交**：\`fix(quartermaster): B4《轰炸伦敦》改为「不列颠半径2」计数\`

## 2026-11-05 · B6 15233/17725《掠夺》排除「同阵营所有大本营」（服务端）

- **症状**：德国控制意大利大本营、意大利控制德国大本营时仍计分。
- **根因**：两张卡只排除 \`effective_home_base(game, 本国)\`（单个大本营）。
- **改法**：新增 \`friendly_home_base_spaces(game, nation)\`（按阵营收集全部大本营，含委托国 法国/中国，
  走 \`effective_home_base\` 所以 15344/17845 的改判一并生效），两卡改用它。
- **验证**：\`tools/_real_test_loot_friendly_base.js\` **9/9**（含"两个普通格计 2 分"防恒 0 断言）；
  回归 \`test_basic_cards\` 288/9、全量冒烟 112 全绿。
- **提交**：\`c7f0a91\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B4 15206《轰炸伦敦》') >= 0) console.log('fix-log 已有，跳过')
	else {
		const marker = '## 2026-11-04 · S2-b'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 B6/B4 两条')
	}
}
