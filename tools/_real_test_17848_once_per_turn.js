/*
 * S1 验证：17848《正面攻击》等"一回合一次"的状态卡，同一国家回合只能发动一次
 *
 *  A. 真实陆战触发 after_land → 卡被武装；发动成功后 status_used 记在【实例 id】上
 *  B. 同回合再打一场陆战 → 不得再次武装（once_per_turn + in-flight 双保险）
 *  C. 强制再发 activate_status → 被拒，且不白付代价
 *  D. 让权改写 current_nation → freq_key 不变（turn_owner 生效）
 *  E. 进入下一整轮 → 允许再次发动
 *  F. 静态守卫（三项代码标记）
 *
 * 用法：node tools/_real_test_17848_once_per_turn.js
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
const armed = (g, cid) => (g.status_instant || []).some(e => String(e.card_id) === String(cid))
const tableInst = g => (g.table['苏联'] || []).find(x => faceOf(x) === '17848')

function setup() {
	const g = R.setup(7)
	g.opening = null
	/* 苏联开局中立：先结束中立，否则 do_battle 会被静态拦截 */
	g.neutral = g.neutral || {}
	g.neutral['苏联'] = false
	I.refresh(g)
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	if (!(g.hands['苏联'] || []).some(x => faceOf(x) === '17848'))
		R.action(g, 'Allies', 'debug_add_card', { face: '17848', nation: '苏联', dest: 'hand' })
	I.refresh(g)
	const card = (g.hands['苏联'] || []).find(x => faceOf(x) === '17848')
	R.action(g, 'Allies', 'play_card', { card })
	I.refresh(g)
	R.action(g, 'Allies', 'debug_place', { piece: 'su_atk', nation: '苏联', type: 'army', space: d.id_of('罗斯') })
	I.refresh(g)
	I.grant_supply(g, 'su_atk', g.turn)
	I.refresh(g)
	return g
}

/* 打一场陆战（真实 do_battle）→ 触发 after_land */
function landBattle(g) {
	const deSp = I.get_connections(g, d.id_of('罗斯'), 'allies')
		.find(s => d.spaces[s] && d.spaces[s].terrain !== 'sea' &&
			!Object.keys(g.location).some(p => g.location[p] === s))
	const deId = 'de_t' + Math.random().toString(36).slice(2, 6)
	R.action(g, 'Axis', 'debug_place', { piece: deId, nation: '德国', type: 'army', space: deSp })
	I.refresh(g)
	I.grant_supply(g, deId, g.turn)
	I.refresh(g)
	const n0 = (g.log || []).length
	const r = I.do_battle(g, '苏联', deSp, deId, 'land', { from: 'su_atk' })
	return {
		log: logSince(g, n0) + (r && r.ok === false ? ' 【拒绝】' + r.reason : ''),
		space: deSp,
	}
}

console.log('=== A. 首次触发 + 发动 ===')
const g = setup()
let btA = null            /* A 段那场战斗的目标地区，C 段复用 */
{
	const card = tableInst(g)
	console.log('  17848（' + (g.table['苏联'] || []).length + ' 张桌面卡）实例 = ' + JSON.stringify(card))
	ok('17848 已上桌', !!card, JSON.stringify((g.table['苏联'] || []).map(faceOf)))
	btA = landBattle(g)
	console.log('  battle: ' + (btA.log || '(无日志)') + '  目标地区=' + d.name_of(btA.space))
	ok('★ 触发后卡被武装', armed(g, card), JSON.stringify((g.status_instant || []).map(e => e.card_id)))
	const n0 = (g.log || []).length
	/* 17848 的代价是【弃 2 张手牌】，必须随动作提交 */
	const pay = (g.hands['苏联'] || []).slice(0, 2)
	console.log('  代价手牌 = ' + JSON.stringify(pay))
	R.action(g, 'Allies', 'activate_status', { card, from: 'su_atk', space: btA.space, discard: pay })
	console.log('  activate: ' + logSince(g, n0))
	console.log('  status_used = ' + JSON.stringify(g.status_used))
	ok('★ 记账写在实例 id 上', (g.status_used || {})[String(card)] != null, JSON.stringify(g.status_used))
	const fk = (g.status_used || {})[String(card)]
	ok('★ 频率键后缀 = turn_owner', String(fk).split(':')[1] === (g.turn_owner || ''), String(fk) + ' vs ' + g.turn_owner)
}

console.log('\n=== B. 同回合再触发一场陆战：不得重新武装 ===')
{
	const card = tableInst(g)
	console.log('  battle: ' + (landBattle(g) || '(无日志)'))
	console.log('  status_instant = ' + JSON.stringify((g.status_instant || []).map(e => e.card_id)))
	ok('★★ 17848 未被重新武装（once_per_turn + in-flight）', !armed(g, card))
}

console.log('\n=== C. 强制再发 activate_status：应被拒 ===')
{
	const card = tableInst(g)
	const n0 = (g.log || []).length
	const dec0 = (g.decks['苏联'] || []).length
	R.action(g, 'Allies', 'activate_status', { card, from: 'su_atk', space: btA.space, discard: (g.hands['苏联'] || []).slice(0, 2) })
	const lg = logSince(g, n0)
	console.log('  log: ' + lg)
	ok('★★ 被拒绝（提示本回合已发动 / 窗口已过）', /已发动|本回合|已不可发动/.test(lg), lg)
	ok('★ 没有白扣代价（牌库张数不变）', (g.decks['苏联'] || []).length === dec0,
		dec0 + ' -> ' + (g.decks['苏联'] || []).length)
}

console.log('\n=== D. 让权改写 current_nation：freq_key 不变 ===')
{
	const cn0 = g.current_nation
	const fkBefore = I.freq_key(g)
	g.current_nation = '日本'
	g.active = 'Axis'
	I.refresh(g)
	const fkAfter = I.freq_key(g)
	console.log('  before=' + fkBefore + '  after=' + fkAfter + '  turn_owner=' + g.turn_owner + '  current_nation=日本')
	ok('★★ 让权后 freq_key 不变（用 turn_owner 而非 current_nation）', fkBefore === fkAfter, fkBefore + ' vs ' + fkAfter)
	g.current_nation = cn0
	g.active = 'Allies'
	I.refresh(g)
}

console.log('\n=== E. 进入下一整轮：允许再次发动 ===')
{
	const card = tableInst(g)
	g.turn += 1
	g.turn_owner = '苏联'
	I.refresh(g)
	console.log('  turn=' + g.turn + '  turn_owner=' + g.turn_owner)
	console.log('  battle: ' + (landBattle(g) || '(无日志)'))
	console.log('  status_instant = ' + JSON.stringify((g.status_instant || []).map(e => e.card_id)))
	ok('★ 新回合可以再次武装', armed(g, card), JSON.stringify((g.status_instant || []).map(e => e.card_id)))
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('freq_key 使用 turn_owner', /game\.turn_owner \|\| game\.current_nation/.test(src))
	ok('arm_status_instant 尊重 status_inflight', /game\.status_inflight/.test(src))
	ok('activate_status 期间设置 in-flight', /game\.status_inflight = String\(cardId\)/.test(src))
	ok('回合轮转写入 turn_owner', /game\.turn_owner = nextNation/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
