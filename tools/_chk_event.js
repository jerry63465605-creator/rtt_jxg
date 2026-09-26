const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const arr = (C.CARDS || []).filter(c => c.type === 'EVENT')

console.log('EVENT 卡共', arr.length, '张\n')
arr.forEach((c, i) => {
	console.log(String(i + 1).padStart(2) + '. [' + c.id + '] ' + c.name +
		'  (deck=' + c.deck + ', ops=' + c.ops + ')')
	console.log('    ' + c.text)
})
