/*
 * 【B67】6 个 delegate 提示框：入口登记 ask_state.kind + 无数据时清框/清高亮。
 *
 * 玩家报障（2026-11-27）：
 *   「打牌后哪些客户端弹出的显示 ui，没有过回合自动清除」
 *   「义勇军在日本视角清理了，但是美国视角没清」
 *
 * 根因：
 *   服务端 view 按视角分支返回 ——
 *     · 日本视角  { reason, need_discard, hand_count }          （无 waiting_for）
 *     · 美国视角  { waiting_for:'日本', reason, hand_count }     （有 waiting_for）
 *   客户端 update_us_japan_box 的 ask_state 只在【非 waiting_for】分支设置：
 *     if (dg.waiting_for) { render_ask_box('等待【日本】…'); return }   ← 没登记 kind
 *     ask_state = { kind: 'us_japan_delegate' }
 *   于是 !dg 时判不出「这个框是我写的」→ 美国侧的「等待日本弃牌」永久残留。
 *   其余 5 个 delegate box 更彻底：!dg 分支直接 return，框和地图高亮都不清。
 *
 * 修法（6 个 box 统一三件套）：
 *   ① 入口（!dg 之后）立刻 ask_state = { kind:'xxx' } —— 覆盖 waiting_for / 正常 两条路径；
 *   ② !dg 时按 kind 清框 render_ask_box(null, null, null)；
 *   ③ !dg 时清地图高亮 clear_target_highlight()（战区移动另清 clear_piece_highlight('theater')）。
 *
 * 用法：node tools/_real_test_B67_delegate_box_clear.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const JS = path.join(MOD, 'play.js')
const SRC = fs.readFileSync(JS, 'utf8')
const HTML = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* [函数名, view 字段, 是否清高亮] */
const BOXES = [
	['update_us_japan_box', 'us_japan_delegate', false],
	['update_us_china_box', 'us_china_delegate', true],
	['update_uk_build_box', 'uk_build_delegate', true],
	['update_su_build_box', 'su_build_delegate', true],
	['update_us_china_build', 'us_china_build', true],
	['update_us_theater_box', 'us_theater_delegate', true],
]

function segOf(fn, len) {
	const i = SRC.indexOf('function ' + fn + '(')
	return i < 0 ? '' : SRC.slice(i, i + (len || 2600))
}

console.log('=== A. 每个 box：入口登记 ask_state.kind ===')
for (const [fn, kind] of BOXES) {
	const seg = segOf(fn)
	/* 【B68】登记统一走 claim_ask_box(kind) */
	ok(fn + ' 登记 ' + kind, new RegExp("claim_ask_box\\('" + kind + "'\\)").test(seg))
}

console.log('\n=== B. 每个 box：!dg 时清框 ===')
for (const [fn, kind] of BOXES) {
	const seg = segOf(fn)
	const m = seg.match(/if \(!dg\) \{([\s\S]{0,600}?)\n\t\}/)
	/* 【B68】清理统一走 clear_own_ask_box(kind) */
	const has = !!m && new RegExp("clear_own_ask_box\\('" + kind + "'\\)").test(m[1])
	ok(fn + ' !dg -> clear_own_ask_box(' + kind + ')', has)
}

console.log('\n=== C. 每个 box：!dg 时清地图高亮 ===')
for (const [fn, , needHL] of BOXES) {
	const seg = segOf(fn)
	const m = seg.match(/if \(!dg\) \{([\s\S]{0,600}?)\n\t\}/)
	const has = !!m && /clear_target_highlight\(\)/.test(m[1])
	if (needHL) ok(fn + ' !dg -> clear_target_highlight', has)
	else ok(fn + ' 本就不高亮地图（不强求清高亮）', true)
}
ok('update_us_theater_box 另清棋子高亮', /clear_piece_highlight\('theater'\)/.test(segOf('update_us_theater_box')))

console.log('\n=== D. 美国视角关键路径：登记必须在 waiting_for 之前 ===')
for (const [fn, kind] of BOXES) {
	const seg = segOf(fn)
	const iReg = seg.indexOf("claim_ask_box('" + kind + "')")
	const iWait = seg.indexOf('if (dg.waiting_for)')
	ok(fn + ' 登记在 waiting_for 分支之前', iReg >= 0 && iWait >= 0 && iReg < iWait,
		JSON.stringify({ iReg, iWait }))
}

console.log('\n=== E. 版本串 ===')
{
	const vers = (HTML.match(/\?v=(\d{8}[a-z])/g) || []).map(s => s.slice(3))
	const uniq = Array.from(new Set(vers))
	/*
	 * 只校验「统一且格式合法」，不写死具体版本 —— 之前 B54/B64/B67 都因为写死版本、
	 * 后续 bump 时被打红，属于测试脆弱而非产品问题。
	 */
	ok('★★ 版本串统一且格式合法（B67 当轮 20261127b，后续会继续 bump）',
		uniq.length === 1 && /^\d{8}[a-z]$/.test(uniq[0] || ''), JSON.stringify(uniq))
}

console.log('\n=== F. 其余 delegate box 不得回退成「只有 return」 ===')
{
	for (const [fn] of BOXES) {
		const seg = segOf(fn)
		ok(fn + ' 不是单行 if (!dg) return', !/if \(!dg\) return\b/.test(seg))
	}
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
