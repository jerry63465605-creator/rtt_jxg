const path = require('path')
const C = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'cards.js'))
const all = Object.values(C.CARD_BY_ID)
const uk = all.filter(c => c.type === 'EFFECT' && c.nation === '英国')
console.log('英国 EFFECT 共 ' + uk.length + ' 张：')
for (const c of uk) console.log('  ' + c.id + ' ' + c.name + ' | ' + String(c.text || '').slice(0, 60))
