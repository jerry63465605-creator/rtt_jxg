/*
 * 回归测试：15333《配给》
 *
 * 玩家 2026-10-22 口径：
 *   1. 正常打出 / 额外打出 -> 算；因国家技能弃牌或代价弃牌进堆 -> 不算。
 *   2. 状态卡"打出"与"发动效果" -> 排除（卡不在弃牌堆）。
 *   3. 不加"每回合一次"。
 *   4. 响应卡发效果进弃牌堆时 -> 也应能触发。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_15333.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { CARDS } = require(path.join(MOD, 'cards.js'))

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

function base() {
	let g = rules.setup(1)
	g.opening = null
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.table_responses = []
	g.discard['英国'] = g.discard['英国'] || []
	/* 英国持有 15333（暗置于响应区） */
	g.table_responses.push({ card_id: '15333#1', owner_side: 'allies', nation: '英国', id: '15333#1' })
	return g
}
function hit15333(g, ctx) {
	return I.fire_trigger(g, 'play_card', ctx).some(x => String(x.card_face) === '15333')
}

const BRIT_EVENT = CARDS.find(c => c.nation === '英国' && c.type === 'EVENT')
const BRIT_STATUS = CARDS.find(c => c.nation === '英国' && c.type === 'STATUS')
const BRIT_RESP = CARDS.find(c => c.nation === '英国' && c.type === 'RESPONSE' && c.id !== 15333)
const GER_EVENT = CARDS.find(c => c.nation === '德国' && c.type === 'EVENT')
console.log('样本: EVENT=' + BRIT_EVENT.id + ' STATUS=' + (BRIT_STATUS && BRIT_STATUS.id) +
	' RESPONSE=' + (BRIT_RESP && BRIT_RESP.id) + ' 德国EVENT=' + GER_EVENT.id)

console.log('\n=== A. 触发过滤矩阵 ===')
{
	const g = base()

	const evInst = BRIT_EVENT.id + '#1'
	g.discard['英国'].push(evInst)
	ok('英国 EVENT 已进弃牌堆 -> 命中', hit15333(g, { nation: '英国', card: evInst, card_obj: BRIT_EVENT }))

	if (BRIT_STATUS) {
		const stInst = BRIT_STATUS.id + '#1'
		g.discard['英国'].push(stInst)
		ok('英国 STATUS（即便在弃牌堆）-> 不命中（类型排除）',
			!hit15333(g, { nation: '英国', card: stInst, card_obj: BRIT_STATUS }))
	}

	ok('from_status（状态卡发动）-> 不命中',
		!hit15333(g, { nation: '英国', card: evInst, card_obj: BRIT_EVENT, from_status: true }))

	const evNotInDiscard = BRIT_EVENT.id + '#2'
	ok('英国卡但不在弃牌堆（如 17844 回手/被拦截）-> 不命中',
		!hit15333(g, { nation: '英国', card: evNotInDiscard, card_obj: BRIT_EVENT }))

	const deInst = GER_EVENT.id + '#1'
	g.discard['德国'] = [deInst]
	ok('非英国卡进堆 -> 不命中', !hit15333(g, { nation: '德国', card: deInst, card_obj: GER_EVENT }))

	if (BRIT_RESP) {
		const rpInst = BRIT_RESP.id + '#1'
		g.discard['英国'].push(rpInst)
		ok('英国 RESPONSE 发效果进弃牌堆 -> 命中（口径#4）',
			hit15333(g, { nation: '英国', card: rpInst, card_obj: BRIT_RESP }))
	}

	/* 15333 已被消费（不在响应区）后不应再命中 —— 防自回收/递归 */
	g.table_responses = []
	ok('15333 不在响应区 -> 不再命中', !hit15333(g, { nation: '英国', card: evInst, card_obj: BRIT_EVENT }))
}

console.log('\n=== B. impl：洗回牌堆 / 找不到如实失败 ===')
{
	const g = base()
	const inst = BRIT_EVENT.id + '#7'
	g.discard['英国'].push(inst)
	const r = I.RESPONSE_EFFECT_IMPL['15333'](g, 'allies', { nation: '英国', card: inst }, null)
	ok('impl 返回 ok', !!(r && r.ok), JSON.stringify(r))
	ok('已从弃牌堆移除', (g.discard['英国'] || []).indexOf(inst) < 0)
	ok('已进英国牌堆', (g.decks['英国'] || []).indexOf(inst) >= 0,
		'deck含=' + (g.decks['英国'] || []).includes(inst))

	const r2 = I.RESPONSE_EFFECT_IMPL['15333'](g, 'allies', { nation: '英国', card: inst }, null)
	ok('找不到时返回 ok:false（不再假报成功）', !!(r2 && !r2.ok), JSON.stringify(r2))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
