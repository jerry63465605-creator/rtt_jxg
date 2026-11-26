/*
 * 【B57】《租借法案》委托代打经济战卡 —— 复用 play_card 的同一份 ECON 结算。
 *
 * 玩家报障（2026-11-27）：「美国租借法案让英国打出潜艇，无效果」。
 *
 * 根因：`resolve_us_lend_lease_play` 自己写了一份"按卡类型分派"
 *      （EVENT / STATUS / EFFECT / BASIC / else 丢弃），**漏了 ECON** ——
 *      经济战卡落到最后的 else，只 discard 不结算。
 * 深层原因：`action_play_card` 把「效果结算」与「出牌名额记账」耦在一个 if 链里，
 *      没有纯结算入口，当初想复用只能复制一份分派，复制就会漂移。
 *
 * 修法：
 *   ① 把 action_play_card 的 `if (c.type === 'ECON') { ... }` 整段（162 行）抽成
 *      `run_econ_card(game, nation, c, card_id, arg, opts)`，段内 3 处名额记账
 *      包进 `if (quota)`；action_play_card 反向调用它（quota:true，行为不变）。
 *   ② `resolve_us_lend_lease_play` 新增 ECON 分支，调同一个函数但 quota:false ——
 *      这是【委托方回合】的代打，被委托国并没有轮到自己，不能标记"本回合已出牌"。
 *   ③ 同一函数里删掉 BASIC 分支原有的 mark_play_done / card_actions++（口径不一致）。
 *   ④ 最后的 else 不再静默吞牌：退回手牌 + 明确日志。
 *
 * 用法：node tools/_real_test_B57_lend_lease_econ.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const ECON_CARD = '15314#h1'   /* 马耳他潜艇群（英军 ECON，链式应答） */

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

function seed({ lendLease }) {
	const g = R.setup(20261127, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.active = 'Allies'
	g.current_nation = '英国'
	g.turn_phase = 'play'
	if (lendLease) {
		g.delegate = {
			mode: 'single', nation: '英国', nat: '英国', done: false, played: false,
			return_nation: '美国', return_active: 'Allies', card_id: '17535#x1',
		}
	}
	g.hands['英国'] = [ECON_CARD]
	return g
}

console.log('=== A. 委托代打（quota:false）：ECON 真的结算，且不污染名额 ===')
{
	const g = seed({ lendLease: true })
	const pdBefore = J(g.play_done || {})
	let threw = null
	try { R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: ECON_CARD }) } catch (e) { threw = e }
	ok('★★ 不抛异常', threw === null, threw ? threw.message : '')
	const tail = (g.log || []).slice(-2).join('  |  ')
	ok('★★ 进入经济战应答流程（不再"只丢牌"）',
		/\[潜艇行动\]/.test(tail) && /依次选择/.test(tail), tail)
	ok('★★ 牌已离手（不是静默丢弃）', (g.hands['英国'] || []).indexOf(ECON_CARD) < 0)
	ok('★★ play_done 未被污染（本回合英国不该被标记已出牌）',
		J(g.play_done || {}) === pdBefore, J({ before: pdBefore, after: g.play_done }))
	ok('★ 委托仍在、played 已置位',
		!!g.delegate && g.delegate.played === true, J(g.delegate && { played: g.delegate.played }))
}

console.log('\n=== B. 正常出牌（quota:true）：play_card 打同一张 ECON 仍走同一份结算 ===')
{
	const g = seed({ lendLease: false })
	let threw = null
	try { R.action(g, 'Allies', 'play_card', { card: ECON_CARD }) } catch (e) { threw = e }
	ok('★★ 不抛异常', threw === null, threw ? threw.message : '')
	const tail = (g.log || []).slice(-2).join('  |  ')
	ok('★★ 同样进入经济战应答流程（与委托代打共用同一份结算）', /\[潜艇行动\]/.test(tail), tail)
	ok('★ 牌已离手', (g.hands['英国'] || []).indexOf(ECON_CARD) < 0)
	/*
	 * 注意：15314 是【链式挂起】卡（先挂起逐国答复，结算完成时才记账），
	 * 所以此处 play_done 仍为空是正常的，不代表 quota 失效。
	 *   · quota:false（委托代打）永不记账 -> A 组已断言
	 *   · quota:true （正常出牌）由 run_econ_card 内 3 处 `if (quota)` 保护 -> D 组静态断言
	 */
	ok('★ 此时未记账符合链式卡语义（记账在 resolve_econ 完成时）',
		!(g.play_done && g.play_done['英国']), J(g.play_done))
}

console.log('\n=== C. 未知卡型不再静默吞牌（退回手牌 + 明确日志）===')
{
	const g = seed({ lendLease: true })
	/* 造一张类型不被支持的卡：TOKEN 卡（租借法案里没有对应分支） */
	const tokenId = (require(path.join(MOD, 'cards.js')).CARDS.find(x => String(x.type).toUpperCase() === 'TOKEN') || {}).id
	if (tokenId) {
		g.hands['英国'] = [tokenId + '#t1']
		R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: tokenId + '#t1' })
		const tail = (g.log || []).slice(-2).join('  |  ')
		ok('★★ 牌退回手牌（不吞）', (g.hands['英国'] || []).indexOf(tokenId + '#t1') >= 0,
			J(g.hands['英国']))
		ok('★★ 日志明确说明不支持', /暂不支持该卡型/.test(tail), tail)
	} else {
		ok('（无 TOKEN 卡，跳过 C 组）', true)
	}
}

console.log('\n=== D. 静态守卫 ===')
{
	ok('★★ 存在 run_econ_card 函数',
		/^function run_econ_card\(game, nation, c, card_id, arg, opts\)/m.test(SRC))
	ok('★★ pattern_play_card 反向调用它（唯一一份 ECON 结算）',
		/if \(c\.type === 'ECON'\)\s*\n\t\t\treturn run_econ_card\(game, nation, c, card_id, arg, \{[^}]*quota: true/.test(SRC))
	ok('★★ 租借法案也调用它、且 quota: false',
		/quota: false, timing: false, extra: false, playRole: game\.active/.test(SRC))
	ok('★★ 租借法案里已无 mark_play_done / card_actions 记账', (() => {
		const i = SRC.indexOf('function resolve_us_lend_lease_play')
		const seg = SRC.slice(i, SRC.indexOf('\nfunction ', i + 10))
		const code = seg.replace(/\/\*[\s\S]*?\*\//g, '')
		return !/mark_play_done\(/.test(code) && !/card_actions_this_nation\s*=\s*\(?game/.test(code)
	})())
	ok('★★ 租借法案的 else 分支不再 discard_card 吞牌', (() => {
		const i = SRC.indexOf('function resolve_us_lend_lease_play')
		const seg = SRC.slice(i, SRC.indexOf('\nfunction ', i + 10))
		const j = seg.lastIndexOf('暂不支持该卡型')
		if (j < 0) return false
		const around = seg.slice(j, j + 200)
		return /退回手牌|已退回手牌/.test(around)
	})())
	ok('★ run_econ_card 内 3 处记账都受 quota 保护',
		(SRC.match(/if \(quota\) (mark_play_acted|game\.card_actions_this_nation|mark_play_done)/g) || []).length >= 3,
		J((SRC.match(/if \(quota\)/g) || []).length))
	ok('★ 版本串统一且格式合法', (() => {
		const vers = (fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
			.match(/\?v=(\d{8}[a-z])/g) || []).map(s => s.slice(3))
		const uniq = Array.from(new Set(vers))
		return uniq.length === 1 && /^\d{8}[a-z]$/.test(uniq[0] || '')
	})())
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
