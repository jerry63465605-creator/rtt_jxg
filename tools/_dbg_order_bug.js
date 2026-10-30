/*
 * 回归测试：15237 分步增强，15208/15210 顺序依赖 bug（2026-10-13 修复）。
 * 根因：行动入口用 game.current_nation 当"当前行动国"代理来清国家技能窗口，
 *       但 15237 内部续跑期间 current_nation 仍是德国，英国响应(pass_response)进来时
 *       误判把德国国家技能窗口清掉——且仅当先打 15208 时 15210 战斗触发英国响应
 *       与 15237 续跑重叠才会暴露。修复：用 side（真正执行动作的一方阵营）比对。
 *
 * 场景 A：先 15210（战斗触发英国响应）→ 解决响应 → 后 15208
 * 场景 B：先 15208 → 后 15210（战斗触发英国响应，随即 15237 续跑+国家技能）
 *
 * 用法: node tools/_dbg_order_bug.js
 */
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { data, SPACE } = require(path.join(DIR, 'data.js'))
const I = rules._internal
I.set_skip_turn_guard(true)

let pass = 0, fail = 0
const ok = (c, m) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m)) }

const BOSPH = SPACE['黑海']
const AZ = SPACE['亚速尔']

function mkGame() {
	const g = rules.setup(1, 'Standard', {})
	g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.play_done = {}; g.discard = { '德国': [] }
	/* 英国暗置响应卡 15334（驱逐舰：英国/美国海军被移除时触发，小写阵营约定） */
	g.table_responses = [{ card_id: '15334', owner_side: 'allies' }]
	return g
}

function placeSupplyArmyAdjBosph(g) {
	for (const sid of Object.keys(data.spaces)) {
		const sp = data.spaces[sid]
		if (sp.terrain !== 'land') continue
		if (!(sp.connections || []).includes(BOSPH)) continue
		g.location['g_army'] = sid
		g.piece_nation['g_army'] = '德国'; g.piece_type['g_army'] = 'army'
		I.grant_supply(g, 'g_army', g.turn || 1); I.refresh(g)
		if (I.can_build_at(g, '德国', BOSPH, 'navy').ok) return true
		delete g.location['g_army']; delete g.piece_nation['g_army']; delete g.piece_type['g_army']
	}
	return false
}

function placeNavalDuel(g) {
	const azConn = (data.spaces[AZ].connections || []).map(Number)
	const seaNeigh = azConn.filter(s => data.spaces[s] && data.spaces[s].terrain === 'sea')
	const S = seaNeigh[0]
	if (S == null) return null
	let landAdj = null
	for (const n of (data.spaces[S].connections || []).map(Number)) {
		if (data.spaces[n] && data.spaces[n].terrain === 'land') { landAdj = n; break }
	}
	if (landAdj == null) return null
	g.location['de_army2'] = landAdj
	g.piece_nation['de_army2'] = '德国'; g.piece_type['de_army2'] = 'army'
	I.grant_supply(g, 'de_army2', g.turn || 1)
	g.location['al_navy'] = S; g.piece_nation['al_navy'] = '英国'; g.piece_type['al_navy'] = 'navy'
	I.grant_supply(g, 'al_navy', g.turn || 1)
	I.refresh(g)
	return S
}

function armedCards(g) {
	return (g.armed_offers || []).flatMap(w => (w.cards || []).map(c => c.card_id))
}

// 解决英国响应（若队列有），返回是否真的清掉了队列
function resolveUKResponse(g) {
	if ((g.response_queue || []).length === 0) return false
	const before = (g.response_queue || []).length
	const r = rules.action(g, 'Allies', 'pass_response', {})
	const cleared = (g.response_queue || []).length < before
	ok(cleared, '英国响应被解决（队列消费）')
	return cleared
}

function runScenario(name, order, resolveBetween) {
	console.log('\n=== 场景 ' + name + '（顺序 ' + JSON.stringify(order) +
		'，中途解决响应=' + resolveBetween + '）===')
	const g = mkGame()
	ok(placeSupplyArmyAdjBosph(g), '布置黑海邻接补给德军')
	const S = placeNavalDuel(g)
	ok(S != null, '亚速尔相邻海域布置德/英海军')
	g.hands['德国'] = ['15237', '15208', '15210', '15338']

	rules.action(g, 'Axis', 'play_card', { card: '15237' })
	ok((g.armed_offers || []).length === 1, '出现 1 个增强窗口')
	ok(armedCards(g).includes('15208') && armedCards(g).includes('15210'), '窗口同时含 15208 + 15210')
	ok(!!g.pending_event_armed, 'pending_event_armed 挂起')

	for (const c of order) {
		const r = rules.action(g, 'Axis', 'use_armed_offer', { window: 0, card: c })
		ok(r !== undefined, 'use_armed_offer ' + c + ' 返回 state')
		// 若要求在两张之间先解决英国响应（贴合玩家实际流程）
		if (resolveBetween === c && (g.response_queue || []).length) resolveUKResponse(g)
	}

	console.log('  --- 两张都打完后 ---')
	ok((g.armed_offers || []).length === 0, '增强窗口已清空')
	ok(!g.pending_event_armed, 'pending_event_armed 已续跑清空')
	ok(!!g.national_skill_offer, '15237 分步完成→国家技能窗口出现')

	// 场景 B：英国响应仍在挂起（与 15237 续跑重叠），必须先解决
	if ((g.response_queue || []).length) resolveUKResponse(g)
	ok(!!g.national_skill_offer, '【核心修复】英国响应解决后德国国家技能窗口【仍存活】')

	const before = g.log.length
	const rN = rules.action(g, 'Axis', 'use_national_skill', { drop: [] })
	ok(rN !== undefined, '德国可发动国家技能（返回 state）')
	ok(!g.national_skill_offer, '国家技能发动后窗口清空')
	ok(g.log.length > before, '国家技能产生日志（确实生效）')
}

runScenario('A（先 15210，用户说可用）', ['15210', '15208'], '15210')
runScenario('B（先 15208，用户说坏——现已修复）', ['15208', '15210'], null)

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
