const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const g = rules.setup(1)
const seaId = 40
g.location = g.location || {}; g.piece_nation = g.piece_nation || {}; g.piece_type = g.piece_type || {}
const enemyId = 'TEST_US_NAVY_40'
g.location[enemyId] = seaId
g.piece_nation[enemyId] = '美国'
g.piece_type[enemyId] = 'navy'
g.current_nation = '日本'; g.active = 'Axis'
// 设 pending 为奇袭海战选择窗口
g.pending_response_choice = {
	card_id: '15430', card_face: '15430', name: '奇袭', owner_side: 'axis',
	kind: 'space', candidates: [{ id: seaId, name: '东海' }],
	prompt: '选择要发起海战的海域', ctx: { nation: '日本', space: seaId, kind: 'sea' },
	extra: { step: 'sea' },
}
const r = rules.action(g, 'Axis', 'resolve_response_choice', { choice: seaId })
const pc = g.pending_response_choice
console.log('海战结果 pending:', pc ? JSON.stringify({ kind: pc.kind, step: pc.extra && pc.extra.step, prompt: pc.prompt && pc.prompt.slice(0, 30) }) : 'null')
console.log('队列长度:', (g.response_queue || []).length)
