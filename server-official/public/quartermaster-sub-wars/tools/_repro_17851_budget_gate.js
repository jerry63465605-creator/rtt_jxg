/*
 * 复现：17851《天王星行动》选「发起陆战」进入战斗预算(event_budget)后，
 * 是否还能打出其它牌。
 *
 * 与 17852 的区别：
 *   17852 → pending_status_play（build_actions 提前 return 独立白名单，冻结有效）
 *   17851 → 选 battle 后清掉 pending_uranus、只留 event_budget
 *           build_actions 对 event_budget 是【追加】event_battle/event_finish，
 *           不撤销常规出牌权 → 可能仍能 play_card。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const data = I.data
const { CARDS } = require(path.join(__dirname, '..', 'cards.js'))

function section(t) { console.log('\n=== ' + t + ' ===') }

const g = rules.setup(9501, rules.default_scenario, {})
g.opening = null
g.turn_phase = 'play'
g.active = 'allies'
g.current_nation = '苏联'

/* 清掉苏联现有部队，改放 2 支到乌克兰相邻陆地 */
for (const pid of Object.keys(g.location)) {
	if (g.piece_nation[pid] === '苏联') delete g.location[pid]
}
const uk = data.id_of('乌克兰')
const nb = (data.spaces[uk].connections || []).filter(id => data.spaces[id] && data.spaces[id].terrain === 'land')
console.log('乌克兰 id =', uk, '| 相邻陆地 =', nb.map(id => data.name_of(id)).join(','))

let n = 0
for (const sp of nb) {
	if (n >= 2) break
	const pid = 'pS' + (n + 1)
	g.location[pid] = sp
	g.piece_nation[pid] = '苏联'
	g.piece_type[pid] = 'army'
	n++
}
I.compute_supply(g)

/* 手牌：17851 + 一张苏联事件 */
const other = CARDS.find(c => c.nation === '苏联' && c.type === 'EVENT' && String(c.id) !== '17851')
g.hands['苏联'] = ['17851#1', String(other.id) + '#1']
console.log('手牌 =', JSON.stringify(g.hands['苏联']), '| 第二张 =', other.id, other.name)

section('① 打出 17851')
const r1 = rules.action(g, 'Allies', 'play_card', { card: '17851#1' })
console.log('pending_uranus =', JSON.stringify(r1.pending_uranus))
console.log('日志尾部：', (r1.log || []).slice(-2).join(' | '))

section('② 选「发起陆战」(uranus_choice: battle)')
const r2 = rules.action(r1, 'Allies', 'uranus_choice', { choice: 'battle' })
console.log('pending_uranus =', JSON.stringify(r2.pending_uranus))
console.log('event_budget =', JSON.stringify(r2.event_budget && {
	card: r2.event_budget.card_id, source: r2.event_budget.source,
	remaining: r2.event_budget.remaining, uranus_remaining: r2.event_budget.uranus_remaining,
}))
console.log('turn_phase =', r2.turn_phase)

section('③ view.actions（苏联视角）')
const v = rules.view(r2, 'Allies')
console.log('actions =', JSON.stringify(v.actions))
console.log('block_reason =', v.block_reason)
console.log('play_card 在白名单：', !!(v.actions && v.actions.play_card))
console.log('event_battle / event_finish：', !!(v.actions && v.actions.event_battle), !!(v.actions && v.actions.event_finish))

section('④ 直接提交第二张事件 play_card')
const r3 = rules.action(r2, 'Allies', 'play_card', { card: String(other.id) + '#1' })
const tail = (r3.log || []).slice(-3)
for (const l of tail) console.log('  ' + l)
console.log('第二张还在手牌吗：', (r3.hands['苏联'] || []).indexOf(String(other.id) + '#1') >= 0)
console.log('判断：' + (tail.some(l => /等待|不能|只能|请先|预算/.test(l))
	? '服务端【拦截】了第二张'
	: '服务端【放行】了第二张 —— BUG'))

section('⑤ 状态汇总')
console.log('event_budget 仍在：', !!r3.event_budget)
console.log('pending_uranus：', JSON.stringify(r3.pending_uranus))
