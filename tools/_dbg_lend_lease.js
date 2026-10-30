// 验证 17535 租借法案 view 字段：hand 携带 type/img（供卡图显示），两阶段流程正确。
const path = require('path')
const r = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = r._internal

let pass = 0, fail = 0
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS', msg) } else { fail++; console.log('  FAIL', msg) } }

const g = r.setup(7, 'Standard', {})

// 1) 触发租借法案挂起
I.offer_us_lend_lease(g)
let v = r.view(g, 'Allies')
console.log('阶段1（美国选国，Allies 视角）:')
ok(v.us_lend_lease && v.us_lend_lease.step === 'nation', 'step = nation')
ok(JSON.stringify(v.us_lend_lease.nation_candidates) === JSON.stringify(['苏联', '英国']), '候选国 = [苏联, 英国]')

// 等待方（Axis）只看到 waiting_for，无 step
let va = r.view(g, 'Axis')
console.log('阶段1（Axis 视角，应仅等待）:')
ok(va.us_lend_lease && !va.us_lend_lease.step && va.us_lend_lease.waiting_for, '无 step，仅 waiting_for（客户端据此隐藏 modal）')

// 2) 美国选苏联
I.resolve_us_lend_lease_select(g, { nation: '苏联' })
// 给苏联塞一张手牌（取 setup 已发的首张）
const suHand = (g.hands['苏联'] || [])
ok(suHand.length > 0, '苏联手牌非空（用于验证 hand 字段）')
const cardId = suHand[0]
let v2 = r.view(g, 'Allies')
console.log('阶段2（苏联打牌，Allies 视角）:')
ok(v2.us_lend_lease && v2.us_lend_lease.step === 'play', 'step = play')
ok(v2.us_lend_lease.nation === '苏联', 'nation = 苏联')
const h0 = v2.us_lend_lease.hand && v2.us_lend_lease.hand[0]
ok(h0 && h0.id === cardId, 'hand[0].id 即实例 id（send_action 据此传 card）')
ok(h0 && typeof h0.type !== 'undefined', 'hand[0].type 存在（卡图渲染所需）')
ok(h0 && typeof h0.img !== 'undefined', 'hand[0].img 存在（卡图渲染所需）')
ok(h0 && h0.name, 'hand[0].name 存在')
console.log('    示例 hand[0] =', JSON.stringify(h0))

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
