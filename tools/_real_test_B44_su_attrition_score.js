/*
 * 【本体 #5 / B44】17847 消耗战：只有真实打出/弃置的[建设陆军]计分，损耗不计
 * 真实 R.setup / R._internal 原子驱动（初始局面只用工具摆）。
 * 用法：node tools/_real_test_B44_su_attrition_score.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const BUILD = '17800'   /* 苏联[建设陆军]（BASIC） */

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function seed(opts) {
	const g = R.setup(20261112, 'Standard')
	const o = opts || {}
	if (o.statusCard !== false) g.table['苏联'] = ['17847#x1']
	g.decks['苏联'] = o.deck || [BUILD + '#t1']
	g.hands['苏联'] = o.hand === undefined ? [BUILD + '#h1'] : o.hand
	return g
}
const allies = g => (g.score && g.score.allies) || 0
const used = g => !!(g.status_used && g.status_used['17847'])

console.log('=== A. 损耗（attrition）翻出[建设陆军]不计分 ===')
{
	const g = seed()
	const lost = I.attrition_cards(g, '苏联', 1)
	ok('★★ 磨出 1 张[建设陆军]进弃牌堆但苏联阵营不加分',
		lost.length === 1 && lost[0] === BUILD + '#t1' &&
		allies(g) === 0 && !used(g),
		J({ lost: lost, score: g.score, used: g.status_used }))
	ok('★★ 弃牌堆里确有该牌（损耗本身正常执行）',
		(g.discard['苏联'] || []).indexOf(BUILD + '#t1') >= 0,
		J(g.discard['苏联']))
	ok('★★ 之后真实弃置仍可计分（不是把 17847 永久关掉）',
		(I.discard_card(g, '苏联', BUILD + '#h1'), allies(g) === 1),
		J({ score: g.score, used: g.status_used }))
}
{
	/* 被动损耗：差额扣分是既有语义，但不能额外 +1 */
	const g = seed({ deck: [BUILD + '#t1'] })
	const lost = I.attrition_passive(g, '苏联', 3)
	ok('★★ attrition_passive 牌库不足只扣差额分，不掺 17847 加分',
		lost.length === 1 && lost.attrition_short === 2 && allies(g) === -2,
		J({ lost: lost.length, short: lost.attrition_short, score: g.score }))
}
{
	/* 牌库耗尽：不洗回、不计分 */
	const g = seed({ deck: [] })
	const lost = I.attrition_cards(g, '苏联', 2)
	ok('★★ 牌库耗尽不洗回、不计分',
		lost.length === 0 && allies(g) === 0 && !used(g),
		J({ lost: lost.length, score: g.score }))
}
{
	const g = seed({ statusCard: false })
	I.attrition_cards(g, '苏联', 1)
	ok('★ 无 17847 在场时损耗同样不加分（对照）',
		allies(g) === 0 && !used(g), J(g.score))
}

console.log('\n=== B. 真实弃置 / 打出仍计分（三条保留路径）===')
{
	const g = seed()
	I.discard_card(g, '苏联', BUILD + '#h1')
	ok('★★ discard_card 弃置[建设陆军]：+1 分且记账',
		allies(g) === 1 && used(g), J({ score: g.score, used: g.status_used }))
}
{
	const g = seed({ hand: [BUILD + '#h1', BUILD + '#h2'] })
	I.discard_card(g, '苏联', BUILD + '#h1')
	I.discard_card(g, '苏联', BUILD + '#h2')
	ok('★★ 一回合一次：第二张弃置不再 +1',
		allies(g) === 1, J(g.score))
}
{
	const g = seed({ hand: [] })
	g.hands['德国'] = [BUILD + '#d1']
	I.discard_card(g, '德国', BUILD + '#d1')
	ok('★★ 非苏联弃置不计分',
		allies(g) === 0, J(g.score))
}
{
	/* 独立流程卡（17526 等）打出后直接入弃牌堆，仍属「打出」 */
	const g = seed({ hand: [] })
	I.push_discard_direct(g, '苏联', BUILD + '#p1')
	ok('★★ push_discard_direct（打出后入堆）仍计分',
		allies(g) === 1 && used(g), J({ score: g.score, used: g.status_used }))
}
{
	/* 17841 近卫军：从弃牌堆真实打出，牌已不在手牌 */
	const g = seed({ hand: [] })
	g.discard['苏联'] = [BUILD + '#g1']
	let sp = null
	for (let i = 1; i < D.spaces.length; i++)
		if (D.spaces[i] && I.can_build_at(g, '苏联', i, 'army').ok) { sp = i; break }
	if (sp == null) { console.log('  (skip: 无可建设地区)') }
	else {
		const r = I.play_build_army_from(g, '苏联', BUILD + '#g1', sp)
		ok('★★ play_build_army_from（近卫军真实打出）仍计分',
			!!r && r.ok && allies(g) === 1 && used(g),
			J({ r: r, score: g.score, used: g.status_used, sp: sp }))
	}
}

console.log('\n=== C. 调试卡 debug_attrition 与真实损耗同口径 ===')
{
	const g = seed()
	g.options = g.options || {}
	const r = R.action(g, g.active, 'debug_attrition', { n: 1, nation: '苏联' })
	ok('★★ 调试损耗复用 attrition_cards，不加分',
		allies(g) === 0 && !used(g),
		J({ score: g.score, used: g.status_used, r: !!r }))
}

console.log('\n=== D. 静态守卫（调用点 / 注释 / 客户端零改动）===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const attrFn = src.slice(src.indexOf('function attrition_cards('),
		src.indexOf('function attrition_passive('))
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('★★ attrition_cards 函数体内不再有 su_attrition_score',
		!/su_attrition_score/.test(attrFn.replace(/\/\*[\s\S]*?\*\//g, '')),
		J((attrFn.match(/su_attrition_score/g) || []).length))
	ok('★★ 恰好 3 个计分调用点（弃牌/打出后入堆/近卫军真实打出）+ 定义',
		(src.match(/su_attrition_score\(game, nation, /g) || []).length === 4,
		J((src.match(/su_attrition_score\(game, nation, /g) || []).length))
	ok('★★ 三处注释已修正为「损耗不计分」',
		/【损耗 attrition_cards 不调用】/.test(src) &&
		/损耗 attrition_cards 不计分（本体 #5）/.test(src) &&
		/【不含 17847 计分】/.test(src))
	ok('★ 调试卡仍复用 attrition_cards（未另写遍历）',
		/const lost = attrition_cards\(game, nation, Math\.floor\(raw\)\)/.test(src))
	ok('★ 客户端零改动 -> 版本串仍 20261112p',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v === '20261112p'),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
