/*
 * 回归：客户端"选项识别"三件事（玩家 2026-10-23 反馈"选项1 / 选择 / ？"）
 *
 *   A. 所有 choice 卡的选项都必须有可读标签（不能落到 "选项 N"）
 *      —— 当前 10 张未补，先按白名单冻结；补齐后把白名单清空，测试自然转严
 *   B. 所有 game.pending_echo 都必须带 title（否则客户端显示"选择"）
 *   C. 客户端源码约定：
 *      · inst_card_client 必须查 view.hands / view.table_cards（服务端真实下发的字段）
 *      · show_event_choice 必须兼容 index/id 与 disabled/enabled
 *
 * 用法：node tools/_smoke_choice_labels.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { CARD_BY_ID } = require(path.join(MOD, 'cards.js'))

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

/*
 * 已知待补标签的卡（2026-10-23 已全部补齐，白名单清空）。
 *
 * ⚠ 17514 飞虎队 / 17815 Z 计划 / 17825 铁托游击队 配置里没有 choiceLabels，
 *   但它们走 armed 的 choiceOptions 通道（带 name），不会落到"选项 N"，故不列入。
 */
const PENDING_LABELS = {}

console.log('=== A. choice 卡的选项标签覆盖率 ===')
{
	const g = rules.setup(91, rules.default_scenario, {})
	const missing = []
	const bare = []
	for (const id of Object.keys(CARD_BY_ID)) {
		const eff = I.card_effect_of(id)
		if (!eff || !eff.choice) continue
		const nation = eff.actor || CARD_BY_ID[id].nation
		let need = null
		try { need = I.event_card_needs(g, nation, id, {}) } catch (e) { continue }
		if (!need || need.need !== 'choice') continue
		const opts = need.options || []
		if (!opts.length) { missing.push(id + '：options 为空'); continue }
		for (const o of opts) {
			if (!o.label || /^选项\s*\d+$/.test(o.label)) {
				bare.push(id + '《' + ((CARD_BY_ID[id] || {}).name || '?') + '》第 ' + (o.index + 1) + ' 项 '
					+ JSON.stringify(o.label))
				break
			}
		}
	}

	console.log('  落到"选项 N"或空选项的卡：' + bare.length)
	bare.forEach(x => console.log('    - ' + x))
	missing.forEach(x => console.log('    ! ' + x))

	/* 白名单一致性：白名单里的必须仍然缺（提醒补完后删除），名单外不得新增 */
	const bareIds = new Set(bare.map(x => x.slice(0, 5)))
	const allow = Object.keys(PENDING_LABELS)
	const extra = [...bareIds].filter(id => allow.indexOf(id) < 0)
	const stale = allow.filter(id => !bareIds.has(id))
	ok('没有白名单之外的卡缺标签', extra.length === 0, extra.join(', '))
	ok('白名单无过期条目（补完后请从 PENDING_LABELS 删除）', stale.length === 0,
		stale.map(id => id + ' ' + PENDING_LABELS[id]).join(', '))
}

console.log('\n=== B. pending_echo 必须带 title ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
	const sites = []
	src.forEach((ln, i) => {
		if (!/game\.pending_echo\s*=\s*\{/.test(ln)) return
		const block = src.slice(i, i + 16).join('\n')
		sites.push({ line: i + 1, hasTitle: /title\s*:/.test(block) })
	})
	const bad = sites.filter(s => !s.hasTitle)
	console.log('  pending_echo 生成点 ' + sites.length + ' 处，缺 title ' + bad.length + ' 处')
	bad.forEach(s => console.log('    - line ' + s.line))
	ok('全部 pending_echo 都带 title', bad.length === 0,
		bad.map(s => 'line ' + s.line).join(', '))
}

console.log('\n=== C. 客户端源码约定 ===')
{
	const js = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')

	/* C1 inst_card_client 查服务端真实字段 */
	const fn = (js.match(/function inst_card_client[\s\S]{0,1400}?\n\}/) || [''])[0]
	ok('inst_card_client 查 view.hands', /view\.hands/.test(fn))
	ok('inst_card_client 查 view.table_cards', /view\.table_cards/.test(fn))
	ok('inst_card_client 兼容实例 id 与卡面 id', /card_id/.test(fn))

	/* C2 show_event_choice 字段兼容（截到下一个顶层 function 为止） */
	const sec = (js.match(/function show_event_choice[\s\S]*?\nfunction /) || [''])[0]
	ok('show_event_choice 兼容 index/id', /opt\.index\s*!=\s*null/.test(sec) && /opt\.id/.test(sec))
	ok('show_event_choice 兼容 disabled/enabled', /opt\.enabled\s*===\s*false/.test(sec))
	ok('show_event_choice 兼容 label/name', /opt\.label\s*\|\|\s*opt\.name/.test(sec))
}

console.log('\n' + (fail ? 'FAIL / ' + fail : 'ALL PASS'))
process.exit(fail ? 1 : 0)
