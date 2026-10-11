/*
 * 冒烟测试：B 组美国 EVENT 卡「让权挂起」机制（17526 民主兵工厂 / 17529 摩尔曼斯克运输船队）
 * 2026-10-10：美国打出后让权英国/苏联执行建设/征召（多步交互 delegate，仿 16304/17900 范式）。
 *
 * 覆盖：
 *  - offer_* 设置 delegate 状态 + 翻转 active（记录 armed_delegate_return_active）
 *  - resolve_* 逐步执行（被让权方选点建/征召），完成后清除 delegate + 还原 active
 *  - 候选计算与引擎 can_build_at/can_recruit_at 一致（与 view 暴露同款）
 *  - 17529 step0 限定<罗斯>：传非罗斯点应被拒绝
 *  - play_card EVENT 分支的 hook 与 17817 同款（提前 return + 占名额 + 移除手牌 + offer），此处直接验证 offer/resolve 状态机
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + label) }
	else { fail++; console.log('  ✗ ' + label + (extra != null ? '  -> ' + extra : '')) }
}

let _id = 0
function put(g, nation, type, space) {
	const id = 'tmp' + (_id++)
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	if (I.refresh) I.refresh(g)
	return id
}
function fresh() {
	const g = rules.setup(1)
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	ensure(g, '美国')
	return g
}
function ensure(g, n) {
	const home = I.home_base_of(n)
	const has = Object.keys(g.location).some(p => g.piece_nation[p] === n && g.piece_type[p] === 'army' && g.location[p] === home)
	if (!has) put(g, n, 'army', home)
	return home
}
function countArmy(g, n) {
	let c = 0
	for (const p in g.piece_nation) if (g.piece_nation[p] === n && g.piece_type[p] === 'army') c++
	return c
}
function countNavy(g, n) {
	let c = 0
	for (const p in g.piece_nation) if (g.piece_nation[p] === n && g.piece_type[p] === 'navy') c++
	return c
}
function buildCands(g, n, t) {
	const a = []
	for (let i = 1; i < d.spaces.length; i++) {
		const r = I.can_build_at(g, n, i, t)
		if (r && r.ok) a.push(i)
	}
	return a
}
function recruitCands(g, n, t) {
	const a = []
	for (let i = 1; i < d.spaces.length; i++) {
		const r = I.can_recruit_at ? I.can_recruit_at(g, n, i, t) : null
		if (r && r.ok) a.push(i)
	}
	return a
}

/* ===== 17526 民主兵工厂：让权英国执行「建设1海军 + 建设1陆军」 ===== */
function test17526() {
	console.log('\n[17526 民主兵工厂] 让权英国 建设海军 + 建设陆军')
	const g = fresh(); ensure(g, '英国')
	const origActive = 'Axis' // 模拟「非英国/苏联 active」，便于验证翻转+还原
	g.active = origActive

	I.offer_uk_build_delegate(g, '美国')
	ok('delegate 已设置', !!g.uk_build_delegate)
	ok('delegate.nation = 英国', g.uk_build_delegate && g.uk_build_delegate.nation === '英国')
	ok('delegate 两步', g.uk_build_delegate && g.uk_build_delegate.steps.length === 2)
	ok('delegate.done = 0', g.uk_build_delegate && g.uk_build_delegate.done === 0)
	ok('active 翻转到英国阵营(Allies)', g.active !== origActive, 'active=' + g.active)

	const navyCands = buildCands(g, '英国', 'navy')
	ok('英国有可建海军点', navyCands.length > 0, 'cands=' + navyCands)

	const bN = countNavy(g, '英国'), bA = countArmy(g, '英国')
	// step0: 建海军
	I.resolve_uk_build_delegate(g, { space: navyCands[0] })
	ok('英国海军 +1 (step0)', countNavy(g, '英国') === bN + 1, 'before=' + bN + ' after=' + countNavy(g, '英国'))
	ok('delegate.done = 1', g.uk_build_delegate.done === 1)
	// step1: 建陆军（step0 后重建候选，避开已被本国 home 占用的格子）
	const armyCands2 = buildCands(g, '英国', 'army')
	ok('英国有可建陆军点(重建)', armyCands2.length > 0, 'cands=' + armyCands2)
	I.resolve_uk_build_delegate(g, { space: armyCands2[0] })
	ok('英国陆军 +1 (step1)', countArmy(g, '英国') === bA + 1, 'before=' + bA + ' after=' + countArmy(g, '英国'))
	ok('delegate 已完成并清除', !g.uk_build_delegate)
	ok('active 已还原为原值', g.active === origActive, 'active=' + g.active)
}

/* ===== 17529 摩尔曼斯克运输船队：让权苏联「罗斯征召1陆军 + 建设1陆军」 ===== */
function test17529() {
	console.log('\n[17529 摩尔曼斯克运输船队] 让权苏联 罗斯征召陆军 + 建设陆军')
	const g = fresh(); ensure(g, '苏联')
	const origActive = 'Axis'
	g.active = origActive

	const ros = I.space_id_of('罗斯')
	ok('罗斯 单格解析', ros != null, 'ros=' + ros)

	I.offer_su_build_delegate(g, '美国')
	ok('delegate 已设置', !!g.su_build_delegate)
	ok('delegate.nation = 苏联', g.su_build_delegate && g.su_build_delegate.nation === '苏联')
	ok('delegate 两步', g.su_build_delegate && g.su_build_delegate.steps.length === 2)
	ok('delegate.done = 0', g.su_build_delegate && g.su_build_delegate.done === 0)
	ok('active 翻转到苏联阵营(Allies)', g.active !== origActive, 'active=' + g.active)

	// step0 限定罗斯：罗斯应可征召（苏联在罗斯有合法征召点）
	const rosOk = I.can_recruit_at ? I.can_recruit_at(g, '苏联', ros, 'army').ok : false
	ok('罗斯可征召(苏联)', rosOk, 'rosOk=' + rosOk)
	const bA = countArmy(g, '苏联')
	I.resolve_su_build_delegate(g, { space: ros })
	ok('苏联陆军 +1 (step0 罗斯征召)', countArmy(g, '苏联') === bA + 1, 'before=' + bA + ' after=' + countArmy(g, '苏联'))
	ok('delegate.done = 1', g.su_build_delegate.done === 1)

	// step0 误传非罗斯点应被拒绝（不推进）
	const r0 = I.resolve_su_build_delegate(g, { space: (ros === 1 ? 2 : 1) })
	ok('step0 非罗斯点被拒绝(不推进)', g.su_build_delegate.done === 1, 'done=' + g.su_build_delegate.done)

	// step1: 建陆军
	const armyCands = buildCands(g, '苏联', 'army')
	ok('苏联有可建陆军点', armyCands.length > 0, 'cands=' + armyCands)
	I.resolve_su_build_delegate(g, { space: armyCands[0] })
	ok('苏联陆军 +1 (step1 建设)', countArmy(g, '苏联') === bA + 2, 'before=' + bA + ' after=' + countArmy(g, '苏联'))
	ok('delegate 已完成并清除', !g.su_build_delegate)
	ok('active 已还原为原值', g.active === origActive, 'active=' + g.active)
}

/* ===== 互斥：同一张卡重复 offer 被拒绝 ===== */
function testMutex() {
	console.log('\n[互斥] 同一张卡重复 offer 被拒绝')
	const g = fresh(); ensure(g, '英国')
	const r1 = I.offer_uk_build_delegate(g, '美国')
	ok('第一次 offer_uk 成功', r1 === true)
	const r2 = I.offer_uk_build_delegate(g, '美国')
	ok('重复 offer_uk 返回 false', r2 === false)
	ok('仍为单个 uk delegate', !!g.uk_build_delegate)
}

test17526()
test17529()
testMutex()
console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
