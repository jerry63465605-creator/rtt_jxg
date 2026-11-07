/* 诊断：16806（deck:TOKEN）为什么还是进了牌堆；以及 give 到英国手牌是否成功 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give } = L

const g = new_board(20261108)
console.log('=== 16806 出现在哪 ===')
for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国']) {
	for (const z of ['decks', 'hands', 'discard', 'removed', 'table']) {
		const arr = (g[z] && g[z][n]) || []
		const hit = arr.filter(x => faceOf(x) === '16806')
		if (hit.length) console.log('  ' + z + '/' + n + ' → ' + JSON.stringify(hit))
	}
}

console.log('\n=== cards_of_nation 对 16806 的处理 ===')
const cardsMod = require(path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js'))
if (typeof cardsMod.cards_of_nation === 'function') {
	const list = cardsMod.cards_of_nation('英国')
	console.log('  英国 cards_of_nation 含 16806 = ' + list.some(x => String(x.id || x) === '16806') + '（共 ' + list.length + '）')
} else console.log('  (cards_of_nation 未导出)')

console.log('\n=== 手动 give 16806 到英国手牌 ===')
give(g, '16806', '英国')
I.refresh(g)
console.log('  英国手牌 = ' + JSON.stringify((g.hands['英国'] || []).map(x => x + '(' + faceOf(x) + ')')))
console.log('  其中 16806 实例 = ' + JSON.stringify((g.hands['英国'] || []).filter(x => faceOf(x) === '16806')))
