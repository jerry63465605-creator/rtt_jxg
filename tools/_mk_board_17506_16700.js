/*
 * 真实盘面：17506《沉睡的巨人》(美国 armed, after_build_navy) + 16700《一日之狮》(意大利拦截)
 *
 * 用法：node tools/_mk_board_17506_16700.js [gameId] [seed]      默认 18 / 20261108
 *
 * ⚠ 建盘一律走 `_board_lib.new_board()`：内部已完成
 *   setup → 清挂起 → **六国「摸 10 弃 3」初设（真实 opening_discard）** → 切阶段。
 *   不要在这里裸调 R.setup()（tools/_audit_board_setup.js 会扫出来）。
 *
 * 盘中状态（交给前端，玩家自己操作）：
 *   美国 · 出牌阶段（同盟视角）
 *   美国手牌：17502《建设海军》+ 17506《沉睡的巨人》
 *   美国：陆军在<夏威夷> → 可在<中太平洋>建设海军
 *   意大利手牌：16700《一日之狮》（牌库充足，付得起 1 损耗）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place, report, ROLE } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const GID = Number(process.argv[2] || 18)
const SEED = Number(process.argv[3] || 20261108)

/* ① 建盘：setup + 六国弃 3 + 切到「美国·出牌阶段」 */
const g = new_board(SEED, { nation: '美国', phase: 'play' })
console.log('=== 初设完成（六国已摸 10 弃 3）===')
report(g, '  手牌/牌堆')

/* ② 布阵 */
place(g, 'us_haw', '美国', 'army', '夏威夷')
I.grant_supply(g, 'us_haw', g.turn); I.refresh(g)

give(g, '17502', '美国')     /* 建设海军（基本卡） */
give(g, '17506', '美国')     /* 沉睡的巨人 */
give(g, '16700', '意大利')   /* 一日之狮 */

console.log('\n=== 布阵 ===')
console.log('  当前：' + g.current_nation + ' · ' + g.turn_phase)
console.log('  美国手牌(' + (g.hands['美国'] || []).length + ') = ' + JSON.stringify((g.hands['美国'] || []).map(faceOf)))
console.log('  意大利手牌含 16700 = ' + (g.hands['意大利'] || []).some(x => faceOf(x) === '16700') +
	'（牌库 ' + (g.decks['意大利'] || []).length + ' 张，够付 1 损耗）')
console.log('  <夏威夷> = ' + JSON.stringify(I.pieces_on(g, d.id_of('夏威夷')).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))

/* ③ 自检：整条链在副本上跑一遍（不污染要落库的状态） */
console.log('\n=== 自检（副本上跑完整链路）===')
{
	const t = JSON.parse(JSON.stringify(g))
	I.refresh(t)
	const bid = (t.hands['美国'] || []).find(x => faceOf(x) === '17502')
	const n0 = (t.log || []).length
	R.action(t, 'Allies', 'play_card', { card: bid, space: d.id_of('中太平洋') })
	I.refresh(t)
	console.log('  ① 建海军：' + logSince(t, n0).slice(0, 130))
	console.log('     窗口(美国) = ' + JSON.stringify((t.armed_offers || []).map(w => ({ when: w.when, nation: w.nation, f: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	const w = (t.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '17506'))
	if (!w) console.log('  ✗ 没开出 17506 窗口')
	else {
		const cid = (w.cards || []).find(c => faceOf(c.card_id) === '17506').card_id
		const n1 = (t.log || []).length
		R.action(t, 'Allies', 'use_armed_offer', { card: cid })
		I.refresh(t)
		console.log('  ② 点 17506：' + logSince(t, n1).slice(0, 160))
		console.log('     窗口(意大利) = ' + JSON.stringify((t.armed_offers || []).map(w2 => ({ when: w2.when, nation: w2.nation, f: (w2.cards || []).map(c => faceOf(c.card_id)) }))))
		const it = (t.armed_offers || []).find(x => (x.cards || []).some(c => faceOf(c.card_id) === '16700'))
		if (!it) console.log('  ✗ 意大利没收到 16700 拦截窗口')
		else {
			const icid = (it.cards || []).find(c => faceOf(c.card_id) === '16700').card_id
			const deck0 = (t.decks['意大利'] || []).length
			const n2 = (t.log || []).length
			R.action(t, 'Axis', 'use_armed_offer', { card: icid })
			I.refresh(t)
			console.log('  ③ 点 16700：' + logSince(t, n2).slice(0, 220))
			console.log('     意大利牌库 ' + deck0 + '→' + (t.decks['意大利'] || []).length +
				'　窗口剩余=' + JSON.stringify((t.armed_offers || []).length))
		}
	}
}

/* ④ 落库（与 UI 建局一致） */
const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const { upsert_game } = require('./_db_game_rows')
const db = new Database(path.join(ROOT, 'server-official', 'db'))
upsert_game(db, GID, { active: 'Allies' })
db.prepare('insert or replace into game_state (game_id, state) values (?,?)').run(GID, JSON.stringify(g))
db.close()

console.log('\n已写入 game ' + GID + '（' + Math.round(JSON.stringify(g).length / 1024) + ' KB）')
console.log('美国视角：http://localhost:8091/quartermaster-sub-wars/play.html?game=' + GID + '&role=Allies')
console.log('意大利视角：http://localhost:8091/quartermaster-sub-wars/play.html?game=' + GID + '&role=Axis')
