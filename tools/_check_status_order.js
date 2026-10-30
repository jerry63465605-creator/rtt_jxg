const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const t = fs.readFileSync(p, 'utf8').split('\n')
const pats = [
	[/----------------\s*付代价/, '付代价块'],
	[/15353：本回合已跳过拦截/, '15353 窗口派发'],
	[/offer_armed_effects\(game, 'enemy_status_effect'/, 'enemy_status_effect 派发'],
	[/if \(cost\.discard && !borrowed\)/, 'discard 代价'],
	[/if \(cost\.attrition && !borrowed\)/, 'attrition 代价'],
	[/if \(cost\.lose_score\)/, 'lose_score 代价'],
	[/"跳过出牌阶段"放在这里/, 'skip_play 代价'],
	[/typeof tr\.precheck === 'function'/, '参数预检 precheck'],
	[/tr\.effect && tr\.effect\.kind === 'battle'/, 'battle from 预检'],
]
for (const [re, label] of pats) {
	const i = t.findIndex(l => re.test(l))
	console.log((i >= 0 ? String(i + 1) : 'MISS').padStart(6) + '  ' + label)
}
