/* B19 补丁：内部重放（echo/status/结算续跑）不能被"对方时点"门禁挡住 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let L = fs.readFileSync(P, 'utf8').split('\n')
const bare = i => L[i].replace(/\r$/, '')
const hit = (ok, m) => console.log((ok ? '✓ ' : '✗ ') + m)

/* ① 所有内部 exports.action(...) → internal_action(...) */
let n = 0
for (let i = 0; i < L.length; i++) {
	if (bare(i).indexOf('exports.action(game,') >= 0) {
		L[i] = bare(i).replace('exports.action(game,', 'internal_action(game,') + (L[i].endsWith('\r') ? '\r' : '')
		n++
	}
}
hit(n >= 8, '内部重放改走 internal_action（' + n + ' 处）')

/* ② 插入 helper：放在 do_action 之前（函数声明会提升，放哪都行，这里靠 battle_reconcile_active 附近） */
if (!L.some(l => /^function internal_action\(/.test(l))) {
	const anchor = L.findIndex(l => /^function do_action\(/.test(l))
	if (anchor >= 0) {
		const block = [
			'/*',
			' * 【2026-11-06 · B19】内部重放包装。',
			' *',
			' * "对方时点强挂起"只应拦【玩家发起的推进动作】；引擎自己的续跑',
			' * （echo 队列放行、状态卡拦截后重放、结算续跑…）必须放行，',
			' * 否则 15352/15353 的窗口一开，连"放行那张卡"的重放也会被拦 = 死锁。',
			' */',
			'function internal_action(game, role, action, arg) {',
			'\tgame.__internal_depth = (game.__internal_depth || 0) + 1',
			'\ttry {',
			'\t\treturn exports.action(game, role, action, arg)',
			'\t} finally {',
			'\t\tgame.__internal_depth = Math.max(0, (game.__internal_depth || 1) - 1)',
			'\t\tif (!game.__internal_depth) delete game.__internal_depth',
			'\t}',
			'}',
			'',
		].map(x => x + '\r')
		L.splice(anchor, 0, ...block)
		hit(true, '插入 internal_action @' + (anchor + 1))
	} else hit(false, '未找到 do_action')
} else hit(true, 'internal_action 已存在')

/* ③ 门禁放行内部重放 */
for (let i = 0; i < L.length; i++) {
	if (bare(i).indexOf("if (_oppMoment && action !== 'use_armed_offer'") >= 0) {
		L[i] = "\tif (_oppMoment && !game.__internal_depth && action !== 'use_armed_offer'" + (L[i].endsWith('\r') ? '\r' : '')
		hit(true, '门禁放行内部重放 @' + (i + 1))
		break
	}
}

fs.writeFileSync(P, L.join('\n'), 'utf8')
const back = fs.readFileSync(P, 'utf8')
console.log('回读：internal_action 定义=', /function internal_action\(/.test(back),
	' 调用=', (back.match(/internal_action\(game,/g) || []).length,
	' 门禁=', /_oppMoment && !game\.__internal_depth/.test(back))
