/* B12 完成：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const lines = [
		'',
		'## 2026-11-05 · B12《德国军事顾问》17732：候选放宽 + 代价改由借用方（意大利）支付（服务端）',
		'',
		'- **玩家口径**：① 候选 = 该桌面**全部**德国状态卡，只有带 `trigger` 的能点；',
		'  ② 借用后代价按**意大利**牌库判断、扣**意大利**的牌；③ 付不起 → **拒绝发动**（一张都不扣）。',
		'- **改法**（4 处）：',
		'  1. `17732` 候选：`filter(cfg.trigger)` → 全部德国状态卡 + `playable{}` 标记；',
		'  2. `view.italy_borrow.options` 下发 `playable`（客户端据此置灰，不可发动的只能看）；',
		'  3. 代价段去掉 `!borrowed` 豁免（discard / attrition / skip_play 三处）——**改为由 `costPayer`（意大利）支付**；',
		'     并补「弃牌代价必须来自 `costPayer` 手牌」校验（否则点德国的牌会静默白嫖）；',
		'  4. `precheck_status_args` 改为按 `costPayer` 查手牌（原来传 `owner`=德国，借用时误判「要弃置的手牌不在手里」）；',
		'     并新增**损耗前置预检**：`can_attrite(costPayer)` 不过就拒绝（原来 `skip_play` 先执行 → 15255 会出现「出牌阶段被跳过、再报牌库不足」）。',
		'- **顺带修掉重复代码**：`cost.discard` 分支在文件里被复制成两份（会扣两次牌），已删掉第二份。',
		'- **验证**：`tools/_real_test_17732_borrow_all.js` —— 对 **16 张德国状态卡逐张**跑真实链路',
		'  （真实打出状态卡 → 真实暗置 17732 → 真实 `play_start` 响应窗口 → `trigger_response` → `resolve_italy_borrow` → `activate_status`），',
		'  **88 项断言全过**；关键结论：',
		'  · 16 张全部进候选，`playable` 与 `cfg.trigger` 一一对应（6 张可发动 / 10 张仅展示）；',
		'  · **德国牌库在任何情况下都不被扣**（Δ=0）；',
		'  · 15255《征兵》（损耗 2）在意大利付得起时 Δ(意大利)=-2，付不起时**明确拒绝且 Δ=0**；',
		'  · 借用 15242 时用德国手牌当代价 → 拒绝「要弃置的手牌不在手里」，德国那张牌未被弃。',
		'  连带更新 3 条旧冒烟（把「借用免代价」写死的断言）：`_smoke_114_status_cost_precheck`、',
		'  `_smoke_skip_play_unified`、`_smoke_italy_response`（改为「意大利付代价 + 意大利跳过出牌阶段」）。',
		'  回归：`test_basic_cards` 288/9、`_real_test_precheck_*` 25/11/8、`_smoke_17732_borrow` 16、',
		'  `_real_test_15353_status_intercept` 23、全量冒烟 112 全绿。',
		'- **提交**：`fix(quartermaster): B12 德国军事顾问候选放宽 + 代价改由意大利支付（16 张逐卡真实测试）`',
		''
	].join('\n')
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B12《德国军事顾问》17732') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · 15410《武士道》guard 窗口回弹'
		fs.writeFileSync(p, cur.replace(marker, lines + '\n' + marker), 'utf8')
		console.log('fix-log 已插入 B12')
	}
}

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf('B12 已完成（2026-11-05）') < 0) {
		s += [
			'',
			'### ✅ B12《德国军事顾问》17732（2026-11-05 完成）',
			'',
			'- 候选放宽到桌面全部德国状态卡（`playable` 标记）；借用代价改由**意大利**支付；付不起 → 拒绝发动。',
			'- 真实测试：`tools/_real_test_17732_borrow_all.js`（**16 张德国状态卡逐卡**，88 项断言全过）。',
			'- 顺带修：`cost.discard` 重复块（会扣两次）、`precheck_status_args` 借用时查错手牌、损耗预检晚于 `skip_play`。',
			''
		].join('\n')
		fs.writeFileSync(p, s, 'utf8')
		console.log('todo 已补 B12 完成备注')
	} else console.log('todo 已有备注')
}
