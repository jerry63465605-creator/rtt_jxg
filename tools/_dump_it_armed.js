/* 打印意大利 armed 增强卡的配置（ready/cond/cost/when）供构造复现 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const EE = R._internal.ECHO_EFFECTS || {}
for (const face of ['17711', '17705', '17708', '16700', '15352']) {
	const e = EE[face]
	if (!e) { console.log(face + ' 无配置'); continue }
	const ar = e.armed || {}
	console.log('\n=== ' + face + ' ' + (e.name || '') + '  when=' +
		(Array.isArray(ar.when) ? ar.when.join('/') : ar.when) + ' watch=' + !!ar.watch)
	console.log('  cost=' + JSON.stringify(ar.cost || {}))
	console.log('  tag=' + ar.tag + ' cond=' + (typeof ar.cond) + ' filter=' + (typeof ar.filter))
	if (typeof ar.ready === 'function') console.log('  ready源码: ' + String(ar.ready).replace(/\s+/g, ' ').slice(0, 420))
	if (typeof ar.run === 'function') console.log('  run源码: ' + String(ar.run).replace(/\s+/g, ' ').slice(0, 300))
}
