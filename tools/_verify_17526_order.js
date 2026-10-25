/*
 * 【验收】17526 民主兵工厂：先选建造顺序 → 按顺序依次建（参考 17532 战区移动）。
 *
 * 断言：
 *   ① 委托建立后处于 stage='order'，两个兵种都在（不再被 autoskip 删除）
 *   ② 选「先陆军」后 stage='build'、current='army'
 *   ③ 建完陆军 → current 变 'navy'，且【海军此时可建】（旧实现已被删除、建不了）
 *   ④ 建完海军 → 委托收尾、归还美国
 *   ⑤ 反向顺序（先海军）同样能走完
 *   ⑥ 当前兵种确实无处可建时，允许 skip 放弃，且不会卡住
 *
 * 用法：node tools/_verify_17526_order.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}
function spacesOf(g, type) {
  const out = []
  for (let s = 1; s < 500; s++) {
    const r = I.can_build_at(g, '英国', s, 'army')
    if (r && r.reason === '地区不存在') break
    if (I.can_build_at(g, '英国', s, type).ok) out.push(s)
  }
  return out
}
function fresh() {
  const g = rules.setup(1)
  g.opening = null
  g.current_nation = '美国'
  g.active = 'Allies'
  g.turn_phase = 'play'
  g.hands['美国'] = ['17526#1', '15310#1', '15311#1']
  return g
}

console.log('=== A. 先陆军、后海军（旧实现下海军会被删掉） ===')
{
  const g = fresh()
  /* 腾出不列颠，制造"此时海军 0 处、建完陆军后可建"的局面 */
  const BR = I.space_id_of('不列颠')
  const ped = I.pieces_on(g, BR).find(p => g.piece_nation[p] === '英国' && g.piece_type[p] === 'army')
  if (ped != null) rules.action(g, 'Allies', 'debug_remove', { piece: ped })

  rules.action(g, 'Allies', 'play_card', { card: '17526#1' })
  const dg = g.uk_build_delegate
  ok('委托已建立', !!dg)
  ok('阶段 = order（先选顺序）', dg && dg.stage === 'order')
  ok('两个兵种都在（未被删除）',
    dg && dg.order === null && JSON.stringify(dg.skipped) === '[]')

  const navyBefore = spacesOf(g, 'navy')
  const armyBefore = spacesOf(g, 'army')
  console.log('    （局面：海军 ' + navyBefore.length + ' 处、陆军 ' + armyBefore.length + ' 处）')

  /* 选「先陆军」 */
  rules.action(g, 'Allies', 'resolve_uk_build_delegate', { first: 'army' })
  ok('选完顺序 -> stage=build', g.uk_build_delegate.stage === 'build')
  ok('order = army→navy', JSON.stringify(g.uk_build_delegate.order) === JSON.stringify(['army', 'navy']))
  ok('current = army', I.uk_build_current_type(g.uk_build_delegate) === 'army')

  /* 建陆军 */
  const aSp = spacesOf(g, 'army')[0]
  if (aSp != null) {
    rules.action(g, 'Allies', 'resolve_uk_build_delegate', { space: aSp, build: 'army' })
    ok('建完陆军后 idx 前进', g.uk_build_delegate.idx === 1)
    ok('current 变 navy', I.uk_build_current_type(g.uk_build_delegate) === 'navy')
    const navyAfter = spacesOf(g, 'navy')
    ok('★ 建完陆军后海军变得可建', navyAfter.length > 0,
      '旧实现此值恒为 0（已被删除）')
    /* 建海军 */
    if (navyAfter.length) {
      rules.action(g, 'Allies', 'resolve_uk_build_delegate', { space: navyAfter[0], build: 'navy' })
    }
    ok('两支都建完 -> 委托收尾', !g.uk_build_delegate)
    ok('控制权归还美国', g.current_nation === '美国')
  } else {
    console.log('    （陆军无处可建，改测放弃路径）')
  }
}

console.log('\n=== B. 反向顺序：先海军、后陆军 ===')
{
  const g = fresh()
  rules.action(g, 'Allies', 'play_card', { card: '17526#1' })
  rules.action(g, 'Allies', 'resolve_uk_build_delegate', { first: 'navy' })
  ok('order = navy→army', JSON.stringify(g.uk_build_delegate.order) === JSON.stringify(['navy', 'army']))
  ok('current = navy', I.uk_build_current_type(g.uk_build_delegate) === 'navy')
  const nSp = spacesOf(g, 'navy')[0]
  if (nSp != null) {
    rules.action(g, 'Allies', 'resolve_uk_build_delegate', { space: nSp, build: 'navy' })
    ok('建完海军后 idx=1', g.uk_build_delegate.idx === 1)
    const aSp2 = spacesOf(g, 'army')[0]
    if (aSp2 != null) {
      rules.action(g, 'Allies', 'resolve_uk_build_delegate', { space: aSp2, build: 'army' })
      ok('随后建完陆军 -> 收尾', !g.uk_build_delegate)
    } else {
      ok('陆军无处可建 -> 可放弃', !!rules.view(g, 'Allies').uk_build_delegate.can_skip)
      rules.action(g, 'Allies', 'resolve_uk_build_delegate', { skip: true })
      ok('放弃后收尾', !g.uk_build_delegate)
    }
  }
}

console.log('\n=== C. 顺序不符时服务端拒绝（防串建） ===')
{
  const g = fresh()
  rules.action(g, 'Allies', 'play_card', { card: '17526#1' })
  rules.action(g, 'Allies', 'resolve_uk_build_delegate', { first: 'army' })
  const nSp = spacesOf(g, 'navy')[0]
  if (nSp != null) {
    const b = g.log.length
    rules.action(g, 'Allies', 'resolve_uk_build_delegate', { space: nSp, build: 'navy' })
    ok('按顺序应建陆军时提交海军 -> 被拒且未落地',
      /当前按顺序应建设陆军/.test(g.log.slice(b).join('|')) && g.uk_build_delegate.idx === 0)
  } else {
    console.log('    （无海军候选，跳过）')
  }
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
