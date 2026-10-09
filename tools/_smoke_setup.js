/* 开局布阵自检（2026-10-10）：各国大本营 1 陆军 + 开局状态卡 15348/17850/17555 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

const g = rules.setup(1)
/* 含委托国 法国 / 中国，共 8 国 */
const HOME = { '德国': '德国', '日本': '日本', '意大利': '意大利', '英国': '不列颠',
	'苏联': '莫斯科', '美国': '美国', '法国': '西欧', '中国': '中国东部' }
const NATIONS = Object.keys(HOME)

console.log('=== 1. 各国大本营 1 支本国陆军 ===')
for (const n of NATIONS) {
	const sp = d.id_of(HOME[n])
	const cnt = Object.keys(g.location).filter(p =>
		g.piece_nation[p] === n && g.piece_type[p] === 'army' && g.location[p] === sp)
	ok(n + ' 大本营<' + HOME[n] + '>有 1 陆军', cnt.length === 1, 'count=' + cnt.length)
}

console.log('\n=== 2. 开局状态卡在桌面 ===')
const INIT = { '英国': '15348', '苏联': '17850', '美国': '17555' }
for (const n of Object.keys(INIT)) {
	const face = INIT[n]
	const onTable = (g.table[n] || []).some(x => String(x).split('#')[0] === face)
	ok(n + ' 桌面有 ' + face, onTable, 'table=' + JSON.stringify(g.table[n]))
	/* 不得同时存在于牌堆或手牌（重复） */
	const inDeck = (g.decks[n] || []).some(x => String(x).split('#')[0] === face)
	const inHand = (g.hands[n] || []).some(x => String(x).split('#')[0] === face)
	ok(face + ' 不在牌堆/手牌重复', !inDeck || !inHand,
		'deckDup=' + inDeck + ' handDup=' + inHand)
}

console.log('\n=== 3. 17850 大清洗的既有副作用（苏联不能资源再分配）===')
ok('table_has 苏联 17850 成立', (g.table['苏联'] || []).some(x => String(x).split('#')[0] === '17850'))

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
