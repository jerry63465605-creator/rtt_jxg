/*
 * 8600《南方作战计划》真实效果验收（2026-11-12 修正实现记录）
 *
 * 卡面：出牌阶段开始时：对<印度尼西亚><新几内亚><东南亚><菲律宾>之一发起1次陆战。
 *       在战斗地区建设陆军。
 *
 * 真实响应链：暗置响应卡 → play_start 派发窗口 → trigger_response →
 *             resolve_response_choice{choice:地区 id} → 断言陆战 + 战斗地区建设。
 * 与 _smoke_jp_response.js / _real_test_supp_jp.js 不同：这里验【效果内容】，
 * 不只验窗口是否开出（旧的错误正是这样被记成「正常」的）。
 *
 * 用法：node tools/_real_test_8600_south_plan.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const J = x => JSON.stringify(x)
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const jpArmies = (g, sp) => I.pieces_on(g, sp).filter(p =>
	g.piece_nation[p] === '日本' && g.piece_type[p] === 'army').length

const TARGETS = ['印度尼西亚', '新几内亚', '东南亚', '菲律宾']

function board() {
	const g = R.setup(1)
	g.opening = null
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_trigger = null; g._resp_settling = false
	g.current_nation = '日本'; g.active = 'Axis'; g.turn_phase = 'play'
	I.refresh(g)
	/* <南海> 与卡面四个地区全相邻：一支补给中的日本海军作发起者 */
	const sea = d.id_of('南海')
	R.action(g, 'Axis', 'debug_place',
		{ piece: 'jp_navy_8600', nation: '日本', type: 'navy', space: sea })
	I.refresh(g)
	I.set_supply_point(g, sea, 'axis', true)
	I.grant_supply(g, 'jp_navy_8600', g.turn)
	I.compute_supply(g)
	/* 清掉四个目标地区的非日本部队，使「战斗地区建设」可稳定验收 */
	for (const n of TARGETS) {
		const sp = d.id_of(n)
		for (const p of I.pieces_on(g, sp)) {
			if (g.piece_nation[p] === '日本') continue
			delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p]
		}
	}
	I.refresh(g)
	/* 暗置 8600 到桌面（真实 action），再重新进入出牌阶段派发 play_start 窗口 */
	R.action(g, 'Axis', 'debug_add_card', { face: '8600', nation: '日本', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['日本'] || []).find(x => faceOf(x) === '8600')
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	R.action(g, 'Axis', 'play_card', { card: c })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'resource' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	return g
}

const respIds = g => (((R.view(g, 'Axis').pending_trigger || {}).candidates) || [])
	.map(c => (c && (c.card_face || c.card_id || c.id)) || c).map(String)

console.log('=== A. 真实 play_start 响应链 ===')
{
	const g = board()
	const ids = respIds(g)
	console.log('  窗口候选 = ' + J(ids))
	ok('A1 8600 出现在 play_start 响应窗口', ids.some(x => x.indexOf('8600') >= 0), J(ids))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'trigger_response', {})
	const v = R.view(g, 'Axis')
	const ch = v.response_choice
	console.log('  trigger_response 日志: ' + logSince(g, n0).slice(0, 180))
	console.log('  response_choice = ' + J(ch && {
		name: ch.name, kind: ch.kind, prompt: ch.prompt,
		cands: (ch.candidates || []).map(c => c.name),
	}))
	ok('★★ A2 进入选【地区】阶段（不是四选一 option）',
		!!ch && ch.kind === 'space', J(ch && ch.kind))
	const names = ((ch && ch.candidates) || []).map(c => c.name)
	ok('★★ A3 候选 = 卡面四个地区', names.length === 4 &&
		TARGETS.every(n => names.indexOf(n) >= 0), J(names))
	ok('★ A4 四选一占位文案已消失',
		!names.some(n => /获得 1 分|消灭 1 支中国陆军|英属印度/.test(n)), J(names))

	if (ch && ch.candidates && ch.candidates.length) {
		const pick = ch.candidates.find(c => c.name === '印度尼西亚') || ch.candidates[0]
		const sp = Number(pick.id)
		const before = jpArmies(g, sp)
		const score0 = (g.score || {}).axis || 0
		const n1 = (g.log || []).length
		R.action(g, 'Axis', 'resolve_response_choice', { choice: sp })
		const lg = logSince(g, n1)
		console.log('  选 ' + pick.name + ' 后日志: ' + lg.slice(0, 260))
		ok('★★ A5 结算文案 = 陆战 + 在战斗地区建设陆军',
			/发起陆战/.test(lg) && /建设陆军/.test(lg), lg.slice(0, 200))
		ok('★★ A6 战斗地区确实新增 1 支日本陆军', jpArmies(g, sp) === before + 1,
			before + ' -> ' + jpArmies(g, sp))
		ok('★★ A7 不再得分（旧 option0 的行为）', ((g.score || {}).axis || 0) === score0,
			score0 + ' -> ' + ((g.score || {}).axis || 0))
		ok('★ A8 不再消灭中国陆军/打印度',
			!/消灭 1 支中国陆军|英属印度|获得 1 分/.test(lg), lg.slice(0, 160))
		ok('★ A9 响应栈清空、卡已消耗', !(g.response_stack || []).length &&
			!(g.table_responses || []).some(x => faceOf(x.card_id) === '8600'),
			J({ stack: (g.response_stack || []).length, table: g.table_responses }))
	}
}

console.log('\n=== B. 实现函数两级协议（首调 / 续调）===')
{
	const g = board()
	const impl = I.RESPONSE_EFFECT_IMPL['8600']
	const first = impl(g, 'axis', {}, undefined)
	ok('B1 首调返回 pending + kind=space', !!(first && first.pending && first.kind === 'space'), J(first))
	ok('B2 首调不执行任何动作（不战斗、不建设）',
		!/(发起陆战|建设陆军)/.test((g.log || []).slice(-3).join(' | ')))
	const sp = Number(first.candidates[0].id)
	const r2 = impl(g, 'axis', {}, sp)
	ok('B3 续调返回 ok + 两句文案', !!(r2 && r2.ok) &&
		/发起陆战/.test(r2.desc || '') && /建设陆军/.test(r2.desc || ''), J(r2))
	ok('B4 伪造不在候选内的地区被拒',
		impl(g, 'axis', {}, 99999).ok === false)
}

console.log('\n=== C. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('C1 四选一占位已删除', !/南方作战计划：选择执行哪项/.test(src))
	ok('C2 实现按卡面四地区', /'印度尼西亚', '新几内亚', '东南亚', '菲律宾'/.test(src))
	ok('C3 候选走权威原子 event_cands_filter + battle_initiators',
		/event_cands_filter\(game, '日本',\s*\{ op: 'battle'/.test(src) &&
		/battle_initiators\(game, '日本', sp\)/.test(src))
	ok('C4 执行走 do_land_battle_at + build_piece',
		/do_land_battle_at\(game, sp, '日本'\)/.test(src) &&
		/build_piece\(game, '日本', 'army', sp\)/.test(src))
	const csv = fs.readFileSync(path.join(__dirname, '..', 'out', 'ja_cards.csv'), 'utf8')
	ok('C5 CSV 卡面文本未被改动（数据层原本就是对的）',
		/SUPP,8600,86,0,0,南方作战计划,RESPONSE/.test(csv))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
