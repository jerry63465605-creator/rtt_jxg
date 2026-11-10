/*
 * #4 罗马尼亚铁卫 16703：delegate[german_draw] 期间，持国家技能窗口的一方必须能提交技能
 *   注：意大利与德国同属 Axis，客户端按阵营取 actions —— 因此断言都看 Axis 侧。
 *
 * A ★★ 意大利有 national_skill_offer + 德国弃牌挂起 → Axis actions 含 use/skip_national_skill
 * B ★  同一挂起但无技能窗口 → 不给键（不放宽）
 * C ★★ 德国侧原口径仍在：italy_german_draw / event_delegate_decline
 * D ★★ 真发 use_national_skill 能结算（不被 do_action 冻结）
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, new_board } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const acts = (g, side) => Object.keys(R.view(g, side).actions || {})

function scene({ withOffer = true } = {}) {
	const g = new_board(20261108, { nation: '意大利', phase: 'play' })
	g.delegate = { mode: 'german_draw', nation: '意大利', to: '德国', waiting_response: false }
	if (withOffer)
		g.national_skill_offer = { nation: '意大利', skill: 'it_skill', kind: 'offer', desc: '测试用技能窗口' }
	I.refresh(g)
	return g
}

console.log('=== A. 有技能窗口 + german_draw 挂起（Axis 视角）===')
{
	const g = scene()
	const a = acts(g, 'Axis')
	console.log('  Axis actions = ' + JSON.stringify(a))
	ok('★★ 含 use_national_skill', a.indexOf('use_national_skill') >= 0, JSON.stringify(a))
	ok('★★ 含 skip_national_skill', a.indexOf('skip_national_skill') >= 0, JSON.stringify(a))
}

console.log('\n=== B. 无技能窗口 → 不给键 ===')
{
	const g = scene({ withOffer: false })
	const a = acts(g, 'Axis')
	console.log('  Axis actions = ' + JSON.stringify(a))
	ok('★ 不含国家技能键', a.indexOf('use_national_skill') < 0 && a.indexOf('skip_national_skill') < 0, JSON.stringify(a))
}

console.log('\n=== C. 德国弃牌通道不被挤掉 ===')
{
	const g = scene()
	const a = acts(g, 'Axis')
	ok('★★ 仍有 italy_german_draw / event_delegate_decline',
		a.indexOf('italy_german_draw') >= 0 && a.indexOf('event_delegate_decline') >= 0, JSON.stringify(a))
}

console.log('\n=== D. 真发 use_national_skill ===')
{
	const g = scene()
	const score0 = JSON.stringify(g.score || {})
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_national_skill', {})
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + (lg || '(无日志)').slice(0, 160))
	console.log('  score ' + score0 + ' → ' + JSON.stringify(g.score || {}))
	ok('★★ 技能真的结算（有日志），未被冻结', !!lg && /国家技能/.test(lg), lg.slice(0, 120))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
