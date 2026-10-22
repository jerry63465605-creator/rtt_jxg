/*
 * 回归：海军【建设】与海军【补给】口径一致 + 17549 共享补给组
 *
 * 玩家口径（2026-10-23）：
 *   「建设要求和补给一致，但是与本国的陆地部队相邻」
 *   → 建设海军 = 海军补给的两条判定【分别】满足：
 *       A. 相邻有处于补给状态的【本国/组内盟国】部队（不限兵种）
 *       B. 相邻有【本国/组内盟国】的【陆地部队（陆军）】（不要求它自身补给）
 *
 * 修复前的错误：把 A、B 压在同一支陆军上（"邻接一支处于补给状态的本国陆军"），
 *   于是"补给中的海军 + 断补陆军"这类合法场景被误判为不可建。
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

/* 找一个"海区 + 邻接陆地 + 该海区还邻接另一个海区"的三元组 */
function findTriple() {
	for (let i = 1; i < data.spaces.length; i++) {
		const s = data.spaces[i]
		if (!s || s.terrain !== 'sea') continue
		const conns = (s.connections || []).map(Number)
		const land = conns.find(x => data.spaces[x] && data.spaces[x].terrain === 'land')
		const sea2 = conns.find(x => data.spaces[x] && data.spaces[x].terrain === 'sea')
		if (land != null && sea2 != null) return { sea: i, land: land, sea2: sea2 }
	}
	return null
}
const T = findTriple()

function base() {
	const g = rules.setup(41, rules.default_scenario, {})
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
function put(g, pid, nation, type, space, granted) {
	g.location[pid] = space
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
	if (granted) g.supply_granted[pid] = (g.turn || 1) + 99
}
function add17549(g) {
	g.table['美国'] = ['17549']
	I.apply_status_ongoing(g, '17549', '美国')
}
/* 该海域能否建美国海军 */
function canBuild(g) { return I.can_build_at(g, '美国', T.sea, 'navy') }
/* 若在该海域放一支美国海军，compute_supply 判它是否补给（= 补给口径） */
function wouldBeSupplied(g) {
	put(g, '__probe', '美国', 'navy', T.sea)
	const sup = I.compute_supply(g)
	const got = !!sup.in_supply['__probe']
	delete g.location['__probe']
	delete g.piece_nation['__probe']
	delete g.piece_type['__probe']
	return got
}
/* 一致性：建设口径 == 补给口径 */
function same(g, tag) {
	const b = canBuild(g).ok
	const s = wouldBeSupplied(g)
	ok(tag + '：建设(' + b + ') 与 补给(' + s + ') 一致', b === s)
	return { b, s }
}

console.log('测试地区：海区 =', data.name_of(T.sea),
	'/ 邻接陆地 =', data.name_of(T.land),
	'/ 邻接海区 =', data.name_of(T.sea2))

console.log('\n=== A. 基线：无 17549，邻接英国陆军（补给中）===')
{
	const g = base()
	put(g, 'uk1', '英国', 'army', T.land, true)
	const r = canBuild(g)
	ok('不能建（默认只认本国陆军）', !r.ok, r.reason || '')
	ok('reason 指明缺陆地部队', /陆地部队/.test(r.reason || ''), r.reason || '')
	same(g, '无 17549')
}

console.log('\n=== B. 有 17549：英国陆军（补给中）=> 可建 ===')
{
	const g = base()
	add17549(g)
	put(g, 'uk1', '英国', 'army', T.land, true)
	const r = canBuild(g)
	ok('可以建', r.ok, r.reason || '')
	same(g, '17549 + 组内陆军补给中')
}

console.log('\n=== C. 组外友军（中国陆军）仍不能充当 ===')
{
	const g = base()
	add17549(g)
	put(g, 'cn1', '中国', 'army', T.land, true)
	const r = canBuild(g)
	ok('不能建', !r.ok, r.reason || '')
	same(g, '17549 + 组外陆军')
}

console.log('\n=== D. ★新口径：相邻"补给中的海军"(A) + "断补陆军"(B) => 可建 ===')
{
	const g = base()
	add17549(g)
	put(g, 'uk1', '英国', 'army', T.land, false)        /* B 满足，但自身断补 */
	put(g, 'uk2', '英国', 'navy', T.sea2, true)         /* A 满足：相邻海域有补给中的英国海军 */
	const r = canBuild(g)
	ok('可以建（旧实现会误判为不可建）', r.ok, r.reason || '')
	same(g, 'A/B 分属不同部队')
}

console.log('\n=== E. 只有断补陆军、无任何补给部队 => 不可建（A 失败）===')
{
	const g = base()
	add17549(g)
	put(g, 'uk1', '英国', 'army', T.land, false)
	const r = canBuild(g)
	ok('不能建', !r.ok, r.reason || '')
	ok('reason 指明缺补给部队', /补给状态/.test(r.reason || ''), r.reason || '')
	same(g, '只有断补陆军')
}

console.log('\n=== F. 只有补给部队、无陆地部队 => 不可建（B 失败）===')
{
	const g = base()
	add17549(g)
	put(g, 'uk2', '英国', 'navy', T.sea2, true)
	const r = canBuild(g)
	ok('不能建', !r.ok, r.reason || '')
	ok('reason 指明缺陆地部队', /陆地部队/.test(r.reason || ''), r.reason || '')
	same(g, '只有补给海军')
}

console.log('\n=== G. 15346《自由法国》光环不架空相邻要求 ===')
{
	const g = base()
	/* 法国 15346：法国部队总是处于补给状态（光环） */
	g.table['法国'] = ['15346']
	I.apply_status_ongoing(g, '15346', '法国')
	ok('15346 光环已生效', !!(g.status_aura.supply_immune || {})['法国'],
		JSON.stringify(g.status_aura.supply_immune))
	/* 法国建海军，但相邻无任何部队 -> 不能让"自身光环补给"充当 A/B */
	const r = I.can_build_at(g, '法国', T.sea, 'navy')
	ok('法国在无邻居的海域仍不能建（光环不替代 A/B）', !r.ok, r.reason || '')
	/* 与"补给口径"一致性：这里不比对 —— 15346 按要求会让新海军自身算补给，
	   这正是不能直接用 compute_supply 模拟的原因，故单独断言"不可建"。 */
}

console.log('\n=== H. 组内陆军存在但被压制/无关时不影响判定（回归） ===')
{
	const g = base()
	add17549(g)
	put(g, 'fr1', '法国', 'army', T.land, true)
	ok('法国陆军可充当陆地部队', canBuild(g).ok, canBuild(g).reason || '')
	same(g, '17549 + 法国陆军')
}

console.log('\n' + (fail ? 'FAIL / ' + fail : 'ALL PASS'))
process.exit(fail ? 1 : 0)
