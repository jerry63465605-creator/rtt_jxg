/*
 * 审计 #4 的共同模式（F2）：哪些【状态卡】的 run 需要玩家选位（space/piece），
 * 而 activate_status 在【付代价之后】才校验参数 → 缺参时"白扣代价、窗口不消耗、可重复点"。
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const txt = id => String((C.CARD_BY_ID[String(id)] || {}).text || '')

const SE = I.STATUS_EFFECTS || {}
const needSpace = []
for (const id of Object.keys(SE)) {
	const t = SE[id].trigger
	if (!t || typeof t.run !== 'function') continue
	const src = String(t.run)
	const usesSpace = /arg\.space|ctx\.arg\.space|\.space\b/.test(src)
	const usesPiece = /arg\.piece/.test(src)
	if (usesSpace || usesPiece) {
		needSpace.push({ id, name: nm(id), window: t.window, cost: t.cost || {},
			need: usesSpace ? 'space' : '', needPiece: usesPiece ? 'piece' : '' })
	}
}
console.log('=== run 需要选位/选子的状态卡（共 ' + needSpace.length + ' 张）===')
for (const x of needSpace)
	console.log('  ' + x.id + ' ' + x.name + '  window=' + x.window +
		'  cost=' + JSON.stringify(x.cost) + '  ' + [x.need, x.needPiece].filter(Boolean).join('+'))
console.log('\n卡面样例：')
for (const x of needSpace.slice(0, 6)) console.log('  ' + x.id + ' ' + x.name + ': ' + txt(x.id).slice(0, 70))

/* activate_status 里"付代价 vs 校验参数"的顺序 */
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
const i = t.findIndex(l => /action === 'activate_status'/.test(l))
console.log('\n=== activate_status 分支 (' + (i + 1) + ') ===')
console.log(t.slice(i, i + 60).join('\n'))
