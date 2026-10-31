/*
 * 用本地对局库 game 8 的历史快照，还原《阿拉曼战役》**出牌前**的真实盘面，
 * 并在那份盘面上直接问 event_targets —— 判定到底是"服务端只给 1 个候选"还是别的原因。
 *
 * 用法：node --experimental-sqlite tools/_replay_15315_game8.js [gid]
 */
const path = require('path')
const { DatabaseSync } = require('node:sqlite')
const gid = Number(process.argv[2] || 8)
const dbPath = path.join(__dirname, '..', 'server-official', 'db')
const db = new DatabaseSync(dbPath, { readOnly: true })

const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

const snaps = db.prepare('select snap_id, state from game_snap where game_id = ? order by snap_id').all(gid)
console.log('快照数 = ' + snaps.length)

const parsed = snaps.map(s => ({ id: s.snap_id, st: JSON.parse(s.state) }))
const hit = parsed.find(x => (x.st.log || []).some(l => String(l).indexOf('阿拉曼战役') >= 0))
if (!hit) {
	console.log('本局日志里没有《阿拉曼战役》—— 可能这张卡还没在这局打出过')
	/* 退一步：直接看最新盘面里 英国 是否还有 15315 */
	const last = parsed[parsed.length - 1].st
	console.log('  最新盘面 英国手牌 = ' + JSON.stringify(((last.hands || {})['英国']) || []))
	process.exit(1)
}
const idx = parsed.findIndex(x => x.id === hit.id)
const pre = idx > 0 ? parsed[idx - 1].st : parsed[idx].st
console.log('首个含「阿拉曼战役」的快照 = snap_id ' + hit.id + '（取前一个快照作为出牌前盘面）')

const at = (st, sid) => Object.keys(st.location || {})
	.filter(p => st.location[p] === sid)
	.map(p => p + ':' + st.piece_nation[p] + '/' + st.piece_type[p])
const AF = d.id_of('非洲北部'), ME = d.id_of('中东')
console.log('出牌前盘面：')
console.log('  turn=' + pre.turn + ' current_nation=' + pre.current_nation + ' phase=' + pre.turn_phase +
	' active=' + pre.active)
console.log('  北非(15) = ' + JSON.stringify(at(pre, AF)))
console.log('  中东(16) = ' + JSON.stringify(at(pre, ME)))
console.log('  英国手牌 = ' + JSON.stringify(((pre.hands || {})['英国']) || []))

const card = (((pre.hands || {})['英国']) || []).find(x => faceOf(x) === '15315')
console.log('  英国手里 15315 = ' + card)
if (!card) { console.log('  （出牌前英国手里没有 15315，改用含它的那个快照）') }

/* 直接把快照塞回引擎（只读问询，不推进） */
if (card) {
	I.refresh(pre)
	const q = R.query(pre, 'Allies', 'event_targets', { card })
	console.log('\n=== 在这份真实盘面上问 event_targets ===')
	console.log('  -> ' + JSON.stringify(q && {
		need: q.need, step: q.step, total: q.total,
		cands: (q.candidates || []).map(c => c.name || c),
		pick: q.pick,
	}))
	const needs = I.event_card_needs(pre, '英国', card, {})
	console.log('  event_card_needs 直调 -> ' + JSON.stringify(needs && {
		need: needs.need, step: needs.step,
		cands: (needs.candidates || []).map(c => typeof c === 'object' ? c.name : d.name_of(c)),
	}))
	/* 各步候选细节：eliminate 与 recruit 分别算出什么 */
	console.log('\n  can_recruit_at(中东) = ' + JSON.stringify(I.can_recruit_at(pre, '英国', ME, 'army')))
	console.log('  can_recruit_at(北非) = ' + JSON.stringify(I.can_recruit_at(pre, '英国', AF, 'army')))
	const ec = I.eliminate_candidates(pre, '英国', AF, 'army')
	console.log('  eliminate_candidates(北非, army) = ' + JSON.stringify(ec))
}
