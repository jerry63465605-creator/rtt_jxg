/* 同上，改为先统一 LF 再替换，最后还原 CRLF */
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

rep(`	const _costPaidNow = (game.__status_cost_paid || {})[cardId] === freq_key(game)`,
	`	const _costPaidNow = game.__status_cost_resume === cardId
	if (_costPaidNow) delete game.__status_cost_resume   /* 一次性令牌：只免重扣这一次 */`,
	'① 守卫改一次性令牌')

rep(`	/* 【2026-10-31 S1】代价已付 -> 登记，续跑时不再重复扣 */
	if (!_costPaidNow) {
		game.__status_cost_paid = game.__status_cost_paid || {}
		game.__status_cost_paid[cardId] = freq_key(game)
	}

`, '', '② 删除按回合登记')

rep(`					try {
						exports.action(game, faction_role_of_nation(resumeStatus.nation), 'activate_status',
							Object.assign({ card: resumeStatus.card }, resumeStatus.arg))
					} catch (e) {
						game.log.push('续跑《' + onm + '》出错：' + e.message)
					}`,
	`					/* 置一次性令牌：这次续跑不再重复扣代价 */
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

fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('完成 ' + n + ' 处')
