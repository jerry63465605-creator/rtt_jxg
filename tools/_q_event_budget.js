/* 战斗预算（event_budget）在哪里被消费/校验 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
t.forEach((l, i) => {
	if (l.indexOf('event_budget') >= 0) console.log((i + 1) + ': ' + l.trim().slice(0, 130))
})
