const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const g = R.setup(7); g.opening = null; I.refresh(g)
for (const nm of ['中国东部', '中国西部', '中国东北']) {
	const id = d.id_of(nm)
	console.log(nm + '(' + id + ')')
	console.log('   allies 视角: ' + (I.get_connections(g, id, 'allies') || []).map(x => d.name_of(x)).join(', '))
	console.log('   axis   视角: ' + (I.get_connections(g, id, 'axis') || []).map(x => d.name_of(x)).join(', '))
}
