/* 验证 17550 先进造船厂（navy 版）同样走 need 两步选位 */
const rules = require('c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/rules.js')
const I = rules._internal
const NAME = id => (I.data && I.data.spaces[id] && I.data.spaces[id].name) || ('#' + id)

const g = rules.setup(12345, 'Standard', {})
g.current_nation = '美国'
g.turn_phase = 'play'
g.table = g.table || {}
g.table['美国'] = (g.table['美国'] || []).concat(['17550'])
const navySpace = 52 // 东太平洋
g.status_instant = [{ card_id: '17550', nation: '美国', window: 'after_build_navy', space: navySpace }]

rules.action(g, 'Allies', 'activate_status', { card: '17550' })
const cand = g.pending_status && g.pending_status.pending && g.pending_status.pending.candidates
console.log('17550 候选建设海域:', (cand || []).map(NAME))
if (cand && cand.length) {
  const chosen = cand.find(c => c !== navySpace) || cand[0]
  rules.action(g, 'Allies', 'activate_status', { card: '17550', space: chosen })
  console.log('选', NAME(chosen), '后美国海军位于:', Object.keys(g.piece_type)
    .filter(p => g.piece_type[p] === 'navy' && g.piece_nation[p] === '美国')
    .map(p => NAME(g.location[p])))
  console.log('pending_status(应清空) =', JSON.stringify(g.pending_status))
}
