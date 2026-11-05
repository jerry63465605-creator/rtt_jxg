/* B8 完成：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('### B8. 15311《马奇诺》等：挂起打断对手',
		'### ✅ B8. 15311《马奇诺》等：挂起打断对手（已修：对方时点强挂起）')
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo B8 已勾选:', s.indexOf('✅ B8.') >= 0)
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · B8「对方时点」的增强窗口改为强挂起（阿登 + 马奇诺实测）

- **症状**（玩家实测）：德国打《阿登闪击战》第一步在\<西欧\>移除法国陆军 → 英国桌面 15311《马奇诺防线》、
  手牌 7 张，窗口确实开在英国那侧；但德国可以直接 \`event_finish\` 把阿登第二步（建设陆军）做完，
  还能继续出牌。等英国表态时局面已变（西欧已被德军建设），复原出的法军与德军同格。
- **根因**：\`armed_offers\` 只被当作「可选窗口」（做其它动作即错过），\`do_action\` 没有任何针对它的门禁；
  \`event_finish / next_phase / play_card\` 都不检查窗口。\`watch:true\` 只解决"发给谁"，没解决"谁必须等谁"。
- **改法**（\`do_action\` 增加一道门禁，范围限定）：窗口里被移除/被指向的部队属于【对方阵营】
  （\`ctx.piece_nation / target_nation\`）且候选非空时，行动方只允许 \`use_armed_offer / skip_armed_offer / log / debug_*\`，
  其它动作拒绝并写「等待【英国】决定是否发动《马奇诺防线》（对方时点，不可继续推进）」。
  自己回合的"自有窗口"（\`after_build_army\` / \`after_deploy_air\` 等）**仍是"错过即失效"**，节奏不变。
- **验证**：\`tools/_real_test_15311_suspend.js\` **14/14**
  A 窗口出现且 Allies 可见 / Axis 不可见；B \`event_finish\` 被拒且阿登第二步未执行（西欧仍空）；
  C \`play_card\`/\`next_phase\` 被拒；D 英国发动 15311 → 法军复原 → 窗口清空后德国可推进；
  E 英国「不发动」→ 立刻可推进（无死锁）；F 自有窗口不受影响（仍错过即失效）；G 静态守卫 3 条。
  回归：\`test_basic_cards\` 288/9、\`_real_test_15353_status_intercept\` 23、\`17848\` 13、\`precheck_*\` 25/11/8、\`15407\` 14、全量冒烟 112 全绿。
- **另记**：\`offer_armed_effects\` 在 \`cost.discard\` 不足时会**静默剔除**候选（\`rules.js:14849 if (dpool.length < discNeed) continue\`），
  玩家会误以为"没挂起"——已列入待办（B15），本次未改。
- **提交**：\`fix(quartermaster): B8「对方时点」的增强窗口改为强挂起（阿登+马奇诺）\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B8「对方时点」的增强窗口改为强挂起') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · 15353《保持冷静》可拦截'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 B8')
	}
}

/* 待办 B15：代价不足时静默剔除候选 */
{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf('### B15.') < 0) {
		s += `
### B15. 增强卡"付不起代价"时从窗口静默消失（探针实测）

- **实测**：15311 需弃 4 张，英国手牌裁到 2 张 → \`g.armed_offers = []\`，窗口整体消失（连"有这张卡但点不了"都看不到）。
- **根因**：\`rules.js:14849  if (dpool.length < discNeed) continue\` —— 代价不足直接跳过该卡；\`cost.attrition\` 牌库不足同理（32061 一带）。
- **方案**：不 \`continue\`，改为把卡片放进候选并带 \`short:true\`（点击时由 \`use_armed_offer\` 给明确原因）；
  前端若要灰化，需要 \`update_armed_offer_box\` 支持 \`disabled/reason\`（当前不读）。
- **真实测试**：手牌不足 → 窗口仍出现、卡片在候选且 short=true、点击给「需先选择弃置 N 张手牌」、不扣牌。
`
	}
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo B15 已登记:', s.indexOf('### B15.') >= 0)
}
