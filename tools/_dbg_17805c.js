const R = require('./rtt_repro.js')
const { rules } = R
const I = R.I
const g = R.setupRepro({ nation: '苏联', active: 'Allies', phase: 'play' })
g.hands['苏联'] = ['17805']
g.table['德国'] = ['15338#1']
I.offer_su_red(g, '苏联')
g.opening = null   // 真实游戏已离开开局阶段，避免 build_actions 提前 return
// 苏联使用 + 选卡（走到德国二选一）
rules.action(g, 'Allies', 'su_red_use', {})
const pick = rules.view(g, 'Allies').su_red_pick
console.log('su_red_pick candidates =', JSON.stringify(pick && pick.options))
rules.action(g, 'Allies', 'su_red_pick', { status: '15338#1' })

function dump(tag, role) {
  const v = rules.view(g, role)
  console.log('\n=== ' + tag + ' (' + role + ') ===')
  console.log('  view.waiting_for =', JSON.stringify(v.waiting_for))
  console.log('  view.pending_red =', JSON.stringify(v.pending_red))
  console.log('  view.actions.resolve_red =', v.actions && v.actions.resolve_red)
  console.log('  view.actions keys =', v.actions ? Object.keys(v.actions).filter(k => v.actions[k]) : null)
}
dump('苏联端', 'Allies')
dump('德国端', 'Axis')

// 德国端尝试 resolve_red
const before = JSON.stringify(g.pending_red)
const r = rules.action(g, 'Axis', 'resolve_red', { choice: 0 })
console.log('\nresolve_red(0) 返回 action 名 =', r && r.action, '| 结果 game.pending_red =', JSON.stringify(g.pending_red))
console.log('resolve 前 pending_red =', before)
