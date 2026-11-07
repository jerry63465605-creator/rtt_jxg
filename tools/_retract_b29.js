/*
 * 撤回 B29（误报）：armed 卡"要选地区"的候选其实完整下发在
 * view.armed_offer.pending.candidates，客户端 play.js L2362 会读取并渲染。
 * 我上一轮探针只看了 pending_echo / pending_ask / cards[0]，漏了 armed_offer.pending。
 * 同时把 B30 的根因补精确（代价先付 + needs 预检未覆盖 build/spacesFn）。
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

/* ① 报告：B29 改为"误报"，补实测证据 */
{
	const P = path.join(ROOT, 'docs', 'probe-us-ace-empty-frame.md')
	let s = fs.readFileSync(P, 'utf8')
	s = s.replace(/## 3\. B29（新）：名将系列"要选地区"时，客户端拿不到候选 → 点了没反应/,
		'## 3. ~~B29~~ **误报**：名将系列的候选其实一直在 `armed_offer.pending` 里')
	const add = [
		'',
		'### 3.1 更正（2026-11-07 复核）',
		'',
		'上一版结论"客户端拿不到候选"是**我探针看漏了**。实测同一状态：',
		'',
		'```js',
		'view.armed_offer.pending = {',
		'  need: "space", candidates: [25, 30], pick: 1, pickMin: 1,',
		'  revealNation: null, choiceOptions: null, spaceCandidates: null',
		'}',
		'server off.pending     = 与上面完全一致',
		'```',
		'',
		'且客户端确实读它：`play.js`',
		'',
		'```',
		'L1993   if (view && view.armed_offer && view.armed_offer.pending) return',
		'L2348   need: ao.pending.need,',
		'L2362   candidates: (ao.pending.candidates || []).map(...)',
		'```',
		'',
		'→ 服务器把候选写进 `game.armed_offers[].pending`（`rules.js:33197-33221`），',
		'  view 原样下发，客户端据此渲染地区选择器。**B29 不成立，已关闭。**',
		'',
		'> 教训：排查 armed 卡时，候选在 **`view.armed_offer.pending`**，',
		'> 不是 `pending_echo` / `pending_ask`（那两个是"通用挂起"通道）。',
		'',
	].join('\n')
	if (s.indexOf('### 3.1 更正') < 0) {
		s = s.replace('## 4. B30（新）', add + '\n## 4. B30（真）：17509 无合法空军地时，白扣损耗且提示像"未实现"')
	}
	fs.writeFileSync(P, s, 'utf8')
	console.log('报告已更正：B29 撤回')
}

/* ② todo：B29 标为误报关闭；B30 补根因 */
{
	const P = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(P, 'utf8')
	s = s.replace('### B29. 名将系列 armed「再选一次地区」时客户端无候选（点了没反应）',
		'### ⊘ B29. ~~名将系列 armed 选地区无候选~~ —— **误报，已关闭**（候选在 `view.armed_offer.pending.candidates`，客户端 L2362 会读）')
	s = s.replace('- **建议修法**：armed `need` 的统一处理处做 `candidates → cands` 归一化（早于空框守卫）；\n  补真实测试 4 条（四张上将各一条：不带 space 时 view 必须有候选）。',
		'- **更正（2026-11-07）**：服务器把候选写进 `game.armed_offers[].pending`（rules.js:33197-33221），\n' +
		'  view 原样下发、客户端 `play.js` L1993/L2348/L2362 读取渲染 —— **链路完整，无需修改**。\n' +
		'  我上一轮探针只查了 `pending_echo/pending_ask/armed_offer.cards[0]`，漏看 `armed_offer.pending`。')
	s = s.replace('- **建议修法**：`steps` 前先算合法目标，无目标 → `{ok:false, reason:\'<中太平洋>及相邻没有可部署空军的地区\'}` 且不扣 cost。',
		'- **根因（已定位）**：`execute_effect` 里 `cost.attrition` 在 steps 之前就扣了（rules.js:3356-3358），\n' +
		'  而"零效果"判定在 steps 之后（L20873-20874）；且 `needs` 预检**未覆盖 `op:\'build\'` + `spacesFn` 这类步骤**，\n' +
		'  于是零候选时仍先付代价、之后才被判"无可执行效果"，且没有回滚。\n' +
		'- **建议修法**（两条任选）：\n' +
		'  ① 把 build/recruit 的候选预检并入 `needs`（优先，治本，但属共享路径，需回归 20+ 卡）；\n' +
		'  ② 在 L20874 失败返回处回滚本张卡已付的 attrition（把 `attrition_cards` 返回的牌移回牌库顶）。\n' +
		'  文案同时改为「<中太平洋>及相邻没有可部署空军的地区」。')
	fs.writeFileSync(P, s, 'utf8')
	console.log('todo 已更新：B29 关闭 / B30 补根因')
}
