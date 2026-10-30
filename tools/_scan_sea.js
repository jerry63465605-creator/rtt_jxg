const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const g = rules.setup(1)
const seas = []
for (let i = 1; i < I.data.spaces.length; i++) {
	const sp = I.data.spaces[i]
	if (sp && sp.terrain === 'sea') {
		const inits = I.battle_initiators(g, '日本', i)
		if (inits.length) seas.push({ id: i, name: sp.name, inits: inits.map(x => x.space_name + ':' + x.type).join(',') })
	}
}
console.log('可行日本海战海域数:', seas.length)
console.log(seas.slice(0, 8).map(s => `${s.id} ${s.name} [${s.inits}]`).join('\n'))
