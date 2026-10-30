/*
 * 探查 15315《阿拉曼战役》征召步是否有客户端选择（用户反馈：没有选择，默认中东）
 *
 * 范式 B（rtt-realboard-test §7）：debug_* 布阵 + 真实 play_card 驱动
 *
 * 用法：node tools/_probe_15315_alamein.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const piecesAt = (g, name) => {
	const sid = d.id_of(name)
	return Object.keys(g.location).filter(p => g.location[p] === sid)
}

console.log('=== 地区 id ===')
const NA = d.id_of('非洲北部'), ME = d.id_of('中东')
console.log('  非洲北部=', NA, ' 中东=', ME)
console.log('  相邻(同盟视角)=', JSON.stringify(I.get_connections({}, NA, 'allies').map(x => d.name_of(x))))

const g = R.setup(7)
g.opening = null
I.refresh(g)

/* ① 英国出牌阶段；② 非洲北部放 1 支德国陆军（被消灭目标）；③ 发 15315 给英国 */
R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_na', nation: '德国', type: 'army', space: NA })
R.action(g, 'Allies', 'debug_add_card', { face: '15315', nation: '英国', dest: 'hand' })
I.refresh(g)

const card = (g.hands['英国'] || []).find(x => faceOf(x) === '15315')
console.log('\n=== 布阵 ===')
console.log('  15315 在手=', !!card, ' 德国陆军@非洲北部=', piecesAt(g, '非洲北部').length)
console.log('  中东现有部队=', piecesAt(g, '中东').map(p => g.piece_nation[p] + '/' + g.piece_type[p]))
console.log('  非洲北部现有部队=', piecesAt(g, '非洲北部').map(p => g.piece_nation[p] + '/' + g.piece_type[p]))

/* ④ 服务端算出的征召候选（直接问 steps 机器，与执行同源） */
console.log('\n=== 征召步候选（服务端视角）===')
for (const nm of ['中东', '非洲北部']) {
	const chk = I.can_recruit_at(g, '英国', d.id_of(nm), 'army')
	console.log('  can_recruit_at(' + nm + ') = ' + JSON.stringify(chk))
}

/* ⑤ 真实打出 */
console.log('\n=== 真实 play_card 15315 ===')
let n0 = (g.log || []).length
R.action(g, 'Allies', 'play_card', { card })
console.log('  log: ' + logSince(g, n0))
console.log('  pending_event_step=', JSON.stringify(g.pending_event_step))
console.log('  pending_echo=', JSON.stringify(g.pending_echo))
console.log('  event_budget=', JSON.stringify(g.event_budget && {
	card: g.event_budget.card, step: g.event_budget.step, targets: g.event_budget.targets,
}))
const v = R.view(g, 'Allies')
console.log('  view.pending_event_step=', JSON.stringify(v.pending_event_step))
console.log('  view.event_budget=', JSON.stringify(v.event_budget && {
	card: v.event_budget.card, need: v.event_budget.need, targets: v.event_budget.targets,
}))
console.log('  征召后：中东=', piecesAt(g, '中东').map(p => g.piece_nation[p] + '/' + g.piece_type[p]),
	' 非洲北部=', piecesAt(g, '非洲北部').map(p => g.piece_nation[p] + '/' + g.piece_type[p]))
console.log('  15315 去向: 弃牌堆=', (g.discard['英国'] || []).indexOf(card) >= 0,
	' 仍在手=', (g.hands['英国'] || []).indexOf(card) >= 0)
