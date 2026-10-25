/*
 * 【2026-10-25 批次 C】牌名保密的回归脚本。
 *
 * 覆盖三类断言：
 *   ① 静态兜底：rules.js 里凡属"牌尚未翻开"的日志语句，不得出现卡名插值；
 *   ② view 隔离：response_stack / response_pending / 拦截记录按阵营裁剪，
 *               且【已翻开】的帧不被误伤（防"过严"）；
 *   ③ 运行时：真实走 action 路径表态（放弃发动），产生的日志不得含卡名。
 *
 * 用法：node tools/_smoke_facedown_privacy.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}

/* ============================================================
 * ① 静态兜底
 * ============================================================ */
console.log('\n[静态] 未翻开卡牌的日志不得插值卡名')
const LINES = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split(/\r?\n/)
/*
 * 保密关键词 = 当前这批 ("尚未翻开"的语境) 文案里出现过的词。
 * 新增同类日志时必须也走 FACEDOWN_DESC / 通用措辞，否则会被这里拦下。
 */
const KEY = /(暗置|背面向上|不发动|放弃发动响应|可打出|响应结算中|留于桌面)/
const leaks = []
for (let i = 0; i < LINES.length; i++) {
	if (!/game\.log\.push/.test(LINES[i])) continue
	let buf = LINES[i], j = i
	while (j < LINES.length - 1 && !/\)\s*;?\s*$/.test(LINES[j]) && j - i < 5) {
		j++; buf += ' ' + LINES[j].trim()
	}
	buf = buf.replace(/\s+/g, ' ')
	if (KEY.test(buf) && /《'\s*\+/.test(buf)) leaks.push((i + 1) + ': ' + buf.slice(0, 120))
}
ok('rules.js 无明文卡名插值（未翻开语境）', leaks.length === 0,
	leaks.length ? '\n      ' + leaks.join('\n      ') : '')

/* ============================================================
 * ② view 数据面隔离
 * ============================================================ */
console.log('\n[view] 待发动响应雅面对对手保密')
function freshGame(frame) {
	const g = rules.setup(1)
	g.opening = null   /* 跳过开局弃牌阶段 */
	g.response_stack = [Object.assign({
		card_id: '15337#1', card_face: '15337', name: '生命的飞跃',
		owner_side: 'allies', on: 'piece_removed', pre: false,
		kind: 'space', candidates: [], prompt: '', extra: null,
		ctx: {}, group_id: 'rg_p1', group_idx: 0, ordered: true,
	}, frame || {})]
	g.response_queue = g.response_stack.slice()
	return g
}

{
	const g = freshGame()
	const vAxis = rules.view(g, 'Axis')
	const vAlly = rules.view(g, 'Allies')

	ok('对手 response_stack 看不到卡名',
		vAxis.response_stack.length === 1 && vAxis.response_stack[0].name === null)
	ok('对手 response_stack 看不到 card_id（防反查）',
		vAxis.response_stack[0].card_id === null)
	ok('对手 response_pending.mine = false',
		vAxis.response_pending && vAxis.response_pending.mine === false)
	ok('对手 response_pending 看不到卡名',
		vAxis.response_pending && vAxis.response_pending.name === null)
	ok('持有方 response_stack 仍看得到卡名（不误伤）',
		vAlly.response_stack[0].name === '生命的飞跃')
	ok('持有方 response_pending 仍看得到卡名（不误伤）',
		vAlly.response_pending && vAlly.response_pending.name === '生命的飞跃')
	ok('owner_side 双方都下发（客户端据此让位）',
		vAxis.response_stack[0].owner_side === 'allies')
}

console.log('\n[view] 已发动（翻开）的响应卡不误伤')
{
	const g = freshGame({
		candidates: [{ card_id: '15337#1', card_face: '15337', name: '生命的飞跃' }],
	})
	const vAxis = rules.view(g, 'Axis')
	ok('candidates 非空 = 已翻开 -> 对手可见卡名',
		vAxis.response_stack[0].name === '生命的飞跃')
}

console.log('\n[view] 拦截记录隐藏拦截方身份')
{
	const g = rules.setup(1)
	g.opening = null
	g.last_intercept = {
		turn: 1, by_nation: '苏联', victim_nation: '德国',
		target_card: 'x#1', target_face: '15247', target_name: '高速公路',
		interceptor_card: '15337#1', interceptor_face: '15337', freq: null,
	}
	g.intercept_log = [g.last_intercept]
	const vAxis = rules.view(g, 'Axis')      /* 德国 = 被拦截方 */
	const vAlly = rules.view(g, 'Allies')    /* 苏联 = 拦截方 */
	ok('非拦截方看不到 interceptor_face',
		vAxis.last_intercept && vAxis.last_intercept.interceptor_face === null)
	ok('非拦截方仍看得到被拦截的明牌',
		vAxis.last_intercept && vAxis.last_intercept.target_name === '高速公路')
	ok('拦截方自己看得到完整记录',
		vAlly.last_intercept && vAlly.last_intercept.interceptor_face === '15337')
	ok('intercept_log 同样裁剪',
		vAxis.intercept_log.length === 1 && vAxis.intercept_log[0].interceptor_face === null)
}

/* ============================================================
 * ③ 运行时：真实 action 路径产生的日志不得含卡名
 * ============================================================ */
console.log('\n[运行时] 放弃发动响应的日志不含卡名')
{
	const g = freshGame()
	const before = g.log.length
	rules.action(g, 'Allies', 'pass_response', {})
	const added = g.log.slice(before).join(' | ')
	console.log('    日志 = ' + added)
	ok('产生了放弃发动的日志', added.length > 0)
	ok('该日志不含书名号卡名', !/《[^》]+》/.test(added), added)
	ok('该日志保留张数信息', /张响应牌/.test(added), added)
}

console.log('\n[运行时] 响应表态等待期间的封锁提示不含卡名')
{
	/*
	 * 构造：队列里已有帧 + 该同盟方试着做常规动作 -> 走 25855 的"响应结算中"守卫。
	 */
	const g = freshGame()
	const before = g.log.length
	rules.action(g, 'Allies', 'play_card', { card: '15337#1' })
	const added = g.log.slice(before).join(' | ')
	console.log('    日志 = ' + added)
	ok('封锁提示列出了张数', /张暗置响应牌/.test(added), added)
	ok('封锁提示不含卡名', !/《[^》]+》/.test(added), added)
}

console.log('\n[常量] FACEDOWN_DESC 文案本身不含卡名')
{
	const d = I.FACEDOWN_DESC
	ok('FACEDOWN_DESC 存在', !!d)
	if (d) {
		const bad = Object.keys(d).filter(k => /《/.test(d[k]))
		ok('四种文案均无书名号', bad.length === 0, bad.join(','))
	}
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
