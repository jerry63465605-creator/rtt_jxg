const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal
const EE = I.ECHO_EFFECTS || {}
console.log('英国 EFFECT 中在 ECHO_EFFECTS 有的：')
for (const f of ['15305', '15306', '15311', '15352', '15353', '15355']) {
	const e = EE[f]
	console.log('  ' + f + ' ' + (e ? ('keys=' + Object.keys(e).join(',') + '  desc=' + String(e.desc || '').slice(0, 40)) : '（无配置）'))
}
/* 试打 15311（任意时机） */
const g = R.setup(1)
g.opening = null
g.current_nation = '英国'; g.active = 'Allies'; g.turn_phase = 'play'
g.hands['英国'] = ['15311#1', '15341#7', '15342#8', '15343#9', '15344#10']
g.hands['意大利'] = ['16700#1', '15341#11']
g.decks['意大利'] = ['15345#80', '15345#81']
const n0 = (g.log || []).length
R.action(g, 'Allies', 'play_card', { card: '15311#1' })
console.log('\n打 15311: ' + (g.log || []).slice(n0).join(' | '))
console.log('armed_offers=', JSON.stringify((g.armed_offers || []).map(w => w.when + '@' + w.nation)))
