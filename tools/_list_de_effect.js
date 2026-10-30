const path = require('path')
const M = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'cards.js'))
console.log('module keys:', Object.keys(M).slice(0, 8))
const all = M.CARDS ? Object.values(M.CARDS) : (Array.isArray(M) ? M : Object.values(M))
console.log('count', all.length, 'sample', JSON.stringify(all[0]).slice(0, 160))
const de = all.filter(c => c && c.type === 'EFFECT' && (c.nation === '德国' || /德国/.test(c.nation || '')))
console.log('\n德国 EFFECT:')
for (const c of de) console.log(c.id + ' ' + c.name + ' | ' + String(c.text || '').slice(0, 46))
