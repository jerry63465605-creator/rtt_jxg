/*
 * 排查：为什么"装载型"（armed 触发型）增强卡在【触发那一刻】无法被 15352/16700 拦？
 *
 * 三个待验证点：
 *   ① 装载后卡片是否还在手牌（scan_armed_cards 只扫 hands）
 *   ② 触发时（use_armed_offer）有没有派发 enemy_echo_played 窗口
 *   ③ 唯一的触发时派发点 suspend_armed_use_for_counter 是否被 off.when 早退挡掉
 *
 * 用法：node tools/_probe_armed_trigger_intercept.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

/* ---------- ① 装载后卡片在哪 ---------- */
const g = R.setup(7)
g.opening = null
g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'; g.neutral = {}
g.hands['德国'] = ['15205#1', '15341#1', '15341#2']
g.decks['德国'] = ['15345#1', '15345#2', '15345#3']
g.hands['英国'] = ['15352#1', '15341#70']
g.location = {}; g.piece_nation = {}; g.piece_type = {}
g.location['de_a'] = d.id_of('德国'); g.piece_nation['de_a'] = '德国'; g.piece_type['de_a'] = 'army'
I.refresh(g)

console.log('\n=== ① 装载（打出 15205 JU-87）===')
const n0 = (g.log || []).length
R.action(g, 'Axis', 'play_card', { card: '15205#1' })
;(g.log || []).slice(n0).forEach(l => console.log('  log| ' + l))
const inHand = (g.hands['德国'] || []).indexOf('15205#1') >= 0
const inDisc = (g.discard['德国'] || []).indexOf('15205#1') >= 0
console.log('  15205 在手里=' + inHand + '  在弃牌堆=' + inDisc)
ok('装载后卡片【仍在手牌】（scan_armed_cards 能扫到）', inHand)
ok('装载后【不在】弃牌堆', !inDisc)

/* 装载时是否开了拦截窗口？—— 打出时会有 */
ok('★ 打出/装载那一刻会派发 enemy_echo_played（英国 15352 可拦）',
	(g.armed_offers || []).some(w => w.when === 'enemy_echo_played'),
	JSON.stringify((g.armed_offers || []).map(w => w.when)))

/* 英国放弃拦截，让卡真正装载生效 */
if ((g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	R.action(g, 'Allies', 'skip_armed_offer', {})

/* ---------- ② 触发时是否派发窗口 ---------- */
console.log('\n=== ② 触发（德国部署空军后 after_deploy_air）===')
const FR = d.id_of('法国')
g.location['de_air'] = d.id_of('德国'); g.piece_nation['de_air'] = '德国'; g.piece_type['de_air'] = 'air'
I.refresh(g)
/* 直接派发 after_deploy_air 窗口（模拟"刚部署完空军"） */
I.offer_armed_effects(g, 'after_deploy_air', { nation: '德国', space: d.id_of('德国') })
const win = (g.armed_offers || []).find(w => w.when === 'after_deploy_air')
console.log('  after_deploy_air 窗口=' + JSON.stringify(win && win.cards && win.cards.map(c => c.card_id)))
ok('触发窗口里出现了 15205（待命）', !!(win && win.cards && win.cards.some(c => c.card_id === '15205#1')))

if (win && win.cards.some(c => c.card_id === '15205#1')) {
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card: '15205#1', space: FR })
	;(g.log || []).slice(n1).forEach(l => console.log('  log| ' + l))
	console.log('  触发后 armed_offers=' + JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★ 触发时【没有】给英国开 enemy_echo_played 窗口',
		!(g.armed_offers || []).some(w => w.when === 'enemy_echo_played'))
	ok('触发时英国 15352 仍在手牌（从未被询问）', (g.hands['英国'] || []).indexOf('15352#1') >= 0)
}

/* ---------- ③ 唯一的触发时派发点被 off.when 早退 ---------- */
console.log('\n=== ③ suspend_armed_use_for_counter 的门槛 ===')
const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const i = src.indexOf('function suspend_armed_use_for_counter')
const seg = src.slice(i, i + 900)
console.log(seg.split('\n').slice(0, 16).map(l => '  ' + l.trim()).join('\n'))
ok('该函数第一道门就是 off.when !== enemy_echo_played -> return false',
	/if \(!off \|\| off\.when !== 'enemy_echo_played'\) return false/.test(seg))

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
