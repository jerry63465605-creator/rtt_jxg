/*
 * 验证：拦截询问时，客户端能看到【被拦截的卡】
 *   例：德国打出 14500《黄色方案》 -> 英国 15352 的询问框显示"【德国】打出《黄色方案》"
 *
 *  A. enemy_echo_played（15352/16700）：view.armed_offer.target 带 name/nation/via/text
 *  B. 触发来源（via='trigger'）：target.via='trigger'，客户端文案写"触发"
 *  C. enemy_status_effect（15353）：target 指向被拦的状态卡
 *  D. 保密：只有能表态的一方拿得到 target（另一方 armed_offer 为 null）
 *  E. 静态：客户端标题/描述拼装 + .ask_text 保留换行
 *
 * 用法：node tools/_verify_intercept_target_ui.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

console.log('\n=== A. 增强卡打出被 15352 拦：target=黄色方案 ===')
const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Allies', 'debug_set_phase', { nation: '德国', phase: 'play' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_a', nation: '德国', type: 'army', space: d.id_of('德国') })
R.action(g, 'Axis', 'debug_add_card', { face: '14500', nation: '德国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15341', nation: '英国', dest: 'hand' })
I.refresh(g)
/* 14500 是德国打出的增强卡；英国 15352 是拦截方 —— 但注意 15352 属同盟，需德国是轴心（是） */
const c14500 = (g.hands['德国'] || []).find(x => faceOf(x) === '14500')
ok('14500 已在德国手牌', !!c14500, JSON.stringify(g.hands['德国']))
R.action(g, 'Axis', 'play_card', { card: c14500 })
/* 若 14500 需要参数（多步），这里可能停在 need；打印日志便于判断 */
console.log('  log: ' + (g.log || []).slice(-2).join(' | '))

const vUk = R.view(g, 'Allies')
const ao = vUk.armed_offer
const isEchoWin = !!(ao && ao.when === 'enemy_echo_played')
if (!isEchoWin) {
	console.log('  （未开 enemy_echo_played 窗口，armed_offer=' +
		JSON.stringify(ao && ao.when) + '）—— 14500 可能需先选参数，改用直接派发窗口验证')
}

/* 直接用真实派发函数开窗（等价于 play_card 的派发点），聚焦 UI 数据 */
const g2 = R.setup(7)
g2.opening = null
I.refresh(g2)
R.action(g2, 'Allies', 'debug_set_phase', { nation: '德国', phase: 'play' })
R.action(g2, 'Axis', 'debug_add_card', { face: '14500', nation: '德国', dest: 'hand' })
R.action(g2, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
I.refresh(g2)
const c2 = (g2.hands['德国'] || []).find(x => faceOf(x) === '14500')
I.offer_armed_effects(g2, 'enemy_echo_played', { nation: '德国', card: c2, space: null, via: 'play', window: 'enemy_echo_played' })
const v2 = R.view(g2, 'Allies')
const ao2 = v2.armed_offer
ok('★ 开出 enemy_echo_played 窗口', !!(ao2 && ao2.when === 'enemy_echo_played'),
	JSON.stringify(ao2 && ao2.when))
ok('★ target 指向被拦截的卡（黄色方案）',
	!!(ao2 && ao2.target && ao2.target.name === '黄色方案'),
	JSON.stringify(ao2 && ao2.target && ao2.target.name))
ok('target.nation=德国', !!(ao2 && ao2.target && ao2.target.nation === '德国'),
	JSON.stringify(ao2 && ao2.target && ao2.target.nation))
ok('target.via=play（主动打出）', !!(ao2 && ao2.target && ao2.target.via === 'play'),
	JSON.stringify(ao2 && ao2.target && ao2.target.via))
ok('target.text 带卡面文本（供描述行）',
	!!(ao2 && ao2.target && (ao2.target.text || '').length > 4),
	JSON.stringify(ao2 && ao2.target && (ao2.target.text || '').slice(0, 40)))

console.log('\n=== B. 触发来源：target.via=trigger ===')
const g3 = R.setup(7)
g3.opening = null
I.refresh(g3)
R.action(g3, 'Allies', 'debug_set_phase', { nation: '德国', phase: 'play' })
R.action(g3, 'Axis', 'debug_add_card', { face: '15208', nation: '德国', dest: 'hand' })
R.action(g3, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
I.refresh(g3)
const c3 = (g3.hands['德国'] || []).find(x => faceOf(x) === '15208')
I.offer_armed_effects(g3, 'enemy_echo_played', { nation: '德国', card: c3, space: null, via: 'trigger', srcWhen: 'after_build_navy', window: 'enemy_echo_played' })
const ao3 = R.view(g3, 'Allies').armed_offer
ok('★ target.via=trigger', !!(ao3 && ao3.target && ao3.target.via === 'trigger'),
	JSON.stringify(ao3 && ao3.target && ao3.target.via))
ok('target.name=齐柏林伯爵号', !!(ao3 && ao3.target && /齐柏林/.test(ao3.target.name)),
	JSON.stringify(ao3 && ao3.target && ao3.target.name))
ok('窗口 src_when=after_build_navy', !!(ao3 && ao3.src_when === 'after_build_navy'),
	JSON.stringify(ao3 && ao3.src_when))

console.log('\n=== C. 状态卡被 15353 拦：target=状态卡 ===')
const g4 = R.setup(7)
g4.opening = null
I.refresh(g4)
R.action(g4, 'Allies', 'debug_set_phase', { nation: '德国', phase: 'play' })
R.action(g4, 'Axis', 'debug_add_card', { face: '15248', nation: '德国', dest: 'hand' })
R.action(g4, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
I.refresh(g4)
const c4 = (g4.hands['德国'] || []).find(x => faceOf(x) === '15248')
I.offer_armed_effects(g4, 'enemy_status_effect', { nation: '德国', card: c4, arg: { card: c4, space: 1 }, window: 'enemy_status_effect' })
const ao4 = R.view(g4, 'Allies').armed_offer
ok('开出 enemy_status_effect', !!(ao4 && ao4.when === 'enemy_status_effect'),
	JSON.stringify(ao4 && ao4.when))
ok('★ target 指向状态卡《合成燃料》', !!(ao4 && ao4.target && /合成燃料/.test(ao4.target.name)),
	JSON.stringify(ao4 && ao4.target && ao4.target.name))
ok('target.type=STATUS', !!(ao4 && ao4.target && ao4.target.type === 'STATUS'),
	JSON.stringify(ao4 && ao4.target && ao4.target.type))

console.log('\n=== D. 保密：无权表态的一方拿不到 ===')
ok('★ 轴心视角 armed_offer=null（看不到英国的询问内容）',
	!R.view(g2, 'Axis').armed_offer, JSON.stringify(R.view(g2, 'Axis').armed_offer))

console.log('\n=== E. 静态：客户端接线 ===')
{
	const pj = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const css = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8')
	ok('客户端读 ao.target 拼标题', pj.indexOf('const tgt = ao.target || null') > 0)
	ok('标题含"是否拦截"', pj.indexOf('—— 是否拦截？') > 0)
	ok('描述含"被拦截："前缀', pj.indexOf("'被拦截：'") > 0)
	ok('触发来源写"触发"', pj.indexOf("tgt.via === 'trigger' ? '触发' : '打出'") > 0)
	ok('.ask_text 保留换行（white-space: pre-line）',
		/\.ask_text[^{]*\{[^}]*white-space:\s*pre-line/.test(css))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
