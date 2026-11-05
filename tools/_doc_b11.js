/* B11 完成：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('### B11. 卡佩里尼 / 租借法案：被捞/被让权的建设不触发状态卡',
		'### ✅ B11. 卡佩里尼 / 租借法案：被捞/被让权的建设不触发状态卡（已修：链停一步 + 窗口归属豁免）')
	s = s.replace('| 16 | **B11** | 17729/17535 被捞/被让权建设不触发状态卡 | 下沉 `build_piece` 原子层 | 高 | 6 |',
		'| 16 | ~~**B11**~~ ✅ | ~~17729/17535 被捞/被让权建设不触发状态卡~~ | 已修：链停一步 + `status_instant_covers` 豁免 | 中 | 18 |')
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo B11 已勾选:', s.indexOf('✅ B11.') >= 0)
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const lines = [
		'',
		'## 2026-11-05 · B11《卡佩里尼》捞出的建设不触发建设国状态卡（服务端）',
		'',
		'- **症状**：意大利打 17729《卡佩里尼》→ 德国从弃牌堆打出《建设陆军》→ 德国的',
		'  15247《贵在行动》**不亮/点了被拒**；租借法案（17535）让苏联建设的同款。',
		'- **探针结论**（`tools/_probe_b11_build_window.js`）：窗口其实**已经武装**',
		'  （`status_instant = ["15247@after_build_army(德国)"]`，`last_built.nation=德国` 正确），',
		'  但链在 `resolve_italy_play` 末尾立刻 `advance_italy_chain()` → `current_nation` 切到意大利 →',
		'  ① `table_status.ready=false`；② `activate_status` 回「不能触发非本方的状态卡」。',
		'- **改法**：',
		'  1. `resolve_italy_play`：本步打出基本卡且**建成**、且建设国桌上有 `after_build_*` 状态卡时，',
		'     **不推进链**，改为登记通用「事件卡分步机」`game.pending_event_step`（`chain:"italy"`）；',
		'  2. `event_step_next` 增加 `chain==="italy"` 分支：点「下一步」= 放弃窗口并 `advance_italy_chain()`；',
		'  3. 新增 `status_instant_covers(game, card_id, owner)`：只对**引擎武装**的窗口（条目带 `by`，且与卡的归属国同一代表）',
		'     豁免 `status_window_ready` 与 `activate_status` 的"非本方"判据；',
		'  4. 新增 `has_after_build_status()`：没有对应状态卡时**不多弹**一次「下一步」。',
		'  - 代价/名额按玩家口径记在**打出的国家**（现状已满足：`last_built.nation` 与 `costPayer` 都取该卡 owner）。',
		'- **客户端**：零改动 —— 复用已有的 `#event_step_box`「下一步」面板（`update_event_step_box`），',
		'  文案自动变成「下一步：继续处置下一位：意大利（有可发动的贵在行动；不发动就直接点「下一步」）」。',
		'- **验证**：`tools/_real_test_b11_window_activate.js` **18/18**',
		'  A 基准（德国自建→15247 可发动）；B ★★ 分步机出现且链停在德国；C ★★ 15247 ready=true 且真的发动（扣 1 张+空打）；',
		'  D 点「下一步」链续跑；E 不发动直接「下一步」也能续跑（无死锁）；F 无该状态卡时链照常推进；G 静态守卫。',
		'  回归：`test_basic_cards` 288/9、`_smoke_17732_borrow` 16/16（该冒烟一度因豁免过宽失败，已把豁免收紧为"仅引擎武装的窗口"）、',
		'  `_real_test_15353_status_intercept` 23、`_real_test_15210_window` 11、`_real_test_loot_friendly_base` 9、',
		'  `_real_test_17747_strait` 16、`_real_test_15228_air` 12、`_real_test_15206_london` 12、全量冒烟 112 全绿。',
		'- **提交**：`fix(quartermaster): B11 卡佩里尼/租借法案的建设触发窗口 —— 链停一步 + 窗口归属豁免`',
		''
	].join('\n')
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B11《卡佩里尼》捞出的建设不触发') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · B8「对方时点」'
		fs.writeFileSync(p, cur.replace(marker, lines + '\n' + marker), 'utf8')
		console.log('fix-log 已插入 B11')
	}
}
