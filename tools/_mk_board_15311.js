/*
 * 真实开局 + 六国「摸10弃3」初设 + 插入手牌，构建 15311《马奇诺防线》验收盘面
 *
 * 用法：node tools/_mk_board_15311.js [gameId] [seed]
 *   默认 gameId=14，seed=20261108
 *
 * 产物：本地 DB 里的真实对局；打开
 *   http://localhost:8091/quartermaster-sub-wars/play.html?game=14&role=Axis
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const GID = Number(process.argv[2] || 14)
const SEED = Number(process.argv[3] || 20261108)

const ROLE = n => (I.faction_of_nation(n) === 'allies' ? 'Allies' : 'Axis')

/* ① 真实 setup（每国发 10 张） */
const g = R.setup(SEED)
console.log('=== 开局 ===')
for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国'])
	console.log('  ' + n + ' 手牌 ' + (g.hands[n] || []).length + ' / 牌堆 ' + (g.decks[n] || []).length)

/* ② 六国依次「弃 3 留 7」（真实动作 opening_discard，按国序推进） */
console.log('\n=== 初设：每国弃 3 ===')
let guard = 0
while (g.opening && guard++ < 12) {
	const nation = (I.ORDER_OF_NATIONS || ['德国', '英国', '日本', '苏联', '意大利', '美国'])[g.opening.index]
	const hand = (g.hands[nation] || []).slice()
	const drop = hand.slice(0, 3)
	const n0 = (g.log || []).length
	R.action(g, ROLE(nation), 'opening_discard', { cards: drop })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  ' + nation + ' 弃 ' + drop.map(faceOf).join(',') +
		' → 手牌 ' + (g.hands[nation] || []).length + '　' + (lg ? lg.slice(0, 60) : ''))
}
console.log('  opening 结束 = ' + !g.opening + '　当前国 = ' + g.current_nation + ' · 阶段 ' + g.turn_phase)
for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国'])
	console.log('    ' + n + ' 手牌 ' + (g.hands[n] || []).length)

/* ③ 插入手牌 / 布阵，构建 15311 的验收局面 */
console.log('\n=== 插入手牌与布阵 ===')
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)

/* 英国：确保手里有 15311 + 4 张垫牌（弃 4 是代价） */
const addUK = ['15311', '15304', '15305', '15306', '15307']
for (const f of addUK) R.action(g, 'Allies', 'debug_add_card', { face: f, nation: '英国', dest: 'hand' })
I.refresh(g)

/* <西欧> 的法国陆军（保证有，且处于补给） */
const WE = d.id_of('西欧')
let fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
if (!fr) {
	R.action(g, 'Allies', 'debug_place', { piece: 'fr_we', nation: '法国', type: 'army', space: WE })
	I.refresh(g)
	fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
}
I.grant_supply(g, fr, g.turn)
I.refresh(g)

/* 德国：<德国> 放 1 支陆军（发起陆战的发起单位）+ 手里给《发起陆战》 */
R.action(g, 'Axis', 'debug_place', { piece: 'de_mk', nation: '德国', type: 'army', space: d.id_of('德国') })
I.refresh(g)
I.grant_supply(g, 'de_mk', g.turn)
I.refresh(g)
R.action(g, 'Axis', 'debug_add_card', { face: '15201', nation: '德国', dest: 'hand' })
I.refresh(g)

console.log('  英国手牌(' + (g.hands['英国'] || []).length + ') = ' + JSON.stringify((g.hands['英国'] || []).map(faceOf)))
console.log('  德国手牌(' + (g.hands['德国'] || []).length + ') 含 15201 = ' +
	(g.hands['德国'] || []).some(x => faceOf(x) === '15201'))
console.log('  <西欧> = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p]) +
	'  法国陆军=' + fr + ' 补给=' + !!(g.supply && g.supply[fr])))
console.log('  当前：' + g.current_nation + ' · ' + g.turn_phase)

/* ④ 落库 */
const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const db = new Database(path.join(ROOT, 'server-official', 'db'))
if (!db.prepare('select game_id from games where game_id=?').get(GID)) {
	db.prepare(`insert into games (game_id, status, title_id, scenario, options, player_count,
		join_count, invite_count, user_count, owner_id, notice, is_private, is_random, is_match,
		ctime, mtime, xtime, moves)
		values (?, 1, 'quartermaster-sub-wars', 'Standard', '{}', 2, 2, 0, 2, 1, '', 0, 0, 0,
		current_timestamp, current_timestamp, current_timestamp, 0)`).run(GID)
}
db.prepare('insert or replace into game_state (game_id, state) values (?,?)').run(GID, JSON.stringify(g))
db.prepare('update games set status=1, mtime=current_timestamp where game_id=?').run(GID)
db.close()

console.log('\n已写入 game ' + GID + '（' + Math.round(JSON.stringify(g).length / 1024) + ' KB）')
console.log('打开：http://localhost:8091/quartermaster-sub-wars/play.html?game=' + GID + '&role=Axis')
console.log('（英国视角把 role=Axis 改成 role=Allies）')
