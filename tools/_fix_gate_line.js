/* 修复被截断的门禁条件行 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const L = fs.readFileSync(P, 'utf8').split('\n')
for (let i = 0; i < L.length; i++) {
	if (L[i].indexOf('_oppMoment && !game.__internal_depth') >= 0) {
		console.log('before:', JSON.stringify(L[i]))
		L[i] = "\tif (_oppMoment && !game.__internal_depth && action !== 'use_armed_offer' &&" +
			" action !== 'skip_armed_offer' &&" + (L[i].endsWith('\r') ? '\r' : '')
		console.log('after :', JSON.stringify(L[i]))
		break
	}
}
fs.writeFileSync(P, L.join('\n'), 'utf8')
