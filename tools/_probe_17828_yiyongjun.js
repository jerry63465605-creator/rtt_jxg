/*
 * 复现：场上有 17553《抗日义勇军》时，苏联打 17828《百团大战》-> 没有跳转到轴心(日本)弃牌，卡死。
 *
 * 用法：node tools/_probe_17828_yiyongjun.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const g = R.setup(7)
g.opening = null
I.refresh(g)

/* ① 美国打出 17553《抗日义勇军》放到桌面 */
R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
/* 17553 开局就在美国手牌里（V1：不能 debug_add 第二份） */
I.refresh(g)
{
	const c = (g.hands['美国'] || []).find(x => faceOf(x) === '17553')
	let n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: c })
	console.log('美国打出 17553: ' + logSince(g, n0))
	/* 17555《大萧条的余波》：美国打出状态卡后须自选弃 1 张（game.us_depression_discard），
	 * 弃完服务端会按原参数重放这张卡 */
	if (g.us_depression_discard && g.us_depression_discard.pending) {
		const pay = (g.hands['美国'] || []).filter(x => String(x).split('#')[0] !== '17553')[0]
		n0 = (g.log || []).length
		R.action(g, 'Allies', 'us_depression_discard', { card: pay })
		console.log('  17555 弃牌: ' + logSince(g, n0))
	}
}
console.log('美国桌面 = ' + JSON.stringify((g.table['美国'] || []).map(faceOf)))

/* ② 找中国地区 + 相邻的日本陆军格 */
const cnSpaces = I.space_ids_expand ? I.space_ids_expand(['中国']) : [d.id_of('中国')]
console.log('中国地区 = ' + JSON.stringify(cnSpaces.map(s => s + ':' + d.name_of(s))))
let jpSpace = null
for (const cn of cnSpaces) {
	for (const nb of (d.spaces[cn].connections || [])) {
		if (nb === cn) continue
		jpSpace = nb
		break
	}
	if (jpSpace) break
}
console.log('候选日军格 = ' + (jpSpace != null ? jpSpace + ':' + d.name_of(jpSpace) : '(无)'))

/* ③ 苏联打出 17828 */
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'resource' })   /* 先离开美国回合 */
R.action(g, 'Allies', 'debug_place', { piece: 'jp_a1', nation: '日本', type: 'army', space: jpSpace })
R.action(g, 'Allies', 'debug_add_card', { face: '17828', nation: '苏联', dest: 'hand' })
R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
I.refresh(g)
{
	const c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17828')
	let n0 = (g.log || []).length
	/* 第 1 步是"在<中国>之一征召"，需要指定地区（3 个中国地区 -> 必选） */
	const first = cnSpaces[0]
	R.action(g, 'Allies', 'play_card', { card: c, space: first, spaces: [first] })
	console.log('\n苏联打出 17828（征召@' + d.name_of(first) + '）: ' + logSince(g, n0))
	let guard = 0
	while (g.pending_event_step && guard++ < 4) {
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'event_step_next', {})
		console.log('  下一步: ' + logSince(g, n1))
	}
}

const dump = (label) => {
	const vA = R.view(g, 'Allies'), vX = R.view(g, 'Axis')
	console.log('\n--- ' + label + ' ---')
	console.log('  active=' + g.active + '  current_nation=' + g.current_nation)
	console.log('  us_japan_delegate=' + JSON.stringify(g.us_japan_delegate && {
		return_nation: g.us_japan_delegate.return_nation, reason: g.us_japan_delegate.reason,
	}))
	console.log('  event_budget=' + JSON.stringify(g.event_budget && {
		card: g.event_budget.card, step: g.event_budget.step, remaining: g.event_budget.remaining,
		targets: (g.event_budget.targets || []).length,
	}))
	console.log('  pending_echo=' + JSON.stringify(g.pending_echo && g.pending_echo.kind))
	console.log('  pending_event_step=' + JSON.stringify(g.pending_event_step && g.pending_event_step.step))
	console.log('  Allies: my_nation=' + vA.my_nation + ' us_japan_delegate=' + JSON.stringify(vA.us_japan_delegate) +
		' active=' + JSON.stringify(vA.active) + ' actions(jp)=' +
		JSON.stringify(Object.keys(vA.actions || {}).filter(k => /japan|delegate/.test(k))))
	console.log('  Axis  : my_nation=' + vX.my_nation + ' us_japan_delegate=' + JSON.stringify(vX.us_japan_delegate) +
		' active=' + JSON.stringify(vX.active) + ' actions(jp)=' +
		JSON.stringify(Object.keys(vX.actions || {}).filter(k => /japan|delegate/.test(k))))
}
dump('打出后')

/* ④ 轴心（日本）尝试弃牌结算 */
{
	const hand = g.hands['日本'] || []
	console.log('\n日本手牌数 = ' + hand.length)
	if (hand.length) {
		let n0 = (g.log || []).length
		R.action(g, 'Axis', 'resolve_japan_delegate', { card: hand[0] })
		console.log('resolve_japan_delegate: ' + logSince(g, n0))
		dump('轴心结算后')
	}
}
