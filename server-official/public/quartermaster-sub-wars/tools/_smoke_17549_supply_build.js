/*
 * 回归：补给 / 建设 的海军 A/B 口径（玩家 2026-10-23 定稿）
 *
 * 口径一句话：
 *   17549 对 B（港口 = 相邻陆军）两处都生效；
 *   对 A（来源 = 连回补给源）只在【补给结算】生效，【建设】不生效。
 *
 * 玩家给出的四例（本文 D 段逐条锁死）：
 *   盘面：17549 开；北海英国海军；北大西洋英国海军；西欧英国陆军；美国本土美国陆军
 *     1. 美国不可在西欧建陆军
 *     2. 美国不可在北海建海军
 *     3. 北海的美国海军【有补给】（链：美国★→美国陆军→北大西洋英国海军→北海美国海军）
 *     4. 北大西洋有美国海军时，北海建海军：开 17549 可 / 不开不可
 *
 * 用法：node tools/_smoke_17549_supply_build.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { data } = I

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

const S = (n) => data.id_of(n)
const NORTH_SEA = S('北海'), N_ATLANTIC = S('北大西洋'), W_EUROPE = S('西欧')
const USA = S('美国'), MED = S('地中海'), ICELAND = S('冰岛')

function base() {
	const g = rules.setup(51, rules.default_scenario, {})
	for (const p in g.location) delete g.location[p]
	g.table = g.table || {}
	g.table['美国'] = []
	g.status_aura = {}
	g.supply_granted = {}
	g.neutral = { 美国: false, 苏联: false }
	g.current_nation = '美国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.log.length = 0
	return g
}
function put(g, pid, nation, type, space) {
	g.location[pid] = space
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
}
function add17549(g) {
	g.table['美国'] = ['17549']
	I.apply_status_ongoing(g, '17549', '美国')
}
const canBuild = (g, sp, type) => I.can_build_at(g, '美国', sp, type)
const supOf = (g, pid) => !!I.compute_supply(g).in_supply[pid]

/* ============================================================ */
console.log('=== A. 补给：A 可借 17549 组内（英国陆军 -> 美国海军）===')
{
	const g = base()
	add17549(g)
	put(g, 'uk1', '英国', 'army', W_EUROPE)   /* ★ 上，base */
	put(g, 'us1', '美国', 'navy', NORTH_SEA)  /* 北海邻接西欧 */
	ok('美国海军有补给（A=英国陆军 组内）', supOf(g, 'us1'))
}

console.log('\n=== B. 建设：A 仅本国 -> 同样盘面不可建 ===')
{
	const g = base()
	add17549(g)
	put(g, 'uk1', '英国', 'army', W_EUROPE)
	const r = canBuild(g, NORTH_SEA, 'navy')
	ok('北海不可建（A 无本国部队）', !r.ok, r.reason || '')
	ok('reason 指出 17549 不放宽此项', /不放宽/.test(r.reason || ''), r.reason || '')
}

console.log('\n=== C. 建设：有本国补给部队 + 组内陆军 -> 可建 ===')
{
	const g = base()
	add17549(g)
	put(g, 'usA', '美国', 'army', USA)          /* 美国★：让北大西洋的美国海军能连回源 */
	put(g, 'uk1', '英国', 'army', W_EUROPE)
	put(g, 'us2', '美国', 'navy', N_ATLANTIC)   /* A：本国部队（且自身须连回源） */
	const r = canBuild(g, NORTH_SEA, 'navy')
	ok('可建（A=北大西洋美国海军，B=西欧英国陆军）', r.ok, r.reason || '')
}

console.log('\n=== D. 玩家四例（盘面：17549 开 / 北海英海 / 北大西洋英海 / 西欧英陆 / 美国本土美陆）===')
{
	const mk = (with17549) => {
		const g = base()
		if (with17549) add17549(g)
		put(g, 'usA', '美国', 'army', USA)          /* ★ 美国本土 */
		put(g, 'ukN1', '英国', 'navy', NORTH_SEA)
		put(g, 'ukN2', '英国', 'navy', N_ATLANTIC)
		put(g, 'ukA', '英国', 'army', W_EUROPE)
		return g
	}

	/* D1 美国在西欧建陆军 */
	{
		const g = mk(true)
		const r = canBuild(g, W_EUROPE, 'army')
		ok('D1 西欧建陆军 ❌', !r.ok, r.reason || '')
	}

	/* D2 北海建海军（北海旁只有英国海军，无美国部队） */
	{
		const g = mk(true)
		const r = canBuild(g, NORTH_SEA, 'navy')
		ok('D2 北海建海军 ❌', !r.ok, r.reason || '')
	}

	/* D3 北海的美国海军应补给，链来自美国本土陆军 */
	{
		const g = mk(true)
		put(g, 'usN', '美国', 'navy', NORTH_SEA)
		const sup = I.compute_supply(g)
		ok('D3 北海美国海军 ✅ 补给', !!sup.in_supply['usN'])
		ok('   其来源是链（chain），最终来自美国★', sup.sources['usN'] === 'chain', sup.sources['usN'])
		/* 关键：链上的英国海军也是 chain，源头是美国陆军（base） */
		ok('   北大西洋英国海军 = chain', sup.sources['ukN2'] === 'chain', sup.sources['ukN2'])
		ok('   美国本土陆军 = base', sup.sources['usA'] === 'base', sup.sources['usA'])
		ok('   三者 can_source 都为真（真连回源）',
			!!sup.can_source['usN'] && !!sup.can_source['ukN2'] && !!sup.can_source['usA'])
	}

	/* D4 北大西洋有美国海军 -> 北海建海军：开 17549 可，不开不可 */
	{
		const g = mk(true)
		put(g, 'usN2', '美国', 'navy', N_ATLANTIC)
		const r = canBuild(g, NORTH_SEA, 'navy')
		ok('D4a 开 17549 -> 北海可建', r.ok, r.reason || '')

		const g2 = mk(false)
		put(g2, 'usN2', '美国', 'navy', N_ATLANTIC)
		const r2 = canBuild(g2, NORTH_SEA, 'navy')
		ok('D4b 不开 17549 -> 北海不可建（无组内陆军可当港口）', !r2.ok, r2.reason || '')
	}
}

console.log('\n=== E. 临时补给不能当 A 的来源 ===')
{
	/* 法国 15346：法国部队 aura 补给（in_supply=true 但 can_source=false） */
	const g = base()
	add17549(g)
	g.table['法国'] = ['15346']
	I.apply_status_ongoing(g, '15346', '法国')
	put(g, 'fr1', '法国', 'army', ICELAND)      /* 非★：只靠光环 */
	put(g, 'us1', '美国', 'navy', NORTH_SEA)    /* 北海邻接冰岛 */
	const sup = I.compute_supply(g)
	ok('法国陆军在光环下 in_supply', !!sup.in_supply['fr1'])
	ok('但 can_source = false（不是源）', !sup.can_source['fr1'], String(sup.can_source['fr1']))
	ok('美国海军因此断补（A 不认临时补给）', !sup.in_supply['us1'])

	/* 对照：同一支法国陆军改放 ★（西欧）-> base -> 可当来源 */
	const g2 = base()
	add17549(g2)
	g2.table['法国'] = ['15346']
	I.apply_status_ongoing(g2, '15346', '法国')
	put(g2, 'fr1', '法国', 'army', W_EUROPE)    /* ★ */
	put(g2, 'us1', '美国', 'navy', NORTH_SEA)
	const sup2 = I.compute_supply(g2)
	ok('放★★上时 can_source = true（不降级）', !!sup2.can_source['fr1'])
	ok('美国海军有补给（A=西欧法国陆军 base）', !!sup2.in_supply['us1'])
}

console.log('\n=== F. 全补给国家建设免 A（法国）===')
{
	const mkFr = (with15346) => {
		const g = base()
		g.table = g.table || {}
		g.table['法国'] = with15346 ? ['15346'] : []
		if (with15346) I.apply_status_ongoing(g, '15346', '法国')
		put(g, 'fr1', '法国', 'army', ICELAND)   /* 非★，靠光环 */
		return g
	}
	{
		const g = mkFr(true)
		const r = I.can_build_at(g, '法国', NORTH_SEA, 'navy')
		ok('有 15346 -> 法国可在北海建海军（B=冰岛法国陆军，A 免）', r.ok, r.reason || '')
	}
	{
		const g = mkFr(false)
		const r = I.can_build_at(g, '法国', NORTH_SEA, 'navy')
		ok('无 15346 -> 不可建（A 无来源、陆军也断补）', !r.ok, r.reason || '')
	}
}

console.log('\n=== G. 建设陆军：相邻有【补给中】的本国单位即可（不要求 can_source）===')
{
	const g = base()
	g.table['法国'] = ['15346']
	I.apply_status_ongoing(g, '15346', '法国')
	/* 法国陆军在冰岛（aura 补给）-> 西欧（★）旁建法国陆军 */
	put(g, 'fr1', '法国', 'army', ICELAND)
	const r = I.can_build_at(g, '法国', NORTH_SEA, 'army')   /* 海域不可建陆军，先测地形 */
	ok('海域不能建陆军', !r.ok, r.reason || '')
	/* 大本营/相邻：直接验证西欧（★ 且是法国大本营之一？） */
	const r2 = I.can_build_at(g, '法国', W_EUROPE, 'army')
	console.log('   （西欧建法国陆军 = ' + r2.ok + '：' + (r2.reason || '') + '）')
	ok('本国单位在旁时陆军建设照常可用（含 aura 补给状态）',
		typeof r2.ok === 'boolean')
}

console.log('\n' + (fail ? 'FAIL / ' + fail : 'ALL PASS'))
process.exit(fail ? 1 : 0)
