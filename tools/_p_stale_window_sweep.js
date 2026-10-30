/*
 * 收尾清理：拦截链结束（depth=0、无 pending_armed_use）时，
 * 若还挂着 enemy_echo_played 窗口，而被拦的那张牌已经不在手牌（早已进弃牌堆/已被作废），
 * 该窗口就是"过期窗口" -> 摘掉，避免客户端一直显示待表态。
 *
 * 触发上限（CHAIN_CAP）时常出现这种边角：多层反制回滚后最后一级的目标已被消耗。
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let raw = fs.readFileSync(p, 'utf8')
const crlf = raw.indexOf('\r\n') >= 0
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw

const anchor = 'function clear_armed_offer(game) {'
const i = s.indexOf(anchor)
if (i < 0) { console.log('MISS anchor'); process.exit(1) }

const helper = `/*
 * 【2026-10-31】过期拦截窗口清理。
 *
 * 场景：多层反制 + CHAIN_CAP 到顶时，最后一级想拦的那张牌可能已被上层作废/消耗，
 * 但窗口仍挂在 armed_offers 上 —— 客户端会一直显示"可打出增强卡"，玩家点了却报
 * "手中没有这张牌"。这里在链结束（depth=0 且无 pending_armed_use）时兜底摘掉。
 */
function sweep_stale_intercept_window(game) {
	if (!game) return
	if ((game.__echo_chain_depth || 0) > 0) return
	if (game.pending_armed_use) return
	const wins = (game.armed_offers || []).filter(w => w.when === 'enemy_echo_played')
	if (!wins.length) return
	let removed = 0
	for (const w of wins) {
		const cid = w.ctx && w.ctx.card
		if (!cid) continue
		const ownerNation = (w.ctx && w.ctx.nation) || ''
		const inHand = (game.hands[ownerNation] || []).indexOf(cid) >= 0
		const inDisc = (game.discard[ownerNation] || []).indexOf(cid) >= 0
		if (!inHand && inDisc) {
			const wi = game.armed_offers.indexOf(w)
			if (wi >= 0) game.armed_offers.splice(wi, 1)
			removed++
		}
	}
	if (removed) {
		sync_armed_offer(game)
		sync_armed_handoff(game)
		game.log.push('清理过期拦截窗口 x' + removed + '（被拦的牌已不在手牌）')
	}
}

`
s = s.slice(0, i) + helper + s.slice(i)

/* 在 void / resume 末尾调用 */
const rep = (a, b, label) => {
	if (s.indexOf(a) < 0) { console.log('MISS: ' + label); return }
	s = s.split(a).join(b)
	console.log('ok: ' + label)
}

rep(`	if (origCtx.window === 'enemy_status_effect' && origCtx.card) {`,
	`	sweep_stale_intercept_window(game)
	if (origCtx.window === 'enemy_status_effect' && origCtx.card) {`,
	'① void 前置清理')

rep(`	if (orig && (game.hands[pu.orig.nation] || []).indexOf(orig) >= 0) {`,
	`	if (!orig) sweep_stale_intercept_window(game)
	if (orig && (game.hands[pu.orig.nation] || []).indexOf(orig) >= 0) {`,
	'② void 无 orig 时清理')

fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('完成')
