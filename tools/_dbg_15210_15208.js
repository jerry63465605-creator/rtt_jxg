/*
 * 复现：15237 建海军后，after_build_navy 窗口同时含 15208 + 15210。
 * 验证：打完 15210 后，15208 是否仍可打出。
 *
 * 用法: node tools/_dbg_15210_15208.js
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
	return g
}

// 黑海邻接陆地放德国陆军并补给 -> 可建海军
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

// 亚速尔相邻海域(17)放 英国海军(目标)；其相邻陆地放 补给德国陆军(发起者)，使 15210 ready 通过且能开战
function placeNavalDuel(g) {
	const azConn = (data.spaces[AZ].connections || []).map(Number)
	const seaNeigh = azConn.filter(s => data.spaces[s] && data.spaces[s].terrain === 'sea')
	const S = seaNeigh[0]
	if (S == null) return null
	// 找 S 的相邻陆地，放德国陆军并补给 -> 作为海战发起者
	let landAdj = null
	for (const n of (data.spaces[S].connections || []).map(Number)) {
		if (data.spaces[n] && data.spaces[n].terrain === 'land') { landAdj = n; break }
	}
	if (landAdj == null) return null
	g.location['de_army2'] = landAdj
	g.piece_nation['de_army2'] = '德国'; g.piece_type['de_army2'] = 'army'
	I.grant_supply(g, 'de_army2', g.turn || 1)
	g.location['al_navy'] = S; g.piece_nation['al_navy'] = '英国'; g.piece_type['al_navy'] = 'navy'
	I.refresh(g)
	return S
}

function armedCards(g) {
	return (g.armed_offers || []).flatMap(w => (w.cards || []).map(c => c.card_id))
}

console.log('=== 当前 synchronous 15210：打完 15210 后 15208 是否还在 ===')
{
	const g = mkGame()
	ok(placeSupplyArmyAdjBosph(g), '布置黑海邻接补给德军')
	const S = placeNavalDuel(g)
	ok(S != null, '亚速尔相邻海域布置德/英海军 (space=' + S + ')')
	g.hands['德国'] = ['15237', '15208', '15210', '15338']

	const r = rules.action(g, 'Axis', 'play_card', { card: '15237' })
	console.log('  play 15237 ->', JSON.stringify(r && r.desc))
	console.log('  [debug] armedCards =', JSON.stringify(armedCards(g)))
	console.log('  [debug] 15210 ready passed?', !!(I.ECHO_EFFECTS['15210'].armed.ready && I.ECHO_EFFECTS['15210'].armed.ready(g, { space: BOSPH, nation: '德国' })))
	const ar10 = I.ECHO_EFFECTS['15210'].armed
	console.log('  [debug] find_battle_target(德,sea,near=亚速尔,enemyOnly) =', JSON.stringify((typeof I.find_battle_target === 'function') ? I.find_battle_target(g, '德国', 'sea', { near: AZ, enemyOnly: true }) : 'N/A'))
	ok((g.armed_offers || []).length === 1, '出现 1 个增强窗口')
	ok(armedCards(g).includes('15208') && armedCards(g).includes('15210'), '窗口同时含 15208 + 15210')
	ok(!!g.pending_event_armed, 'pending_event_armed 挂起（15237 step0）')

	// 打 15210（synchronous 海战）
	const r2 = rules.action(g, 'Axis', 'use_armed_offer', { window: 0, card: '15210' })
	console.log('  use_armed_offer 15210 ->', JSON.stringify(r2 && r2.desc))
	ok(armedCards(g).includes('15208'), '【关键】打完 15210 后，15208 仍在增强窗口内')
	ok((g.hands['德国'] || []).indexOf('15210') < 0, '15210 已离手（已打出）')

	// 再打 15208
	const r3 = rules.action(g, 'Axis', 'use_armed_offer', { window: 0, card: '15208' })
	console.log('  use_armed_offer 15208 ->', JSON.stringify(r3 && r3.desc))
	ok((g.armed_offers || []).length === 0, '15208 打完，增强窗口清空')
	ok(!g.pending_event_armed, 'pending_event_armed 已续跑清空')
	ok(!!g.national_skill_offer, '国家技能已触发（15237 全部分步完成）')
}

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
