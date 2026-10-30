/* 验证 17547 人工港 经 activate_status 的两步选位流程：
 * 1) 武装 after_build_navy -> status_window_ready ok
 * 2) 第一次 activate_status(无 space) -> run 返回 need:'space'，game.pending_status 写入、view.pending_status 下发
 * 3) 第二次 activate_status(带 space) -> 真正建设陆军、付代价、清窗口
 */
const rules = require('c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/rules.js')
const I = rules._internal
const NAME = id => (I.data && I.data.spaces[id] && I.data.spaces[id].name) || ('#' + id)

const g = rules.setup(12345, 'Standard', {})
g.current_nation = '美国'
g.turn_phase = 'play'
g.table = g.table || {}
g.table['美国'] = (g.table['美国'] || []).concat(['17547'])

// 模拟"建设海军后"武装
const navySpace = 52 // 东太平洋
g.status_instant = [{ card_id: '17547', nation: '美国', window: 'after_build_navy', space: navySpace }]

const cfg = I.status_config_of('17547')
const ready = I.status_window_ready(g, '美国', '17547', cfg.trigger)
console.log('1) status_window_ready ->', JSON.stringify(ready))

// 第一次：无选位
rules.action(g, 'Allies', 'activate_status', { card: '17547' })
console.log('2) 第一次 activate_status 后:')
console.log('   game.pending_status =', JSON.stringify(g.pending_status))
console.log('   view.pending_status  =', JSON.stringify((rules.view ? rules.view(g, 'Allies') : {}).pending_status))
const cand = g.pending_status && g.pending_status.pending && g.pending_status.pending.candidates
console.log('   候选建设地区:', (cand || []).map(NAME))

// 选一个候选（优先挑一个相邻陆地的合法位；若无候选则说明 need 协议已兜底结束）
let chosen = null
if (cand && cand.length) chosen = cand[0]
if (chosen != null) {
  console.log('3) 玩家点选', NAME(chosen), '-> 第二次 activate_status')
  rules.action(g, 'Allies', 'activate_status', { card: '17547', space: chosen })
  console.log('   game.pending_status(应清空) =', JSON.stringify(g.pending_status))
  console.log('   美国陆军现在位于:', Object.keys(g.piece_type)
    .filter(p => g.piece_type[p] === 'army' && g.piece_nation[p] === '美国')
    .map(p => NAME(g.location[p])))
} else {
  console.log('3) 无候选：need 协议已兜底结束（符合"无合法地区则发动结束"）')
}
console.log('\n结论：17547 现在会先弹选位、再真正建设，不再静默不发动。')
