// 冒烟：15428《舰队决战》选项 B（玩家自选海域发起1次海战）
// 验证：① play_start 时在有可开战海域才弹出 15428
//       ② 触发后挂起，候选=所有「日本有发起单位的海域」
//       ③ 选定海域后真正发起海战（game.pending_battle.kind==='sea'）
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const data = require(path.join(__dirname, '..', 'data.js')).data

const game = rules.setup(12345, 'Standard', {})
I.ensure_markers(game)
game.current_nation = '日本'
game.turn_phase = 'play'
game.turn = 1
game.active = 'Axis'

// 找一对「陆地 S 邻接海域 T」，把日本陆军摆在 S 并补给
let S = null, T = null
for (let i = 1; i < data.spaces.length; i++) {
	const sp = data.spaces[i]
	if (!sp || sp.terrain !== 'land') continue
	const nbrs = I.get_connections(game, i, 'axis') || []
	for (const n of nbrs) {
		if (data.spaces[n] && data.spaces[n].terrain === 'sea') { S = i; T = n; break }
	}
	if (S) break
}
if (!S) { console.log('NO_LAND_SEA_PAIR'); process.exit(1) }
console.log('选地-海对:', data.spaces[S].name, '->', data.spaces[T].name)

const pid = 'testJpArmy#1'
game.location[pid] = S
game.piece_nation[pid] = '日本'
game.piece_type[pid] = 'army'
I.set_supply_point(game, S, 'axis', true)
I.compute_supply(game)

// 在目标海域放一艘敌舰 + 一架英机，使海战进入 defend 挂起（验证 pending_battle.kind==='sea'）
const eid = 'enemyNavy#1'
game.location[eid] = T
game.piece_nation[eid] = '英国'
game.piece_type[eid] = 'navy'
const aid = 'enemyAir#1'
game.location[aid] = T
game.piece_nation[aid] = '英国'
game.piece_type[aid] = 'air'

// 15428 暗置桌上（axis/日本）
game.table_responses = [
	{ card_id: '15428#1', owner_side: 'axis', nation: '日本', id: '15428#1' },
]

console.log('--- 入队 play_start ---')
const cands = I.request_responses(game, 'play_start', { nation: '日本' }, false)
const has15428 = !!(cands && cands.find(c => c.card_face === '15428'))
console.log('候选响应:', cands && cands.map(c => c.card_face))

console.log('--- 触发 trigger_response ---')
const g2 = rules.action(game, 'Axis', 'trigger_response', {})
const pc = (g2.response_stack || []).slice(-1)[0] || null
console.log('pending kind:', pc && pc.kind)
console.log('候选海域:', pc && pc.candidates && pc.candidates.map(c => c.name))

const feasIds = (pc && pc.candidates) ? pc.candidates.map(c => c.id) : []
const target = (feasIds.indexOf(T) >= 0) ? T : (pc && pc.candidates && pc.candidates[0] && pc.candidates[0].id)
console.log('选定海域:', data.spaces[target] && data.spaces[target].name)

console.log('--- 玩家选海域 -> 发起海战 ---')
const g3 = rules.action(g2, 'Axis', 'resolve_response_choice', { choice: target })
console.log('pending_battle:', g3.pending_battle && {
	kind: g3.pending_battle.kind,
	space: g3.pending_battle.space,
	name: data.spaces[g3.pending_battle.space] && data.spaces[g3.pending_battle.space].name,
})

const pass1 = has15428
const pass2 = !!(pc && pc.kind === 'space' && (pc.candidates || []).length > 0)
const pass3 = !!(g3.last_battle && g3.last_battle.kind === 'sea' && g3.last_battle.space === target)
const pass4 = !!(g3.pending_battle && g3.pending_battle.kind === 'sea')
console.log('---')
console.log('① 弹出 15428            :', pass1)
console.log('② 挂起候选海域          :', pass2, '(候选数', (pc && pc.candidates || []).length, ')')
console.log('③ last_battle 记海战    :', pass3, JSON.stringify(g3.last_battle))
console.log('④ pending_battle 已挂起 :', pass4)
console.log(pass1 && pass2 && pass3 && pass4 ? 'SMOKE_PASS' : 'SMOKE_FAIL')
