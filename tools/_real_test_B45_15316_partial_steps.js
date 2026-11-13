/*
 * 【本体 #9 / B45】15316《佩塔尔二世即位》：第二步不合法时整卡仍可打出并执行第一步
 * 真实 R.setup / R.action / R.query 驱动（初始局面只用工具摆）。
 * 同时记录 #7（17724 法国陆军误判）为误报的依据。
 * 用法：node tools/_real_test_B45_15316_partial_steps.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const BALK = D.id_of('巴尔干')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
/* 摆初始局面：巴尔干放指定敌方陆军，英国持 15316 且处于出牌阶段 */
function seed(enemies) {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	let k = 0
	for (const nat of enemies) {
		const id = 'probe_enemy_' + (++k)
		g.location[id] = BALK
		g.piece_nation[id] = nat
		g.piece_type[id] = 'army'
	}
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.hands['英国'] = ['15316#t1']
	return g
}
const at = g => I.pieces_on(g, BALK).map(p => g.piece_nation[p] + '/' + g.piece_type[p])
const hasUKArmy = g => I.pieces_on(g, BALK).some(p =>
	g.piece_nation[p] === '英国' && g.piece_type[p] === 'army')

console.log('=== A. 巴尔干 IT + 德国两支：整卡仍可打出、只执行第一步 ===')
{
	const g = seed(['意大利', '德国'])
	const tg1 = R.query(g, 'Allies', 'event_targets', { card: '15316#t1' })
	ok('★ 首查返回 need:piece（两支敌军由玩家自选消灭目标）',
		!!tg1 && tg1.need === 'piece' && tg1.total === 2 &&
		(tg1.candidates || []).length === 2, J(tg1))
	const victim = (tg1.candidates || [])[0].id
	const tg2 = R.query(g, 'Allies', 'event_targets',
		{ card: '15316#t1', pieces: [victim] })
	ok('★★ 后续步不合法不会拦整卡：第二次查询返回 need:null',
		!!tg2 && tg2.need === null, J(tg2))
	const before = at(g).length
	R.action(g, 'Allies', 'play_card',
		{ card: '15316#t1', pieces: [victim], piece: victim })
	ok('★★ 卡确实打出（离手）且第一步消灭了选中的那支',
		(g.hands['英国'] || []).indexOf('15316#t1') < 0 &&
		at(g).length === before - 1 &&
		!!g.pending_event_step && g.pending_event_step.step === 1,
		J({ hands: g.hands['英国'], at: at(g), step: g.pending_event_step && g.pending_event_step.step }))
	ok('★★ 分步停机等「下一步」，白名单放行 event_step_next',
		R.view(g, 'Allies').actions.event_step_next === 1,
		J(R.view(g, 'Allies').actions.event_step_next))
	R.action(g, 'Allies', 'event_step_next', {})
	ok('★★ 续跑：第二步失败但卡仍结算完成（部分效果未执行）',
		!g.pending_event_step &&
		!!g.last_card_fail &&
		(g.log || []).some(x => /分步结算完成/.test(x)) &&
		(g.hands['英国'] || []).indexOf('15316#t1') < 0,
		J({ pending: g.pending_event_step, fail: g.last_card_fail }))
	ok('★★ 失败原因是真实的「巴尔干 有敌方部队」，不是「null 地区不存在」',
		!!g.last_card_fail && g.last_card_fail.fails.some(x =>
			/巴尔干 有敌方部队/.test(x)) &&
		!g.last_card_fail.fails.some(x => /null|地区不存在/.test(x)),
		J(g.last_card_fail && g.last_card_fail.fails))
	ok('★ 剩余敌军与盘面未被误改', at(g).length === 1 && at(g)[0] === '德国/army',
		J(at(g)))
}

console.log('\n=== B. 对照：只有 1 支敌军时两步都成功 ===')
{
	const g = seed(['德国'])
	R.action(g, 'Allies', 'play_card', { card: '15316#t1' })
	if (g.pending_event_step) R.action(g, 'Allies', 'event_step_next', {})
	ok('★★ 消灭敌军并征召出英国陆军，且没有部分失败',
		hasUKArmy(g) && !g.last_card_fail && !g.pending_event_step,
		J({ at: at(g), fail: g.last_card_fail }))
}

console.log('\n=== C. 对照：无敌军时第一步失败、第二步仍执行 ===')
{
	const g = seed([])
	R.action(g, 'Allies', 'play_card', { card: '15316#t1' })
	ok('★★ 首步不合法同样不拦整卡，第二步征召成功',
		(g.hands['英国'] || []).indexOf('15316#t1') < 0 && hasUKArmy(g),
		J({ at: at(g), fail: g.last_card_fail }))
}

console.log('\n=== D. #7 误报依据：17724「英国陆军」严格按国别，不含法国 ===')
{
	const g = seed([])
	const g2 = R.setup(20261112, 'Standard')
	const mid = D.id_of('中东')
	const near = D.id_of('非洲北部')
	g2.location = {}; g2.piece_nation = {}; g2.piece_type = {}
	g2.location['p_fr'] = near
	g2.piece_nation['p_fr'] = '法国'
	g2.piece_type['p_fr'] = 'army'
	const eff = I.EVENT_EFFECTS['17724']
	ok('★★ 相邻只有法国陆军时 cond 仍 ok:true（未把法国当英国）',
		!!eff && eff.steps[1].cond(g2).ok === true &&
		I.has_pieces(g2, { space: near, nation: '英国', types: ['army'] }) === false,
		J(eff && eff.steps[1].cond(g2)))
	ok('★ list_pieces 对 opt.nation 是严格比较（源码守卫）',
		/if \(opt\.nation && game\.piece_nation\[p\] !== opt\.nation\) continue/.test(
			fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')))
}

console.log('\n=== E. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ 固定地区兜底：候选为空时用 st.spaces 交给权威原子',
		/if \(!spaces\.length && st\.spaces && st\.spaces\.length\)/.test(src) &&
		/const fixed = space_id\(st\.spaces\[0\]\)/.test(src))
	ok('★★ 「没有任何可执行的效果」仍只看首次打出且全部无效果',
		/if \(startStep <= 0 && !descs\.length && !costDescs\.length\)/.test(src))
	ok('★ 卡面配置仍是两步（eliminate + recruit 巴尔干）',
		/\{ op: 'eliminate', type: 'army', spaces: space_ids_of\(\['巴尔干'\]\) \}/.test(src) &&
		/\{ op: 'recruit', type: 'army', spaces: space_ids_of\(\['巴尔干'\]\) \}/.test(src))
	/* 【B46】卡表找回 bump 过版本串，这里只校验统一性 */
	const vers = (fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
		.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	ok('★ 版本串统一且非空（B45 当轮为 20261112p）',
		vers.length >= 5 && vers.every(v => v && v === vers[0]), vers)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
