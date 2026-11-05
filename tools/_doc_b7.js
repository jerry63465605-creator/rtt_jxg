/* B7 完成：todo 勾选 + fix-log 追加 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('### B7. 15210《施佩伯爵海军上将号》：建设海军「无法执行」也要给时点',
		'### ✅ B7. 15210《施佩伯爵海军上将号》：建设海军「无法执行」也要给时点（已修）')
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo B7 已勾选:', s.indexOf('✅ B7.') >= 0)
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · B7《施佩伯爵》建设海军失败也要给触发时点（服务端）

- **症状**：建设海军「无法执行」（没建出来）时，15210 完全没有触发时点；玩家口径：失败也要给时点。
- **根因**：\`build_piece\` 只在 \`__r.ok\` 时才 \`offer_armed_effects('after_build_navy')\`；
  而多数失败发生在更早的 \`has_legal_target\` / \`can_build_at\` 阶段，连 \`build_piece\` 都到不了。
  另外 15210 的 \`armed.ready\` 要求"此刻已有合法海战目标"，且 \`run\` 无目标时返回 \`ok:true\`（**照扣 1 张**）。
- **改法**：
  - 新增 \`emit_build_navy_failed()\` / \`maybe_emit_navy_build_failed()\`：失败时记 \`game.last_build_failed\` 并派发
    \`after_build_navy\` 窗口（\`ctx.failed=true\` + \`reason\`）；
  - 接入 3 个失败出口：\`build_piece\`（上限/impl）、\`has_legal_target\` 预检（两处）、\`resolve_basic_card\` 失败；
  - 15210：\`ready\` 改为只要求"亚速尔存在"；\`run\` 无目标/开打失败一律返回 \`ok:false\` → 明确拒绝且**不扣代价**。
- **验证**：\`tools/_real_test_15210_window.js\` **11/11**
  A 建成+有敌→开窗、扣 1 张、真发起海战；B 对陆地建（失败）→ **仍开窗**、15210 在候选；
  C 失败窗口点发动→「亚速尔相邻无可发起的海战目标」且牌库/弃牌堆不变；D 未建海军→不开窗；E 静态守卫 3 条。
  回归：\`test_basic_cards\` 288/9、全量冒烟 112 全绿。
- **提交**：\`fix(quartermaster): B7 建设海军失败也派发 after_build_navy（15210 不再白扣代价）\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B7《施佩伯爵》建设海军失败') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · C3 计分标记'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 B7')
	}
}
