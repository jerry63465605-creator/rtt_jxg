/*
 * 回归：play.js 顶部的 send_action 兼容 shim（2026-10-24）
 *
 * 背景（线上实测已确认）：
 *   某些"定制部署"把 /common/client.js 的 send_action 改成了
 *       if (view.actions[verb].includes(realnoun)) { 发送 }
 *   而官方约定是 view.actions[verb] === 1 / true / 字符串 表示"可提交"。
 *   于是对值为 1 的动作（本模块绝大多数）执行 (1).includes(...)
 *   -> TypeError: ...includes is not a function -> 请求根本发不出去
 *   -> 玩家看到"点了没反应、永远卡在当前阶段"。
 *
 * 本 shim 先走平台实现，抛异常时按官方语义自行发送；官方平台上 try 成功、零副作用。
 *
 * 测试方式：按 BEGIN/END 标记从 play.js 抽出 shim 段，在 vm 里分别装到
 *   (a) 官方 send_action
 *   (b) 定制 bug 版 send_action
 * 两套环境上跑同一批用例。
 *
 * 用法：node tools/_smoke_send_action_shim.js
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

/* ---------- 1. 从 play.js 抽出 shim ---------- */
const src = fs.readFileSync(path.join(__dirname, '..', 'play.js'), 'utf8')
const BEGIN = '===== BEGIN send_action shim ====='
const END = '===== END send_action shim ====='
const bIdx = src.indexOf(BEGIN)
const eIdx = src.indexOf(END)
if (bIdx < 0 || eIdx < 0) {
	console.log('FAIL  play.js 里找不到 shim 标记')
	process.exit(1)
}
const startAt = src.lastIndexOf('/*', bIdx)
const endAt = src.indexOf('\n})()', eIdx) + 5
const shim = src.slice(startAt, endAt)
console.log('抽出 shim =', shim.length, '字符')

/* ---------- 2. 两种平台实现 ---------- */
function officialPlatform(sb) {
	return function (verb, noun) {
		const va = sb.view.actions && sb.view.actions[verb]
		if (va === 1 || va === true || typeof va === 'string') {
			if (noun === undefined || noun === null || typeof noun === 'object') {
				sb.view.actions = null
				sb.send_message('action', [verb, noun === undefined ? null : noun, sb.game_cookie])
				return true
			}
			return false
		}
		if (Array.isArray(va)) {
			const real = Array.isArray(noun) ? noun[0] : noun
			if (va.indexOf(real) < 0) return false
			sb.view.actions = null
			sb.send_message('action', [verb, noun, sb.game_cookie])
			return true
		}
		return false
	}
}

/* 线上测试服那版：无条件 .includes */
function buggyPlatform(sb) {
	return function (verb, noun) {
		if (noun !== undefined) {
			const realnoun = Array.isArray(noun) ? noun[0] : noun
			if (sb.view.actions && sb.view.actions[verb] && sb.view.actions[verb].includes(realnoun)) {
				sb.view.actions = null
				sb.send_message('action', [verb, noun, sb.game_cookie])
				return true
			}
		} else {
			if (sb.view.actions && sb.view.actions[verb]) {
				sb.view.actions = null
				sb.send_message('action', [verb, null, sb.game_cookie])
				return true
			}
		}
		return false
	}
}

function mkEnv(platform, actions) {
	const sent = []
	const sandbox = {
		view: { actions: Object.assign({}, actions) },
		send_message: function () { sent.push(Array.prototype.slice.call(arguments)) },
		game_cookie: 42,
		toast: function (m) { sent.push(['toast', m]) },
		Array, Object, JSON, String, Number, console,
	}
	sandbox.window = sandbox
	sandbox.send_action = platform(sandbox)
	vm.createContext(sandbox)
	vm.runInContext(shim, sandbox)
	return { sb: sandbox, sent }
}

const realSends = sent => sent.filter(x => x[0] === 'action')
const card3 = [{ id: '15401#1' }, { id: '15401#2' }, { id: '15401#3' }]

console.log('\n=== A. 官方 client.js（shim 必须零副作用，不重复发送） ===')
{
	const { sb, sent } = mkEnv(officialPlatform, { log: 1, opening_discard: 1 })
	const r = sb.send_action('opening_discard', { cards: card3 })
	ok('A1 返回 true', r === true, String(r))
	ok('A2 只发送 1 次', realSends(sent).length === 1, realSends(sent).length)
	ok('A3 action 名与参数正确',
		realSends(sent)[0][1][0] === 'opening_discard' &&
		realSends(sent)[0][1][1].cards.length === 3,
		JSON.stringify(realSends(sent)[0][1]).slice(0, 80))
	ok('A4 带 cookie', realSends(sent)[0][1][2] === 42, realSends(sent)[0][1][2])
	ok('A5 发送后 view.actions 被清空（防连点）', sb.view.actions === null)
}

console.log('\n=== B. 定制 bug 版（线上现场：值为 1 + 带参数 -> TypeError） ===')
{
	const { sb, sent } = mkEnv(buggyPlatform, { log: 1, opening_discard: 1, propose_rollback: 1 })
	/* 先证明原平台确实会抛（直接调未打 shim 的版本） */
	let threw = false
	try {
		const raw = buggyPlatform({ view: { actions: { opening_discard: 1 } }, send_message: function () {} })
		raw('opening_discard', { cards: card3 })
	} catch (e) {
		threw = /includes is not a function/.test(String(e && e.message))
	}
	ok('B0 原生 buggyPlatform 确实抛 includes is not a function', threw)

	const r = sb.send_action('opening_discard', { cards: card3 })
	ok('B1 shim 回退后返回 true', r === true, String(r))
	ok('B2 仍然只发送 1 次', realSends(sent).length === 1, realSends(sent).length)
	ok('B3 参数完整送出',
		realSends(sent)[0][1][0] === 'opening_discard' &&
		realSends(sent)[0][1][1].cards.length === 3,
		JSON.stringify(realSends(sent)[0][1]).slice(0, 80))
	ok('B4 发送后 view.actions 被清空', sb.view.actions === null)
	ok('B5 没有误报 toast', !sent.some(x => x[0] === 'toast'), JSON.stringify(sent.filter(x => x[0] === 'toast')))
}

console.log('\n=== C. 无参数动作（buggy 版本本来不抛，shim 应透传） ===')
{
	const { sb, sent } = mkEnv(buggyPlatform, { log: 1, next_phase: 1 })
	const r = sb.send_action('next_phase')
	ok('C1 返回 true', r === true, String(r))
	ok('C2 发送 1 次', realSends(sent).length === 1, realSends(sent).length)
	ok('C3 第二参数为 null', realSends(sent)[0][1][1] === null, realSends(sent)[0][1][1])
}

console.log('\n=== D. 数组型 actions（"thing action"，候选校验） ===')
{
	const { sb, sent } = mkEnv(buggyPlatform, { resolve_autobahn: [9, 45] })
	ok('D1 命中候选 -> 发送', sb.send_action('resolve_autobahn', 9) === true && realSends(sent).length === 1)

	const e2 = mkEnv(buggyPlatform, { resolve_autobahn: [9, 45] })
	ok('D2 不在候选 -> 不发送', e2.sb.send_action('resolve_autobahn', 99) === false && realSends(e2.sent).length === 0)

	const e3 = mkEnv(officialPlatform, { resolve_autobahn: [9, 45] })
	ok('D3 官方平台上同样命中', e3.sb.send_action('resolve_autobahn', 9) === true && realSends(e3.sent).length === 1)
}

console.log('\n=== E. 未授权 / 已发送过一次 ===')
{
	const { sb, sent } = mkEnv(buggyPlatform, { log: 1 })
	ok('E1 没有该动作 -> false 且不发', sb.send_action('play_card', { card: 'x' }) === false && realSends(sent).length === 0)

	const e2 = mkEnv(buggyPlatform, { opening_discard: 1 })
	e2.sb.send_action('opening_discard', { cards: card3 })
	const r2 = e2.sb.send_action('opening_discard', { cards: card3 })
	ok('E2 连点第二次 -> false 且不再发', r2 === false && realSends(e2.sent).length === 1,
		realSends(e2.sent).length + ' / ' + String(r2))
}

console.log('\n=== F. 缺少 send_message 时不崩（防御） ===')
{
	const sent = []
	const sandbox = {
		view: { actions: { opening_discard: 1 } },
		game_cookie: 0,
		toast: function (m) { sent.push(['toast', m]) },
		Array, Object, JSON, String, Number, console,
	}
	sandbox.window = sandbox
	sandbox.send_action = buggyPlatform(sandbox)
	delete sandbox.send_message
	vm.createContext(sandbox)
	vm.runInContext(shim, sandbox)
	let threw = false
	let r
	try { r = sandbox.send_action('opening_discard', { cards: card3 }) } catch (e) { threw = true }
	ok('F1 不抛异常', !threw)
	ok('F2 返回 false', r === false, String(r))
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
