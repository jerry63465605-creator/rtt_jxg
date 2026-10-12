/*
 * 复现：德国★卡(15237)结算后开了国家技能窗口，
 * 轮转到英国（抽牌/响应卡结算）时窗口被无差别清掉。
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

console.log('=== 场景 A：英国抽牌阶段入口清掉德国 offer ===')
{
	const g = mkGame()
	g.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '德国国家技能' }
	// 英国进入抽牌阶段 -> run_phase_entry -> maybe_offer(英国,'draw')
	I.maybe_offer_national_skill(g, '英国', 'draw')
	ok(!(g.national_skill_offer && g.national_skill_offer.nation === '德国'),
		'【复现】英国抽牌阶段把德国 offer 清掉/替换成英国的（BUG）')
}

console.log('\n=== 场景 B：英国结算响应卡 after_card_resolved 清掉德国 offer ===')
{
	const g = mkGame()
	g.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '德国国家技能' }
	I.after_card_resolved(g, '英国', '15334') // 英国打出非★响应卡
	ok(!g.national_skill_offer, '【复现】英国结算非★卡把德国 offer 清掉了（BUG）')
}

console.log('\n=== 场景 C：英国做出任何动作（action 入口）清掉德国 offer ===')
{
	const g = mkGame()
	g.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '德国国家技能' }
	g.current_nation = '英国'
	const r = rules.action(g, 'Allies', 'log', {})
	ok(!g.national_skill_offer, '【复现】英国任意动作把德国 offer 清掉了（BUG）')
}

console.log('\n=== 对照：德国自己打非★卡，应清掉自己的 offer ===')
{
	const g = mkGame()
	g.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '德国国家技能' }
	I.after_card_resolved(g, '德国', '15208') // 德国打非★卡
	ok(!g.national_skill_offer, '【正确】德国自己打别的非★卡清掉自己窗口')
}

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
