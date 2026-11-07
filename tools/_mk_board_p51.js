/*
 * 真实盘面：17505《P-51 野马》一次性加成（需 17517 B-29 + 半径2内美国陆军 & 空军）
 *
 * 用法：node tools/_mk_board_p51.js [gameId] [seed]      默认 19 / 20261108
 *
 * 盘中：美国·出牌阶段，手里有 17517(B-29) + 17505(P-51)
 *       <东欧> 放 1 支美国陆军 + 1 支美国空军（东欧在德国半径 2 内，满足 B-29 与 P-51 的要求）
 *
 * 玩法：打《B-29 超级堡垒》→ 目标 德国 → 结算后弹「打出《P-51 野马》」
 *        → 点打出：德国额外损耗 2 张（1 支空军 ×2），P-51 进弃牌堆（本局不再生效）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place, report } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const GID = Number(process.argv[2] || 19)
const SEED = Number(process.argv[3] || 20261108)

const g = new_board(SEED, { nation: '美国', phase: 'play' })
console.log('=== 初设（六国摸 10 弃 3）===')
report(g, '  手牌/牌堆')

/* 手里只留一张 P-51（CORE 牌堆本身可能有 1 张），避免窗口出现两个候选 */
g.hands['美国'] = (g.hands['美国'] || []).filter(x => faceOf(x) !== '17505')
g.decks['美国'] = (g.decks['美国'] || []).filter(x => faceOf(x) !== '17505')
I.refresh(g)
give(g, '17517', '美国')     /* B-29：对德国，需半径2内有美国陆军 */
give(g, '17505', '美国')     /* P-51 */

place(g, 'us_arm2', '美国', 'army', '东欧')
I.refresh(g)
I.grant_supply(g, 'us_arm2', g.turn); I.refresh(g)
place(g, 'us_air2', '美国', 'air', '东欧')
I.refresh(g)

console.log('\n=== 布阵 ===')
console.log('  当前：' + g.current_nation + ' · ' + g.turn_phase)
console.log('  美国手牌 = ' + JSON.stringify((g.hands['美国'] || []).map(faceOf)))
console.log('  美国单位 = ' + JSON.stringify(Object.keys(g.location || {})
	.filter(p => g.piece_nation[p] === '美国').map(p => p + '@' + d.name_of(g.location[p]))))

/* 自检（副本） */
console.log('\n=== 自检 ===')
{
	const t = JSON.parse(JSON.stringify(g))
	I.refresh(t)
	const bid = (t.hands['美国'] || []).find(x => faceOf(x) === '17517')
	const de0 = (t.decks['德国'] || []).length + (t.hands['德国'] || []).length
	const n0 = (t.log || []).length
	R.action(t, 'Allies', 'play_card', { card: bid, target: '德国' })
	I.refresh(t)
	console.log('  打 B-29：' + logSince(t, n0).slice(0, 140))
	console.log('  窗口 = ' + JSON.stringify((t.armed_offers || []).map(w => ({ when: w.when, f: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	const w = (t.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '17505'))
	if (w) {
		const cid = (w.cards || []).find(c => faceOf(c.card_id) === '17505').card_id
		const n1 = (t.log || []).length
		R.action(t, 'Allies', 'use_armed_offer', { card: cid })
		I.refresh(t)
		console.log('  点 P-51：' + logSince(t, n1).slice(0, 160))
		console.log('  德国总牌 ' + de0 + '→' + ((t.decks['德国'] || []).length + (t.hands['德国'] || []).length) +
			'　P-51 进弃牌堆=' + (t.discard['美国'] || []).some(x => faceOf(x) === '17505'))
	} else console.log('  ✗ 没有 P-51 窗口')
}

/* 落库 */
const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const { upsert_game } = require('./_db_game_rows')
const db = new Database(path.join(ROOT, 'server-official', 'db'))
upsert_game(db, GID, { active: 'Allies' })
db.prepare('insert or replace into game_state (game_id, state) values (?,?)').run(GID, JSON.stringify(g))
db.close()

console.log('\n已写入 game ' + GID + '（' + Math.round(JSON.stringify(g).length / 1024) + ' KB）')
console.log('美国视角：http://localhost:8091/quartermaster-sub-wars/play.html?game=' + GID + '&role=Allies')
