/*
 * 复现 #4：战区移动（17532）分步建设中，先进造船厂（17550，STATUS after_build_navy）能不能触发？
 *
 * 步骤：美国桌面已有 17550 → 打出 17532（choice=0 先海军）→ resolve_theater 移除1支陆军/海军
 *       → resolve_theater 建海军 → 看 status_instant / view.table_status / activate_status 可用性
 *
 * 用法：node tools/_probe_theater_17550.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))

const g = R.setup(7)
g.opening = null
g.current_nation = '美国'
g.active = 'Allies'
g.turn_phase = 'play'
g.neutral = {}
g.hands['美国'] = ['17532#1', '15345#9']
g.decks['美国'] = ['15345#1', '15345#2', '15345#3']
/* 桌面放 17550（已打出、激活） */
g.table = g.table || {}
g.table['美国'] = ['17550#1']
/* 给美国一支陆军当"移除"目标，并保证有可建海军的海域 */
g.location = {}
g.piece_nation = {}
g.piece_type = {}
/* 先放一支美国陆军在<夏威夷>（补给点，保证能作为建设支点） */
const HAW = d.id_of('夏威夷')
g.location['us_a'] = HAW
g.piece_nation['us_a'] = '美国'
g.piece_type['us_a'] = 'army'
/* 第二支陆军（放本土）专门当"移除"代价，避免把建设支点拆掉 */
g.location['us_b'] = d.id_of('美国')
g.piece_nation['us_b'] = '美国'
g.piece_type['us_b'] = 'army'
I.refresh(g)

const seaCands = []
for (let i = 1; i < d.spaces.length; i++) {
	if (!d.spaces[i]) continue
	if (d.spaces[i].terrain !== 'sea') continue
	if (!I.can_build_at(g, '美国', i, 'navy').ok) continue
	seaCands.push(i)
}
const home = HAW
console.log('美国陆军@' + NM(home) + '  可建海军海域候选=' + seaCands.length +
	'（' + seaCands.slice(0, 5).map(NM).join(',') + '）')

console.log('\n=== 桌面状态卡 ===')
console.log('  table.美国 = ' + JSON.stringify(g.table['美国']))
const ts = (R.view(g, 'Allies').table_status || [])
console.log('  view.table_status = ' + JSON.stringify(ts.map(x => ({
	card: x.card_id, name: x.name, ready: x.ready, window: x.window,
}))))

console.log('\n=== 打出 17532（choice=0 先海军） ===')
let n0 = (g.log || []).length
R.action(g, 'Allies', 'play_card', { card: '17532#1', choice: 0 })
console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
console.log('  pending_theater=' + JSON.stringify(g.pending_theater && {
	stage: g.pending_theater.stage, order: g.pending_theater.order, built: g.pending_theater.built,
}))

console.log('\n=== 第 1 步：移除 1 支美国陆军 ===')
n0 = (g.log || []).length
R.action(g, 'Allies', 'resolve_theater', { piece: 'us_b' })
console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
console.log('  stage=' + (g.pending_theater && g.pending_theater.stage))

console.log('\n=== 第 2 步：建海军（这一步应武装 17550 的 after_build_navy 窗口） ===')
n0 = (g.log || []).length
const sea = seaCands.find(x => Number(x) === Number(home)) != null ? seaCands[0] : seaCands[0]
R.action(g, 'Allies', 'resolve_theater', { space: sea })
console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
console.log('  stage=' + (g.pending_theater && g.pending_theater.stage))
console.log('  status_instant = ' + JSON.stringify(g.status_instant || []))
console.log('  status_used = ' + JSON.stringify(g.status_used || {}))

const v = R.view(g, 'Allies')
console.log('\n=== 建完海军后的客户端可用性 ===')
console.log('  view.table_status(17550) = ' + JSON.stringify(
	(v.table_status || []).filter(x => String(x.card_id).indexOf('17550') === 0).map(x => ({
		card: x.card_id, ready: x.ready, reason: x.reason, window: x.window,
	}))))
const acts = v.actions || {}
console.log('  actions.activate_status = ' + JSON.stringify(acts.activate_status))
console.log('  actions 里有 resolve_theater? ' + !!acts.resolve_theater)

console.log('\n=== 直接尝试发动 17550 ===')
n0 = (g.log || []).length
R.action(g, 'Allies', 'activate_status', { card: '17550#1' })
console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
