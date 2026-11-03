/*
 * 探查：17848《正面攻击》"一回合一次"是否会被反复触发（疑似可一回合多次）。
 * 复现思路：苏联回合发起陆战 -> after_land 武装 17848 -> 发动 -> 看 status_used 的键
 *          以及 current_nation 是否在中途被让权/战斗挂起改写（freq_key 用的是它）。
 *
 * 用法：node tools/_probe_17848_freq.js
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

/* 苏联：桌面放 17848；中亚放苏联陆军；中亚相邻放德国陆军（可打） */
R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
const su = Object.keys(d.spaces).map(Number).find(s => /罗斯/.test(d.name_of(s)))
const cn = d.id_of('中国西部')
console.log('苏联测试格 = ' + d.name_of(su) + '(' + su + ')')
R.action(g, 'Allies', 'debug_add_card', { face: '17848', nation: '苏联', dest: 'hand' })
I.refresh(g)
{
	const c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17848')
	let n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: c })
	console.log('苏联打出 17848: ' + logSince(g, n0))
}
console.log('苏联桌面 = ' + JSON.stringify((g.table['苏联'] || []).map(faceOf)))

/* 给苏联一支能开战的陆军：放在罗斯（大本营，必然补给） */
R.action(g, 'Allies', 'debug_place', { piece: 'su_atk', nation: '苏联', type: 'army', space: su })
/* 相邻格放德国陆军（找第一个陆地的邻居） */
const nb = I.get_connections(g, su, 'allies').find(s => d.spaces[s] && d.spaces[s].terrain !== 'sea')
R.action(g, 'Axis', 'debug_place', { piece: 'de_def', nation: '德国', type: 'army', space: nb })
I.refresh(g)
console.log('苏联陆军@' + d.name_of(su) + '  德国陆军@' + d.name_of(nb))

/* 发起陆战（真实基本卡：建设/发起陆战） */
const battleCards = Object.keys((g.hands['苏联'] || [])).map(i => (g.hands['苏联'] || [])[i]).filter(x => {
	const c = I.inst_card(x)
	return c && /发起陆战/.test(c.name || '')
})
console.log('苏联手牌里的发起陆战 = ' + JSON.stringify(battleCards))
if (!battleCards.length) {
	/* 没有就发一张（英国 15300-15304 是基本卡；苏联 17800-17804） */
	R.action(g, 'Allies', 'debug_add_card', { face: '17801', nation: '苏联', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['苏联'] || []).find(x => /发起陆战/.test((I.inst_card(x) || {}).name || ''))
	console.log('补发的战斗卡 = ' + c + ' ' + ((I.inst_card(c) || {}).name))
	battleCards.push(c)
}
{
	/* 直接走 do_battle 核心（本轮出牌名额已被 17848 用掉，基本卡打不出；战斗链测试同款） */
	let n0 = (g.log || []).length
	I.do_battle(g, '苏联', nb, 'de_def', 'land', { from: 'su_atk' })
	console.log('\n发起陆战: ' + logSince(g, n0))
}
console.log('  after_land 后 active=' + g.active + ' current_nation=' + g.current_nation)
console.log('  status_used=' + JSON.stringify(g.status_used || {}))
console.log('  status_instant=' + JSON.stringify((g.status_instant || []).map(x => ({
	card: x.card || x.cid || x.card_id, space: x.space,
}))))
{
	const v = R.view(g, 'Allies')
	console.log('  view.table_status(17848).ready=' + JSON.stringify(
		(v.table_status || []).filter(t => faceOf(t.card) === '17848')
			.map(t => ({ ready: t.ready, used: t.used, window: t.window }))))
	console.log('  view.status_instant=' + JSON.stringify((v.status_instant || []).map(x => x.card || x)))
}

/* 发动 17848 */
{
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: (g.table['苏联'] || []).find(x => faceOf(x) === '17848'), drop: [] })
	console.log('\n发动 17848: ' + logSince(g, n0))
	console.log('  status_used=' + JSON.stringify(g.status_used || {}))
	console.log('  current_nation=' + g.current_nation + ' active=' + g.active + ' turn=' + g.turn)
}
