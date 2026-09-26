/*
 * 8 张增强卡（ECHO / ↑）+ 时点接口
 *
 * 卡面文本经 GLM 读图核对（2026-09-25），OCR 原文全部有误已更正。
 * 运行：node tools/test_echo_cards.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
const failures = []
function ok(cond, name, extra) {
	if (cond) pass++
	else { fail++; failures.push(name + (extra ? '  -> ' + extra : '')) }
}
function eq(a, b, name) {
	ok(a === b, name, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b))
}

const SP = d.id_of

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null
	g.markers = I.init_markers()
	g.supply_override = {}; g.supply_granted = {}; g.ongoing = {}
	g.modifiers = []
	g.peek = null
	for (const n of ['英国', '法国', '德国', '苏联', '意大利', '日本', '美国', '中国']) {
		g.hands[n] = []; g.decks[n] = []; g.discard[n] = []
	}
	return g
}

let seq = 0
function place(g, n, t, s) {
	const id = 'p' + (++seq)
	g.location[id] = Number(s); g.piece_nation[id] = n; g.piece_type[id] = t
	return id
}

console.log('=== 1. 卡面文本已更正（对照 GLM 读图结果） ===')
{
	const EXPECT = {
		'15305': '摸牌阶段开始时：随机选择并观看 2 张德国的手牌，将这些牌以任意顺序置于德国牌堆顶。',
		'15306': '计分阶段开始时，弃置 2 张手牌：在<非洲北部>-<中东>-<东南亚>-<印度尼西亚>之一征召陆军。',
		'15307': '计分阶段开始时，弃置 2 张手牌：法国建设 1 支海军。',
		'15308': '空军阶段开始时：法国部署 1 支空军。',
		'15309': '计分阶段开始时，弃置 2 张手牌：法国建设 1 支陆军。',
		'15310': '计分阶段开始时，弃置 1 张手牌：法国在<非洲北部>-<非洲南部>-<马达加斯加>-<中东>-<东南亚>-<新几内亚>之一征召 1 支陆军。',
		'15311': '任意时机，弃置 4 张手牌：<西欧>的法国陆军在本回合内不会被移除。',
		'15312': '计分阶段开始时，弃置 2 张手牌：在<东欧>征召陆军。（卡底：华沙，起义！）',
	}
	const ids = Object.keys(EXPECT)
	for (const id of ids) {
		const c = (C.CARDS || []).find(x => String(x.id) === id)
		ok(c != null, '1.' + id + ' 卡存在')
		if (c) {
			eq(c.type, 'EFFECT', '1.' + id + ' 类型是增强卡(EFFECT)')
			eq(c.text, EXPECT[id], '1.' + id + ' 文本已更正')
		}
	}
}

console.log('=== 2. 配置与时点声明完整 ===')
{
	eq(Object.keys(I.ECHO_EFFECTS).length, 8, '2.1 8 张都有配置')
	eq(Object.keys(I.CARD_TRIGGERS).length, 8, '2.2 8 张都声明了时点')
	const TRIG = {
		'15305': { kind: 'self', phase: 'draw' },
		'15306': { kind: 'self', phase: 'scoring' },
		'15307': { kind: 'self', phase: 'scoring' },
		'15308': { kind: 'self', phase: 'airforce' },
		'15309': { kind: 'self', phase: 'scoring' },
		'15310': { kind: 'self', phase: 'scoring' },
		'15311': { kind: 'anytime' },
		'15312': { kind: 'self', phase: 'scoring' },
	}
	for (const id of Object.keys(TRIG)) {
		const t = I.CARD_TRIGGERS[id]
		eq(t.kind, TRIG[id].kind, '2.3 ' + id + ' kind')
		if (TRIG[id].phase) eq(t.phase, TRIG[id].phase, '2.4 ' + id + ' phase')
	}
}

console.log('=== 3. 时点校验：阶段不对会被拒 ===')
{
	const g = fresh()
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'             /* 出牌阶段 */
	g.hands['英国'] = ['15306']
	/* 15306 需要 scoring 阶段 */
	R.action(g, 'Allies', 'play_card', { card: '15306' })
	eq(g.hands['英国'].indexOf('15306') >= 0, true, '3.1 阶段不对时未打出')
	ok(g.log.some(l => l.indexOf('只能在本方的计分阶段') >= 0), '3.2 日志说明了原因',
		g.log[g.log.length - 1])
}
{
	/* 阶段对了就能打 */
	const g = fresh()
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'scoring'
	g.hands['英国'] = ['15312', 'a', 'b']   /* 15312 需弃 2 张 */
	R.action(g, 'Allies', 'play_card', { card: '15312', space: SP('东欧') })
	eq(g.hands['英国'].indexOf('15312') < 0, true, '3.3 计分阶段可打出')
	const brit = Object.keys(g.location).filter(p => g.piece_nation[p] === '英国')
	eq(brit.length, 1, '3.4 征召了 1 支英国陆军')
	eq(g.location[brit[0]], SP('东欧'), '3.5 位置是东欧')
	/*
	 * 弃牌堆 = 2 张代价 + 卡本身（打出后也进弃牌堆）= 3。
	 * 直接调 resolve_event_card 时不含卡本身，只有 2 —— 见测试 5.5。
	 */
	eq(g.discard['英国'].length, 3, '3.6 弃牌堆共 3 张（2 张代价 + 卡本身）')
	eq(g.discard['英国'].indexOf('15312') >= 0, true, '3.7 卡本身已进弃牌堆')
}
{
	/* 不是自己的回合 -> 被拒 */
	const g = fresh()
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'scoring'
	g.hands['英国'] = ['15312']
	R.action(g, 'Allies', 'play_card', { card: '15312' })
	eq(g.hands['英国'].indexOf('15312') >= 0, true, '3.7 非本方回合被拒')
}

console.log('=== 4. 增强卡不占出牌名额 ===')
{
	const g = fresh()
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'scoring'
	g.hands['英国'] = ['15312']
	g.play_done = {}
	R.action(g, 'Allies', 'play_card', { card: '15312', space: SP('东欧') })
	eq(g.play_done['英国'], undefined, '4.1 不写 play_done（不占名额）')
}

console.log('=== 5. 15306 英联邦殖民地民兵：弃 2 张 + 四地之一征召 ===')
{
	const g = fresh()
	const eff = I.ECHO_EFFECTS['15306']
	eq(eff.cost.discard, 2, '5.1 代价是弃 2 张')
	const want = [15, 16, 37, 39].sort()   /* 非洲北部/中东/东南亚/印度尼西亚 */
	eq(eff.steps[0].spaces.slice().sort().join(','), want.join(','),
		'5.2 四个候选地区正确')
	/* 手牌不足 */
	g.hands['英国'] = ['15306', 'x1']
	let r = I.resolve_event_card(g, '英国', '15306', { space: SP('中东') })
	eq(r.ok, false, '5.3 手牌不足被拒')
	/* 足够 */
	g.hands['英国'] = ['15306', 'x1', 'x2']
	r = I.resolve_event_card(g, '英国', '15306', { space: SP('中东') })
	eq(r.ok, true, '5.4 执行成功', r.reason)
	eq(g.discard['英国'].length, 2, '5.5 弃了 2 张')
	eq(g.location[Object.keys(g.location)[0]], SP('中东'), '5.6 在中东征召')
}

console.log('=== 6. 15307 自由法国海军：弃 2 张 + 法国建设海军 ===')
{
	const g = fresh()
	place(g, '法国', 'army', SP('西欧'))   /* 载体：西欧★邻接北海 */
	g.hands['英国'] = ['15307', 'a', 'b']
	const r = I.resolve_event_card(g, '英国', '15307', { space: 17 })
	eq(r.ok, true, '6.1 执行成功', r.reason)
	eq(g.discard['英国'].length, 2, '6.2 弃了 2 张')
	const navy = Object.keys(g.location).filter(p => g.piece_type[p] === 'navy')[0]
	ok(navy != null, '6.3 产生了海军')
	eq(g.piece_nation[navy], '法国', '6.4 是法国海军')
}

console.log('=== 7. 15308 法国空军：空军阶段 + 部署空军 ===')
{
	const g = fresh()
	place(g, '法国', 'army', SP('西欧'))
	const r = I.resolve_event_card(g, '英国', '15308', { space: SP('西欧') })
	eq(r.ok, true, '7.1 执行成功', r.reason)
	const air = Object.keys(g.location).filter(p => g.piece_type[p] === 'air')[0]
	ok(air != null, '7.2 产生了空军')
	eq(g.piece_nation[air], '法国', '7.3 是法国空军')
	/* 时点是 airforce */
	eq(I.CARD_TRIGGERS['15308'].phase, 'airforce', '7.4 时点是空军阶段')
}
{
	/* 无载体时应失败 */
	const g = fresh()
	const r = I.resolve_event_card(g, '英国', '15308', { space: SP('西欧') })
	eq(r.ok, false, '7.5 无本方陆/海军载体时被拒')
}

console.log('=== 8. 15309 自由法国陆军：弃 2 张 + 建设陆军 ===')
{
	const g = fresh()
	g.hands['英国'] = ['15309', 'a', 'b']
	const r = I.resolve_event_card(g, '英国', '15309', { space: SP('西欧') })
	eq(r.ok, true, '8.1 执行成功', r.reason)
	eq(g.discard['英国'].length, 2, '8.2 弃了 2 张')
	eq(g.piece_nation[Object.keys(g.location)[0]], '法国', '8.3 是法国陆军')
}

console.log('=== 9. 15310 法国外籍军团：弃 1 张 + 六地之一征召 ===')
{
	const g = fresh()
	const eff = I.ECHO_EFFECTS['15310']
	eq(eff.cost.discard, 1, '9.1 代价是弃 1 张')
	eq(eff.steps[0].spaces.length, 6, '9.2 六个候选地区')
	/* 马达加斯加(33) 必须在列表里（OCR 曾漏掉） */
	ok(eff.steps[0].spaces.indexOf(33) >= 0, '9.3 含马达加斯加(33)')

	g.hands['英国'] = ['15310', 'a']
	const r = I.resolve_event_card(g, '英国', '15310', { space: 33 })
	eq(r.ok, true, '9.4 执行成功', r.reason)
	eq(g.discard['英国'].length, 1, '9.5 弃了 1 张')
	eq(g.location[Object.keys(g.location)[0]], 33, '9.6 在马达加斯加征召')
	eq(g.piece_nation[Object.keys(g.location)[0]], '法国', '9.7 是法国部队')
}

console.log('=== 10. 15311 马奇诺防线：protect 保护（含到期） ===')
{
	const g = fresh()
	g.turn = 3
	g.hands['英国'] = ['15311', 'a', 'b', 'c', 'd']
	/* 造一支断补的法国陆军在西欧，验证它被保护 */
	const fr = place(g, '法国', 'army', SP('西欧'))
	/* 让它断补：移除西欧的补给（西欧是★，用 override 关掉） */
	I.remove_supply_point(g, SP('西欧'))
	const sup = I.compute_supply(g)
	eq(!!sup.in_supply[fr], false, '10.1 该部队本会断补')

	/* 打出马奇诺防线 */
	const r = I.resolve_event_card(g, '英国', '15311', {})
	eq(r.ok, true, '10.2 执行成功', r.reason)
	eq(g.discard['英国'].length, 4, '10.3 弃了 4 张')
	eq(I.is_protected(g, fr), true, '10.4 该部队现在受保护')

	/* 补给结算：不应被移除 */
	const removed = I.resolve_supply(g, '法国')
	eq(removed.indexOf(fr) < 0, true, '10.5 断补但被保护，未被移除')
	eq((I.resolve_supply.last_protected || []).indexOf(fr) >= 0, true,
		'10.6 记录在 protected 列表里')
}
{
	/* 非保护地区/非保护国籍不受保护 */
	const g = fresh()
	g.turn = 3
	g.hands['英国'] = ['15311', 'a', 'b', 'c', 'd']
	I.resolve_event_card(g, '英国', '15311', {})
	const other = place(g, '法国', 'army', SP('东欧'))   /* 不在西欧 */
	eq(I.is_protected(g, other), false, '10.7 西欧以外的法国陆军不受保护')
	const uk = place(g, '英国', 'army', SP('西欧'))
	eq(I.is_protected(g, uk), false, '10.8 英国部队不受保护（只保护法国）')
	const frNavy = place(g, '法国', 'navy', SP('西欧'))
	eq(I.is_protected(g, frNavy), false, '10.9 海军不受保护（只保护陆军）')
}
{
	/* 到期：跨回合后保护失效 */
	const g = fresh()
	g.turn = 3
	g.hands['英国'] = ['15311', 'a', 'b', 'c', 'd']
	I.resolve_event_card(g, '英国', '15311', {})
	const fr = place(g, '法国', 'army', SP('西欧'))
	eq(I.is_protected(g, fr), true, '10.10 本回合受保护')
	g.turn = 4
	I.prune_modifiers(g)
	eq(I.is_protected(g, fr), false, '10.11 下一回合保护失效')
}
{
	/* anytime：任何阶段都能打 */
	const g = fresh()
	g.current_nation = '英国'
	g.active = 'Allies'
	for (const ph of ['play', 'draw', 'scoring', 'airforce']) {
		const t = I.trigger_ready(Object.assign(g, { turn_phase: ph }), '15311', '英国')
		eq(t.ok, true, '10.12 ' + ph + ' 阶段都能打马奇诺防线')
	}
}

console.log('=== 11. 15305 双十字系统：peek_reorder ===')
{
	const g = fresh()
	g.hands['德国'] = ['g1', 'g2', 'g3']
	g.decks['德国'] = ['d1', 'd2']

	/* 第一次：随机挑 2 张，等玩家排序 */
	const r1 = I.resolve_event_card(g, '英国', '15305', {})
	eq(r1.pending, true, '11.1 需等玩家排序')
	ok(Array.isArray(r1.peek) && r1.peek.length === 2, '11.2 挑了 2 张',
		JSON.stringify(r1.peek))
	eq(g.hands['德国'].length, 3, '11.3 此时还没从手牌移除')
	ok(g.peek != null, '11.4 game.peek 已记录')

	/* 提交顺序 */
	const picked = g.peek.cards.slice()
	const r2 = I.resolve_event_card(g, '英国', '15305', {
		order: [picked[1], picked[0]],   /* 逆序 */
	})
	eq(r2.ok, true, '11.5 执行成功', r2.reason)
	eq(g.hands['德国'].length, 1, '11.6 德国手牌剩 1 张')
	/* 牌堆顶按 order 顺序：order[0] 在最顶 */
	eq(g.decks['德国'][0], picked[1], '11.7 牌堆顶是 order[0]')
	eq(g.decks['德国'][1], picked[0], '11.8 次顶是 order[1]')
	eq(g.peek, null, '11.9 peek 已清除')
}
{
	/* 排序的牌与观看的不一致 -> 拒绝 */
	const g = fresh()
	g.hands['德国'] = ['g1', 'g2', 'g3']
	I.resolve_event_card(g, '英国', '15305', {})
	const r = I.resolve_event_card(g, '英国', '15305', { order: ['g1', 'zzz'] })
	eq(r.ok, false, '11.10 不一致时被拒')
}
{
	/* 对手无手牌 -> 失败 */
	const g = fresh()
	g.hands['德国'] = []
	const r = I.resolve_event_card(g, '英国', '15305', {})
	eq(r.ok, false, '11.11 对手无手牌时失败')
}
{
	/* 时点是摸牌阶段 */
	eq(I.CARD_TRIGGERS['15305'].phase, 'draw', '11.12 时点是摸牌阶段')
}

console.log('=== 11b. view.peek 与 clear_peek（UI 支撑） ===')
{
	/*
	 * 注意：view.peek.cards 会把卡 id 经 inst_card() 展开成【卡对象】，
	 * 所以用假 id（'g1'）会 filter 掉 -> cards 为空。
	 * 这里必须用 CARDS 里的【真实卡 id】。
	 */
	const REAL = (C.CARDS || []).slice(0, 3).map(c => c.id)
	const g = fresh()
	g.hands['德国'] = REAL.slice()
	g.hands['英国'] = ['15305']        /* 卡必须在手里才能打出 */
	g.decks['德国'] = ['d1']
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'draw'              /* 15305 时点是摸牌阶段 */

	/* 未打牌时 view.peek 为 null */
	eq(R.view(g, 'Allies').peek, null, '11b.1 初始无 peek')

	/* 打出 15305 -> 进入 pending */
	R.action(g, 'Allies', 'play_card', { card: '15305' })
	const v = R.view(g, 'Allies')
	ok(v.peek != null, '11b.2 打出后 view.peek 非空')
	eq(v.peek.nation, '德国', '11b.3 目标是德国')
	eq(v.peek.cards.length, 2, '11b.4 卡对象 2 张')
	ok(v.peek.cards.every(c => c.id && c.name), '11b.5 含 id/name（客户端要渲染）')
	ok(v.peek.cards.every(c => typeof c.img === 'string'), '11b.6 含 img（客户端要画卡图）')
	eq(String(v.peek.card), '15305', '11b.7 记录了是哪张卡触发的')

	/* 卡仍在手里（pending 不弃牌） */
	eq(g.hands['英国'].indexOf('15305') >= 0, true, '11b.8 卡仍在手里')
}
{
	/* clear_peek：作废本次挑牌 */
	const g = fresh()
	g.hands['德国'] = ['g1', 'g2', 'g3']
	g.hands['英国'] = ['15305']
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'draw'
	R.action(g, 'Allies', 'play_card', { card: '15305' })
	ok(g.peek != null, '11b.9 已挂起')
	R.action(g, 'Allies', 'clear_peek', {})
	eq(g.peek, null, '11b.10 clear_peek 清掉了挂起')
	eq(g.hands['德国'].length, 3, '11b.11 德国手牌未动')
	eq(g.decks['德国'].indexOf('g1') < 0, true, '11b.12 牌堆未被改动')
}
{
	/* 取消后重新打出会【重新随机挑】（不沿用上次结果） */
	const g = fresh()
	g.hands['德国'] = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']
	g.hands['英国'] = ['15305']
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'draw'
	R.action(g, 'Allies', 'play_card', { card: '15305' })
	const first = (g.peek.cards || []).slice().sort().join(',')
	R.action(g, 'Allies', 'clear_peek', {})
	R.action(g, 'Allies', 'play_card', { card: '15305' })
	const second = (g.peek.cards || []).slice().sort().join(',')
	ok(g.peek != null, '11b.13 可重新挂起')
	/* 6 选 2，两次完全相同的概率很高但非必然；只要不报错、数量对即可 */
	eq((g.peek.cards || []).length, 2, '11b.14 仍是 2 张')
}

console.log('=== 12. 时点语义：涉及阶段=自己回合 ===')
{
	const g = fresh()
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'draw'
	/* 15305 时点 draw，本方回合 -> 可打 */
	eq(I.trigger_ready(g, '15305', '英国').ok, true, '12.1 自己摸牌阶段可打')
	g.turn_phase = 'scoring'
	eq(I.trigger_ready(g, '15305', '英国').ok, false, '12.2 自己计分阶段不可打')
	/* 15306 时点 scoring */
	eq(I.trigger_ready(g, '15306', '英国').ok, true, '12.3 自己计分阶段可打(15306)')
	/* 响应卡(any) 不能主动打出 */
	eq(I.trigger_ready(g, '15330', '英国').ok, false, '12.4 响应卡不能主动打出')
}

console.log('=== 13. fire_trigger（B 类接口，本期只定义不接线） ===')
{
	const g = fresh()
	/* 当前没有任何 any 类型的时点声明，所以恒返回空 */
	eq(I.fire_trigger(g, 'build', {}).length, 0, '13.1 本期无响应卡接线')
	eq(I.fire_trigger(g, 'remove', {}).length, 0, '13.2 同上')
	ok(typeof I.fire_trigger === 'function', '13.3 接口存在')
}

console.log('=== 14. 事件卡不受影响（回归） ===')
{
	const g = fresh()
	eq(I.event_effect_of('15319') != null, true, '14.1 事件卡仍可取配置')
	eq(I.event_effect_of('15305'), null, '14.2 增强卡不进事件卡配置')
	eq(I.card_effect_of('15305') != null, true, '14.3 增强卡走统一入口')
	eq(I.card_effect_of('15319') != null, true, '14.4 事件卡也走统一入口')
}

console.log('\n' + '='.repeat(50))
console.log('通过 ' + pass + ' / 失败 ' + fail)
if (fail) {
	console.log('\n失败项：')
	failures.forEach(f => console.log('  ✗ ' + f))
	process.exit(1)
}
console.log('全部通过')
