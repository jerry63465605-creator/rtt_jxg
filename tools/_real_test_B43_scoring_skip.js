/*
 * 【本体 #4 / B43】大本营被占跳过计分：加分/扣分/状态卡自动结算一并免除
 * 真实 R.setup / R._internal.phase_scoring 驱动（初始局面只用工具摆）。
 * 大本营位置全部用 effective_home_base 动态取，不写死「莫斯科/不列颠」或地区 id。
 * 用法：node tools/_real_test_B43_scoring_skip.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
/* 只用工具摆初始局面：清空棋子/标记，可按需摆敌军到大本营 */
function seed() {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.markers = {}
	g.pending_scoring = {}
	return g
}
function place(g, sp, nat, type, id) {
	const key = id || ('probe_' + Object.keys(g.location).length)
	g.location[key] = sp
	g.piece_nation[key] = nat
	g.piece_type[key] = type || 'army'
	return key
}
/* 动态取大本营（与 phase_scoring 跳过判定同源），不写死地区名/id */
function occupyHome(g, nation, enemy) {
	const hb = I.effective_home_base(g, nation)
	if (hb == null) throw new Error('没有大本营：' + nation)
	place(g, hb, enemy || '德国', 'army', 'enemy_at_' + nation)
	return hb
}
/* 摆中立苏联部队在〈印度〉，让 soviet_india_penalty 有值 */
function placeSovietNearIndia(g) {
	const india = D.id_of('印度')
	if (india == null) throw new Error('没有印度地区')
	place(g, india, '苏联', 'army', 'soviet_at_india')
	return india
}
/* 摆 8601 + 日本陆军在海参崴，让 auto.run 返回 -1 */
function place8601(g) {
	const vp = D.id_of('海参崴')
	if (vp == null) throw new Error('没有海参崴地区')
	g.table = g.table || {}
	g.table['日本'] = ['8601#x1']
	place(g, vp, '日本', 'army', 'jp_at_vp')
	return vp
}
const res = (g, n) => I.phase_scoring(g, n)

console.log('=== A. 英国大本营被占：印度扣分彻底取消（动态大本营）===')
{
	const hb = (() => { const g = seed(); const h = I.effective_home_base(g, '英国'); occupyHome(g, '英国'); return h })()
	ok('★ 大本营由 effective_home_base 动态取得（非硬编码）',
		typeof hb === 'number' && hb > 0, J(hb))
	const g = seed()
	occupyHome(g, '英国')
	const india = placeSovietNearIndia(g)
	ok('★ 扣分前置条件成立（中立苏联在印度 zone）',
		I.soviet_india_penalty(g).penalty > 0, J(I.soviet_india_penalty(g)))
	const r = res(g, '英国')
	ok('★★ 跳过计分：india_penalty=0、净分 0、不落账',
		r.india_penalty === 0 && r.gained === 0 &&
		!g.pending_scoring['英国'] &&
		!r.results.some(x => x.penalty),
		J({ r: { gained: r.gained, india: r.india_penalty }, pending: g.pending_scoring }))
	ok('★★ results 里英国仍标 skipped（各判各的判定未破坏）',
		r.results.some(x => x.nation === '英国' && x.skipped),
		J(r.results))
	ok('★★ 日志写明「加分、扣分与状态卡自动结算一并免除」',
		(g.log || []).some(x => /一并免除/.test(x)),
		J((g.log || []).filter(x => /跳过计分/.test(x))))
}

console.log('\n=== B. 对照：大本营未被占时印度扣分照常 ===')
{
	const g = seed()
	placeSovietNearIndia(g)
	const r = res(g, '英国')
	ok('★★ 印度扣分照常落账（未跳过时不回归）',
		r.india_penalty > 0 && r.gained === -r.india_penalty &&
		g.pending_scoring['英国'] === r.gained,
		J({ india: r.india_penalty, gained: r.gained, pending: g.pending_scoring['英国'] }))
}

console.log('\n=== C. 陷阱：法国大本营被占不影响英国计分（各判各的）===')
{
	const g = seed()
	occupyHome(g, '法国')
	placeSovietNearIndia(g)
	const r = res(g, '英国')
	ok('★★ 法国被占、英国未被占 -> 印度扣分仍照常（不按 bloc 任一 skipped）',
		r.india_penalty > 0 && r.gained < 0 &&
		r.results.some(x => x.nation === '法国' && x.skipped),
		J({ india: r.india_penalty, results: r.results.map(x => ({ n: x.nation, s: !!x.skipped })) }))
	const rFr = res(g, '法国')
	ok('★★ 印度扣分不顺延到法国计分阶段',
		rFr.india_penalty === 0, J(rFr.india_penalty))
}

console.log('\n=== D. 苏联大本营被占：8601 的 -1 一并免除（动态大本营）===')
{
	const g0 = seed()
	place8601(g0)
	const base = res(g0, '苏联')
	ok('★ 未跳过时 8601 扣 1 分（对照成立）',
		base.gained === -1 || base.results.some(x => x.gained === -1),
		J({ gained: base.gained, results: base.results.map(x => x.gained) }))
	const g = seed()
	const hb = occupyHome(g, '苏联')
	place8601(g)
	const r = res(g, '苏联')
	ok('★★ 苏联 effective_home_base 被占（' + hb + '）：auto 整段不结算、-1 免除',
		r.gained === 0 && !r.results.some(x => x.gained === -1) &&
		!g.pending_scoring['苏联'],
		J({ gained: r.gained, results: r.results.map(x => ({ n: x.nation, g: x.gained })) }))
	ok('★★ results 里苏联标 skipped',
		r.results.some(x => x.nation === '苏联' && x.skipped), J(r.results))
}

console.log('\n=== E. 静态守卫（动态判据 / 无硬编码 / 客户端零改动）===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const fn = src.slice(src.indexOf('function phase_scoring('),
		src.indexOf('function phase_scoring(') + 16000)
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('★★ selfSkipped 按【代表国自己】判，不按 bloc 任一',
		/const selfSkipped = results\.some\(r => r\.nation === nation && r\.skipped\)/.test(src))
	ok('★★ 大本营判定仍走 effective_home_base(game, n)，函数内无「莫斯科」/硬编码 id 9',
		/const hb = effective_home_base\(game, n\)/.test(fn) &&
		!/莫斯科/.test(fn) && !/=== 9\b/.test(fn),
		J((fn.match(/莫斯科/g) || []).length))
	ok('★★ 两处守卫：印度扣分 + 整段 auto',
		/if \(nation === '英国' && !selfSkipped\)/.test(fn) &&
		/if \(selfSkipped\) break/.test(fn))
	ok('★ 既有「各判各的」注释与跳过判定未改',
		/两者必须【各判各的】/.test(fn) &&
		/results\.push\(\{ nation: n, skipped: true, gained: 0 \}\)/.test(fn))
	ok('★ 客户端零改动 -> 版本串仍 20261112p',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v === '20261112p'),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
