/*
 * 验证：德国★卡(15237)结算后开了国家技能窗口，
 * 轮转到英国（抽牌/响应卡结算/任意动作）时窗口【不应】被误清。
 * 同时保留对照：德国自己打非★卡或做别的动作，应清掉自己的窗口（错过即失效）。
 * 用法: node tools/_dbg_nskill_clear.js
 */
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const I = rules._internal
I.set_skip_turn_guard(true)

let pass = 0, fail = 0
const ok = (c, m) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m)) }

function mkGame() {
	const g = rules.setup(1, 'Standard', {})
	g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.play_done = {}; g.discard = { '德国': [] }
	return g
}

console.log('=== 场景 A：进入英国【自己回合】(draw phase) 应清掉德国过期 offer（设计：不跨动作残留）===')
{
	const g = mkGame()
	g.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '德国国家技能' }
	// 英国进入抽牌阶段 -> run_phase_entry -> maybe_offer(英国,'draw')
	I.maybe_offer_national_skill(g, '英国', 'draw')
	ok(!(g.national_skill_offer && g.national_skill_offer.nation === '德国'),
		'【符合设计】进入英国回合后德国窗口被清掉/替换（offer 不跨动作残留）')
	ok(g.national_skill_offer && g.national_skill_offer.nation === '英国',
		'【符合设计】英国自己回合获得本国窗口')
}

console.log('\n=== 场景 B：英国结算响应卡 after_card_resolved 不得清掉德国 offer ===')
{
	const g = mkGame()
	g.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '德国国家技能' }
	I.after_card_resolved(g, '英国', '15334') // 英国打出非★响应卡
	ok(g.national_skill_offer && g.national_skill_offer.nation === '德国',
		'【修复】英国结算非★卡保留德国的 offer')
}

console.log('\n=== 场景 C：英国做出任何动作（action 入口）不得清掉德国 offer ===')
{
	const g = mkGame()
	g.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '德国国家技能' }
	g.current_nation = '英国'
	const r = rules.action(g, 'Allies', 'log', {})
	ok(g.national_skill_offer && g.national_skill_offer.nation === '德国',
		'【修复】英国任意动作保留德国的 offer')
}

console.log('\n=== 对照 1：德国自己打非★卡，应清掉自己的 offer（错过即失效）===')
{
	const g = mkGame()
	g.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '德国国家技能' }
	I.after_card_resolved(g, '德国', '15208') // 德国打非★卡
	ok(!g.national_skill_offer, '【正确】德国自己打别的非★卡清掉自己窗口')
}

console.log('\n=== 对照 2：德国自己做别的动作，应清掉自己的 offer ===')
{
	const g = mkGame()
	g.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '德国国家技能' }
	rules.action(g, 'Axis', 'log', {})
	ok(!g.national_skill_offer, '【正确】德国自己别的动作清掉自己窗口')
}

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
