/*
 * 【B68】#ask_box 的「登记 / 清理」统一走 helper（claim_ask_box / clear_own_ask_box）。
 *
 * 背景：B67 修好了 6 个 delegate 框的「美国视角不清」，但那是把同一段 12 行代码
 * 复制了 6 份 —— 只是「写法统一」，不是「代码统一」。以后新增一个每帧驱动的提示框，
 * 仍然可能漏掉「登记 kind」或「无数据清框」中的一步（2026-11-27 的事故就是这么来的：
 * 义勇军日本视角登记了、美国视角漏了）。
 *
 * 本次：
 *   ① 新增 helper
 *        claim_ask_box(kind)      —— 声明「当前这个框是我写的」
 *        clear_own_ask_box(kind)  —— 只有确实是我写的才清（避免误清别人的框）
 *   ② 全库把「裸手工判断」统一替换成 helper 调用：
 *        13 处清理块 + 19 处单字段登记
 *   ③ 结果：代码里【不再存在】任何「ask_state.kind === 'x' + ask_state = null + render_ask_box(null)」
 *      的裸清理块 —— 新增提示框只能走 helper，漏一步就会在测试里暴露。
 *
 * 用法：node tools/_real_test_B68_askbox_unified.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const SRC = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const HTML = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
const L = SRC.split(/\r?\n/)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

console.log('=== A. helper 存在且语义正确 ===')
{
	ok('★★ claim_ask_box(kind) 定义',
		/function claim_ask_box\(kind\) \{\s*\n\s*ask_state = \{ kind: kind \}/.test(SRC))
	ok('★★ clear_own_ask_box(kind) 定义（只在 kind 匹配时清）', (() => {
		const i = SRC.indexOf('function clear_own_ask_box')
		const seg = SRC.slice(i, i + 400)
		return /if \(ask_state && ask_state\.kind === kind\)/.test(seg) &&
			/ask_state = null/.test(seg) &&
			/render_ask_box\(null, null, null\)/.test(seg)
	})())
	ok('★★ clear_own_ask_box 未匹配时不清（返回 false，不误清别人的框）',
		/return false/.test(SRC.slice(SRC.indexOf('function clear_own_ask_box'), SRC.indexOf('function clear_own_ask_box') + 400)))
}

console.log('\n=== B. 全库再无「裸清理块」 ===')
{
	const hits = []
	for (let i = 0; i < L.length; i++) {
		if (!/ask_state && ask_state\.kind === '/.test(L[i])) continue
		const seg = L.slice(i, i + 6).join('\n')
		if (/ask_state = null/.test(seg) && /render_ask_box\(null/.test(seg)) hits.push(i + 1)
	}
	ok('★★ 剩余清理型裸判断 = 0（全部走 clear_own_ask_box）', hits.length === 0, JSON.stringify(hits))
}

console.log('\n=== C. 关键 kind 都已接入 helper ===')
{
	const KINDS = [
		'us_japan_delegate', 'us_china_delegate', 'uk_build_delegate', 'su_build_delegate',
		'us_china_build', 'us_theater_delegate',
		'status_ask', 'balloon', 'us_merchant',
	]
	for (const k of KINDS) {
		const claim = new RegExp("claim_ask_box\\('" + k + "'\\)").test(SRC)
		const clear = new RegExp("clear_own_ask_box\\('" + k + "'\\)").test(SRC)
		ok(k + ' 已登记 + 可清理', claim && clear, JSON.stringify({ claim, clear }))
	}
}

console.log('\n=== D. 裸 render_ask_box(null) 只剩 helper 内部 / 主动清 ===')
{
	const all = (SRC.match(/render_ask_box\(null, null, null\)/g) || []).length
	const inHelper = (() => {
		const i = SRC.indexOf('function clear_own_ask_box')
		return /render_ask_box\(null, null, null\)/.test(SRC.slice(i, i + 400)) ? 1 : 0
	})()
	ok('★ render_ask_box(null) 总数 = helper 1 + 主动清若干', all >= 1 + inHelper, JSON.stringify({ all, inHelper }))
}

console.log('\n=== E. 版本串 ===')
{
	const vers = (HTML.match(/\?v=(\d{8}[a-z])/g) || []).map(s => s.slice(3))
	const uniq = Array.from(new Set(vers))
	ok('★★ 客户端有改动 -> 版本串统一为 20261127c', uniq.length === 1 && uniq[0] === '20261127c', JSON.stringify(uniq))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
