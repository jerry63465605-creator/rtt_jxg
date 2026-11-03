/* 反向验证：15410 武士道 guard 阶段，同盟是否也能看到日本手牌（同一行代码的反方向泄漏） */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const g = R.setup(7)
g.opening = null
I.refresh(g)

/* 日本：装载 15410（load 型）；持 1 张响应卡作代价 */
R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
let c = (g.hands['日本'] || []).find(x => faceOf(x) === '15410')
if (!c) {
	R.action(g, 'Axis', 'debug_add_card', { face: '15410', nation: '日本', dest: 'hand' })
	I.refresh(g)
	c = (g.hands['日本'] || []).find(x => faceOf(x) === '15410')
}
R.action(g, 'Axis', 'play_card', { card: c })
console.log('装载 15410: ' + logSince(g, 0).slice(-80))

/* 日本陆军在某格；英国陆军相邻，发起攻击 */
const jpSp = Object.keys(d.spaces).map(Number).find(s => /日本|中国北部|满洲/.test(d.name_of(s)))
const jpEmpty = jpSp != null && !Object.keys(g.location).some(p => g.location[p] === jpSp)
const target = jpEmpty ? jpSp : Object.keys(d.spaces).map(Number).find(s => /中国/.test(d.name_of(s)))
let ukSp = null
for (const nb of I.get_connections(g, target, 'allies')) {
	if (d.spaces[nb] && d.spaces[nb].terrain !== 'sea' && !Object.keys(g.location).some(p => g.location[p] === nb)) { ukSp = nb; break }
}
R.action(g, 'Axis', 'debug_place', { piece: 'jp_a1', nation: '日本', type: 'army', space: target })
R.action(g, 'Allies', 'debug_place', { piece: 'uk_a1', nation: '英国', type: 'army', space: ukSp })
I.refresh(g)
I.grant_supply(g, 'uk_a1', g.turn)
I.refresh(g)

const n0 = (g.log || []).length
const r = I.do_battle(g, '英国', target, 'jp_a1', 'land', { from: 'uk_a1' })
console.log('攻击 ' + d.name_of(target) + ': ' + logSince(g, n0) + (r && r.ok === false ? ' 【拒绝】' + r.reason : ''))
console.log('pending_battle.stage = ' + JSON.stringify((g.pending_battle || {}).stage))

const vX = R.view(g, 'Axis'), vA = R.view(g, 'Allies')
for (const [tag, v] of [['Axis', vX], ['Allies', vA]]) {
	const leak = Object.keys(v.hands || {}).filter(n => v.hands[n] && v.hands[n].cards)
	console.log('  [' + tag + '] my_nation=' + v.my_nation + '  能看到牌面的国家=' + JSON.stringify(leak) +
		'  pending_battle=' + (v.pending_battle ? v.pending_battle.stage : 'null'))
}
