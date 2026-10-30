/*
 * 验证「创建对局页的两个增强德国选项」：T1 德国回合开始时从牌库直取入手
 *
 *   选项（create.html）：ger_boost_ardennes（15225 阿登闪击战）/ ger_boost_strategy（15239 战略规划）
 *
 * 单元（直接调 grant_ger_boosters，棋盘可控）：
 *   A. 都不勾 -> 不补
 *   B. 勾阿登 -> 15225 从牌库进手牌
 *   C. 勾两张 -> 两张都进手牌，各 1 张
 *   D. 幂等：重复调用不再加
 *   E. 手牌已有 -> 跳过（写日志）
 *   F. 弃牌堆已有 -> 跳过（写日志）
 *   G. 牌库没有 -> 写"未找到"日志、不崩
 * 集成（走真实 opening_discard 到 T1）：
 *   H. T1 后 15225 一定不在牌库；要么在手（补发），要么在弃牌堆（初始阶段被弃 -> 按规则不补）
 *   I. 静态：create.html 两个 checkbox + rules.js 关键点
 *
 * 用法：node tools/_verify_ger_boosters.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const inHand = (g, f) => (g.hands['德国'] || []).some(x => faceOf(x) === f)
const inDisc = (g, f) => (g.discard['德国'] || []).some(x => faceOf(x) === f)
const inDeck = (g, f) => (g.decks['德国'] || []).some(x => faceOf(x) === f)

/* 把某张牌强制放回德国牌库（清掉手牌/弃牌堆/桌面/移出里的同名实例），用于可控单元测 */
function forceToDeck(g, face) {
	const strip = arr => (arr || []).filter(x => faceOf(x) !== face)
	const pick = []
	for (const k of [['hands', g.hands], ['discard', g.discard], ['table', g.table], ['removed', g.removed]]) {
		const bank = k[1]['德国'] || []
		for (const x of bank) if (faceOf(x) === face) pick.push(x)
	}
	g.hands['德国'] = strip(g.hands['德国'])
	g.discard['德国'] = strip(g.discard['德国'])
	g.table['德国'] = strip(g.table['德国'])
	g.removed['德国'] = strip(g.removed['德国'])
	/* 必须用【真实实例 id】—— 造 face#999 这种假 id 会污染 inDeck 判定 */
	const card = pick[0] ||
		(g.decks['德国'] || []).find(x => faceOf(x) === face)
	if (!card) return null
	g.decks['德国'] = strip(g.decks['德国'])
	g.decks['德国'].push(card)
	return card
}

function unit(opts) {
	const g = R.setup(7, 'Standard', opts)
	g.opening = null                 /* 单元测不需要走初始阶段 */
	g.ger_boosters_done = false
	return g
}

console.log('\n=== A. 都不勾 ===')
{
	const g = unit({})
	ok('game.options 均为 false', !g.options.ger_boost_ardennes && !g.options.ger_boost_strategy,
		JSON.stringify(g.options))
	const before = (g.hands['德国'] || []).length
	I.grant_ger_boosters(g)
	ok('不补发（手牌数不变）', (g.hands['德国'] || []).length === before)
	ok('无日志', !(g.log || []).some(l => l.indexOf('【开局增强】') >= 0))
}

console.log('\n=== B. 勾阿登 ===')
{
	const g = unit({ ger_boost_ardennes: 'true' })
	ok('选项已记录', g.options.ger_boost_ardennes === true)
	const card = forceToDeck(g, '15225')
	g.ger_boosters_done = false
	const n0 = (g.hands['德国'] || []).length
	I.grant_ger_boosters(g)
	ok('★ 15225 已进手牌', inHand(g, '15225'), JSON.stringify((g.hands['德国'] || []).map(faceOf)))
	ok('手牌 +1', (g.hands['德国'] || []).length === n0 + 1)
	ok('15225 已不在牌库', !inDeck(g, '15225'))
	ok('同一实例（不是新造的）', (g.hands['德国'] || []).indexOf(card) >= 0, card)
	ok('15239 未被补发', !inHand(g, '15239'))
	ok('日志写明牌名',
		(g.log || []).some(l => l.indexOf('【开局增强】德国牌库直取入手') >= 0 &&
			l.indexOf('阿登闪击战') >= 0),
		(g.log || []).filter(l => l.indexOf('【开局增强】') >= 0).join(' | '))
}

console.log('\n=== C. 勾两张 ===')
{
	const g = unit({ ger_boost_ardennes: true, ger_boost_strategy: true })
	forceToDeck(g, '15225'); forceToDeck(g, '15239')
	g.ger_boosters_done = false
	I.grant_ger_boosters(g)
	ok('★ 两张都在手牌', inHand(g, '15225') && inHand(g, '15239'),
		JSON.stringify((g.hands['德国'] || []).map(faceOf)))
	const c1 = (g.hands['德国'] || []).filter(x => faceOf(x) === '15225').length
	const c2 = (g.hands['德国'] || []).filter(x => faceOf(x) === '15239').length
	ok('各只有 1 张', c1 === 1 && c2 === 1, c1 + '/' + c2)
}

console.log('\n=== D. 幂等 ===')
{
	const g = unit({ ger_boost_ardennes: true })
	forceToDeck(g, '15225')
	g.ger_boosters_done = false
	I.grant_ger_boosters(g)
	const n1 = (g.hands['德国'] || []).length
	I.grant_ger_boosters(g)
	ok('重复调用不重复加', (g.hands['德国'] || []).length === n1,
		n1 + ' -> ' + (g.hands['德国'] || []).length)
}

console.log('\n=== E. 手牌已有 -> 跳过 ===')
{
	const g = unit({ ger_boost_ardennes: true })
	const card = forceToDeck(g, '15225')
	/* 再放回手牌（模拟初始发牌已抽到） */
	g.decks['德国'] = (g.decks['德国'] || []).filter(x => x !== card)
	g.hands['德国'].push(card)
	g.ger_boosters_done = false
	const n0 = (g.hands['德国'] || []).length
	I.grant_ger_boosters(g)
	ok('手牌数不变', (g.hands['德国'] || []).length === n0)
	ok('仍只有 1 张', (g.hands['德国'] || []).filter(x => faceOf(x) === '15225').length === 1)
	ok('写了跳过日志', (g.log || []).some(l => l.indexOf('已在德国手牌/弃牌堆/桌面') >= 0),
		(g.log || []).filter(l => l.indexOf('【开局增强】') >= 0).join(' | '))
}

console.log('\n=== F. 弃牌堆已有 -> 跳过 ===')
{
	const g = unit({ ger_boost_strategy: true })
	const card = forceToDeck(g, '15239')
	g.decks['德国'] = (g.decks['德国'] || []).filter(x => x !== card)
	g.discard['德国'] = g.discard['德国'] || []
	g.discard['德国'].push(card)
	g.ger_boosters_done = false
	I.grant_ger_boosters(g)
	ok('未补进手牌', !inHand(g, '15239'))
	ok('牌库中也没有', !inDeck(g, '15239'))
	ok('写了跳过日志', (g.log || []).some(l => l.indexOf('已在德国手牌/弃牌堆/桌面') >= 0))
}

console.log('\n=== G. 牌库没有 -> 提示不崩 ===')
{
	const g = unit({ ger_boost_ardennes: true })
	forceToDeck(g, '15225')
	const card = (g.decks['德国'] || []).find(x => faceOf(x) === '15225')
	g.decks['德国'] = (g.decks['德国'] || []).filter(x => x !== card)
	g.ger_boosters_done = false
	I.grant_ger_boosters(g)
	ok('未崩且未进手牌', !inHand(g, '15225'))
	ok('写了"未找到"日志', (g.log || []).some(l => l.indexOf('德国牌库中未找到') >= 0),
		(g.log || []).filter(l => l.indexOf('【开局增强】') >= 0).join(' | '))
}

console.log('\n=== H. 集成：走真实 opening_discard 到 T1 ===')
{
	const g = R.setup(7, 'Standard', { ger_boost_ardennes: true, ger_boost_strategy: true })
	ok('开局进入初始阶段', !!g.opening)
	for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国']) {
		if (!g.opening || g.current_nation !== n) break
		const hand = (g.hands[n] || []).slice(0, 3)
		R.action(g, I.faction_of_nation(n) === 'allies' ? 'Allies' : 'Axis',
			'opening_discard', { cards: hand })
	}
	ok('已进入 T1 德国', g.turn === 1 && g.current_nation === '德国' && !g.opening,
		JSON.stringify({ turn: g.turn, cur: g.current_nation, op: !!g.opening }))
	/* 初始阶段后每人 7 张；补发成功的张数会让它变多（15225 可能被初始阶段弃掉 -> 不补） */
	const added = (g.log || []).filter(l => l.indexOf('德国牌库直取入手') >= 0)
		.join('').match(/152[23]\d#/g)
	const addN = added ? added.length : 0
	ok('德国手牌 = 7 + 补发数（' + addN + '）',
		(g.hands['德国'] || []).length === 7 + addN,
		String((g.hands['德国'] || []).length))
	for (const f of ['15225', '15239']) {
		const h = inHand(g, f), d = inDisc(g, f), k = inDeck(g, f)
		ok('★ ' + f + ' 不在牌库（要么在手=' + h + '，要么已被初始阶段弃掉=' + d + '）', !k,
			JSON.stringify({ hand: h, disc: d, deck: k }))
	}
	console.log('  T1 德国手牌=' + JSON.stringify((g.hands['德国'] || []).map(faceOf)))
	console.log('  开局增强日志=' + ((g.log || []).filter(l => l.indexOf('【开局增强】') >= 0).join(' | ') || '（无）'))
	ok('日志与结果一致（补发了 或 说明了跳过）',
		(g.log || []).some(l => l.indexOf('【开局增强】') >= 0),
		'无开局增强日志')
}

console.log('\n=== I. 静态守卫 ===')
{
	const html = fs.readFileSync(path.join(MOD, 'create.html'), 'utf8')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('create.html: 阿登 checkbox',
		html.indexOf('name="ger_boost_ardennes"') > 0 && html.indexOf('阿登闪击战') > 0)
	ok('create.html: 战略规划 checkbox',
		html.indexOf('name="ger_boost_strategy"') > 0 && html.indexOf('战略规划') > 0)
	ok('rules.js: setup 读取 options',
		src.indexOf('ger_boost_ardennes: !!(options && options.ger_boost_ardennes)') > 0)
	ok('rules.js: GER_BOOSTERS 表含两张牌',
		src.indexOf("face: '15225'") > 0 && src.indexOf("face: '15239'") > 0)
	ok('rules.js: T1 开始时调用 grant_ger_boosters',
		src.indexOf('grant_ger_boosters(game)') > 0)
	ok('rules.js: 幂等标记 ger_boosters_done', src.indexOf('ger_boosters_done') > 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
