/*
 * 【本体 #2 / B41】17526 民主兵工厂：委托期用 15341/15342 替换建设陆军
 * 真实 R.setup / R.action / R.view 驱动（初始局面只用工具摆）。
 * 用法：node tools/_real_test_B41_17526_forgo.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const AUS = 42   /* 澳大利亚 */

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
/* 摆 17526 委托局面（只用工具摆初始局面，之后全用真实 R.action） */
function seed(order, idx, statusCards) {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	/* 清空澳大利亚，保证 15341 的 recruit_piece 能成立 */
	for (const id of Object.keys(g.location || {})) {
		if (Number(g.location[id]) === AUS) {
			delete g.location[id]; delete g.piece_nation[id]; delete g.piece_type[id]
		}
	}
	g.table['英国'] = statusCards || ['15341#s1']
	g.current_nation = '英国'
	g.uk_build_delegate = {
		nation: '英国', stage: 'build', order: order, idx: idx,
		skipped: [], return_nation: '美国',
	}
	return g
}
const ukArmyAtAus = g => Object.keys(g.location || {}).filter(id =>
	Number(g.location[id]) === AUS && g.piece_nation[id] === '英国' &&
	g.piece_type[id] === 'army')

console.log('=== A. army 步替换：视为已建造，继续 navy 步 ===')
{
	const g = seed(['army', 'navy'], 0)
	const v0 = R.view(g, 'Allies').uk_build_delegate
	ok('★★ view 在 army 步下发 15341 替换卡（仅义务方）',
		!!v0 && v0.forgo_cards.length === 1 &&
		v0.forgo_cards[0].id === '15341#s1' &&
		v0.forgo_cards[0].name === '澳大利亚劳管局' &&
		R.view(g, 'Axis').uk_build_delegate.forgo_cards.length === 0,
		J(v0 && v0.forgo_cards))
	const hand0 = (g.hands['英国'] || []).length
	const l0 = g.log.length
	R.action(g, 'Allies', 'resolve_uk_build_delegate', { forgo: '15341#s1' })
	ok('★★ 澳大利亚征召出 1 支英国陆军（复用既有效果原子）',
		ukArmyAtAus(g).length === 1, J(ukArmyAtAus(g)))
	ok('★★ army 步视为完成：idx=1、委托未结束、继续 navy 步',
		!!g.uk_build_delegate && g.uk_build_delegate.idx === 1 &&
		R.view(g, 'Allies').uk_build_delegate.current === 'navy' &&
		R.view(g, 'Allies').uk_build_delegate.remaining.join(',') === 'navy',
		J(g.uk_build_delegate && { idx: g.uk_build_delegate.idx,
			cur: R.view(g, 'Allies').uk_build_delegate.current }))
	ok('★★ 日志写明「替换…该步视为已建造，按原顺序继续」',
		(g.log || []).slice(l0).some(x => /该步视为已建造，按原顺序继续/.test(x)),
		J((g.log || []).slice(l0)))
	ok('★★ 不扣英国手牌（没打出《建设陆军》，不占名额）',
		(g.hands['英国'] || []).length === hand0 &&
		!(g.log || []).slice(l0).some(x => /扣除任何手牌/.test(x) && /建设/.test(x)),
		J((g.hands['英国'] || []).length))
	ok('★ navy 步不再下发替换卡',
		R.view(g, 'Allies').uk_build_delegate.forgo_cards.length === 0,
		J(R.view(g, 'Allies').uk_build_delegate.forgo_cards))
}

console.log('\n=== B. army 是最后一步时：替换后委托收尾、归还美国 ===')
{
	const g = seed(['navy', 'army'], 1)
	R.action(g, 'Allies', 'resolve_uk_build_delegate', { forgo: '15341#s1' })
	ok('★★ 委托结束（uk_build_delegate=null）、current_nation 归还美国',
		!g.uk_build_delegate && g.current_nation === '美国',
		J({ dg: g.uk_build_delegate, nation: g.current_nation }))
	ok('★ 澳大利亚仍征召出英国陆军', ukArmyAtAus(g).length === 1,
		J(ukArmyAtAus(g)))
}

console.log('\n=== C. 非法替换被拒，委托状态不变 ===')
for (const [label, arg, cards] of [
	['不在桌面的卡', { forgo: '15341#nope' }, ['15341#s1']],
	['非替换状态卡', { forgo: '15255#x' }, ['15255#x']],
]) {
	const g = seed(['army', 'navy'], 0, cards)
	const before = J(g.uk_build_delegate)
	const l0 = g.log.length
	R.action(g, 'Allies', 'resolve_uk_build_delegate', arg)
	ok('★★ ' + label + '：idx 不变、澳大利亚无新增陆军',
		J(g.uk_build_delegate) === before && ukArmyAtAus(g).length === 0,
		J((g.log || []).slice(l0)))
}
{
	/* navy 步不能替换 */
	const g = seed(['navy', 'army'], 0)
	R.action(g, 'Allies', 'resolve_uk_build_delegate', { forgo: '15341#s1' })
	ok('★★ navy 步替换被拒（只适用于陆军步）',
		g.uk_build_delegate.idx === 0 &&
		(g.log || []).some(x => /替换建设只适用于陆军步/.test(x)),
		J(g.uk_build_delegate.idx))
}

console.log('\n=== D. 15342 印度宣布参战同样可用 ===')
{
	const g = seed(['army', 'navy'], 0, ['15342#s1'])
	const v = R.view(g, 'Allies').uk_build_delegate
	ok('★ view 下发 15342 替换卡', !!v &&
		v.forgo_cards.some(c => c.id === '15342#s1'), J(v && v.forgo_cards))
	R.action(g, 'Allies', 'resolve_uk_build_delegate', { forgo: '15342#s1' })
	ok('★★ 替换成功、army 步视为完成',
		!!g.uk_build_delegate && g.uk_build_delegate.idx === 1,
		J(g.uk_build_delegate && g.uk_build_delegate.idx))
}

console.log('\n=== E. 静态守卫（同源 / 客户端 / 版本串）===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('★★ 三条路径共用 uk_build_step_done（无第二份顺序机）',
		/function uk_build_step_done\(game\)/.test(src) &&
		(src.match(/uk_build_step_done\(game\)/g) || []).length === 4,
		J((src.match(/uk_build_step_done\(game\)/g) || []).length))
	ok('★★ forgo 分支复用 run_status_effect，不改 activate_status 核心',
		/const r = run_status_effect\(game, dg\.nation, inst, tr, \{\}, null\)/.test(src) &&
		/【本体 #2 \/ 17526】用 15341/.test(src))
	ok('★★ view.forgo_cards 判据与 table_status/register_status_actions 同源',
		/forgo_cards: forgoCands/.test(src) &&
		/dg\.nation === game\.current_nation/.test(src) &&
		/status_active\(game, cid, dg\.nation\)/.test(src))
	/* 只检查 send_action 那一行本身（注释里提到 build_card 不算） */
	const sendLine = pjs.split('\n').find(l =>
		/send_action\('resolve_uk_build_delegate', \{ forgo: f\.id \}\)/.test(l))
	ok('★★ 客户端按钮只回传实例 id、不带 build_card',
		!!sendLine && !/build_card/.test(sendLine), J(sendLine))
	ok('★ 版本串统一且为 20261112p',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v === '20261112p'),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
