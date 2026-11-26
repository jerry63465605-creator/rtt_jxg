/*
 * 【重构补修 / B56】do_action 内部嵌套函数必须提升到模块顶层。
 *
 * 玩家报障（2026-11-27）：「苏联进战弃大清洗打新牌时卡死：
 *   ReferenceError: discard_table_card is not defined」
 *
 * 根因（拆分 do_action 引入）：
 *   `discard_table_card` 原本是 do_action 内部的【嵌套函数】，只在 do_action 作用域可见。
 *   拆分时三个调用它的分支被搬成模块顶层函数
 *   （action_su_purge_play / action_su_purge_skip / action_su_17817_proceed），
 *   于是调用点再也够不到它 → 运行到这条 action 才抛 ReferenceError。
 *   实测（同一场景 su_purge_skip，旧版 7812004）：ReferenceError；修复后正常弃牌。
 *
 * 修法：把 discard_table_card 上移到模块顶层（纯函数，只依赖参数与
 *       inst_card_id / revert_status_ongoing）。校验器同步升级：
 *       `_verify_action_split.js` 现在会扫【嵌套函数】而不只是局部变量。
 *
 * 用法：node tools/_real_test_B56_nested_fn_hoisted.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const J = x => JSON.stringify(x)

const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const LINES = SRC.split(/\r?\n/)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 苏联「大清洗」在桌面 + 结束中立奖励挂着 */
function seed() {
	const g = R.setup(20261127, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.active = 'Allies'
	g.current_nation = '苏联'
	g.su_purge_offer = true
	g.table['苏联'] = ['17850#s1']
	return g
}

console.log('=== A. 真实路径：su_purge_skip 弃掉《大清洗》（修复前此处抛 ReferenceError）===')
{
	const g = seed()
	let threw = null
	try { R.action(g, 'Allies', 'su_purge_skip', {}) } catch (e) { threw = e }
	ok('★★ 不抛 ReferenceError', threw === null, threw ? threw.constructor.name + ': ' + threw.message : '')
	const tail = (g.log || []).slice(-2).join(' | ')
	ok('★★ 《大清洗》已从桌面弃掉', (g.table['苏联'] || []).indexOf('17850#s1') < 0, J(g.table['苏联']))
	ok('★★ 弃牌堆收到该卡', (g.discard['苏联'] || []).some(x => String(x).indexOf('17850') === 0),
		J((g.discard['苏联'] || []).slice(-3)))
	ok('★ 日志写明已弃置', /已弃置《大清洗》/.test(tail), tail)
	ok('★ su_purge_offer 已消费', !g.su_purge_offer)
}

console.log('\n=== B. 静态守卫：discard_table_card 在模块顶层（缩进 0）===')
{
	const idx = LINES.findIndex(l => /^function discard_table_card\s*\(/.test(l))
	ok('★★ 存在顶层定义（行首无缩进）', idx >= 0, idx >= 0 ? 'L' + (idx + 1) : '未找到')
	ok('★★ 不再有「缩进的嵌套版本」（避免两份定义打架）',
		!LINES.some(l => /^\t+function discard_table_card\s*\(/.test(l)))
	ok('★★ 定义处函数体完整（可被任意 action_* 调用）',
		idx >= 0 && /game\.discard\[nation\]\.push\(inst\)/.test(LINES.slice(idx, idx + 16).join('\n')))
}

console.log('\n=== C. 静态守卫：do_action 内不得再有嵌套 function 声明 ===')
{
	let s = -1
	for (let i = 0; i < LINES.length; i++) if (/^function do_action\s*\(/.test(LINES[i])) { s = i; break }
	ok('★ 找到 do_action', s >= 0)
	const nested = []
	if (s >= 0) {
		for (let i = s; i < LINES.length; i++) {
			if (/^\}/.test(LINES[i]) && i > s) break
			const m = LINES[i].match(/^\t+function\s+([A-Za-z_$][\w$]*)\s*\(/)
			if (m) nested.push(m[1] + '@L' + (i + 1))
		}
	}
	ok('★★ do_action 内无嵌套函数（有的话必须提升到顶层，否则搬出的调用点够不到）',
		nested.length === 0, J(nested))
}

console.log('\n=== D. 三个调用点都在模块顶层函数里 ===')
{
	for (const fn of ['action_su_purge_play', 'action_su_purge_skip', 'action_su_17817_proceed']) {
		const i = LINES.findIndex(l => new RegExp('^function ' + fn + '\\s*\\(').test(l))
		ok('★ ' + fn + ' 是模块顶层函数', i >= 0, i >= 0 ? 'L' + (i + 1) : '未找到')
	}
	ok('★★ 三个 action 内都引用了 discard_table_card',
		['action_su_purge_play', 'action_su_purge_skip', 'action_su_17817_proceed'].every(fn => {
			const i = LINES.findIndex(l => new RegExp('^function ' + fn + '\\s*\\(').test(l))
			if (i < 0) return false
			let end = i
			for (let k = i; k < LINES.length; k++) if (/^\}/.test(LINES[k]) && k > i) { end = k; break }
			return /discard_table_card\(/.test(LINES.slice(i, end).join('\n'))
		}))
}

console.log('\n=== E. 校验器已升级（能识别嵌套函数）===')
{
	const v = fs.readFileSync(path.join(__dirname, '_verify_action_split.js'), 'utf8')
	ok('★★ 校验器扫描 do_action 内的嵌套 function', /kind: '嵌套函数'/.test(v))
	ok('★★ 校验器从【基线】收集（否则重构后 do_action 里已看不到它）',
		/for \(let i = bRange\[0\]; i <= bRange\[1\]; i\+\+\)/.test(v))
	ok('★ 校验器识别「已提升到模块顶层」为合法', /topLevelFns/.test(v))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
