/*
 * 【2026-10-28】15207《JU-52 空投补给》—— 建海军「免 A」一致性验收
 *
 * 卡面：「回合开始时，若场上有德国空军，损耗1张牌：本回合内所有德国部队处于补给状态。」
 *
 * 背景：15346 自由法国 / 17838 苏联 这类 always_supplied 光环，建海军时**免 A**
 *       （supply_aura_covers），因为「全补给的国家不要求连补给点」。
 *       15207 是同一件事（整国部队一次性全补给），但走的是 modifiers 的
 *       all_german_supplied，此前**不在** supply_aura_covers 里 ->
 *       卡面写着「所有德国部队处于补给状态」，建海军却仍按「须连回补给源」拒。
 *
 * 修复前实测（德国陆军断补在〈非洲北部〉）：
 *   开 15207: in_supply=true、roots={} -> 北海/南大西洋/阿拉伯海/地中海 全部不可建
 *   换 15346 式: 四片海域全部可建
 *
 * 修复：supply_aura_covers 增加 15207 分支（只对德国 + 德国本国回合）。
 * 不变更：「空投补给不是补给源」（can_source=false、不写 roots，不能外传）。
 */
const path = require('path')
const fs = require('fs')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const d = I.data

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

const NB = d.id_of('非洲北部')       /* 远离德国补给源的陆地 */
const SEAS = ['北海', '南大西洋', '阿拉伯海', '地中海'].map(n => d.id_of(n)).filter(x => x != null)

/*
 * 造局：德国回合；把德国唯一的陆军挪到〈非洲北部〉（断补），
 * 于是相邻四片海域都「有德国陆军(B✅) 但它不连回源(A❌)」—— 正好卡在 A 上。
 */
function mk(germanHome) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = germanHome ? '德国' : '德国'
	g.active = 'axis'
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	g.modifiers = []
	g.table = {}
	g.hands['德国'] = []
	I.refresh(g)
	/* 德国唯一陆军 p1 挪到非洲北部 */
	const homePid = Object.keys(g.location).find(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'army')
	if (homePid) g.location[homePid] = NB
	I.refresh(g)
	return g
}
const add15207 = g => { g.modifiers.push({ key: 'all_german_supplied', nation: '德国', untilTurn: 3, source: '15207' }); I.refresh(g) }
const buildOk = (g, s) => I.can_build_at(g, '德国', s, 'navy')

/* ---------------- S0 造局自检 ---------------- */
section('S0 造局自检：德国陆军在〈非洲北部〉且断补')
let g0 = mk(true)
{
	const sup = I.compute_supply(g0)
	const pid = Object.keys(g0.location).find(p => g0.piece_nation[p] === '德国')
	ok('德国陆军已在〈非洲北部〉', g0.location[pid] === NB, g0.location[pid])
	ok('★ 该陆军断补（roots 为空）', !sup.in_supply[pid] && !(sup.roots[pid] && Object.keys(sup.roots[pid]).length),
		{ in_supply: !!sup.in_supply[pid], roots: sup.roots[pid] })
	ok('四片相邻海域齐全', SEAS.length === 4, SEAS.map(x => d.name_of(x)))
}

/* ---------------- S1 关 15207：A 不满足 -> 不可建 ---------------- */
section('S1 关 15207：四片海域都不可建（A 不满足）')
{
	for (const s of SEAS) {
		const r = buildOk(g0, s)
		ok('★ ' + d.name_of(s) + ' 不可建', !r.ok, r.reason)
		ok('  拒绝原因是「须有本国且连回补给源的部队」（不是缺陆军）',
			/连回补给源/.test(r.reason || ''), r.reason)
	}
}

/* ---------------- S2 开 15207：免 A -> 可建 ---------------- */
section('S2 开 15207：四片海域全部可建（免 A，与 15346 同待遇）')
let g2
{
	g2 = mk(true)
	add15207(g2)
	const sup = I.compute_supply(g2)
	const pid = Object.keys(g2.location).find(p => g2.piece_nation[p] === '德国')
	ok('该陆军 in_supply=true（卡面生效）', !!sup.in_supply[pid])
	ok('★ roots 仍为空（空投不是补给源）',
		!sup.roots[pid] || Object.keys(sup.roots[pid]).length === 0, sup.roots[pid])
	ok('★ can_source=false（不能把补给传给别的部队）',
		sup.can_source ? sup.can_source[pid] !== true : true, sup.can_source && sup.can_source[pid])
	ok('来源标记为 echo', sup.sources[pid] === 'echo', sup.sources[pid])
	for (const s of SEAS) {
		const r = buildOk(g2, s)
		ok('★ ' + d.name_of(s) + ' 可建', r.ok, r.reason)
	}
}

/* ---------------- S3 空投不外传：旁边的德国断补陆军依旧断补 ---------------- */
section('S3 空投补给不外传：15207 下新增的孤立德国陆军仍断补')
{
	const g = mk(true)
	add15207(g)
	/* 在〈非洲东部〉放一支孤立的德国陆军（与非洲北部相邻，但非洲北部本身断补） */
	g.location['de_far'] = d.id_of('非洲东部')
	g.piece_nation['de_far'] = '德国'; g.piece_type['de_far'] = 'army'
	I.refresh(g)
	const sup = I.compute_supply(g)
	ok('★ 孤立陆军的 roots 不含任何根（没被"喂"补给）',
		!sup.roots['de_far'] || !sup.roots['de_far']['德国'], sup.roots['de_far'])
	ok('它自己的 in_supply 来自 echo 而非 root',
		sup.sources['de_far'] === 'echo' || !sup.in_supply['de_far'], sup.sources['de_far'])
}

/* ---------------- S4 只对德国：意大利不享受 ---------------- */
section('S4 范围：15207 只免【德国】的 A，意大利不受影响')
{
	const g = mk(true)
	add15207(g)
	/*
	 * ⚠ 不用整条 can_build_at 对比（地中海初始就有意大利海军在补给中，
	 *   会因 A 本来就满足而误判），直接断言最底层的免 A 判定：同源、无干扰。
	 */
	for (const s of SEAS) {
		ok('★ 德国在' + d.name_of(s) + ' 免 A', I.supply_aura_covers(g, '德国', 'navy', s) === true)
		ok('★ 意大利在' + d.name_of(s) + ' 不免 A', I.supply_aura_covers(g, '意大利', 'navy', s) === false)
	}
}

/* ---------------- S5 只在德国本国回合生效 ---------------- */
section('S5 回合限制：非德国回合（current_nation=英国）不免 A')
{
	const g = mk(true)
	add15207(g)
	g.current_nation = '英国'
	I.refresh(g)
	for (const s of SEAS) {
		const r = buildOk(g, s)
		ok('★ ' + d.name_of(s) + ' 不可建（echo 已过期/非德国回合）', !r.ok, r.reason)
	}
}

/* ---------------- S6 不回归：always_supplied 光环仍免 A ---------------- */
section('S6 不回归：15346 式 always_supplied 光环仍免 A')
{
	const g = mk(true)
	g.status_aura = g.status_aura || {}
	g.status_aura.supply_immune = g.status_aura.supply_immune || {}
	g.status_aura.supply_immune['德国'] = true
	I.refresh(g)
	for (const s of SEAS) {
		const r = buildOk(g, s)
		ok('★ ' + d.name_of(s) + ' 仍可建', r.ok, r.reason)
	}
}

/* ---------------- S7 A 仍必须是本国（15207 不放宽 17549） ---------------- */
section('S7 15207 不改变「A 只认本国」：它免的是 A 的连源要求，不是国籍限制')
{
	const g = mk(true)
	add15207(g)
	/* 非洲北部改放【英国】陆军（17549 未开 -> 非组内），德国陆军撤走 */
	const pid = Object.keys(g.location).find(p => g.piece_nation[p] === '德国')
	delete g.location[pid]; delete g.piece_nation[pid]; delete g.piece_type[pid]
	g.location['uk1'] = NB; g.piece_nation['uk1'] = '英国'; g.piece_type['uk1'] = 'army'
	I.refresh(g)
	const r = buildOk(g, SEAS[0])
	ok('★ 相邻只有英国陆军时德国仍不可建（B 国籍也不符）', !r.ok, r.reason)
}

/* ---------------- S8 源码守卫 ---------------- */
section('S8 源码守卫')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	ok('supply_aura_covers 里有 15207 分支',
		/function supply_aura_covers[\s\S]{0,1400}echo_mod_active\(game, 'all_german_supplied'\)[\s\S]{0,120}return true/.test(src))
	ok('该分支限定只对德国', /nation === '德国' && echo_mod_active\(game, 'all_german_supplied'\)/.test(src))
	ok('supply_aura_covers 仍只有建海军一个调用点',
		(src.match(/supply_aura_covers\(/g) || []).length === 2, (src.match(/supply_aura_covers\(/g) || []).length)
	ok('compute_supply 里 15207 仍不给源（can_source=false 保留）',
		/all_german_supplied[\s\S]{0,900}can_source\[pid\] = false/.test(src))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
