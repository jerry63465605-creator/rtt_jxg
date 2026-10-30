/*
 * 批 3 配套修复（三处）：
 *   ① 付代价段加"本次已付"守卫 __status_cost_paid（放弃拦截后续跑时不会二次扣）
 *   ② 派发 enemy_status_effect 时把原始 arg 存进 ctx
 *   ③ skip_armed_offer 放弃拦截后【续跑】那次 activate_status（否则效果永远不执行）
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(p, 'utf8')
let n = 0
function rep(from, to, label) {
	if (s.indexOf(from) < 0) { console.log('MISS: ' + label); return }
	const c = s.split(from).length - 1
	s = s.split(from).join(to)
	n += c
	console.log('ok x' + c + ': ' + label)
}

/* ①a 声明 payCost 标志（紧跟付代价块头注释之后） */
rep(`	 * 例外：cost.skip_play（跳过出牌阶段）仍留在窗口之后 —— 被拦时不照付，待玩家裁定。
	 */`,
	`	 * 例外：cost.skip_play（跳过出牌阶段）仍留在窗口之后 —— 被拦时不照付，待玩家裁定。
	 *
	 * 【2026-10-31】_costPaidNow：放弃拦截后我们会【续跑】activate_status（见 skip_armed_offer），
	 * 续跑时不能二次扣代价 —— 代价照付，但只付一次。
	 */
	const _costPaidNow = (game.__status_cost_paid || {})[cardId] === freq_key(game)`,
	'①a payCost 声明')

/* ①b 各代价分支加条件 */
rep('if (cost.discard && !borrowed) {', 'if (cost.discard && !borrowed && !_costPaidNow) {', '①b discard')
rep('if (cost.forgo_build_army) {', 'if (cost.forgo_build_army && !_costPaidNow) {', '①b forgo_build_army')
rep('if (cost.lose_score) {', 'if (cost.lose_score && !_costPaidNow) {', '①b lose_score')
rep('if (cost.attrition && !borrowed) {', 'if (cost.attrition && !borrowed && !_costPaidNow) {', '①b attrition')

/* ①c 代价付完登记（放在 15353 窗口派发之前） */
rep(`	/* 15353：本回合已跳过拦截 -> 不再弹窗，敌方照常执行；否则派发拦截窗口让英国响应 */`,
	`	/* 【2026-10-31 S1】代价已付 -> 登记，续跑时不再重复扣 */
	if (!_costPaidNow) {
		game.__status_cost_paid = game.__status_cost_paid || {}
		game.__status_cost_paid[cardId] = freq_key(game)
	}

	/* 15353：本回合已跳过拦截 -> 不再弹窗，敌方照常执行；否则派发拦截窗口让英国响应 */`,
	'①c 登记已付')

/* ② 派发时带上原始 arg */
rep("offer_armed_effects(game, 'enemy_status_effect', { nation: owner, card: cardId })",
	"offer_armed_effects(game, 'enemy_status_effect', { nation: owner, card: cardId, arg: arg || {} })",
	'② ctx 带 arg')

/* ③a skip 里记下要续跑的状态卡 */
rep(`				if (win.when === 'enemy_status_effect' && win.ctx && win.ctx.card) {
					game.status_intercept_skipped = game.status_intercept_skipped || {}
					game.status_intercept_skipped[win.ctx.card] = freq_key(game)
				}`,
	`				if (win.when === 'enemy_status_effect' && win.ctx && win.ctx.card) {
					game.status_intercept_skipped = game.status_intercept_skipped || {}
					game.status_intercept_skipped[win.ctx.card] = freq_key(game)
					/*
					 * 【2026-10-31 S1】放弃拦截 -> 续跑那次发动：
					 * 旧实现只记放行标记 + 关窗，状态卡效果【永远不执行】；
					 * S1 之后代价已付，不续跑就成了"付了代价没效果"。
					 * 原 arg（space/from/discard…）由派发时存进 ctx.arg 带回来，
					 * 放行标记保证续跑时不再弹窗、不再重复扣代价。
					 */
					resumeStatus = {
						card: win.ctx.card,
						nation: win.ctx.nation,
						arg: win.ctx.arg || {},
					}
				}`,
	'③a 记录续跑')

/* ③b 声明 resumeStatus */
rep(`				if (resumeEcho && ECHO_COST_FIRST.has(String(inst_card_id(resumeEcho.card)))) {`,
	`				let resumeStatus = null
				if (resumeEcho && ECHO_COST_FIRST.has(String(inst_card_id(resumeEcho.card)))) {`,
	'③b 声明变量')

/* ③c removeArmedWindow 之后执行续跑 */
rep(`				/* 【2026-10-29 二级拦截】反制方放弃 -> 放回原窗口，续跑那次 use */
				if (_isCounterOfUse) resume_pending_armed_use(game)`,
	`				/* 【2026-10-31 S1】放弃拦截敌方状态卡 -> 续跑那次 activate_status */
				if (resumeStatus) {
					const onm = (inst_card(String(inst_card_id(resumeStatus.card))) || {}).name ||
						resumeStatus.card
					game.log.push('《' + onm + '》未被拦截（代价已付），效果照常执行')
					try {
						exports.action(game, faction_role_of_nation(resumeStatus.nation), 'activate_status',
							Object.assign({ card: resumeStatus.card }, resumeStatus.arg))
					} catch (e) {
						game.log.push('续跑《' + onm + '》出错：' + e.message)
					}
				}
				/* 【2026-10-29 二级拦截】反制方放弃 -> 放回原窗口，续跑那次 use */
				if (_isCounterOfUse) resume_pending_armed_use(game)`,
	'③c 执行续跑')

fs.writeFileSync(p, s, 'utf8')
console.log('完成，改动 ' + n + ' 处')
