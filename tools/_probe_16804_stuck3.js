/* 检查：窗口开着时，各种"排他挂起"是否会把美国的 use_armed_offer 从 build_actions 里挤掉 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const CE = d.id_of('中国东部')

function sceneJP() {
	const g = new_board(20261108, { nation: '英国', phase: 'play' })
	give(g, '16804', '美国')
	I.refresh(g)
	for (const p of I.pieces_on(g, CE)) R.action(g, 'Axis', 'debug_remove', { piece: p })
	I.refresh(g)
	place(g, 'jp_ce', '日本', 'army', '中国东部')
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	I.offer_armed_effects(g, 'after_build_army', { space: CE, nation: '日本', type: 'army', piece_id: 'jp_ce' })
	I.refresh(g)
	return g
}

const acts = g => Object.keys(R.view(g, 'Allies').actions || {}).filter(k => /armed|skip/.test(k))

console.log('=== 基线（无其它挂起）===')
{
	const g = sceneJP()
	console.log('  Allies 可发 = ' + JSON.stringify(acts(g)))
}

const cases = [
	['pending_event_step（事件分步未结束）', g => { g.pending_event_step = { op: 'build', nation: '日本', done: 0, steps: [], kind: 'test' } }],
	['event_budget（战斗/建设预算）', g => { g.event_budget = { nation: '日本', remaining: 1, kind: 'battle' } }],
	['pending_battle（战斗待应答）', g => { g.pending_battle = { stage: 'defend', space: CE, attacker: '日本', defender: '中国', kind: 'land' } }],
	['pending_echo（选地区挂起）', g => { g.pending_echo = { kind: 'echo_need', step: 'space', card: '15400#1', cands: [CE] } }],
	['pending_autobahn（高速公路）', g => { g.pending_autobahn = { nation: '德国', steps: [], done: 0 } }],
	['pending_theater（战区移动）', g => { g.pending_theater = { nation: '美国', done: 0, steps: [] } }],
	['status_instant 待应答', g => { g.status_instant = [{ nation: '日本', card_id: '15408#1', window: 'after_build_army' }] }],
]

for (const [name, mut] of cases) {
	const g = sceneJP()
	try { mut(g) } catch (e) { console.log('  ' + name + ' → 构造失败：' + e.message); continue }
	I.refresh(g)
	console.log('  ' + name.padEnd(30, ' ') + ' → 美国可发 = ' + JSON.stringify(acts(g)))
}

console.log('\n=== 若 actions 为空，客户端是否会静默不发 ===')
{
	const src = require('fs').readFileSync(path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars', 'play.js'), 'utf8')
	const m = src.match(/function send_action\([\s\S]{0,500}?\n\}/)
	console.log(m ? m[0].split('\n').slice(0, 18).join('\n') : '(未找到 send_action)')
}
