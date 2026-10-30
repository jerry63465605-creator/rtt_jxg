/*
 * 修 15348 回归：
 *   原守卫 __status_cost_paid[cardId] = freq_key(game) 是【按回合】记的，
 *   于是同一回合内第二次发动同一张状态卡时被误判"已付代价" -> 不再扣分/扣牌。
 *   正确语义：只有【放弃拦截后的那次续跑】才免重扣一次。
 *   改法：用一次性令牌 game.__status_cost_resume（值为 cardId），续跑前置、进入后立即清除。
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(p, 'utf8')
let n = 0
const rep = (from, to, label) => {
	if (s.indexOf(from) < 0) { console.log('MISS: ' + label); return }
	s = s.split(from).join(to); n++
	console.log('ok: ' + label)
}

/* ① 守卫改为一次性令牌 */
rep(`	const _costPaidNow = (game.__status_cost_paid || {})[cardId] === freq_key(game)`,
	`	const _costPaidNow = game.__status_cost_resume === cardId
	if (_costPaidNow) delete game.__status_cost_resume   /* 一次性令牌：只免重扣这一次 */`,
	'① 守卫改一次性令牌')

/* ② 删掉按回合登记"已付"的那段（已无用，且会误导） */
rep(`	/* 【2026-10-31 S1】代价已付 -> 登记，续跑时不再重复扣 */
	if (!_costPaidNow) {
		game.__status_cost_paid = game.__status_cost_paid || {}
		game.__status_cost_paid[cardId] = freq_key(game)
	}

`, '', '② 删除按回合登记')

/* ③ 续跑时置令牌 */
rep(`					game.log.push('《' + onm + '》未被拦截（代价已付），效果照常执行')
					try {
						exports.action(game, faction_role_of_nation(resumeStatus.nation), 'activate_status',
							Object.assign({ card: resumeStatus.card }, resumeStatus.arg))
					} catch (e) {
						game.log.push('续跑《' + onm + '》出错：' + e.message)
					}`,
	`					game.log.push('《' + onm + '》未被拦截（代价已付），效果照常执行')
					/* 置一次性令牌：这次续跑不再重复扣代价 */
					game.__status_cost_resume = resumeStatus.card
					try {
						exports.action(game, faction_role_of_nation(resumeStatus.nation), 'activate_status',
							Object.assign({ card: resumeStatus.card }, resumeStatus.arg))
					} catch (e) {
						game.log.push('续跑《' + onm + '》出错：' + e.message)
					} finally {
						delete game.__status_cost_resume
					}`,
	'③ 续跑置令牌')

fs.writeFileSync(p, s, 'utf8')
console.log('完成 ' + n + ' 处')
