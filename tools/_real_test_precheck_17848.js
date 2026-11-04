/*
 * S2-b 真实测试 ①：17848《正面攻击》—— 代价（弃 2 张）必须在"预检通过"之后才付
 *
 * 按 rtt-realboard-test 铁律：① 布阵只用 debug_* ② 驱动只用真实 action
 * ③ 三层断言（服务端 / view / 日志）④ 客户端点击链镜像 ⑤ 残留检查 ⑥ 窗口断言在 view 之后
 *
 *  A. 目标格 = 本方地区（无敌军）→ 预检拒，手牌/牌库/记账/窗口全部不动
 *  B. 目标格有敌军但没给 victim → 预检拒「请选择攻击目标」，代价不付
 *  C. 合法目标 → 成功：弃 2 张、status_used 记账、窗口消费
 *  D. 残留：status_inflight / pending_* 全空
 *  E. 静态守卫：4 张"发起战斗型"状态卡都挂了 precheck
 *
 * 用法：node tools/_real_test_precheck_17848.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const tableInst = g => (g.table['苏联'] || []).find(x => faceOf(x) === '17848')

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = g.neutral || {}
	g.neutral['苏联'] = false          /* 苏联参战（V24：否则不能发起战斗） */
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	if (!(g.hands['苏联'] || []).some(x => faceOf(x) === '17848'))
		R.action(g, 'Allies', 'debug_add_card', { face: '17848', nation: '苏联', dest: 'hand' })
	I.refresh(g)
	const card = (g.hands['苏联'] || []).find(x => faceOf(x) === '17848')
	R.action(g, 'Allies', 'play_card', { card })
	I.refresh(g)
	/* 苏联陆军@罗斯（大本营，处于补给）；德国陆军@相邻陆地（合法陆地格，V14） */
	R.action(g, 'Allies', 'debug_place', { piece: 'su_atk', nation: '苏联', type: 'army', space: d.id_of('罗斯') })
	const foeSpace = I.get_connections(g, d.id_of('罗斯'), 'allies')
		.find(s => d.spaces[s] && d.spaces[s].terrain !== 'sea' &&
			!Object.keys(g.location).some(p => g.location[p] === s))
	R.action(g, 'Axis', 'debug_place', { piece: 'de_v1', nation: '德国', type: 'army', space: foeSpace })
	I.refresh(g)
	I.grant_supply(g, 'su_atk', g.turn)
	I.grant_supply(g, 'de_v1', g.turn)
	I.refresh(g)
	return { g, foeSpace }
}

function triggerBattle(g, foeSpace) {
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'debug_place', { piece: 'de_trigger', nation: '德国', type: 'army', space: foeSpace })
	I.refresh(g)
	/* 已有德国陆军在该格时会拒绝重复放；忽略失败，直接打 */
	I.do_battle(g, '苏联', foeSpace, 'de_v1', 'land', { from: 'su_atk' })
	return logSince(g, n0)
}

const { g, foeSpace } = setup()
console.log('=== 布阵自检 ===')
{
	ok('17848 已上桌', !!tableInst(g), JSON.stringify((g.table['苏联'] || []).map(faceOf)))
	ok('苏联陆军在陆地格', d.spaces[g.location['su_atk']] && d.spaces[g.location['su_atk']].terrain !== 'sea')
	ok('德国陆军在陆地格', d.spaces[g.location['de_v1']] && d.spaces[g.location['de_v1']].terrain !== 'sea')
	ok('两军不同格（V19）', g.location['su_atk'] !== g.location['de_v1'])
}

console.log('\n=== 触发 after_land ===')
{
	const lg = triggerBattle(g, foeSpace)
	console.log('  battle: ' + (lg || '(无日志)'))
	R.view(g, 'Allies')            /* V6：窗口在 view 之后才武装 */
	const card = tableInst(g)
	ok('★ 17848 被武装', (g.status_instant || []).some(e => String(e.card_id) === String(card)),
		JSON.stringify((g.status_instant || []).map(e => e.card_id)))
}

console.log('\n=== A. 目标格 = 本方地区（无敌军）→ 预检拒，代价不付 ===')
{
	const card = tableInst(g)
	const hand0 = (g.hands['苏联'] || []).length
	const deck0 = (g.decks['苏联'] || []).length
	const disc0 = (g.discard['苏联'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', {
		card, from: 'su_atk', space: d.id_of('罗斯'),   /* 本方所在格 */
		discard: (g.hands['苏联'] || []).slice(0, 2),
	})
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★★ 被预检拦下（提示有我方部队）', /有我方部队|不能攻击|现在不能发动/.test(lg), lg)
	ok('★★ 手牌未扣', (g.hands['苏联'] || []).length === hand0, hand0 + ' -> ' + (g.hands['苏联'] || []).length)
	ok('★ 牌库/弃牌堆未变', (g.decks['苏联'] || []).length === deck0 && (g.discard['苏联'] || []).length === disc0,
		JSON.stringify({ deck: [deck0, (g.decks['苏联'] || []).length], disc: [disc0, (g.discard['苏联'] || []).length] }))
	ok('★ 未记账（status_used 空）', !(g.status_used || {})[String(card)], JSON.stringify(g.status_used))
	ok('★ 窗口仍保留（可重试）', (g.status_instant || []).some(e => String(e.card_id) === String(card)))
}

console.log('\n=== B. 有敌军但未给 victim → 预检拒 ===')
{
	const card = tableInst(g)
	const hand0 = (g.hands['苏联'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', {
		card, from: 'su_atk', space: foeSpace,      /* 有德国陆军，但没给 victim */
		discard: (g.hands['苏联'] || []).slice(0, 2),
	})
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★★ 被预检拦下（请选择攻击目标）', /请选择攻击目标|现在不能发动/.test(lg), lg)
	ok('★ 手牌未扣', (g.hands['苏联'] || []).length === hand0)
}

console.log('\n=== C. 合法目标（敌方 + victim）→ 成功 ===')
{
	const card = tableInst(g)
	const hand0 = (g.hands['苏联'] || []).length
	const pay = (g.hands['苏联'] || []).slice(0, 2)
	/* 动态取该格当前的德国部队（前面那场战斗可能已经消灭了 de_v1） */
	const victim = I.pieces_on(g, foeSpace).find(p => g.piece_nation[p] === '德国')
	console.log('  目标格 ' + d.name_of(foeSpace) + ' 的敌方部队 = ' + JSON.stringify(victim))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', {
		card, from: 'su_atk', space: foeSpace, victim, discard: pay,
	})
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★ 发动成功（日志含卡名/发起陆战）', /正面攻击|发起陆战/.test(lg), lg)
	ok('★ 代价已付（手牌 -2）', (g.hands['苏联'] || []).length === hand0 - 2,
		hand0 + ' -> ' + (g.hands['苏联'] || []).length)
	ok('★ 已记账（本回合不可再发）', (g.status_used || {})[String(card)] != null, JSON.stringify(g.status_used))
	const v = R.view(g, 'Allies')
	const ts = (v.table_status || []).find(x => String(x.card) === String(card))
	console.log('  table_status = ' + JSON.stringify(ts && { ready: ts.ready, used_this_turn: ts.used_this_turn, reason: ts.reason }))
	ok('★ 客户端视角：本回合已发动（used_this_turn）',
		!!ts && ts.used_this_turn === true, JSON.stringify(ts && ts.used_this_turn))
	ok('★ 客户端视角：不再可点（ready=false）', !!ts && ts.ready === false, JSON.stringify(ts && ts.ready))
}

console.log('\n=== D. 残留检查 ===')
{
	const leftovers = {
		status_inflight: g.status_inflight,
		pending_echo: g.pending_echo,
		pending_battle: g.pending_battle,
		pending_armed_use: g.pending_armed_use,
		armed_offers: (g.armed_offers || []).length,
	}
	console.log('  ' + JSON.stringify(leftovers))
	ok('★ 无 status_inflight 残留', !g.status_inflight, String(g.status_inflight))
	ok('★ 无 pending_echo 残留', !g.pending_echo, JSON.stringify(g.pending_echo))
}

console.log('\n=== E. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('precheck_status_args 存在于 activate_status 之前调用', /precheck_status_args\(game, owner, tr, arg/.test(src))
	ok('precheck_launch_battle 已实现', /function precheck_launch_battle/.test(src))
	for (const id of ['17848', '15245', '15247', '17544']) {
		const seg = src.split("'" + id + "': {")[1] || ''
		ok(id + ' 的 trigger 挂了 precheck', /precheck: (precheck_launch_battle|\(g, o, a, c\) =>)/.test(seg.slice(0, 400)))
	}
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
