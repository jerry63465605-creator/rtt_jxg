/*
 * 开一局【真实盘面】：标准 setup（真实牌库 + 真实起手），不加任何调试改动，
 * 写入本地 DB 的新对局，并打印逐国牌堆/手牌实况（用于核查"哪些卡从来没见过"）。
 *
 * 用法：node tools/_mk_board_real.js [gameId] [seed]
 */
const path = require('path')
const ROOT = require('path').join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const cards = require(path.join(MOD, 'cards.js'))
const arr = Array.isArray(cards.CARDS) ? cards.CARDS : Object.values(cards)[0]
const byId = {}
for (const c of arr) byId[String(c.id)] = c
const faceOf = x => String(x).split('#')[0]

const GID = Number(process.argv[2] || 12)
const SEED = Number(process.argv[3] || 20261106)
const NATIONS = ['英国', '德国', '日本', '苏联', '意大利', '美国']

/* 1) 真实 setup（真实牌库 + 真实起手） */
const g = R.setup(SEED)
console.log('=== 真实盘面（seed=' + SEED + '）===')
console.log('当前国=' + g.current_nation + ' 阶段=' + g.turn_phase + ' active=' + g.active +
	' 苏联参战=' + (g.neutral && g.neutral['苏联']) + ' 美国参战=' + (g.neutral && g.neutral['美国']))

/* 2) 逐国：牌堆 / 手牌 / 桌面 */
const allZones = new Set()
console.log('\n=== 逐国实况 ===')
for (const n of NATIONS) {
	const deck = g.decks[n] || []
	const hand = g.hands[n] || []
	const table = g.table[n] || []
	const faces = new Set([...deck, ...hand, ...table].map(faceOf))
	for (const x of [...deck, ...hand, ...table]) allZones.add(faceOf(x))
	const byType = {}
	for (const f of faces) {
		const t = String((byId[f] || {}).type || '?').toUpperCase()
		byType[t] = (byType[t] || 0) + 1
	}
	console.log('\n' + n + '：牌堆 ' + deck.length + ' 张｜手牌 ' + hand.length + ' 张｜桌面 ' + table.length + ' 张' +
		'｜不同牌面 ' + faces.size)
	console.log('  类型（不同牌面）：' + JSON.stringify(byType))
	console.log('  起手：' + hand.map(x => {
		const c = byId[faceOf(x)] || {}
		return (c.name || faceOf(x)) + '[' + String(c.type || '?') + ']'
	}).join('、'))
}

/* 3) 全表 vs 本局实际拥有 */
const never = arr.filter(c => !allZones.has(String(c.id)))
const byDeck = {}
for (const c of never) byDeck[c.deck] = (byDeck[c.deck] || 0) + 1
console.log('\n=== 本局"完全不存在"的卡：' + never.length + ' / ' + arr.length + ' ===')
console.log('  按 deck 字段：' + JSON.stringify(byDeck))
console.log('  （SUPP 已实装但不入池；PRELUDE/ARMAMENT 既未实装也不入池）')

/* 4) 写库 */
const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const db = new Database(path.join(ROOT, 'server-official', 'db'))
const exists = db.prepare('select game_id from games where game_id=?').get(GID)
if (!exists) {
	db.prepare(`insert into games (game_id, status, title_id, scenario, options, player_count,
		join_count, invite_count, user_count, owner_id, notice, is_private, is_random, is_match,
		ctime, mtime, xtime, moves)
		values (?, 1, 'quartermaster-sub-wars', 'Standard', '', 2, 2, 0, 2, 1, '', 0, 0, 0,
		current_timestamp, current_timestamp, current_timestamp, 0)`).run(GID)
}
db.prepare('insert or replace into game_state (game_id, state) values (?,?)').run(GID, JSON.stringify(g))
db.prepare('update games set status=1, mtime=current_timestamp where game_id=?').run(GID)
db.close()
console.log('\n已写入 game ' + GID + '（' + JSON.stringify(g).length + ' 字节）')
console.log('打开：http://localhost:8091/quartermaster-sub-wars/play.html?game=' + GID + '&role=Axis')
