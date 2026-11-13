/*
 * 【D1/P21】前奏军备卡触发代价 + 17555 手牌不足改损耗
 * 真实 R.setup / R.action / R.view / _internal 驱动。
 * 用法：node tools/_real_test_P21_trigger_cost.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function started(scenario) {
	const g = R.setup(20261112, scenario || 'Episode 2')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
/* 摆一张暗置前奏军备卡 + 响应栈帧（只用工具摆初始局面，之后全用 R.action） */
function seedArmament(g, face, nat, side) {
	const id = String(face) + '#arm1'
	g.table_responses = g.table_responses || []
	g.table_responses.push({
		card_id: id, card_face: String(face), name: (R._internal.inst_card &&
			R._internal.inst_card(face)) ? R._internal.inst_card(face).name : '军备卡',
		owner_side: side, prelude: true, nation: nat,
	})
	g.response_stack = [{
		card_id: id, card_face: String(face), name: '军备卡',
		owner_side: side, ctx: { nation: nat },
		group_id: 'g1', group_idx: 0, pending: false, skipped: false,
		ordered: true,
	}]
	return id
}

console.log('=== A. 17555：手牌不足由「跳过代价」改为损耗 1 ===')
{
	const g = started('Standard')
	const nat = '美国'
	/* 摆初始局面：让美国成为当前行动国（开局默认是德国） */
	g.current_nation = nat
	g.active = 'Allies'
	g.turn_phase = 'play'   /* 开局默认是 resource；17555 只在出牌阶段生效 */
	g.table[nat] = g.table[nat] || []
	g.table[nat].push('17555#x1')
	/* 手牌只剩要打的那张 EVENT 卡；牌库留牌供损耗 */
	const ev = (g.hands[nat] || []).find(id => {
		const c = I.inst_card(String(I.inst_card_id(id)))
		return c && c.type === 'EVENT'
	})
	if (ev) g.hands[nat] = [ev]
	if (!ev) { console.log('  (skip: 没有 EVENT 手牌)') }
	const deck0 = (g.decks[nat] || []).length
	const disc0 = (g.discard[nat] || []).length
	const l0 = g.log.length
	if (ev) R.action(g, 'Allies', 'play_card', { card: ev })
	ok('★★ 不再挂 us_depression_discard（不跳过代价）',
		!g.us_depression_discard || !g.us_depression_discard.pending,
		J(g.us_depression_discard))
	ok('★★ 正式牌堆顶损耗 1 张（attrition_cards，不洗回）',
		(g.decks[nat] || []).length === deck0 - 1 &&
		(g.discard[nat] || []).length >= disc0 + 1,
		J({ deck: (g.decks[nat] || []).length, disc: (g.discard[nat] || []).length }))
	ok('★★ 日志写明「无可弃手牌，改为损耗」',
		(g.log || []).slice(l0).some(x => /无可弃手牌，改为损耗/.test(x)),
		J((g.log || []).slice(l0)))
}
{
	/* 手牌充足时仍走原来的自选弃牌窗口（不回归） */
	const g = started('Standard')
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn_phase = 'play'   /* 开局默认是 resource；17555 只在出牌阶段生效 */
	g.table['美国'] = g.table['美国'] || []
	g.table['美国'].push('17555#x1')
	/* 12502《告法国人民书》是 type=EVENT 正式卡 */
	g.hands['美国'] = ['12502#h1', '12502#h2']
	const ev = g.hands['美国'][0]
	const l0 = g.log.length
	R.action(g, 'Allies', 'play_card', { card: ev })
	ok('★★ 手牌充足仍挂 us_depression_discard 自选弃牌窗口',
		!!(g.us_depression_discard && g.us_depression_discard.pending) &&
		!(g.log || []).slice(l0).some(x => /改为损耗/.test(x)),
		J({ st: g.us_depression_discard, log: (g.log || []).slice(l0) }))
}

console.log('\n=== B. 前奏军备卡触发：先弃 1 张正式手牌 ===')
{
	const g = started()
	const nat = g.current_nation
	seedArmament(g, 14919, nat, 'axis')
	const hand0 = (g.hands[nat] || []).length
	const disc0 = (g.discard[nat] || []).length
	R.action(g, 'Axis', 'trigger_response', {})
	ok('★★ 挂起 trigger_cost（need=1、候选=正式手牌带卡图）',
		!!(g.prelude.trigger_cost && g.prelude.trigger_cost.need === 1 &&
			g.prelude.trigger_cost.candidates.length === hand0 &&
			g.prelude.trigger_cost.candidates.every(c => c.img && c.type)),
		J(g.prelude.trigger_cost && { need: g.prelude.trigger_cost.need,
			n: g.prelude.trigger_cost.candidates.length }))
	ok('★★ 日志说明「须先弃置 1 张正式手牌」',
		(g.log || []).some(x => /须先弃置 1 张正式手牌/.test(x)),
		J((g.log || []).slice(-3)))
	const vOwn = R.view(g, 'Axis')
	const vFoe = R.view(g, 'Allies')
	ok('★★ 白名单只放行义务方 prelude_trigger_discard',
		vOwn.actions.prelude_trigger_discard === 1 &&
		!vOwn.actions.trigger_response && !vOwn.actions.pass_response &&
		!vFoe.actions.prelude_trigger_discard,
		J({ own: vOwn.actions, foe: vFoe.actions }))
	ok('★★ view.prelude.trigger_cost 仅义务方可见',
		!!vOwn.prelude.trigger_cost && vFoe.prelude.trigger_cost === null,
		J(vFoe.prelude && vFoe.prelude.trigger_cost))
	/* 非法提交被拒 */
	const bad = g.prelude.trigger_cost.candidates[0].id
	R.action(g, 'Axis', 'prelude_trigger_discard', { cards: [] })
	ok('★★ 空 cards 被拒、窗口保留',
		!!g.prelude.trigger_cost && (g.hands[nat] || []).length === hand0,
		J(!!g.prelude.trigger_cost))
	/* 合法提交 -> 弃牌 + 重放触发 */
	const l1 = g.log.length
	R.action(g, 'Axis', 'prelude_trigger_discard', { cards: [bad] })
	/* 弃牌堆还会多出被消耗的响应卡本身，故不断言精确张数，只验选中那张确实进了弃牌堆 */
	ok('★★ 弃 1 张进弃牌堆、手牌 -1',
		(g.hands[nat] || []).length === hand0 - 1 &&
		(g.discard[nat] || []).indexOf(bad) >= 0,
		J({ hand: (g.hands[nat] || []).length, disc: (g.discard[nat] || []).length }))
	ok('★★ trigger_cost 清空、军备卡效果自动结算（重放只一次）',
		!g.prelude.trigger_cost &&
		(g.log || []).slice(l1).filter(x => /触发：/.test(x)).length === 1,
		J((g.log || []).slice(l1)))
	ok('★★ 重放后响应帧已消耗（不二次挂起）',
		!(g.response_stack || []).some(f => f.card_face === '14919'),
		J(g.response_stack))
}

console.log('\n=== C. 无正式手牌 -> 自动损耗 1，不弹窗 ===')
{
	const g = started()
	const nat = g.current_nation
	seedArmament(g, 14919, nat, 'axis')
	g.hands[nat] = []
	const deck0 = (g.decks[nat] || []).length
	const disc0 = (g.discard[nat] || []).length
	const l0 = g.log.length
	R.action(g, 'Axis', 'trigger_response', {})
	ok('★★ 不挂 trigger_cost（无手牌可弃）', !g.prelude.trigger_cost,
		J(g.prelude.trigger_cost))
	ok('★★ 正式牌堆损耗 1 张',
		(g.decks[nat] || []).length === deck0 - 1 &&
		(g.discard[nat] || []).length >= disc0 + 1,
		J({ deck: (g.decks[nat] || []).length, disc: (g.discard[nat] || []).length }))
	ok('★★ 日志写明「无正式手牌，改为损耗」',
		(g.log || []).slice(l0).some(x => /无正式手牌，改为损耗/.test(x)),
		J((g.log || []).slice(l0)))
	ok('★★ 效果照常结算（代价不阻断触发）',
		(g.log || []).slice(l0).some(x => /触发：/.test(x)),
		J((g.log || []).slice(l0)))
}

console.log('\n=== D. 静态守卫（客户端第 6 用户 / 白名单 / 版本串）===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('★★ 17555 手牌不足走 attrition_cards，不再跳过代价',
		/if \(_pre\.ok && \(game\.hands\['美国'\] \|\| \[\]\)\.length > 1\)/.test(src) &&
		/const lost = attrition_cards\(game, '美国', 1\)/.test(src) &&
		/无可弃手牌，改为损耗/.test(src))
	ok('★★ 触发代价挂起在 trigger_response 首调 impl 之前',
		/【D1\/P21】前奏军备卡触发前先付代价/.test(src) &&
		/const _isPreludeArm = !RESPONSE_EFFECT_IMPL/.test(src) &&
		/game\.prelude\.trigger_cost = \{/.test(src))
	ok('★★ 重放用 internal_action + 一次性跳过标记',
		/game\.__skip_prelude_trigger_cost = true/.test(src) &&
		/return internal_action\(game, resume\.role \|\| current,/.test(src) &&
		/delete game\.__skip_prelude_trigger_cost/.test(src))
	ok('★★ 双门禁：build_actions 总闸 + view 仅义务方 + BUDGET_ALLOWED',
		/if \(game\.prelude && game\.prelude\.enabled && game\.prelude\.trigger_cost\)/.test(src) &&
		/ra\.prelude_trigger_discard = 1/.test(src) &&
		/faction_role_of_nation\(p\.trigger_cost\.nation\) === current/.test(src) &&
		/prelude_trigger_discard: 1/.test(src))
	ok('★★ 客户端 echo_discard_modal 第 6 用户：渲染/确认/不可取消',
		/prelude_trigger_cost_sel/.test(pjs) &&
		/function render_prelude_trigger_cost_box\(\)/.test(pjs) &&
		/send_action\("prelude_trigger_discard", \{ cards: s\.picked\.slice\(\) \}\)/.test(pjs) &&
		/军备卡触发代价不可取消/.test(pjs))
	ok('★ 版本串统一且为 20261112n',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v === '20261112n'),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
