/*
 * 复现：15207《JU-52 空投补给》在"回合边界"弹窗后，操作权被还原到上一回合的阵营。
 *
 * 机理（与 17805 同源，但走的是 handoff 栈）：
 *   next_turn() 里：
 *       on_turn_start(game)                     ← 弹 turn_start 武装卡（15207）
 *       ...
 *       game.active = faction_role_of_nation(game.current_nation)   ← 36 行之后才重置
 *   弹窗那一刻 active 还是【上一回合】的阵营 → sync_armed_handoff 判定跨阵营
 *   → handoff_to('德国','armed') 把 _handoff_base 记成旧阵营
 *   → 玩家点"不打出" → reconcile_handoff → rectify_active 栈空 → active = _handoff_base（旧阵营）
 *   → current_nation 已是德国，active 却是 allies → 卡死
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const data = I.data

function section(t) { console.log('\n=== ' + t + ' ===') }

const g = rules.setup(9601, rules.default_scenario, {})
g.opening = null
g.turn_phase = 'play'

/* 模拟"美国回合刚结束、轮到新一轮德国"的时序：current_nation 已切到德国，active 还是上一回合的 allies */
g.turn = 3
g.nations_done = 6
g.current_nation = '德国'
g.active = 'allies'

/* 场上有德国空军（15207 的 cond 要求） */
const airSpace = data.id_of('东欧') || data.id_of('西欧')
const pid = 'pAirDE'
g.location[pid] = airSpace
g.piece_nation[pid] = '德国'
g.piece_type[pid] = 'air'

/* 德国手牌放 15207 */
g.hands['德国'] = ['15207#1'].concat((g.hands['德国'] || []).slice(0, 4))

section('① 调用 on_turn_start（真实引擎函数）')
I.on_turn_start(g)
console.log('current_nation =', g.current_nation)
console.log('active         =', g.active)
console.log('_handoff_base  =', g._handoff_base)
console.log('handoff_stack  =', JSON.stringify(g.handoff_stack))
console.log('armed_offers   =', JSON.stringify((g.armed_offers || []).map(w => ({
	when: w.when, nation: w.nation, cards: (w.cards || []).map(c => c.card_id),
}))))

section('② 模拟 next_turn 后续那行（21860）')
g.active = 'axis'
console.log('active 被重置为 =', g.active, '（这是回合推进的正常结果）')

section('③ 德国点「不打出」(skip_armed_offer)')
const r = rules.action(g, 'Axis', 'skip_armed_offer', {})
console.log('日志尾部：', (r.log || []).slice(-2).join(' | '))
console.log('current_nation =', r.current_nation)
console.log('active         =', r.active)
console.log('_handoff_base  =', r._handoff_base)
console.log('handoff_stack  =', JSON.stringify(r.handoff_stack))
console.log('armed_offers 剩 =', (r.armed_offers || []).length)

section('④ 判定')
const ok = (r.current_nation === '德国' && r.active === 'axis')
console.log('期望：current_nation=德国, active=axis')
console.log('实际：current_nation=' + r.current_nation + ', active=' + r.active)
console.log('判定：' + (ok ? '正常' : '【BUG 复现】active 被还原成上一回合阵营 → 轴心视角"等待对方行动"'))

/* ⑤ 若复现，再看能否自愈 */
section('⑤ 轴心视角 is_my_turn')
try {
	const v = rules.view(r, 'Axis')
	console.log('my_nation =', v.my_nation, '| active =', v.active, '| current_nation =', v.current_nation)
	console.log('actions =', JSON.stringify(v.actions))
	console.log('block_reason =', v.block_reason)
	console.log('顶部提示 =', JSON.stringify(v.waiting || null))
} catch (e) {
	console.log('view 抛错：', e.message)
}
