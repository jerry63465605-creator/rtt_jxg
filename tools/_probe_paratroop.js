/* 定位「伞兵」卡：卡面 + rules.js 引用 + 相关 view 字段 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

const hits = Object.values(C.CARD_BY_ID).filter(c => /伞兵|空降|paratroop/i.test(String(c.name || '') + String(c.text || '')))
console.log('=== 卡面命中 ===')
for (const c of hits) console.log('  ' + c.id + ' | ' + c.name + ' | ' + c.type + ' | ' + c.nation + ' | ' + String(c.text || '').slice(0, 90))

const faceIds = hits.map(c => String(c.id))
const rules = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')
console.log('\n=== rules.js 引用 ===')
for (const f of faceIds) {
	rules.forEach((l, i) => {
		if (l.indexOf(f) >= 0) console.log('  L' + (i + 1) + ' [' + f + ']: ' + l.trim().slice(0, 130))
	})
}
