/*
 * 【2026-10-26】弃牌 / 抽牌 / 资源再分配 的【牌面保密】回归脚本。
 *
 * 背景：牌在【手牌 / 本方牌堆 / 本方弃牌堆】三个暗区之间流转时，
 *       game.log 是双方共享的，写卡名就等于把暗区摊开给对手。
 *
 * 三类断言：
 *   ① 静态兜底：rules.js 里凡属"暗区流转"语境的日志，不得出现卡名插值；
 *   ② 运行时：真实走 action 路径（弃牌阶段 / 出牌阶段弃 1 张 / 资源再分配），
 *              产生的相关日志只含【张数】、不含任何卡名；
 *   ③ 反证（防过严）：公开信息（打出的牌、桌面状态卡）仍旧照常写卡名。
 *
 * 用法：node tools/_smoke_discard_privacy.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { CARDS } = require(path.join(MOD, 'cards.js'))

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}

/* 取该国所有卡牌实例的名字，用于断言"日志里没出现这些名字" */
const CARD_NAMES = CARDS.map(c => c.name).filter(Boolean)

/* 断言：给定日志行里不含任何已知卡名（且不含《） */
function hasCardName(line) {
	if (/《/.test(line)) return true
	for (const n of CARD_NAMES) if (line.indexOf(n) >= 0) return true
	return false
}

/* ============================================================
 * ① 静态兜底
 * ============================================================ */
console.log('\n[静态] 暗区流转的日志不得插值卡名')
const LINES = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split(/\r?\n/)
/*
 * 语境关键词（暗区流转）：
 *   弃牌阶段 / 出牌阶段弃置 / 资源再分配换取 / 抽牌进手 /
 *   从牌堆弃置 / 从弃牌堆取回 / 置于牌堆顶 / 留在弃牌堆
 */
const KEY = /(弃牌阶段|资源再分配：|HIDDEN_CARD_DESC\.(discard|draw|deckDiscard|takeBack)\(|（来自弃牌堆）)/
const leaks = []
for (let i = 0; i < LINES.length; i++) {
	if (!/game\.log\.push/.test(LINES[i])) continue
	let buf = LINES[i], j = i
	while (j < LINES.length - 1 && !/\)\s*;?\s*$/.test(LINES[j]) && j - i < 5) {
		j++; buf += ' ' + LINES[j].trim()
	}
	buf = buf.replace(/\s+/g, ' ')
	if (!KEY.test(buf)) continue
	/* 允许出现的卡名：写死在文案里的【桌面明牌】（如《大萧条的余波》《卡佩里尼》，
	 * 它们是触发源、本来就在桌面上）。禁止的是【插值】出来的牌名。 */
	if (/《'\s*\+/.test(buf)) leaks.push((i + 1) + ': ' + buf.slice(0, 130))
}
ok('rules.js 暗区流转日志无卡名插值', leaks.length === 0,
	leaks.length ? '\n      ' + leaks.join('\n      ') : '')

/* 顺便校验文案源存在且导出（文档/测试都依赖它） */
ok('HIDDEN_CARD_DESC 已导出到 _internal', !!I.HIDDEN_CARD_DESC)
if (I.HIDDEN_CARD_DESC) {
	ok('discard(n) 只给张数', I.HIDDEN_CARD_DESC.discard(3) === '弃置 3 张手牌')
	ok('draw(n) 只给张数', I.HIDDEN_CARD_DESC.draw(2) === '抽 2 张牌')
	ok('deckDiscard(n) 只给张数', I.HIDDEN_CARD_DESC.deckDiscard(1) === '从牌堆弃置 1 张牌')
	ok('takeBack(n) 只给张数', I.HIDDEN_CARD_DESC.takeBack(2) === '从弃牌堆取回 2 张手牌')
}

/* ============================================================
 * ② 运行时
 * ============================================================ */
function freshGame(nation) {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = nation
	/* 德国属轴心：直接写角色常量，避免依赖未导出的 helper */
	g.active = 'Axis'
	return g
}

/* ---------- 弃牌阶段：主动弃牌 ---------- */
console.log('\n[运行时] 弃牌阶段：只记张数，不记牌名')
{
	const g = freshGame('德国')
	g.turn_phase = 'discard'
	const hand = (g.hands['德国'] || []).slice(0, 2)
	ok('夹具：德国手里至少 2 张', hand.length === 2)
	const before = g.log.length
	rules.action(g, 'Axis', 'discard_in_discard_phase', { cards: hand })
	const added = g.log.slice(before)
	console.log('    新增日志：' + JSON.stringify(added))
	const dl = added.filter(l => /弃牌阶段/.test(l))
	ok('产生了弃牌阶段日志', dl.length === 1)
	ok('日志写明弃了 2 张', /弃置 2 张手牌/.test(dl[0] || ''))
	ok('日志不含任何卡名', dl.every(l => !hasCardName(l)),
		'  -> ' + JSON.stringify(dl))
	ok('确有 2 张进了弃牌堆（行为没被改坏）',
		(g.discard['德国'] || []).length >= 2 &&
		hand.every(id => (g.discard['德国'] || []).indexOf(id) >= 0))
}

/* ---------- 出牌阶段：弃 1 张 ---------- */
console.log('\n[运行时] 出牌阶段弃 1 张：只记张数，不记牌名')
{
	const g = freshGame('德国')
	g.turn_phase = 'play'
	const hand = (g.hands['德国'] || [])
	const card = hand[0]
	const before = g.log.length
	rules.action(g, 'Axis', 'discard_one', { card: card })
	const added = g.log.slice(before)
	console.log('    新增日志：' + JSON.stringify(added))
	const dl = added.filter(l => /出牌阶段/.test(l))
	ok('产生了出牌阶段日志', dl.length >= 1)
	ok('日志写明弃置 1 张手牌', /弃置 1 张手牌/.test(dl.join('|')))
	ok('日志不含任何卡名', dl.every(l => !hasCardName(l)),
		'  -> ' + JSON.stringify(dl))
}

/* ---------- 资源再分配 ---------- */
console.log('\n[运行时] 资源再分配：不写"换到了哪张基本卡"')
{
	const g = freshGame('德国')
	g.turn_phase = 'resource'
	const I2 = I
	const basics = I2.deck_basics(g, '德国')
	ok('夹具：牌堆里有可选基本卡', basics.length > 0)
	const hand = (g.hands['德国'] || []).slice(0, 3)
	const take = basics[0].id
	const before = g.log.length
	rules.action(g, 'Axis', 'resource_swap', { discard: hand, take: take })
	const added = g.log.slice(before)
	console.log('    新增日志：' + JSON.stringify(added))
	const rl = added.filter(l => /资源再分配/.test(l))
	ok('产生了资源再分配日志', rl.length >= 1)
	ok('日志写明执行了资源再分配', /执行资源再分配/.test(rl.join('|')))
	ok('日志不含任何卡名（含换到的基本卡）', rl.every(l => !hasCardName(l)),
		'  -> ' + JSON.stringify(rl))
	ok('换到的牌确实进了手牌（行为没被改坏）',
		(g.hands['德国'] || []).indexOf(take) >= 0)
}

/* ============================================================
 * ③ 反证：公开信息不许被误伤
 * ============================================================ */
console.log('\n[反证] 打出的牌仍照常公开（防过严）')
{
	const g = freshGame('德国')
	g.turn_phase = 'play'
	const hand = (g.hands['德国'] || [])
	/* 找一张能正常打出的 BASIC 牌，用 move/army 之类；找不到就跳过 */
	let played = null
	for (const id of hand) {
		const c = I.inst_card(id)
		if (c && c.type === 'BASIC' && /建设陆军|发起陆战/.test(c.name || '')) { played = id; break }
	}
	if (!played) {
		console.log('    （夹具里没有可用的基本卡，跳过本组）')
	} else {
		const before = g.log.length
		rules.action(g, 'Axis', 'play_card', { card: played })
		const added = g.log.slice(before)
		console.log('    新增日志：' + JSON.stringify(added))
		/*
		 * 反证：play_card 这条路径【照旧】把牌名写进公开日志
		 * （本次改动只动"暗区流转"，不碰"打出"这种本来就要公开的动作）。
		 */
		ok('打出路径仍旧公开卡名（本次未误伤）', added.some(l => /《/.test(l)))
	}
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
