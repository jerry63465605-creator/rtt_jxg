/*
 * 回归测试：17529《摩尔曼斯克运输船队》
 *   卡面：苏联在<罗斯>征召1支陆军。苏联建设1支陆军。
 *
 * 修复点（方案 B，玩家 2026-10-22 确认）：征召步未完成前【不】建立建设预算，
 * 否则 pending_autobahn 排他分支会挡掉 resolve_su_build_delegate（"不能征召"）。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_17529.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

function base() {
	let g = rules.setup(1)
	g.opening = null
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.hands['美国'] = g.hands['美国'] || []
	g.hands['美国'].push('17529#1')
	return g
}
function suArmiesAt(g, sp) {
	let n = 0
	for (const p of Object.keys(g.piece_nation || {}))
		if (g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army' && g.location[p] === sp) n++
	return n
}

const ROSS = data.id_of('罗斯')

console.log('=== A. 打出 17529：只出征召，不提前开建设预算 ===')
{
	let g = base()
	g = rules.action(g, 'Allies', 'play_card', { card: '17529#1' })
	ok('委托已建立', !!g.su_build_delegate)
	ok('征召步未完成（done=0）', !!(g.su_build_delegate && g.su_build_delegate.done === 0))
	ok('建设预算【未】开启', !g.pending_autobahn, JSON.stringify(g.pending_autobahn))
	const v = rules.view(g, 'Allies')
	ok('放行 resolve_su_build_delegate', !!(v.actions && v.actions.resolve_su_build_delegate),
		'actions keys=' + Object.keys(v.actions || {}).join(','))
	ok('未放行 resolve_autobahn（此刻无预算）', !(v.actions && v.actions.resolve_autobahn))
	ok('征召候选含<罗斯>', !!(v.su_build_delegate &&
		(v.su_build_delegate.candidates || []).some(c => c.id === ROSS)),
		JSON.stringify(v.su_build_delegate && v.su_build_delegate.candidates))
}

console.log('\n=== B. 点征召：罗斯苏陆军+1，随后建设预算开启 ===')
{
	let g = base()
	g = rules.action(g, 'Allies', 'play_card', { card: '17529#1' })
	const before = suArmiesAt(g, ROSS)
	g = rules.action(g, 'Allies', 'resolve_su_build_delegate', { space: ROSS })
	ok('罗斯苏陆军 +1', suArmiesAt(g, ROSS) === before + 1,
		'before=' + before + ' after=' + suArmiesAt(g, ROSS))
	ok('征召步已完成（done=1）', !!(g.su_build_delegate && g.su_build_delegate.done === 1))
	ok('建设预算已开启（source=su_build_delegate）',
		!!g.pending_autobahn && g.pending_autobahn.source === 'su_build_delegate',
		JSON.stringify(g.pending_autobahn))
	const v = rules.view(g, 'Allies')
	ok('放行 resolve_autobahn（建设可进行）', !!(v.actions && v.actions.resolve_autobahn))
	ok('不再放行 resolve_su_build_delegate', !(v.actions && v.actions.resolve_su_build_delegate))
}

console.log('\n=== C. 建设 / 结束预算 收尾 ===')
{
	let g = base()
	g = rules.action(g, 'Allies', 'play_card', { card: '17529#1' })
	g = rules.action(g, 'Allies', 'resolve_su_build_delegate', { space: ROSS })
	const pa = g.pending_autobahn

	let spot = null
	if (pa && pa.remaining > 0) {
		for (let sp = 1; sp < data.spaces.length; sp++) {
			if (!data.spaces[sp]) continue
			if (I.can_build_at(g, '苏联', sp, 'army').ok &&
				I.unit_slot_free(g, '苏联', 'army', sp).ok) { spot = sp; break }
		}
	}
	if (spot != null) {
		const before = suArmiesAt(g, spot)
		g = rules.action(g, 'Allies', 'resolve_autobahn', { space: spot })
		ok('建设后该地苏陆军 +1', suArmiesAt(g, spot) === before + 1,
			'spot=' + spot + ' ' + data.name_of(spot))
		ok('建设预算 remaining 归 0',
			!!(g.pending_autobahn && g.pending_autobahn.remaining === 0),
			JSON.stringify(g.pending_autobahn && g.pending_autobahn.remaining))
	} else {
		ok('（当前盘面无可建设地或无预算，跳过实际建设）', true,
			'remaining=' + (pa && pa.remaining))
	}

	g = rules.action(g, 'Allies', 'finish_su_build_budget', {})
	ok('结束预算后 pending_autobahn 清空', !g.pending_autobahn)
	ok('委托 su_build_delegate 清空', !g.su_build_delegate)
	ok('操作权归还美国', g.current_nation === '美国', 'current=' + g.current_nation)
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
