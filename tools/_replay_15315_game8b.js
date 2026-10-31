/*
 * 用 game_replay 找到 15315 的那一步，再用 game_snap 还原【出牌前】盘面，
 * 在该盘面上直接问 event_targets —— 判定"是不是服务端只给了一个候选"。
 *
 * 用法：node --experimental-sqlite tools/_replay_15315_game8b.js [gid]
 */
const path = require('path')
const { DatabaseSync } = require('node:sqlite')
const gid = Number(process.argv[2] || 8)
const db = new DatabaseSync(path.join(__dirname, '..', 'server-official', 'db'), { readOnly: true })

const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

const reps = db.prepare('select replay_id, role, action, arguments from game_replay where game_id = ? order by replay_id').all(gid)
console.log('回放行数 = ' + reps.length)
const idx = reps.findIndex(r => String(r.arguments || '').indexOf('15315') >= 0)
if (idx < 0) { console.log('回放里没有 15315'); process.exit(1) }
const rep = reps[idx]
console.log('命中：replay_id=' + rep.replay_id + ' role=' + rep.role + ' action=' + rep.action +
	' args=' + String(rep.arguments).slice(0, 160))
console.log('前后动作：')
for (let k = Math.max(0, idx - 2); k <= Math.min(reps.length - 1, idx + 2); k++) {
	console.log('  [' + (k === idx ? '★' : ' ') + '] ' + reps[k].replay_id + ' ' + reps[k].action +
		' ' + String(reps[k].arguments).slice(0, 100))
}

/* 出牌前盘面 = replay_id 小于该步的最后一个快照 */
const snap = db.prepare('select snap_id, replay_id, log_length, state from game_snap where game_id = ? and replay_id < ? order by replay_id desc, snap_id desc limit 1').get(gid, rep.replay_id)
const snapAfter = db.prepare('select snap_id, replay_id, state from game_snap where game_id = ? and replay_id >= ? order by replay_id asc, snap_id asc limit 1').get(gid, rep.replay_id)
console.log('出牌前快照 = ' + (snap && ('snap_id ' + snap.snap_id + ' replay_id ' + snap.replay_id)) +
	'   出牌后快照 = ' + (snapAfter && ('snap_id ' + snapAfter.snap_id + ' replay_id ' + snapAfter.replay_id)))
if (!snap) process.exit(1)

const pre = JSON.parse(snap.state)
const at = sid => Object.keys(pre.location || {}).filter(p => pre.location[p] === sid)
	.map(p => p + ':' + pre.piece_nation[p] + '/' + pre.piece_type[p])
const AF = d.id_of('非洲北部'), ME = d.id_of('中东')

console.log('\n=== 出牌前真实盘面 ===')
console.log('  turn=' + pre.turn + ' current_nation=' + pre.current_nation + ' phase=' + pre.turn_phase +
	' active=' + pre.active + ' play_done=' + JSON.stringify(pre.play_done || {}))
console.log('  北非(15) = ' + JSON.stringify(at(AF)))
console.log('  中东(16) = ' + JSON.stringify(at(ME)))
const hand = ((pre.hands || {})['英国']) || []
console.log('  英国手牌 = ' + JSON.stringify(hand))
const card = hand.find(x => faceOf(x) === '15315')
console.log('  手里 15315 = ' + card)

if (card) {
	I.refresh(pre)
	const q = R.query(pre, 'Allies', 'event_targets', { card })
	console.log('\n=== event_targets（客户端点手牌时调的就是它）===')
	console.log('  ' + JSON.stringify(q && {
		need: q.need, step: q.step, total: q.total,
		cands: (q.candidates || []).map(c => c.name || c), pick: q.pick,
	}))
	console.log('  can_recruit_at(中东) = ' + JSON.stringify(I.can_recruit_at(pre, '英国', ME, 'army')))
	console.log('  can_recruit_at(北非) = ' + JSON.stringify(I.can_recruit_at(pre, '英国', AF, 'army')))
	console.log('  eliminate_candidates(北非,army) = ' + JSON.stringify(I.eliminate_candidates(pre, '英国', AF, 'army')))
	console.log('  hits = ' + JSON.stringify((pre.hits || {})['英国'] || null))
}
