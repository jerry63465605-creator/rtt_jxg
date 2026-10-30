/* 真驱动整张 17533：验证征召->建设海军 的真实顺序与候选数量 */
const rules = require('c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/rules.js')
const I = rules._internal
const NAME = id => (rules._internal.data && rules._internal.data.spaces[id] && rules._internal.data.spaces[id].name) || ('#' + id)
const names = ids => (ids || []).map(NAME)

const g = rules.setup(12345, 'Standard', {})
console.log('初始：美国陆军=', Object.keys(g.piece_type).filter(p => g.piece_type[p] === 'army' && g.piece_nation[p] === '美国').map(p => NAME(g.location[p])))
console.log('初始：美国海军=', Object.keys(g.piece_type).filter(p => g.piece_type[p] === 'navy' && g.piece_nation[p] === '美国').map(p => NAME(g.location[p])))

/* 第一次调用：needs 阶段（第 0 步征召尚未真正落子） */
const r1 = I.resolve_event_card(g, '美国', '17533', {})
console.log('\n=== r1 (needs 阶段) ===')
console.log('pending=', r1.pending, 'need=', r1.need ? JSON.stringify({ need: r1.need.need, step: r1.need.step, candidates: names(r1.need.candidates), pick: r1.need.pick }) : '无')
if (r1.need && r1.need.candidates) {
  console.log('>> 第 2 步(建设海军) 候选点位 =', names(r1.need.candidates), ' (共', r1.need.candidates.length, '个)')
}

/* 模拟客户端：在第 2 步候选里选第一个，回传 arg.spaces[step]=[pick] */
if (r1.need && r1.need.candidates && r1.need.candidates.length) {
  const pick = r1.need.candidates[0]
  const arg = { spaces: [undefined, [pick]] }
  const r2 = I.resolve_event_card(g, '美国', '17533', arg)
  console.log('\n=== r2 (回传选择后) ===')
  console.log('ok=', r2.ok, 'desc=', r2.desc || '')
  console.log('美国陆军=', Object.keys(g.piece_type).filter(p => g.piece_type[p] === 'army' && g.piece_nation[p] === '美国').map(p => NAME(g.location[p])))
  console.log('美国海军=', Object.keys(g.piece_type).filter(p => g.piece_type[p] === 'navy' && g.piece_nation[p] === '美国').map(p => NAME(g.location[p])))
}
