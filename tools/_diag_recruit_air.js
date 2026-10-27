/*
 * 【#18】征召空军必须走载体校验（不能独立存在）
 * 【#16】17531《现购自运政策》应能选择美国自己
 *
 * #18 根因：can_recruit_at 对空军
 *   ① 缺 air_host_check  -> 无单位处也能征召空军
 *   ② "已有本国部队->拒绝" 对空军是反的 -> 有载体（唯一合法）处反而不能
 *   叠加后完全颠倒。与《空军力量》部署同源修复：air_host_check + unit_slot_free。
 *
 * #16 根因：候选写死 ['英国','苏联','中国','法国']，漏了美国；
 *   而卡面是「选择 1 个友方国家」（不像 17535 明写"自己之外"）。
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const data = I.data

const MOSCOW = data.id_of('莫斯科')     /* 9  苏联大本营（补给点） */
const EAST_EU = data.id_of('东欧')      /* 5  普通陆地 */
const NORTH_SEA = data.id_of('北海')    /* 17 海域 */

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

function blank() {
	const g = rules.setup(9201, rules.default_scenario, {})
	g.opening = null
	g.turn = 3
	g.turn_phase = 'play'
	g.current_nation = '苏联'
	g.active = 'Axis'
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.table = {}
	return g
}
const put = (g, pid, nat, type, sp) => {
	g.location[pid] = sp
	g.piece_nation[pid] = nat
	g.piece_type[pid] = type
}

section('S1 #18 无单位的位置 —— 不能征召空军')
{
	const g = blank()
	const r = I.can_recruit_at(g, '苏联', EAST_EU, 'air')
	ok('★ 东欧（无任何部队）不可征召空军', !r.ok, r.reason)
	console.log('    原因: ' + r.reason)
}

section('S2 #18 有本国陆军且补给中 —— 可以征召空军')
{
	const g = blank()
	put(g, 'pSU', '苏联', 'army', MOSCOW)   /* 莫斯科是苏联大本营=补给点 */
	const sup = I.compute_supply(g)
	ok('该苏联陆军处于补给状态', !!sup.in_supply['pSU'])
	const r = I.can_recruit_at(g, '苏联', MOSCOW, 'air')
	ok('★ 莫斯科可征召空军（依托同格陆军）', r.ok, r.reason)
	if (r.ok) console.log('    原因: ' + r.reason)
	/* 实际落子 */
	const rp = I.recruit_piece(g, '苏联', 'air', MOSCOW)
	ok('★ recruit_piece 实际能落空军', !!(rp && rp.ok), rp && rp.reason)
}

section('S3 #18 载体存在但断补 —— 不能征召空军')
{
	const g = blank()
	put(g, 'pSU', '苏联', 'army', EAST_EU)   /* 东欧远离补给源 -> 断补 */
	const sup = I.compute_supply(g)
	ok('该陆军确实断补', !sup.in_supply['pSU'])
	const r = I.can_recruit_at(g, '苏联', EAST_EU, 'air')
	ok('★ 载体断补时不可征召空军', !r.ok, r.reason)
}

section('S4 回归：陆军 / 海军行为不变')
{
	const g = blank()
	ok('陆地空位可征召陆军', I.can_recruit_at(g, '苏联', EAST_EU, 'army').ok)
	ok('海域不可征召陆军', !I.can_recruit_at(g, '苏联', NORTH_SEA, 'army').ok)
	ok('海域空位可征召海军', I.can_recruit_at(g, '苏联', NORTH_SEA, 'navy').ok)

	const g2 = blank()
	put(g2, 'pSU', '苏联', 'army', EAST_EU)
	ok('★ 已有本国陆军 -> 不可再征召陆军（每国每格 1 支）',
		!I.can_recruit_at(g2, '苏联', EAST_EU, 'army').ok)
}

section('S5 #18 17531 的兵种候选：只在有载体时列出空军')
{
	/* 友方=英国；英国大本营不列颠。放一支补给中的英国陆军 */
	const g = blank()
	g.table = {}
	if (typeof I.us_merchant_types !== 'function') {
		console.log('    （us_merchant_types 未导出，跳过）')
	} else {
		const brit = data.id_of('不列颠')
		const t1 = I.us_merchant_types(g, '英国', brit)
		console.log('    不列颠（无部队）可征召: [' + t1.map(x => x.type).join(',') + ']')
		ok('★ 无载体时不列空军', t1.every(x => x.type !== 'air'))

		put(g, 'pUK', '英国', 'army', brit)
		const t2 = I.us_merchant_types(g, '英国', brit)
		console.log('    不列颠（有英国陆军）可征召: [' + t2.map(x => x.type).join(',') + ']')
		ok('★ 有载体时列出空军', t2.some(x => x.type === 'air'))
	}
}

section('S6 #16 17531 可以选择美国自己')
{
	if (typeof I.offer_us_merchant !== 'function') {
		console.log('    （offer_us_merchant 未导出，跳过）')
	} else {
		const g = blank()
		g.current_nation = '美国'
		g.active = 'Allies'
		I.offer_us_merchant(g)
		ok('us_merchant 已建立', !!g.us_merchant)

		rules.action(g, 'Allies', 'resolve_us_merchant_select', { nation: '美国' })
		ok('★ 选择【美国】被接受', g.us_merchant && g.us_merchant.nation === '美国',
			g.us_merchant && g.us_merchant.nation)

		const g2 = blank()
		g2.current_nation = '美国'
		g2.active = 'Allies'
		I.offer_us_merchant(g2)
		rules.action(g2, 'Allies', 'resolve_us_merchant_select', { nation: '英国' })
		ok('选择英国仍被接受', g2.us_merchant && g2.us_merchant.nation === '英国')

		const g3 = blank()
		g3.current_nation = '美国'
		g3.active = 'Allies'
		I.offer_us_merchant(g3)
		rules.action(g3, 'Allies', 'resolve_us_merchant_select', { nation: '德国' })
		ok('★ 非法国家（德国）仍被拒', g3.us_merchant && g3.us_merchant.nation == null,
			g3.us_merchant && g3.us_merchant.nation)
	}
}

console.log('\n==============================================')
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) { console.log('失败项：\n - ' + fails.join('\n - ')); process.exit(1) }
console.log('ALL PASS')
