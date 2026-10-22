/*
 * 回归：17837《KV-2 重型坦克》—— 攻击方"弃置 4 张手牌"必须【玩家自选】
 *
 * 玩家 2026-10-23 反馈："弃牌应该手牌自选"。
 * 修复前服务端直接 `discard_card(game, attacker, hand[0])` 循环 4 次
 * （等于替玩家挑手牌最前面 4 张），且【先消耗响应卡再校验】——
 * 一旦 drop 不足，卡已进弃牌堆，玩家既没弃成牌又丢了响应卡。
 *
 * 本测试锁死四条：
 *   A. 未带 drop         -> 拒绝 + 响应卡仍在桌面
 *   B. drop 数量不足      -> 拒绝 + 响应卡仍在桌面
 *   C. drop 4 张（非前 4）-> 弃的正是所选那 4 张（不是前 4 张）+ 卡被消耗
 *   D. 手牌不足 4 张      -> 按现有张数选（Math.min(4, len)）
 *
 * 用法：node tools/_smoke_17837_kv2_discard.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { data } = I

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const EAST = data.id_of('东欧')

function base(handCount) {
	const g = rules.setup(101, rules.default_scenario, {})
	for (const p in g.location) delete g.location[p]
	g.location['de1'] = EAST; g.piece_nation['de1'] = '德国'; g.piece_type['de1'] = 'army'
	g.location['su1'] = EAST; g.piece_nation['su1'] = '苏联'; g.piece_type['su1'] = 'army'

	/* 用真实卡实例 id 作手牌（discard_card 需要能查到卡） */
	const pool = (g.decks['德国'] || []).slice(0, 8)
	g.decks['德国'] = (g.decks['德国'] || []).slice(pool.length)
	g.hands['德国'] = pool.slice(0, handCount)

	g.table_responses = [{ card_id: '17837#9', card_face: '17837', owner_side: 'allies', nation: '苏联' }]
	g.pending_battle = {
		stage: 'kv2', attacker: '德国', defender_nation: '苏联', victim_nation: '苏联',
		victim: 'su1', space: EAST, kind: 'land',
		kv2_card: '17837#9', kv2_owner_nation: '苏联', attacker_piece: 'de1',
		attacker_piece: 'de1',
	}
	g.active = 'Axis'
	g.current_nation = '德国'
	g.turn_phase = 'play'
	g.log.length = 0
	return g
}

const handOf = (g) => (g.hands['德国'] || []).slice()
const kv2Left = (g) => (g.table_responses || []).filter(t => t.card_id === '17837#9').length
const lastLogs = (g, n) => (g.log || []).slice(-(n || 3)).join(' / ')

console.log('=== A. 未带 drop -> 拒绝，且响应卡仍在桌面 ===')
{
	const g = base(6)
	const before = handOf(g)
	rules.action(g, 'Axis', 'resolve_battle', { kv2: 'discard' })
	ok('手牌未变（服务端不再替玩家挑）', JSON.stringify(handOf(g)) === JSON.stringify(before),
		handOf(g).length + ' 张')
	ok('响应卡仍在桌面（校验前置于消耗）', kv2Left(g) === 1, 'left=' + kv2Left(g))
	ok('日志提示需弃置 4 张', /需弃置 4 张/.test(lastLogs(g, 4)), lastLogs(g, 2))
}

console.log('\n=== B. drop 数量不足 -> 拒绝，卡仍在 ===')
{
	const g = base(6)
	const before = handOf(g)
	rules.action(g, 'Axis', 'resolve_battle', { kv2: 'discard', drop: before.slice(0, 2) })
	ok('手牌未变', JSON.stringify(handOf(g)) === JSON.stringify(before))
	ok('响应卡仍在桌面', kv2Left(g) === 1, 'left=' + kv2Left(g))
}

console.log('\n=== C. drop 4 张（选后 4 张，不是前 4 张）===')
{
	const g = base(6)
	const before = handOf(g)
	const pick = before.slice(2, 6)          /* 故意跳过前 2 张 */
	const kept = before.slice(0, 2)
	rules.action(g, 'Axis', 'resolve_battle', { kv2: 'discard', drop: pick })
	ok('弃的正是所选 4 张（前 2 张仍在手里）',
		JSON.stringify(handOf(g)) === JSON.stringify(kept), JSON.stringify(handOf(g)))
	ok('所选 4 张已进弃牌堆',
		pick.every(id => (g.discard['德国'] || []).indexOf(id) >= 0), JSON.stringify(pick))
	ok('响应卡已被消耗', kv2Left(g) === 0, 'left=' + kv2Left(g))
	ok('日志记录弃置 4 张', /弃置 4 张手牌/.test(lastLogs(g, 5)), lastLogs(g, 2))
}

console.log('\n=== D. 手牌不足 4 张 -> 按现有张数选 ===')
{
	const g = base(2)
	const before = handOf(g)
	rules.action(g, 'Axis', 'resolve_battle', { kv2: 'discard', drop: before.slice() })
	ok('2 张全部弃掉', handOf(g).length === 0, handOf(g).length + ' 张')
	ok('日志记录弃置 2 张', /弃置 2 张手牌/.test(lastLogs(g, 5)), lastLogs(g, 2))
}

console.log('\n=== E. protect 分支不需要 drop（回归） ===')
{
	const g = base(6)
	const before = handOf(g)
	rules.action(g, 'Axis', 'resolve_battle', { kv2: 'protect' })
	ok('手牌未动', JSON.stringify(handOf(g)) === JSON.stringify(before))
	ok('响应卡被消耗', kv2Left(g) === 0, 'left=' + kv2Left(g))
	ok('注册了 protect 修饰器',
		(g.modifiers || []).some(m => m && m.key === 'protect' && String(m.card) === '17837'),
		JSON.stringify((g.modifiers || []).map(m => m && m.key)))
}

console.log('\n' + (fail ? 'FAIL / ' + fail : 'ALL PASS'))
process.exit(fail ? 1 : 0)
