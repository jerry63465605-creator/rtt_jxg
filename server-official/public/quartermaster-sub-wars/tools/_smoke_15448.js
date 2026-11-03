const rules = require('../rules.js')
const I = rules._internal
const { data } = require('../data.js')

let SEA = null
for (const k of Object.keys(data.spaces)) {
  if (data.name_of(Number(k)) === '东南亚') { SEA = Number(k); break }
}
console.log('东南亚 id =', SEA)

const g = rules.setup('t-15448-' + Math.random(), 'Standard', {})
console.log('trigger.on =', I.RESPONSE_EFFECTS['15448'].trigger.on)

const ctx = { nation: '日本', space: SEA }

/* 1) 未选 -> pending 单格候选 */
const r0 = I.RESPONSE_EFFECT_IMPL['15448'](g, 'Axis', ctx, undefined)
console.log('pending =', JSON.stringify(r0))
const pendingOk = r0 && r0.pending === true && r0.kind === 'space' &&
  r0.candidates.length === 1 && Number(r0.candidates[0].id) === Number(SEA)

/* 2) 提交候选 -> 东南亚多1支日本陆军 */
const count = gg => Object.keys(gg.location)
  .filter(p => Number(gg.location[p]) === SEA && gg.piece_nation[p] === '日本' && gg.piece_type[p] === 'army').length
const before = count(g)
const r1 = I.RESPONSE_EFFECT_IMPL['15448'](g, 'Axis', ctx, SEA)
const after = count(g)
console.log('征召结果 =', JSON.stringify(r1), '| 东南亚日本陆军', before, '->', after)

/* 3) 伪造 choice 拒绝 */
const r2 = I.RESPONSE_EFFECT_IMPL['15448'](g, 'Axis', ctx, 999)
console.log('非法choice =', JSON.stringify(r2))

console.log(pendingOk && after === before + 1 && r2.ok === false ? 'SMOKE PASS' : 'SMOKE FAIL')
