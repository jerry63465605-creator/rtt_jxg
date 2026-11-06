/*
 * 牌库实装/可见性审计（第二层）：哪些卡【真的会出现在对局里】
 *
 * 依据：rules.js 的 init_nation_deck()
 *   · 只收 `deck === 'CORE'` 的卡（SUPP/PRELUDE/ARMAMENT 全部跳过）
 *   · BASIC 按 BASIC_CARD_COUNTS 复制若干张，其余各 1 张
 * 输出：逐国牌堆构成 + "永远不会出现"的卡清单（附原因）
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const cards = require(path.join(MOD, 'cards.js'))
const arr = Array.isArray(cards) ? cards : Object.values(cards)[0]
const faceOf = x => String(x).split('#')[0]
const byId = {}
for (const c of arr) byId[String(c.id)] = c

const NATIONS = ['英国', '德国', '日本', '苏联', '意大利', '美国']

/* 真实建库（setup 会调用 init_nation_deck） */
const g = R.setup(7)
console.log('=== 一、逐国真实牌堆（setup 后 game.decks）===\n')
let totalPool = 0
const poolFaces = new Set()
/* 全部区域：牌堆 + 手牌 + 桌面 + 弃牌 + 移出 */
for (const z of ['decks', 'hands', 'table', 'discard', 'removed']) {
	const m = g[z] || {}
	for (const n of Object.keys(m)) for (const x of (m[n] || [])) poolFaces.add(faceOf(x))
}
for (const n of NATIONS) {
	const deck = g.decks[n] || []
	const hand = g.hands[n] || []
	const faces = new Set(deck.map(faceOf))
	for (const f of faces) poolFaces.add(f)
	totalPool += deck.length
	const byType = {}
	for (const f of faces) {
		const t = String((byId[f] || {}).type || '?').toUpperCase()
		byType[t] = (byType[t] || 0) + 1
	}
	console.log(n + '：牌堆 ' + deck.length + ' 张 / 不同牌面 ' + faces.size +
		'  手牌 ' + hand.length + ' 张')
	console.log('   类型分布（不同牌面）：' + JSON.stringify(byType))
}
console.log('\n六国牌堆合计 ' + totalPool + ' 张；全池不同牌面 ' + poolFaces.size + ' 种')

/* ==== 二、cards.js 全表 vs 实际入池 ==== */
console.log('\n=== 二、cards.js 全表（' + arr.length + ' 张）里【永远不会入池】的卡 ===\n')
const never = arr.filter(c => !poolFaces.has(String(c.id)))
const byDeck = {}
for (const c of never) byDeck[c.deck] = (byDeck[c.deck] || 0) + 1
console.log('不会入池合计 ' + never.length + ' 张，按 deck 字段：' + JSON.stringify(byDeck))
const byTypeNever = {}
for (const c of never) {
	const t = String(c.type).toUpperCase()
	byTypeNever[t] = (byTypeNever[t] || 0) + 1
}
console.log('按类型：' + JSON.stringify(byTypeNever))

/* 逐国列出"该国拥有、但永远不出现"的卡 */
console.log('\n--- 逐国（该国自己的卡里，永远不入池的）---')
for (const n of NATIONS) {
	const mine = arr.filter(c => c.nation === n)
	const miss = mine.filter(c => !poolFaces.has(String(c.id)))
	const supp = miss.filter(c => c.deck === 'SUPP')
	const pre = miss.filter(c => c.deck === 'PRELUDE' || c.deck === 'ARMAMENT')
	const other = miss.filter(c => c.deck !== 'SUPP' && c.deck !== 'PRELUDE' && c.deck !== 'ARMAMENT')
	console.log(n + '：本国卡 ' + mine.length + ' 张，不入池 ' + miss.length +
		'（SUPP ' + supp.length + ' / 前奏武备 ' + pre.length + ' / 其它 ' + other.length + '）')
	if (supp.length) console.log('    SUPP：' + supp.map(c => c.id + c.name).join('、'))
	if (other.length) console.log('    ⚠ 其它：' + other.map(c => c.id + c.name + '(' + c.deck + ')').join('、'))
}

/* ==== 三、SUPP 牌库若入池会有多少 ==== */
console.log('\n=== 三、SUPP 牌库（' + arr.filter(c => c.deck === 'SUPP').length + ' 张）当前状态 ===')
const suppAll = arr.filter(c => c.deck === 'SUPP')
for (const n of NATIONS) {
	const s = suppAll.filter(c => c.nation === n)
	if (!s.length) continue
	console.log('  ' + n + ' ' + s.length + ' 张：' + s.map(c => c.id + c.name).join('、'))
}
console.log('  → init_nation_deck 只收 CORE，SUPP 全部不入池（rules.js:1428 注释："暂不混入核心牌堆"）')

/* ==== 四、真实对局对照（DB 里已有的局） ==== */
console.log('\n=== 四、DB 里真实对局的牌堆（抽 1 局看是否同样只有 CORE）===')
try {
	const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
	const db = new Database(path.join(ROOT, 'server-official', 'db'), { readonly: true })
	const row = db.prepare('select game_id, state from game_state order by game_id desc limit 1').get()
	db.close()
	if (row) {
		const st = JSON.parse(row.state)
		console.log('  game ' + row.game_id + '：')
		for (const n of NATIONS) {
			const dk = st.decks && st.decks[n]
			const hd = st.hands && st.hands[n]
			if (!dk) { console.log('    ' + n + '：无牌堆'); continue }
			const faces = new Set(dk.map(faceOf))
			const supp = [...faces].filter(f => (byId[f] || {}).deck === 'SUPP').length
			console.log('    ' + n + '：牌堆 ' + dk.length + ' 张 / 牌面 ' + faces.size +
				' / 其中 SUPP ' + supp + ' / 手牌 ' + (hd ? hd.length : 0))
		}
	}
} catch (e) { console.log('  (读 DB 失败：' + e.message + ')') }
