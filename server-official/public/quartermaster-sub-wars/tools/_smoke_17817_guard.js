/*
 * 回归测试：17817《进攻是最好的防守》出牌前相邻预检。
 *
 * 口径（玩家 2026-10-22 确认）：
 *   无"德国陆军 + 相邻苏联陆军"时，禁止打出 17817（不结束中立、不弃牌、不占名额）。
 *   只判【相邻】，不查补给（补给留给战斗发起时按通用规则判定）。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_17817_guard.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

function base() {
	let g = rules.setup(1)
	g.opening = null                  /* 模拟开局已结束 */
	g.current_nation = '苏联'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.hands['苏联'] = g.hands['苏联'] || []
	return g
}

function clearSovietArmies(g) {
	for (const p of Object.keys(g.piece_nation || {})) {
		if (g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army') {
			delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p]
		}
	}
}
function placeSovietArmy(g, id, sp) {
	g.location[id] = sp; g.piece_nation[id] = '苏联'; g.piece_type[id] = 'army'
}

console.log('=== A. 无相邻德/苏陆军 -> 禁止打出（零副作用）===')
{
	let g = base()
	clearSovietArmies(g)                 /* 保证没有任何苏陆军与德陆军相邻 */
	g.hands['苏联'] = ['17817#1']
	const neutralBefore = I.is_neutral(g, '苏联')
	g = rules.action(g, 'Allies', 'play_card', { card: '17817#1' })
	ok('17817 仍在手牌', (g.hands['苏联'] || []).indexOf('17817#1') >= 0,
		'hand=' + JSON.stringify(g.hands['苏联']))
	ok('苏联仍中立（未调用 end_neutral）', I.is_neutral(g, '苏联') === neutralBefore,
		'neutral=' + I.is_neutral(g, '苏联'))
	ok('未置 su_17817_pending', !g.su_17817_pending)
	ok('未占出牌名额（play_done 未置位）', !(g.play_done && g.play_done['苏联']),
		'play_done=' + JSON.stringify(g.play_done))
	ok('日志含"无法打出"', g.log.some(l => /进攻是最好的防守.*无法打出/.test(l)),
		'log尾=' + JSON.stringify(g.log.slice(-2)))
}

console.log('\n=== B. 有相邻（苏军不在补给也放行，只判相邻）-> 可打出 ===')
{
	let g = base()
	placeSovietArmy(g, 'su_t1', 5)       /* 东欧，与德国(44)的德陆军相邻 */
	g.hands['苏联'] = ['17817#1']
	g = rules.action(g, 'Allies', 'play_card', { card: '17817#1' })
	ok('17817 已离手', !(g.hands['苏联'] || []).includes('17817#1'))
	ok('苏联已结束中立', !I.is_neutral(g, '苏联'))
	ok('已置 su_17817_pending', g.su_17817_pending === '17817#1')
	ok('已占出牌名额', !!(g.play_done && g.play_done['苏联']))
}

console.log('\n=== C. 相邻 + 大清洗打出 17838（补上补给）-> 预算有目标 ===')
{
	let g = base()
	placeSovietArmy(g, 'su_t1', 5)
	g.hands['苏联'] = ['17817#1', '17838#1']
	/* setup 已在苏联桌面放 17850《大清洗》，故 end_neutral 会开 su_purge_offer */
	g = rules.action(g, 'Allies', 'play_card', { card: '17817#1' })
	ok('打 17817 后 su_purge_offer 开启', !!g.su_purge_offer)
	g = rules.action(g, 'Allies', 'su_purge_play', { card: '17838#1' })
	ok('已建立 event_budget', !!g.event_budget, JSON.stringify(g.event_budget && {
		card_id: g.event_budget.card_id, nation: g.event_budget.nation, remaining: g.event_budget.remaining,
	}))
	const v = rules.view(g, 'Allies')
	const tg = (v.event_budget && v.event_budget.targets) || []
	ok('预算 targets 非空（含德国 44）', tg.indexOf(44) >= 0, 'targets=' + JSON.stringify(tg))
	ok('view.actions 含 event_battle/event_finish',
		!!v.actions.event_battle && !!v.actions.event_finish)
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
