/*
 * 只读复现：直接加载真实对局 game=19 的 state，模拟玩家点击喀秋莎，
 * 看服务端到底为什么拒绝（不写回 db）。
 */
const path = require('path')
const Database = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const db = new Database(path.join(__dirname, '..', 'server-official', 'db'), { readonly: true })
const gid = Number(process.argv[2] || 19)
const st = JSON.parse(db.prepare('SELECT state FROM game_state WHERE game_id = ?').get(gid).state)
db.close()
console.log('（真实对局 game=' + gid + '，只读回放，不写库）')

const L = require('./_board_lib')
const { R, I, d, faceOf } = L

const J = x => JSON.stringify(x)
const CE = 22
const windowEntry = (st.status_instant || [])[0]
console.log('=== 真实窗口条目 ===')
console.log('  card=' + windowEntry.card_id + ' window=' + windowEntry.window +
	' space(窗口战斗地区)=' + windowEntry.space + ' by=' + windowEntry.by)
console.log('  ctx.space(last_piece_removed)=' + windowEntry.ctx.space)
console.log('  status_used=' + J(st.status_used))

/* 引擎视角：把 state 当 game 对象直接跑（与服务器同一 rules.js） */
const g = st
I.refresh(g)
const ts = (R.view(g, 'Allies').table_status || []).find(x => faceOf(x.card) === '17842')
console.log('\n=== view.table_status[17842] ===')
console.log('  ' + J(ts && { ready: ts.ready, space: ts.ready_space, why: ts.ready_reason }))

const drop = (g.hands['苏联'] || []).slice(0, 1)
const from = Object.keys(g.location).find(p =>
	g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army' && Number(g.location[p]) === 21)
const victim = Object.keys(g.location).find(p => Number(g.location[p]) === 22)

console.log('\n=== 模拟玩家点击：space=' + CE + ' from=' + from + ' victim=' + victim + ' ===')
const n0 = (g.log || []).length
R.action(g, 'Allies', 'activate_status', {
	card: '17842#82', discard: drop, space: CE, from: from, victim: victim,
})
console.log('  服务端日志 = ' + J((g.log || []).slice(n0)))
console.log('  status_used(后) = ' + J(g.status_used))
console.log('  目标还在 = ' + J(!!g.location[victim]))
console.log('  窗口还在 = ' + J((g.status_instant || []).map(e => e.card_id)))

/* 对照：若按 ctx.space=21 传，是否能过 allowed */
console.log('\n=== 对照：按 ctx.space(21) 传 ===')
const g2 = JSON.parse(JSON.stringify(st))
I.refresh(g2)
const n1 = (g2.log || []).length
R.action(g2, 'Allies', 'activate_status', {
	card: '17842#82', discard: (g2.hands['苏联'] || []).slice(0, 1),
	space: windowEntry.ctx.space, from: from, victim: null,
})
console.log('  服务端日志 = ' + J((g2.log || []).slice(n1)))
