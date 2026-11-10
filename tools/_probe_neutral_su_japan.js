/*
 * 只读探针：苏联中立时的攻击判定
 *
 * 玩家口径（2026-11-11）：「构建英国回合对中国东北发起陆战，且需要检查，
 *   苏联中立时，应该仍然可以攻击日本，仅仅不能攻击意大利和德国」
 *
 * 不改任何产品代码。new_board() 建真实盘面，全程 R.action 驱动。
 *
 * 用法：node tools/_probe_neutral_su_japan.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const NE = d.id_of('中国东北')
const CE = d.id_of('中国东部')
const W = d.id_of('中国西部')

const instOf = (g, nat, face) =>
	(g.hands[nat] || []).find(x => faceOf(x) === String(face)) || null

/*
 * 摆初始局面。
 * who='英国'：英国陆军在中国西部，<中国东北>只放日本守军（玩家要的场景）。
 * who='苏联'：切到苏联回合，苏联陆军在中国东北作发起单位，目标在<中国东部>。
 */
function scene(targetNation, withArmy, who) {
	const nat = who || '英国'
	const g = new_board(20261111, { nation: nat, phase: 'play' })
	clear_pending(g)
	g.current_nation = nat
	g.active = (nat === '英国' || nat === '苏联') ? 'Allies' : 'Axis'
	/* <中国东部> 开局有中国陆军 p8，先真实移除 */
	R.action(g, 'Axis', 'debug_remove', { piece: 'p8' })
	I.refresh(g)
	place(g, 'uk_w', '英国', 'army', '中国西部')
	/* 苏联发起单位：放<中国东北>（与<中国东部>相邻），真实补给链 */
	place(g, 'su_sib', '苏联', 'army', '西伯利亚')
	place(g, 'su_vl', '苏联', 'army', '海参崴')
	place(g, 'su_ne', '苏联', 'army', '中国东北')
	I.refresh(g)
	if (withArmy) {
		g.location['tgt'] = CE
		g.piece_nation['tgt'] = targetNation
		g.piece_type['tgt'] = 'army'
		I.refresh(g)
	}
	I.grant_supply(g, 'uk_w', g.turn || 1)
	I.grant_supply(g, 'su_ne', g.turn || 1)
	I.refresh(g)
	I.compute_supply(g)
	return g
}

console.log('=== 配置事实 ===')
console.log('  NEUTRAL_RULES[苏联].enemies = ' + J(I.NEUTRAL_RULES && I.NEUTRAL_RULES['苏联'] && I.NEUTRAL_RULES['苏联'].enemies))
console.log('  NEUTRAL_RULES[美国].enemies = ' + J(I.NEUTRAL_RULES && I.NEUTRAL_RULES['美国'] && I.NEUTRAL_RULES['美国'].enemies))
{
	const g = scene('日本', true)
	console.log('  is_neutral(苏联) = ' + J(I.is_neutral(g, '苏联')))
	console.log('  is_neutral(英国) = ' + J(I.is_neutral(g, '英国')))
	console.log('  neutral_attack_check 对照：')
	for (const nat of ['日本', '德国', '意大利', '英国', '中国', null]) {
		const r = I.neutral_attack_check(g, '苏联', nat)
		console.log('    苏联 vs ' + String(nat) + ' => ' + J(r))
	}
	console.log('  英国 vs 日本 => ' + J(I.neutral_attack_check(g, '英国', '日本')))
}

/* ================= A. 玩家要的主场景：英国回合对中国东北发起陆战 ================= */
console.log('\n=== A. 英国回合：<中国西部> 对 <中国东北> 发起陆战 ===')
{
	const g = scene('日本', true)
	give(g, '15301', '英国')       /* 发起陆战 */
	I.refresh(g)
	/* <中国东北> 只放日本陆军当靶子（英国不能攻击有友军的地区，故不在此放苏军） */
	delete g.location['su_ne']; delete g.piece_nation['su_ne']; delete g.piece_type['su_ne']
	g.location['jp_ne'] = NE
	g.piece_nation['jp_ne'] = '日本'
	g.piece_type['jp_ne'] = 'army'
	I.refresh(g)
	console.log('  中国东北 = ' + J(I.pieces_on(g, NE).map(p =>
		p + ':' + g.piece_nation[p] + '/' + g.piece_type[p])))
	console.log('  英国发起单位 = ' + J(I.battle_initiators(g, '英国', NE)))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '英国', '15301'), space: NE, piece: 'jp_ne',
	})
	I.refresh(g)
	console.log('  打出 log = ' + logSince(g, n0).slice(0, 350))
	console.log('  中国东北战后 = ' + J(I.pieces_on(g, NE).map(p =>
		p + ':' + g.piece_nation[p] + '/' + g.piece_type[p])))
	console.log('  pending_battle = ' + J(g.pending_battle && { stage: g.pending_battle.stage }))
}

/* ================= B. 苏联中立：打日本 / 德国 / 意大利（有敌军） ================= */
console.log('\n=== B. 苏联中立 + 对<中国东部>发起陆战（按目标国对照）===')
for (const nat of ['日本', '德国', '意大利']) {
	const g = scene(nat, true, '苏联')
	give(g, '17801', '苏联')       /* 苏联 BASIC 发起陆战 */
	I.refresh(g)
	console.log('  [' + nat + '] current_nation=' + g.current_nation +
		' 苏发起单位=' + J(I.battle_initiators(g, '苏联', CE)))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '苏联', '17801'), space: CE, piece: 'tgt',
	})
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  [' + nat + '] ' + (lg || '(无日志)').slice(0, 220))
	console.log('        目标还在 = ' + J(!!g.location['tgt']) +
		'  pendingBattle=' + J(!!g.pending_battle))
}

/* ================= C. 苏联中立 + 空打（无守军） ================= */
console.log('\n=== C. 苏联中立 + 对空地<中国东部>发起陆战（空打）===')
{
	const g = scene('日本', false, '苏联')
	give(g, '17801', '苏联')
	I.refresh(g)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', {
		card: instOf(g, '苏联', '17801'), space: CE, piece: 0,
	})
	I.refresh(g)
	console.log('  空打 log = ' + (logSince(g, n0) || '(无日志)').slice(0, 260))
}

/* ================= D. 苏联中立 + 夺取制空权（seize_air 原子） ================= */
console.log('\n=== D. 苏联中立 + 夺取制空权（对日本 / 德国空军）===')
for (const nat of ['日本', '德国']) {
	const g = scene(nat, false, '苏联')
	g.location['jp_air'] = CE
	g.piece_nation['jp_air'] = nat
	g.piece_type['jp_air'] = 'air'
	g.location['su_air'] = NE
	g.piece_nation['su_air'] = '苏联'
	g.piece_type['su_air'] = 'air'
	I.refresh(g)
	I.grant_supply(g, 'su_air', g.turn || 1)
	I.refresh(g)
	console.log('  [' + nat + '] 目标国判定 neutral_attack_check = ' +
		J(I.neutral_attack_check(g, '苏联', nat)))
	console.log('  [' + nat + '] 空军力量:seize 候选含<中国东部> = ' +
		J(I.step_space_candidates(g, '苏联', { op: 'seize', kind: 'air' })
			.some(c => Number(c.id) === Number(CE))))
	const r = I.seize_air(g, '苏联', CE, 'su_air', { by: 'action' })
	console.log('  [' + nat + '] seize_air 实际结果 = ' + J(r))
	console.log('  [' + nat + '] 敌机是否被移除 = ' + J(!g.location['jp_air']))
}

console.log('\n=== 结论观察点 ===')
console.log('  ① NEUTRAL_RULES[苏联].enemies 是否只含 德/意（不含日本）')
console.log('  ② neutral_attack_check(苏联, 日本) 是否放行、(德/意) 是否拒绝')
console.log('  ③ 有敌军真实打牌：对日本是否放行、对德/意是否拒绝')
console.log('  ④ 空打分支是否【一刀切】拒绝苏联（不看目标国）')
console.log('  ⑤ seize_air 分支是否【一刀切】拒绝苏联（不看目标空军国籍）')
