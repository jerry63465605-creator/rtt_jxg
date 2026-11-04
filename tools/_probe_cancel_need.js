/*
 * game 10 卡死路径复演：客户端「不发动」按钮发的是 play_card{card, __cancel_need:true}
 * 看服务端如何处理、之后 actions 是否恢复。
 * 用法：node --experimental-sqlite tools/_probe_cancel_need.js [gameId]
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const GID = Number(process.argv[2] || 10)
const { DatabaseSync } = require('node:sqlite')
const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
const row = db.prepare('select state from game_snap where game_id = ? order by snap_id desc limit 1').get(GID)
const g = JSON.parse(row.state)
if (typeof g.log === 'number') g.log = []

const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
I.refresh(g)
const acts = v => Object.keys(v.actions || {})
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

console.log('=== 初始（未修复版服务端） ===')
console.log('  pending_echo = ' + JSON.stringify(g.pending_echo && {
	card: g.pending_echo.card, kind: g.pending_echo.kind, step: g.pending_echo.step,
	options: g.pending_echo.options, cands: g.pending_echo.cands,
}))
console.log('  event_budget = ' + JSON.stringify(g.event_budget && { nation: g.event_budget.nation, remaining: g.event_budget.remaining }))
console.log('  Axis actions = ' + JSON.stringify(acts(R.view(g, 'Axis'))))

/* 客户端「不发动」按钮：play_card{card, __cancel_need:true} */
const n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: g.pending_echo.card, __cancel_need: true })
console.log('\n=== 点「不发动」之后 ===')
console.log('  log: ' + logSince(g, n0))
console.log('  pending_echo = ' + JSON.stringify(g.pending_echo))
console.log('  event_budget = ' + JSON.stringify(g.event_budget && { nation: g.event_budget.nation, remaining: g.event_budget.remaining }))
console.log('  Axis actions = ' + JSON.stringify(acts(R.view(g, 'Axis'))))
console.log('  15209 位置: hand=' + ((g.hands['德国'] || []).indexOf('15209#75') >= 0) +
	' discard=' + ((g.discard['德国'] || []).indexOf('15209#75') >= 0))
