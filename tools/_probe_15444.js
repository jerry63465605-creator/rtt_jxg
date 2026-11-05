/* B5 只读排查：15444《丘克群岛》——"被占领后失效"到底哪一层断了 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const nm = x => d.name_of(Number(x))
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const portAs = g => JSON.stringify((g.status_aura || {}).port_as)

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15444', nation: '日本', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15403', nation: '日本', dest: 'hand' })   /* 建设海军（日本基本卡） */
	I.refresh(g)
	return g
}

function buildNavy(g) {
	const c = (g.hands['日本'] || []).find(x => /^1540[0-9]/.test(String(x)) && /建设海军/.test((I.inst_card(x) || {}).name || ''))
	if (!c) {
		console.log('  （手上没有《建设海军》，列出日本手牌：' + JSON.stringify((g.hands['日本'] || []).map(x => (I.inst_card(x) || {}).name)) + '）')
		return null
	}
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: c, space: d.id_of('硫磺岛') })
	return logSince(g, n0)
}

const g = setup()
const iwo = d.id_of('硫磺岛')
console.log('硫磺岛 id=' + iwo + ' 相邻=' + JSON.stringify((d.spaces[iwo].connections || []).map(nm)))

const card = (g.hands['日本'] || []).find(x => String(x).startsWith('15444'))
let n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card })
console.log('\n=== 打出 15444 ===')
console.log('  log: ' + logSince(g, n0))
console.log('  table 日本 = ' + JSON.stringify(g.table['日本']))
console.log('  port_as = ' + portAs(g))

console.log('\n=== 占领前：在硫磺岛建海军 ===')
console.log('  log: ' + (buildNavy(g) || '(跳过)'))
console.log('  port_as = ' + portAs(g) + '  硫磺岛部队 = ' + JSON.stringify(I.pieces_on(g, iwo)))

console.log('\n=== 美国陆军占领硫磺岛 ===')
R.action(g, 'Allies', 'debug_place', { piece: 'us_a', nation: '美国', type: 'army', space: iwo })
I.refresh(g)
console.log('  硫磺岛部队 = ' + JSON.stringify(I.pieces_on(g, iwo).map(p => p + '(' + g.piece_nation[p] + '/' + g.piece_type[p] + ')')))
console.log('  port_as = ' + portAs(g))
console.log('  table 日本 = ' + JSON.stringify(g.table['日本']))

/* 计分：占领后相邻是否还有日本海军 */
const cfg = I.STATUS_EFFECTS['15444']
console.log('  计分 auto = ' + (() => { try { return cfg.auto.run(g, '日本') } catch (e) { return 'ERR ' + e.message } })())
console.log('  相邻格日本海军 = ' + JSON.stringify((d.spaces[iwo].connections || []).map(s => ({
	name: nm(s), navy: I.pieces_on(g, s).filter(p => g.piece_nation[p] === '日本' && g.piece_type[p] === 'navy').length,
}))))
