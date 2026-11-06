/* 用【真实卡实例】的 ctx 造窗口，再看调试动作是否还会清掉；并找出 action 尾巴里的剪枝代码 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const ao = g => JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, n: (w.cards || []).length })))

console.log('=== action 尾巴里的 armed_offers 赋值点 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
	src.forEach((l, i) => { if (/armed_offers\s*=/.test(l) && !/^\s*\*/.test(l)) console.log('  L' + (i + 1) + ': ' + l.trim().slice(0, 110)) })
}

function setup() {
	const g = R.setup(20261107)
	g.pending_battle = null; g.armed_offers = []; g.response_queue = []; g.response_stack = []
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	/* 真实实例：英国 15352 + 德国 15205（作为"敌方打出的增强卡"） */
	R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15205', nation: '德国', dest: 'hand' })
	I.refresh(g)
	const de = (g.hands['德国'] || []).find(x => faceOf(x) === '15205')
	I.offer_armed_effects(g, 'enemy_echo_played', {
		nation: '德国', card: de, piece_nation: '德国', space: null, via: 'play', window: 'enemy_echo_played',
	})
	I.refresh(g)
	return { g, de }
}
{
	const { g, de } = setup()
	console.log('\n真实 ctx card = ' + de)
	console.log('初始 = ' + ao(g))
	R.action(g, 'Allies', 'debug_attrition', { n: 1 })
	console.log('损耗后 = ' + ao(g))
}
