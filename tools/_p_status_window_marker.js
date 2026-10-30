/*
 * 修复：反制方把"正在拦状态卡的拦截卡"打掉之后，那张状态卡的发动要恢复。
 * 做法：给两类拦截窗口的 ctx 打上 window 标记，void 时按被拦对象分流：
 *   · orig.window === 'enemy_status_effect' -> 续跑 activate_status（一次性令牌免重扣代价）
 *   · orig.window === 'enemy_echo_played'   -> 有 outer 则 resume_suspended_use，否则 release_echo_entry
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let raw = fs.readFileSync(p, 'utf8')
const crlf = raw.indexOf('\r\n') >= 0
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw
let n = 0
const rep = (from, to, label) => {
	if (s.indexOf(from) < 0) { console.log('MISS: ' + label); return }
	s = s.split(from).join(to); n++
	console.log('ok: ' + label)
}

/* ① 状态卡窗口带 window 标记 */
rep("offer_armed_effects(game, 'enemy_status_effect', { nation: owner, card: cardId, arg: arg || {} })",
	"offer_armed_effects(game, 'enemy_status_effect', { nation: owner, card: cardId, arg: arg || {}, window: 'enemy_status_effect' })",
	'① 状态卡窗口标记')

/* ② 增强卡窗口（play 来源）带 window 标记 */
rep("offer_armed_effects(game, 'enemy_echo_played', {\n\t\t\t\t\tnation: nation, card: card_id, space: null,\n\t\t\t\t})",
	"offer_armed_effects(game, 'enemy_echo_played', {\n\t\t\t\t\tnation: nation, card: card_id, space: null, window: 'enemy_echo_played',\n\t\t\t\t})",
	'② 增强卡窗口标记(play)')

/* ③ 触发来源的窗口也带 window 标记 */
rep("offer_armed_effects(game, 'enemy_echo_played', {\n\t\t\tnation: owner, card: cardId, space: null,\n\t\t\tvia: via, srcWhen: off.when, triggerCtx: off.ctx || null,\n\t\t})",
	"offer_armed_effects(game, 'enemy_echo_played', {\n\t\t\tnation: owner, card: cardId, space: null,\n\t\t\tvia: via, srcWhen: off.when, triggerCtx: off.ctx || null,\n\t\t\twindow: 'enemy_echo_played',\n\t\t})",
	'③ 触发窗口标记')

/* ④ void：按 orig.window 分流恢复 */
rep(`	/*
	 * ③ 被它压住的"上一级生效请求"：拦截者已失效 -> 照常结算。
	 *   · 上一级是【触发】（via='trigger'，如 15208）-> 必须走 use_armed_offer 恢复；
	 *     走 play_card 会被"机会卡不能主动打出"拒绝（真实测试实测踩到）。
	 *   · 上一级是【打出】（via='play'）-> 走原 release_echo_entry（play_card 重放）。
	 */
	const outer = pu.outer || null
	/* 本级已作废 -> 先清空挂起；outer 由下面按需恢复（恢复后它就不再是"挂起中"） */
	game.pending_armed_use = null
	if (outer && outer.via === 'trigger') {
		const onm2 = (inst_card(String(inst_card_id(outer.card))) || {}).name || outer.card
		game.log.push('【' + (outer.owner || '') + '】《' + onm2 +
			'》的拦截者被反制，继续结算本次触发')
		resume_suspended_use(game, outer)
		return true
	}
	const orig = pu.orig && pu.orig.card
	if (orig && (game.hands[pu.orig.nation] || []).indexOf(orig) >= 0) {
		const onm = (inst_card(String(inst_card_id(orig))) || {}).name || orig
		game.log.push('【' + (pu.orig.nation || '') + '】《' + onm + '》的拦截者被反制，照常结算')
		echo_queue_drop(game, orig)
		release_echo_entry(game, { card: orig, nation: pu.orig.nation })
	}`,
	`	/*
	 * ③ 被它压住/它想拦的那件事：拦截者已失效 -> 照常结算。
	 *   按被拦对象的窗口类型分流（pu.orig 是它应答的那个窗口的 ctx）：
	 *   · enemy_status_effect -> 续跑那次 activate_status（一次性令牌免重扣代价）
	 *   · enemy_echo_played + outer 是触发 -> resume_suspended_use
	 *   · enemy_echo_played + 无 outer（是 play_card 的打出）-> release_echo_entry 重放
	 */
	const outer = pu.outer || null
	/* 本级已作废 -> 先清空挂起；outer 由下面按需恢复（恢复后它就不再是"挂起中"） */
	game.pending_armed_use = null
	const origCtx = pu.orig || {}
	if (origCtx.window === 'enemy_status_effect' && origCtx.card) {
		const snm = (inst_card(String(inst_card_id(origCtx.card))) || {}).name || origCtx.card
		game.log.push('【' + (origCtx.nation || '') + '】《' + snm +
			'》的拦截者被反制，继续结算这次发动')
		game.__status_cost_resume = origCtx.card     /* 代价此前已付，续跑不重扣 */
		try {
			exports.action(game, faction_role_of_nation(origCtx.nation), 'activate_status',
				Object.assign({ card: origCtx.card }, origCtx.arg || {}))
		} catch (e) {
			game.log.push('续跑《' + snm + '》出错：' + e.message)
		} finally {
			delete game.__status_cost_resume
		}
		return true
	}
	if (outer && outer.via === 'trigger') {
		const onm2 = (inst_card(String(inst_card_id(outer.card))) || {}).name || outer.card
		game.log.push('【' + (outer.owner || '') + '】《' + onm2 +
			'》的拦截者被反制，继续结算本次触发')
		resume_suspended_use(game, outer)
		return true
	}
	const orig = pu.orig && pu.orig.card
	if (orig && (game.hands[pu.orig.nation] || []).indexOf(orig) >= 0) {
		const onm = (inst_card(String(inst_card_id(orig))) || {}).name || orig
		game.log.push('【' + (pu.orig.nation || '') + '】《' + onm + '》的拦截者被反制，照常结算')
		echo_queue_drop(game, orig)
		release_echo_entry(game, { card: orig, nation: pu.orig.nation })
	}`,
	'④ void 按被拦对象分流')

fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('完成 ' + n + ' 处')
