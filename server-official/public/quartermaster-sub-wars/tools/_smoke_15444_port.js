/*
 * 回归：15444《丘克群岛》—— 「<硫磺岛>视为日本港口」（2026-10-23）
 *
 * 卡面：<硫磺岛>视为日本港口。计分阶段：若<硫磺岛>相邻地区都有日本海军，获得1分。
 *
 * 历史问题（两轮）：
 *   ① 原实现 kind:'virtual_army'（临时注入"虚拟陆军"）：
 *      建海军时【不生效】（注入只存在于 compute_supply 内，返回即清理，
 *      而建海军在其后才调 navy_ab_check）；且污染补给链（sources 里冒出 __varmy_*）。
 *   ② 改成 port_as 只给 B（港口）后仍然不可建 —— 硫磺岛是荒岛
 *      （非初始补给点、无法连回本土），A（来源）永远不成立。
 *
 * 现语义：港口是【补给设施】，同时满足
 *   · B（港口）＝等同"相邻有本国陆军"
 *   · A（来源）＝港口本身即补给来源
 * 但仍不让该格算"有陆军"（不参与陆军补给续链、不满足"某地有陆军"类条件）。
 * 敌占时失效。
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
const US = data.id_of('美国')

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

function buildAll(g) {
	return SEAS.map(sp => ({ sp, r: I.can_build_at(g, '日本', sp, 'navy') }))
}
const fmt = rs => rs.map(x => data.name_of(x.sp) + '=' + x.r.ok).join(' , ')

console.log('=== A. 光环写入 port_as（不再有 virtual_army） ===')
{
	const g = mk(true)
	const aura = g.status_aura || {}
	ok('port_as[硫磺岛] = 日本', aura.port_as && String(aura.port_as[IWO]) === '日本',
		JSON.stringify(aura.port_as))
	ok('virtual_army 字段已不存在', aura.virtual_army === undefined)
	ok('无卡时 port_as 为空', !(mk(false).status_aura.port_as || {})[IWO])
}

console.log('\n=== B. 硫磺岛【空无一物、无补给点】时也能在相邻海域建海军 ===')
{
	/* 关键场景：荒岛 + 无驻军 + 非补给点 —— 只靠"视为港口" */
	const gYes = mk(true)
	const rsYes = buildAll(gYes)
	ok('有卡：3 个相邻海域都可建海军', rsYes.every(x => x.r.ok), fmt(rsYes))

	const gNo = mk(false)
	const rsNo = buildAll(gNo)
	ok('无卡（对照组）：全部不可建', rsNo.every(x => !x.r.ok), fmt(rsNo))
}

console.log('\n=== C. 硫磺岛有日本海军时同样可建（回归） ===')
{
	const g = mk(true)
	g.location['jp_n1'] = IWO; g.piece_nation['jp_n1'] = '日本'; g.piece_type['jp_n1'] = 'navy'
	I.add_supply_point(g, IWO, '日本')
	const rs = buildAll(g)
	ok('有海军+补给点：仍可建', rs.every(x => x.r.ok), fmt(rs))
}

console.log('\n=== D. 海军补给：港口即补给来源，相邻海域海军在补给 ===')
{
	const g = mk(true)
	const sea = SEAS[0]
	g.location['jp_n2'] = sea; g.piece_nation['jp_n2'] = '日本'; g.piece_type['jp_n2'] = 'navy'
	const sup = I.compute_supply(g)
	ok('相邻海域日本海军在补给（无补给点也能）', !!sup.in_supply['jp_n2'],
		sup.sources && sup.sources['jp_n2'])
	ok('sources 里没有 __varmy_* 脏键',
		Object.keys(sup.sources).every(k => k.indexOf('__varmy') < 0), Object.keys(sup.sources).join(','))
	ok('location 里没有残留虚拟部队',
		Object.keys(g.location).every(k => k.indexOf('__varmy') < 0))
	ok('硫磺岛本身不算"有日本陆军"',
		I.count_pieces(g, { space: IWO, nation: '日本', types: ['army'] }) === 0,
		I.count_pieces(g, { space: IWO, nation: '日本', types: ['army'] }))
}

console.log('\n=== E. 敌占失效（保持原行为） ===')
{
	const g = mk(true)
	g.location['us1'] = IWO; g.piece_nation['us1'] = '美国'; g.piece_type['us1'] = 'army'
	const rs = buildAll(g)
	ok('硫磺岛被美军占领 -> 相邻海域都不可建', rs.every(x => !x.r.ok), fmt(rs))

	const sea = SEAS[0]
	g.location['jp_x'] = sea; g.piece_nation['jp_x'] = '日本'; g.piece_type['jp_x'] = 'navy'
	const sup = I.compute_supply(g)
	ok('且该海域日本海军不在补给', !sup.in_supply['jp_x'], sup.sources && sup.sources['jp_x'])
}

console.log('\n=== F. 港口只对卡归属国生效（不对同盟国放开） ===')
{
	const g = mk(true)
	/* 英国海军进中太平洋：硫磺岛不是英国港口 -> 不应因此获得补给 */
	const sea = SEAS[0]
	g.location['uk_n1'] = sea; g.piece_nation['uk_n1'] = '英国'; g.piece_type['uk_n1'] = 'navy'
	const sup = I.compute_supply(g)
	ok('英国海军不受日本港口照顾', !sup.in_supply['uk_n1'], sup.sources && sup.sources['uk_n1'])
	const r = I.can_build_at(g, '英国', sea, 'navy')
	ok('英国也不能靠它建海军', !r.ok, r.reason || '')
}

console.log('\n=== G. 计分逻辑不受影响 ===')
{
	const g = mk(true)
	SEAS.forEach((sp, i) => {
		const pid = 'jp_s' + i
		g.location[pid] = sp; g.piece_nation[pid] = '日本'; g.piece_type[pid] = 'navy'
	})
	ok('3 个海域都有日本海军', SEAS.every(sp => I.has_pieces(g, { space: sp, nation: '日本', types: ['navy'] })))
	const g2 = mk(true)
	SEAS.slice(0, -1).forEach((sp, i) => {
		const pid = 'y' + i
		g2.location[pid] = sp; g2.piece_nation[pid] = '日本'; g2.piece_type[pid] = 'navy'
	})
	ok('缺一个则不满条件', !SEAS.every(sp => I.has_pieces(g2, { space: sp, nation: '日本', types: ['navy'] })))
}

console.log('\n=== H. 老存档惰性迁移：virtual_army -> port_as ===')
{
	/* H1：显式调用 */
	const g1 = mk(false)
	g1.status_aura = { supply_immune: {}, home_override: {}, virtual_army: {} }
	g1.status_aura.virtual_army[IWO] = '日本'
	I.ensure_status_aura(g1)
	ok('ensure_status_aura 迁移后 port_as 有值', String((g1.status_aura.port_as || {})[IWO]) === '日本',
		JSON.stringify(g1.status_aura.port_as))
	ok('旧字段已删除', g1.status_aura.virtual_army === undefined)

	/* H2：真实老对局场景 —— 15444 早已在桌面、之后不会再"打出"，
	 * 只靠 view/action/query 入口的惰性迁移。这里只调 view。 */
	const g2 = mk(false)
	g2.table['日本'] = ['15444#1']          /* 卡在桌面 */
	g2.status_aura = { supply_immune: {}, home_override: {}, virtual_army: {} }
	g2.status_aura.virtual_army[IWO] = '日本'
	const before = I.can_build_at(g2, '日本', SEAS[0], 'navy')
	ok('迁移前（只读旧字段）不可建', !before.ok, before.reason || '')
	rules.view(g2, 'Axis')                  /* 触发入口迁移 */
	ok('仅调 view 就会迁移 port_as', String((g2.status_aura.port_as || {})[IWO]) === '日本',
		JSON.stringify(g2.status_aura.port_as))
	const after = I.can_build_at(g2, '日本', SEAS[0], 'navy')
	ok('迁移后建海军生效', after.ok, after.reason || '')
}

console.log('\n=== I. 撤销光环后立即失效 ===')
{
	const g = mk(true)
	ok('撤销前可建', buildAll(g).every(x => x.r.ok))
	I.revert_status_ongoing(g, '15444#1', '日本')
	const rs = buildAll(g)
	ok('撤销后全部不可建', rs.every(x => !x.r.ok), fmt(rs))
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
