/*
 * 【2026-10-26】弹窗可见性（保密）回归：
 *   · view.pending_echo —— 17546 铆钉女工等，候选是【手牌】，只能给归属阵营
 *   · view.peek         —— 15215 卓越规划（自己牌堆顶）/ 15305 双十字（对手手牌）
 *   · view.us_depression_discard —— 17555 的义务提示，只给美国阵营
 *
 * 重点断言两件事：
 *   ① 对手拿不到（裁到 null）
 *   ② 有权方照旧拿得到（防过严）
 * 另加一条"反向"断言：15305 里 pk.nation 是【被看方】，不能用它判定，
 *   否则会把牌发给被看的那个人（正是要防的错）。
 *
 * 用法：node tools/_smoke_ui_visibility.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

let pass = 0, fail = 0
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}
function fresh(nation) {
  const g = rules.setup(1)
  g.opening = null
  g.current_nation = nation
  g.active = (nation === '德国' || nation === '意大利' || nation === '日本') ? 'Axis' : 'Allies'
  g.turn_phase = 'play'
  return g
}

console.log('\n[A] pending_echo（17546 铆钉女工：候选是手牌）')
{
  const g = fresh('美国')
  g.pending_echo = {
    card: '17546', kind: 'status', step: 'first',
    title: '铆钉女工：选 1 张手牌置于牌堆底',
    candidates: [{ id: '15310#1', name: '建设陆军' }],
    allowDone: true,
  }
  const a = rules.view(g, 'Allies')
  const x = rules.view(g, 'Axis')
  ok('美国阵营拿得到（不误伤）', !!(a.pending_echo && a.pending_echo.candidates.length))
  ok('对手拿到 null（不泄露手牌）', x.pending_echo === null, '实际=' + JSON.stringify(x.pending_echo))
}

console.log('\n[B] peek —— 15215 卓越规划（检视自己牌堆顶）')
{
  const g = fresh('德国')
  g.peek = { nation: '德国', cards: ['15310#1'], card: '15215', topBottom: true, viewer: '德国' }
  const ax = rules.view(g, 'Axis')
  const al = rules.view(g, 'Allies')
  ok('德国阵营拿得到（不误伤）', !!(ax.peek && ax.peek.cards.length))
  ok('同盟拿到 null（不泄露下几张摸牌）', al.peek === null, '实际=' + JSON.stringify(al.peek))
}

console.log('\n[C] peek —— 15305 双十字（看【对手】手牌：nation=被看方，viewer=窥视方）')
{
  const g = fresh('德国')
  /* 被看方是英国（Allies），窥视方是德国（Axis） */
  g.peek = { nation: '英国', cards: ['15320#1'], card: '15305', viewer: '德国' }
  const ax = rules.view(g, 'Axis')
  const al = rules.view(g, 'Allies')
  ok('窥视方（德国/Axis）拿得到', !!(ax.peek && ax.peek.cards.length))
  ok('★被看方（英国/Allies）拿不到 —— 证明用的是 viewer 而非 nation',
    al.peek === null, '实际=' + JSON.stringify(al.peek))
}

console.log('\n[D] us_depression_discard（17555 义务提示）')
{
  const g = fresh('美国')
  g.table = g.table || {}
  g.table['美国'] = (g.table['美国'] || []).concat(['17555#1'])
  g.us_depression_discard = { nation: '美国', pending: true }
  const a = rules.view(g, 'Allies')
  const x = rules.view(g, 'Axis')
  ok('美国阵营看得到', a.us_depression_discard === true)
  ok('对手看不到（不再弹无用框）', x.us_depression_discard === false,
    '实际=' + JSON.stringify(x.us_depression_discard))
}

console.log('\n[E] 无 viewer 的旧存档：按 current_nation 兜底（不能卡死，也不能双方可见）')
{
  const g = fresh('德国')   /* current_nation = 德国 */
  g.peek = { nation: '德国', cards: ['15310#1'], card: '15215' }   /* 缺 viewer（旧存档） */
  const ax = rules.view(g, 'Axis')
  const al = rules.view(g, 'Allies')
  ok('窥视方（按 current_nation 推断）仍拿得到 -> 旧存档不卡死', !!ax.peek)
  ok('对手仍拿不到 -> 兜底也不泄露', al.peek === null,
    '实际=' + JSON.stringify(al.peek))
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
