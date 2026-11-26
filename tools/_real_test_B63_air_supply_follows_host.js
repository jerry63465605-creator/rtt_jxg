/*
 * 【B63】空军补给 = 与同格【本国载体】完全一致。
 *
 * 玩家口径（2026-11-27）：「要求本国，空军补给与所属的载体完全一致」。
 *
 * 旧实现：空军与陆军共用通用接根（只借「同格是否有源」，不借「同格部队是否已补给」；
 * 接根又只看【邻格】）。实测缺口：〈硫磺岛〉port_as 港口光环格上
 *   navy in_supply=true / source=base，同格 air=false。
 *
 * 新实现：空军无独立判定，完全跟随载体 ——
 *   · 同格本国陆军/海军任一补给中 -> 空军补给；
 *   · 载体都不补给 / 无载体 -> 空军不补给；
 *   · 载体【本国】限定（17549 组内盟国不算），与 air_host_check 同源；
 *   · 空军不作为中继（can_source=false），也不再走陆军邻格接根。
 *
 * 用法：node tools/_real_test_B63_air_supply_follows_host.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

function seed() {
	const g = R.setup(20261127, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	return g
}
const sup = g => I.compute_supply(g)

console.log('=== A. 港口光环格（port_as）：海军补给 -> 同格空军也补给（旧实现为 false）===')
{
	const g = seed()
	const iwo = D.id_of('硫磺岛')
	g.location.navy = iwo; g.piece_nation.navy = '苏联'; g.piece_type.navy = 'navy'
	g.location.air = iwo; g.piece_nation.air = '苏联'; g.piece_type.air = 'air'
	g.status_aura = { port_as: { [iwo]: '苏联', [String(iwo)]: '苏联' } }
	const s = sup(g)
	ok('★ 前提：海军靠港口光环补给', !!s.in_supply.navy, J(s.sources.navy))
	ok('★★ 同格空军也补给（跟随载体）', !!s.in_supply.air, J(s.sources.air))
	ok('★★ 空军不作为中继（can_source=false）', !s.can_source.air, J(s.can_source.air))
}

console.log('\n=== B. 有源格（大本营）：陆/空都补给，行为不变 ===')
{
	const g = seed()
	const mos = D.id_of('莫斯科')
	g.location.army = mos; g.piece_nation.army = '苏联'; g.piece_type.army = 'army'
	g.location.air = mos; g.piece_nation.air = '苏联'; g.piece_type.air = 'air'
	const s = sup(g)
	ok('★ 陆军补给', !!s.in_supply.army)
	ok('★★ 空军补给', !!s.in_supply.air)
	ok('★ 空军 source=base（承载）', s.sources.air === 'base' || s.sources.air === 'chain', J(s.sources.air))
}

console.log('\n=== C. 载体不补给 -> 空军也不补给（不能自己接根）===')
{
	const g = seed()
	const balt = D.id_of('波罗的海')
	/* 孤立海域只有海军、周边无任何本国根 -> 海军不补给 */
	g.location.navy = balt; g.piece_nation.navy = '苏联'; g.piece_type.navy = 'navy'
	g.location.air = balt; g.piece_nation.air = '苏联'; g.piece_type.air = 'air'
	const s = sup(g)
	ok('★ 前提：海军不补给', !s.in_supply.navy)
	ok('★★ 空军同样不补给（完全一致）', !s.in_supply.air, J(s.sources.air))
}

console.log('\n=== D. 无载体 -> 空军不补给（air_host_check 口径：空军不能独立存在）===')
{
	const g = seed()
	const balt = D.id_of('波罗的海')
	g.location.air = balt; g.piece_nation.air = '苏联'; g.piece_type.air = 'air'
	const s = sup(g)
	ok('★★ 无载体则不补给', !s.in_supply.air, J(s.sources.air))
}

console.log('\n=== E. 载体限定【本国】：17549 组内盟国部队不算载体 ===')
{
	const g = seed()
	const balt = D.id_of('波罗的海')
	/* 英国海军在波罗的海（若靠光环补给），苏联空军同格 -> 不应被算作载体 */
	g.location.ukNavy = balt; g.piece_nation.ukNavy = '英国'; g.piece_type.ukNavy = 'navy'
	g.location.suAir = balt; g.piece_nation.suAir = '苏联'; g.piece_type.suAir = 'air'
	g.status_aura = { port_as: { [balt]: '英国', [String(balt)]: '英国' } }
	const s = sup(g)
	ok('★ 前提：英国海军补给中', !!s.in_supply.ukNavy, J(s.sources.ukNavy))
	ok('★★ 苏联空军不因盟友载体而补给（要求本国）', !s.in_supply.suAir, J(s.sources.suAir))
}

console.log('\n=== F. 静态守卫 ===')
{
	ok('★★ compute_supply 有 air 分支且 continue（不走陆军接根）', (() => {
		const ci = SRC.indexOf('function compute_supply')
		const ai = SRC.indexOf("if (type === 'air') {")
		if (ci < 0 || ai < 0 || ai < ci) return false
		const around = SRC.slice(ai, ai + 900)
		return /【B63】/.test(SRC.slice(Math.max(0, ai - 1400), ai + 200)) && /continue/.test(around)
	})())
	ok('★★ air 分支要求本国（piece_nation\[p2\] === nat）', (() => {
		const i = SRC.indexOf("if (type === 'air') {")
		const seg = SRC.slice(i, i + 900)
		return /game\.piece_nation\[p2\] === nat/.test(seg)
	})())
	ok('★★ air 分支不设 can_source（不作为中继）', (() => {
		const i = SRC.indexOf("if (type === 'air') {")
		const seg = SRC.slice(i, i + 900)
		return !/can_source\[pid\] = true/.test(seg)
	})())
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
