const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
const i = t.findIndex(l => l.indexOf('function battle_initiators') === 0)
console.log('=== battle_initiators (' + (i + 1) + ') ===')
console.log(t.slice(i, i + 30).join('\n'))

/* 实测：中国东部(补给点)有中国陆军，目标中国东北有日军 */
const d = I.data
const g = R.setup(7)
g.opening = null
g.location = {}; g.piece_nation = {}; g.piece_type = {}
const put = (id, n, ty, sp) => { g.location[id] = d.id_of(sp); g.piece_nation[id] = n; g.piece_type[id] = ty }
put('p9', '中国', 'army', '中国东部')
put('jp', '日本', 'army', '中国东北')
I.refresh(g)
const sup = I.compute_supply(g)
console.log('\np9@中国东部 in_supply=' + !!(sup.in_supply || {})['p9'])
console.log('battle_initiators(g,中国,中国东北) = ' +
	JSON.stringify(I.battle_initiators(g, '中国', d.id_of('中国东北'))))
console.log('battle_initiators_at 存在? ' + typeof I.battle_initiators_at)
if (I.battle_initiators_at)
	console.log('  at = ' + JSON.stringify(I.battle_initiators_at(g, '中国', d.id_of('中国东北'), 'land')))
