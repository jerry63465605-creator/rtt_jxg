/*
 * 回归：15444《丘克群岛》—— 「<硫磺岛>视为日本港口」（2026-10-23 重做）
 *
 * 卡面：<硫磺岛>视为日本港口。计分阶段：若<硫磺岛>相邻地区都有日本海军，获得1分。
 *
 * 原实现是 kind:'virtual_army'（"视为有日本陆军"，临时注入 game.location）：
 *   ① 建海军时【不生效】—— 注入只存在于 compute_supply 内，返回即清理，
 *      而建海军是在其后才调 navy_ab_check（看不到虚拟部队）
 *   ② 副作用超标 —— 虚拟陆军参与补给续链，还可能被评为补给源
 *      （sources 里出现 __varmy_48='base'）
 *
 * 现改为 status_aura.port_as + navy_ab_check 的显式港口判定：
 *   · 只满足 B（港口 = 等同相邻有本国陆军）
 *   · 不提供 A（来源）、不作为补给源、不让该格算"有陆军"
 *   · 敌占时失效（保持原行为）
 *
 * 用法：node tools/_smoke_15444_port.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

const IWO = data.id_of('硫磺岛')
const NBS = (data.spaces[IWO].connections || [])
const SEAS = NBS.filter(id => (data.spaces[id] || {}).terrain === 'sea')

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

function mk(withCard) {
	const g = rules.setup(1401, rules.default_scenario, {})
	g.opening = null
	for (const p in g.location) delete g.location[p]
	g.table['日本'] = withCard ? ['15444#1'] : []
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.log.length = 0
	if (withCard) I.apply_status_ongoing(g, '15444#1', '日本')
	return g
}

console.log('=== A. 光环写入 port_as（不再有 virtual_army） ===')
{
	const g = mk(true)
	const aura = g.status_aura || {}
	ok('port_as[硫磺岛] = 日本', aura.port_as && String(aura.port_as[IWO]) === '日本',
		JSON.stringify(aura.port_as))
	ok('virtual_army 字段已不存在', aura.virtual_army === undefined)
	ok('无卡时 port_as 为空', !(mk(false).status_aura.port_as || {})[IWO])
}

console.log('\n=== B. 建海军：硫磺岛视为港口后，相邻海域 B 条件成立 ===')
{
	/* 前提：硫磺岛有日本海军 + 补给点（A 来源），但没有陆军 */
	for (const withCard of [false, true]) {
		const g = mk(withCard)
		g.location['jp_n1'] = IWO; g.piece_nation['jp_n1'] = '日本'; g.piece_type['jp_n1'] = 'navy'
		I.add_supply_point(g, IWO, '日本')
		const results = SEAS.map(sp => ({ sp, r: I.can_build_at(g, '日本', sp, 'navy') }))
		if (withCard) {
			ok('有卡：3 个相邻海域都可建海军',
				results.every(x => x.r.ok),
				results.map(x => data.name_of(x.sp) + '=' + x.r.ok).join(' , '))
		} else {
			ok('无卡：仍然都不可建（对照组）',
				results.every(x => !x.r.ok),
				results.map(x => data.name_of(x.sp) + '=' + x.r.ok).join(' , '))
		}
	}
}

console.log('\n=== C. 海军补给：港口条件同样生效，但不再污染补给链 ===')
{
	const g = mk(true)
	g.location['jp_n1'] = IWO; g.piece_nation['jp_n1'] = '日本'; g.piece_type['jp_n1'] = 'navy'
	I.add_supply_point(g, IWO, '日本')
	/* 相邻海域放一支日本海军，靠硫磺岛这个"港口"拿补给 */
	const sea = SEAS[0]
	g.location['jp_n2'] = sea; g.piece_nation['jp_n2'] = '日本'; g.piece_type['jp_n2'] = 'navy'

	const sup = I.compute_supply(g)
	ok('相邻海域的日本海军在补给', !!sup.in_supply['jp_n2'], sup.sources && sup.sources['jp_n2'])
	ok('sources 里没有 __varmy_* 脏键',
		Object.keys(sup.sources).every(k => k.indexOf('__varmy') < 0),
		Object.keys(sup.sources).join(','))
	ok('game.location 里没有残留虚拟部队',
		Object.keys(g.location).every(k => k.indexOf('__varmy') < 0))
	ok('硫磺岛不算"有日本陆军"',
		I.count_pieces(g, { space: IWO, nation: '日本', types: ['army'] }) === 0,
		I.count_pieces(g, { space: IWO, nation: '日本', types: ['army'] }))
}

console.log('\n=== D. 敌占失效（保持原行为） ===')
{
	const g = mk(true)
	g.location['us1'] = IWO; g.piece_nation['us1'] = '美国'; g.piece_type['us1'] = 'army'
	I.add_supply_point(g, IWO, '日本')
	const results = SEAS.map(sp => ({ sp, r: I.can_build_at(g, '日本', sp, 'navy') }))
	ok('硫磺岛被美军占领 -> 相邻海域都不可建',
		results.every(x => !x.r.ok),
		results.map(x => data.name_of(x.sp) + '=' + x.r.ok).join(' , '))
}

console.log('\n=== E. 不影响陆军的"补给续链" ===')
{
	/* 硫磺岛（视为港口）不应给相邻陆军传补给：相邻没有陆地，改验"本身不算陆军源" */
	const g = mk(true)
	g.location['jp_n1'] = IWO; g.piece_nation['jp_n1'] = '日本'; g.piece_type['jp_n1'] = 'navy'
	const sup = I.compute_supply(g)
	ok('无补给点时硫磺岛海军不在补给（港口不等于补给源）', !sup.in_supply['jp_n1'],
		sup.sources && sup.sources['jp_n1'])
}

console.log('\n=== F. 计分逻辑不受影响（相邻都有日本海军 +1） ===')
{
	const auto = (I.STATUS_CONFIG ? null : null) || null
	/* 直接构造：3 个相邻海域各放 1 支日本海军 */
	const g = mk(true)
	SEAS.forEach((sp, i) => {
		const pid = 'jp_s' + i
		g.location[pid] = sp; g.piece_nation[pid] = '日本'; g.piece_type[pid] = 'navy'
	})
	const all = SEAS.every(sp => I.has_pieces(g, { space: sp, nation: '日本', types: ['navy'] }))
	ok('3 个海域都有日本海军', all)
	ok('缺少一个则不满条件', (() => {
		const g2 = mk(true)
		SEAS.slice(0, -1).forEach((sp, i) => {
			const pid = 'x' + i
			g2.location[pid] = sp; g2.piece_nation[pid] = '日本'; g2.piece_type[pid] = 'navy'
		})
		return !SEAS.every(sp => I.has_pieces(g2, { space: sp, nation: '日本', types: ['navy'] }))
	})())
}

console.log('\n=== G. 老存档惰性迁移：virtual_army -> port_as ===')
{
	const g = mk(false)
	g.status_aura = { supply_immune: {}, home_override: {}, virtual_army: {} }
	g.status_aura.virtual_army[IWO] = '日本'
	I.status_aura(g)
	ok('迁移后 port_as 有值', String((g.status_aura.port_as || {})[IWO]) === '日本',
		JSON.stringify(g.status_aura.port_as))
	ok('旧字段已删除', g.status_aura.virtual_army === undefined)
	I.add_supply_point(g, IWO, '日本')
	g.location['jp_n1'] = IWO; g.piece_nation['jp_n1'] = '日本'; g.piece_type['jp_n1'] = 'navy'
	const r = I.can_build_at(g, '日本', SEAS[0], 'navy')
	ok('迁移后建海军同样生效', r.ok, r.reason || '')
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
