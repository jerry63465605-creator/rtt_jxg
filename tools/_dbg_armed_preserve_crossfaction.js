/*
 * 复现并验证 2026-10-13 修复：
 * 15237(德国) 开出 15208 窗口后，15210 战斗里英国(同盟)做了一个"其它动作"
 * （原 bug：全局清空 armed 窗口，导致德国 15208 选择框消失、15237 走不完、国家技能不触发）。
 * 修复后：按阵营分域清除，英国动作只清同盟窗口，德国的 15208 窗口与 pending_event_armed 保留，
 * 德国回来能继续打 15208 并最终触发国家技能。
 *
 * 用法: node tools/_dbg_armed_preserve_crossfaction.js
 */
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { data, SPACE } = require(path.join(DIR, 'data.js'))
const I = rules._internal
I.set_skip_turn_guard(true)

let pass = 0, fail = 0
const ok = (c, m) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m)) }

const BOSPH = SPACE['黑海']
const AZ = SPACE['亚速尔']

function mkGame() {
	const g = rules.setup(1, 'Standard', {})
	g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.play_done = {}; g.discard = { '德国': [], '英国': [] }
	return g
}

function placeSupplyArmyAdjBosph(g) {
	for (const sid of Object.keys(data.spaces)) {
		const sp = data.spaces[sid]
		if (sp.terrain !== 'land') continue
		if (!(sp.connections || []).includes(BOSPH)) continue
		g.location['g_army'] = sid
		g.piece_nation['g_army'] = '德国'; g.piece_type['g_army'] = 'army'
		I.grant_supply(g, 'g_army', g.turn || 1); I.refresh(g)
		if (I.can_build_at(g, '德国', BOSPH, 'navy').ok) return true
		delete g.location['g_army']; delete g.piece_nation['g_army']; delete g.piece_type['g_army']
	}
	return false
}

function placeNavalDuel(g) {
	const azConn = (data.spaces[AZ].connections || []).map(Number)
	const seaNeigh = azConn.filter(s => data.spaces[s] && data.spaces[s].terrain === 'sea')
	const S = seaNeigh[0]
	if (S == null) return null
	let landAdj = null
	for (const n of (data.spaces[S].connections || []).map(Number)) {
		if (data.spaces[n] && data.spaces[n].terrain === 'land') { landAdj = n; break }
	}
	if (landAdj == null) return null
	g.location['de_army2'] = landAdj
	g.piece_nation['de_army2'] = '德国'; g.piece_type['de_army2'] = 'army'
	I.grant_supply(g, 'de_army2', g.turn || 1)
	g.location['al_navy'] = S; g.piece_nation['al_navy'] = '英国'; g.piece_type['al_navy'] = 'navy'
	I.refresh(g)
	return S
}

function armedCards(g) {
	return (g.armed_offers || []).flatMap(w => (w.cards || []).map(c => c.card_id))
}

function setup15237(g) {
	/* 含 15338(状态卡) 以满足德国国家技能"额外打 1 张状态卡"的授予条件，
	 * 否则 national_skill_usable 会正确返回 false 而仅清窗口（那是规则，不是 bug）。 */
	g.hands['德国'] = ['15237', '15208', '15210', '15338']
	rules.action(g, 'Axis', 'play_card', { card: '15237' })
	rules.action(g, 'Axis', 'use_armed_offer', { window: 0, card: '15210' })
}

console.log('=== 场景 A（忠实）：德国 15237→15210 后，英国在战斗中"响应"(pass_response 子动作) ===')
{
	const g = mkGame()
	ok(placeSupplyArmyAdjBosph(g), '布置黑海邻接补给德军')
	const S = placeNavalDuel(g)
	ok(S != null, '亚速尔相邻海域布置德/英海军 (space=' + S + ')')
	setup15237(g)
	ok(armedCards(g).includes('15208'), '打完 15210 后 15208 仍在窗口内')
	ok(!!g.pending_event_armed && g.pending_event_armed.nation === '德国', 'pending_event_armed 挂起（德国 15237）')

	// 英国在 15210 战斗中"响应"——子动作，不推进回合、不切换德国出牌阶段
	g.current_nation = '英国'; g.active = 'Allies'
	const rb = rules.action(g, 'Allies', 'pass_response', {})
	console.log('  英国 pass_response(空队列) ->', JSON.stringify(rb && rb.desc))

	ok(armedCards(g).includes('15208'), '【修复】英国子动作后，德国 15208 窗口仍保留')
	ok(!!g.pending_event_armed && g.pending_event_armed.nation === '德国', '【修复】英国子动作后，德国 pending_event_armed 仍挂起')

	// 控制权回到德国，继续打 15208 -> 续跑 15237 后续并触发国家技能
	g.current_nation = '德国'; g.active = 'Axis'
	const r3 = rules.action(g, 'Axis', 'use_armed_offer', { window: 0, card: '15208' })
	console.log('  德国 use_armed_offer 15208 ->', JSON.stringify(r3 && r3.desc))
	ok((g.armed_offers || []).length === 0, '15208 打完，增强窗口清空')
	ok(!g.pending_event_armed, 'pending_event_armed 已续跑清空（15237 走完）')
	ok(!!g.national_skill_offer, '【修复】国家技能已触发（15237 全部完成）')
}

console.log('\n=== 场景 B（健壮性）：英国推进自己回合(discard_one) 也不得误清德国窗口 ===')
{
	const g = mkGame()
	ok(placeSupplyArmyAdjBosph(g), '布置黑海邻接补给德军')
	placeNavalDuel(g)
	setup15237(g)
	ok(armedCards(g).includes('15208'), '打完 15210 后 15208 仍在窗口内')

	// 英国推进自己回合（会切换 active / 可能推进阶段）
	g.current_nation = '英国'; g.active = 'Allies'
	g.hands['英国'] = ['15338']
	const rb = rules.action(g, 'Allies', 'discard_one', { card: '15338' })
	console.log('  英国 discard_one ->', JSON.stringify(rb && rb.desc))
	ok(armedCards(g).includes('15208'), '【修复】英国推进自己回合后，德国 15208 窗口仍保留')
	ok(!!g.pending_event_armed && g.pending_event_armed.nation === '德国', '【修复】英国推进自己回合后，德国 pending_event_armed 仍挂起')

	// 模拟控制权回到德国：恢复德国出牌阶段后继续打 15208
	g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'
	g.play_done = g.play_done || {}; g.play_done['德国'] = false
	const r3 = rules.action(g, 'Axis', 'use_armed_offer', { window: 0, card: '15208' })
	console.log('  德国 use_armed_offer 15208 ->', JSON.stringify(r3 && r3.desc))
	ok((g.armed_offers || []).length === 0, '15208 打完，增强窗口清空')
	ok(!g.pending_event_armed, 'pending_event_armed 已续跑清空（15237 走完）')
	ok(!!g.national_skill_offer, '【修复】国家技能已触发（15237 全部完成）')
}

console.log('\n=== 对照（回归）：德国自己"做别的事"应正常放弃本国窗口 ===')
{
	const g = mkGame()
	ok(placeSupplyArmyAdjBosph(g), '布置黑海邻接补给德军')
	placeNavalDuel(g)
	setup15237(g)
	ok(armedCards(g).includes('15208'), '打完 15210 后 15208 仍在')

	// 德国自己去做别的事（打另一张牌），应清掉本国 15208 窗口并作废 15237
	rules.action(g, 'Axis', 'discard_one', { card: '15338' })
	ok(!armedCards(g).includes('15208'), '德国自己"做别的事"后，本国 15208 窗口被清（符合"错过即放弃"）')
	ok(!g.pending_event_armed, '德国自己放弃后，pending_event_armed 已作废')
}

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
