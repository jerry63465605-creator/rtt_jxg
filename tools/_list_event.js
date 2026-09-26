const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const arr = (C.CARDS || []).filter(c => c.type === 'EVENT')

console.log('EVENT 共 ' + arr.length + ' 张')
arr.forEach((c, i) => {
	console.log(String(i + 1) + '. id=' + c.id + ' | ' + c.name + ' | deck=' + c.deck + ' ops=' + c.ops)
	console.log('   TEXT: ' + c.text)
})
