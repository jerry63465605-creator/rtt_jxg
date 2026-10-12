/*
 * 15237 土耳其加入轴心国 —— 分步 armed 挂起串行流程验证
 * 用法: node tools/_dbg_15237_seq.js
 *
 * 场景：
 *  A) 15237 + 15208(after_build_navy)：step0 建海军→出现增强窗口→挂起；
 *     出增强后 step1 征召中东→无 after_recruit 卡→国家技能触发。
 *  B) 15237 + 临时德国 after_recruit 卡：step0 不挂起→step1 征召后挂起（验证"也等待"）；
 *     出增强后国家技能触发。
 *  C) 15237 单独：两步立即执行，国家技能触发（回归，无挂起）。
 */
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { data, SPACE } = require(path.join(DIR, 'data.js'))
const I = rules._internal
I.set_skip_turn_guard(true)

let pass = 0, fail = 0
const ok = (c, m) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m)) }

// 临时注册一张德国 after_recruit 增强卡（仅本测试运行时，不改任何配置）
I.ECHO_EFFECTS['99999'] = {
	name: '测试·征召后增强', actor: '德国',
	armed: {
		when: 'after_recruit', actor: '德国', cost: { attrition: 0 },
		desc: 'test after_recruit', run() { return { ok: true, desc: 'test after_recruit' } },
	},
}

const BOSPH = SPACE['黑海']
const MIDEAST = SPACE['中东']

// 找黑海邻接的陆地，放德国陆军并强制补给 -> 黑海可建海军
function placeSupplyArmyAdjBosph(g) {
	for (const sid of Object.keys(data.spaces)) {
		const sp = data.spaces[sid]
		if (sp.terrain !== 'land') continue
		if (!(sp.connections || []).includes(BOSPH)) continue
		g.location['g_army'] = sid
		g.piece_nation['g_army'] = '德国'
		g.piece_type['g_army'] = 'army'
		I.grant_supply(g, 'g_army', g.turn || 1)
		I.refresh(g)
		const chk = I.can_build_at(g, '德国', BOSPH, 'navy')
		if (chk.ok) {
			console.log('  （邻接黑海的陆地 = ' + sp.name + '，已可建海军）')
			return true
		}
		delete g.location['g_army']; delete g.piece_nation['g_army']; delete g.piece_type['g_army']
	}
	return false
}

function mkGame() {
	const g = rules.setup(1, 'Standard', {})
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.play_done = {}
	g.discard = { '德国': [] }
	return g
}

function germanNavyAt(g, sid) {
	return Object.keys(g.location).some(k =>
		g.piece_nation[k] === '德国' && g.piece_type[k] === 'navy' && g.location[k] === sid)
}
function germanArmyAt(g, sid) {
	return Object.keys(g.location).some(k =>
		g.piece_nation[k] === '德国' && g.piece_type[k] === 'army' && g.location[k] === sid)
}
function armedWhenPresent(g, when) {
	return (g.armed_offers || []).some(w => w.nation === '德国' && w.when === when)
}

/* ============ 场景 A：step0 建海军后挂起等待 after_build_navy ============ */
console.log('\n=== 场景 A：15237 + 15208(after_build_navy) ===')
{
	const g = mkGame()
	ok(placeSupplyArmyAdjBosph(g), '布置黑海邻接补给德军')
	g.hands['德国'] = ['15237', '15208', '15338']  // 15338=德国状态卡，使国家技能可用

	const r = rules.action(g, 'Axis', 'play_card', { card: '15237' })
	console.log('  play 15237 ->', JSON.stringify(r && r.desc))
	ok(germanNavyAt(g, BOSPH), '黑海已建德国海军')
	ok(armedWhenPresent(g, 'after_build_navy'), '出现 after_build_navy 增强窗口')
	ok(!!g.pending_event_armed, 'game.pending_event_armed 已设置（挂起）')
	ok(g.pending_event_armed && g.pending_event_armed.resumeStep === 1, 'resumeStep === 1（下一步征召中东）')
	ok((g.hands['德国'] || []).indexOf('15237') < 0, '15237 已移出手牌（防重复打出）')
	ok(!germanArmyAt(g, MIDEAST), '中东尚未征召德军（step1 未执行）')

	// 出增强卡 15208
	const r2 = rules.action(g, 'Axis', 'use_armed_offer', { window: 0, card: '15208' })
	console.log('  use_armed_offer 15208 ->', JSON.stringify(r2 && r2.desc))
	ok((g.armed_offers || []).length === 0, '增强窗口已清空')
	ok(!g.pending_event_armed, 'pending_event_armed 已清空（已续跑）')
	ok(germanArmyAt(g, MIDEAST), '中东已征召德军（step1 已执行）')
	ok(!!g.national_skill_offer, '国家技能窗口已触发（★卡结算后）')
	ok((g.discard['德国'] || []).indexOf('15237') >= 0, '15237 已入弃牌堆')
}

/* ============ 场景 B：第二步征召后也挂起等待 after_recruit ============ */
console.log('\n=== 场景 B：15237 + 临时德国 after_recruit 卡（验证"也等待"） ===')
{
	const g = mkGame()
	ok(placeSupplyArmyAdjBosph(g), '布置黑海邻接补给德军')
	g.hands['德国'] = ['15237', '99999', '15338']  // 15338=德国状态卡

	const r = rules.action(g, 'Axis', 'play_card', { card: '15237' })
	console.log('  play 15237 ->', JSON.stringify(r && r.desc))
	ok(germanNavyAt(g, BOSPH), '黑海已建德国海军')
	ok(!armedWhenPresent(g, 'after_build_navy'), '无 after_build_navy 卡 -> step0 不挂起')
	ok(germanArmyAt(g, MIDEAST), '中东已征召德军（step1 已执行）')
	ok(armedWhenPresent(g, 'after_recruit'), '出现 after_recruit 增强窗口（第二步也等待）')
	ok(!!g.pending_event_armed, 'game.pending_event_armed 已设置（第二步挂起）')
	ok(g.pending_event_armed && g.pending_event_armed.resumeStep === 2, 'resumeStep === 2（已到最后一步之后）')

	const r2 = rules.action(g, 'Axis', 'use_armed_offer', { window: 0, card: '99999' })
	console.log('  use_armed_offer 99999 ->', JSON.stringify(r2 && r2.desc))
	ok((g.armed_offers || []).length === 0, '增强窗口已清空')
	ok(!g.pending_event_armed, 'pending_event_armed 已清空')
	ok(!!g.national_skill_offer, '国家技能窗口已触发')
	ok((g.discard['德国'] || []).indexOf('15237') >= 0, '15237 已入弃牌堆')
}

/* ============ 场景 C：无增强卡 -> 两步立即执行（回归） ============ */
console.log('\n=== 场景 C：15237 单独（无增强卡，回归） ===')
{
	const g = mkGame()
	ok(placeSupplyArmyAdjBosph(g), '布置黑海邻接补给德军')
	g.hands['德国'] = ['15237', '15338']  // 15338=德国状态卡

	const r = rules.action(g, 'Axis', 'play_card', { card: '15237' })
	console.log('  play 15237 ->', JSON.stringify(r && r.desc))
	ok(germanNavyAt(g, BOSPH), '黑海已建德国海军')
	ok(germanArmyAt(g, MIDEAST), '中东已征召德军')
	ok(!(g.armed_offers || []).length, '无增强窗口')
	ok(!g.pending_event_armed, '无挂起')
	ok(!!g.national_skill_offer, '国家技能窗口已触发')
}

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
