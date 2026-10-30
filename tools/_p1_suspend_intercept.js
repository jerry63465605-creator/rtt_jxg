/*
 * P1：把"只服务反制"的 suspend_armed_use_for_counter 扩成通用"生效前拦截挂起"
 *   · via='play'    来源 = 敌方主动打出/装载（原反制链）
 *   · via='trigger' 来源 = 敌方机会卡触发（本次扩展）
 *   · 层级上限 CHAIN_CAP=3（触发层 +1）
 *   · 同一张卡的同一 when 触发只问一次（__trigger_intercept_done）
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let raw = fs.readFileSync(p, 'utf8')
const crlf = raw.indexOf('\r\n') >= 0
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw

const start = s.indexOf('function suspend_armed_use_for_counter(')
if (start < 0) { console.log('MISS func'); process.exit(1) }
/* 找到函数结束（配平大括号） */
let depth = 0, end = -1
for (let i = s.indexOf('{', start); i < s.length; i++) {
	if (s[i] === '{') depth++
	else if (s[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
}
if (end < 0) { console.log('MISS end'); process.exit(1) }
const old = s.slice(start, end)

const neu = `function suspend_armed_use_for_intercept(game, off, cardId, owner, gathered, nm) {
	if (!off) return false
	if (game.__armed_use_resuming) return false
	/*
	 * 【2026-10-31 扩展】来源判定：
	 *   · off.when === 'enemy_echo_played' -> 这张卡本身就是"拦截卡"，现在被别人反制（via='play'）
	 *   · 其它 when（after_deploy_air / after_battle / piece_removed …）
	 *        -> 机会卡【触发】，敌方 15352/16700 同样可以拦（via='trigger'）
	 *
	 * 语义说明（玩家口径）：卡面写"敌方打出增强卡时"，"触发"在口语里也算"打出"，
	 * 代码里用 via 区分，日志分别写"打出/触发"，卡面文案不改。
	 */
	const via = (off.when === 'enemy_echo_played') ? 'play' : 'trigger'
	const CHAIN_CAP = 3
	if ((game.__echo_chain_depth || 0) >= CHAIN_CAP) {
		game.log.push('拦截链已达上限（' + CHAIN_CAP + ' 层），本次不再询问拦截')
		return false
	}
	/* 同一张卡的同一个触发，本回合只问一次（防抖；play 侧由 echo_intercept_skipped 管） */
	const key = cardId + '|' + off.when
	if (via === 'trigger') {
		game.__trigger_intercept_done = game.__trigger_intercept_done || {}
		if (game.__trigger_intercept_done[key] === freq_key(game)) return false
	}
	game.__echo_chain_depth = (game.__echo_chain_depth || 0) + 1
	/* 先把"待用的这张卡"从窗口摘下（它已被玩家选定），再派发拦截窗口 */
	const idx = (game.armed_offers || []).indexOf(off)
	if (idx >= 0) game.armed_offers.splice(idx, 1)
	sync_armed_offer(game)
	try {
		offer_armed_effects(game, 'enemy_echo_played', {
			nation: owner, card: cardId, space: null,
			via: via, srcWhen: off.when, triggerCtx: off.ctx || null,
		})
	} catch (e) { game.log.push('拦截派发错误：' + e.message) }
	const cw = (game.armed_offers || []).find(w => w.when === 'enemy_echo_played')
	if (!cw) {
		/* 没人能拦 -> 原窗口放回去，继续正常结算 */
		game.__echo_chain_depth = Math.max(0, (game.__echo_chain_depth || 1) - 1)
		if (idx >= 0) {
			game.armed_offers = game.armed_offers || []
			game.armed_offers.push(off)
			sync_armed_offer(game)
		}
		return false
	}
	game.pending_armed_use = {
		card: cardId, owner: owner, arg: gathered, window: off, via: via,
		orig: Object.assign({}, off.ctx || {}),
	}
	game.log.push('【' + owner + '】' + (via === 'play' ? '打出' : '触发') +
		'增强《' + nm + '》—— 等待【' + (cw.nation || '敌方') + '】的拦截应答')
	sync_armed_offer(game)
	sync_armed_handoff(game)
	return true
}

/* 兼容旧名（其它地方/测试可能引用） */
const suspend_armed_use_for_counter = suspend_armed_use_for_intercept`

s = s.slice(0, start) + neu + s.slice(end)
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('P1 完成：替换 ' + old.split('\n').length + ' 行 -> ' + neu.split('\n').length + ' 行')
