/*
 * B12 连带更新三条旧冒烟（它们把"借用=免代价"写进了断言）：
 *   ① _smoke_114_status_cost_precheck：cost.discard 条件文本改了
 *   ② _smoke_skip_play_unified：cost.skip_play 条件文本改了
 *   ③ _smoke_italy_response：借用 15242 现在由【借款方意大利】付代价
 */
const fs = require('fs')
const path = require('path')
const T = path.join(__dirname)
const rd = f => fs.readFileSync(path.join(T, f), 'utf8')
const wr = (f, s) => fs.writeFileSync(path.join(T, f), s, 'utf8')
const say = (ok, m) => console.log((ok ? '✓ ' : '✗ ') + m)

/* ① 114 */
{
	const f = '_smoke_114_status_cost_precheck.js'
	let s = rd(f), before = s
	s = s.replace("\"if (cost.discard && !borrowed\"", "\"if (cost.discard && !_costPaidNow\"")
	s = s.replace("'if (cost.discard && !borrowed'", "'if (cost.discard && !_costPaidNow'")
	wr(f, s)
	say(s !== before, '114：cost.discard 文本断言已更新')
}

/* ② skip_play */
{
	const f = '_smoke_skip_play_unified.js'
	let s = rd(f), before = s
	s = s.replace('cost\\.skip_play && !borrowed', 'cost\\.skip_play && !_costPaidNow')
	wr(f, s)
	say(s !== before, 'skip_play：条件文本断言已更新')
}

/* ③ italy_response 借用段：改成"借款方意大利付代价" */
{
	const f = '_smoke_italy_response.js'
	let s = rd(f), before = s
	const oldSeg = [
		"  /*",
		"  * 【2026-10-28 基线清理】15242 现在有 requires { type:'BASIC', name:'发起陆战' }：",
		"  * 借用时\"免代价\"只是跳过 cost（弃手牌 / skip_play），requires 仍要满足。",
		"  * 德国手牌补一张【发起陆战】(15201) 才能激活。",
		"  */",
		"  g.hands['德国'] = g.hands['德国'] || []",
		"  g.hands['德国'].push('15201#1')",
		"  const deHandBefore = (g.hands['德国'] || []).length",
		"  rules.action(g, 'Axis', 'activate_status', { card: gst })",
		"  ok('借用激活免代价：德国未弃手牌', (g.hands['德国'] || []).length === deHandBefore)",
		"  ok('借用激活免代价：未置 skip_play', !g.skip_play_done || !g.skip_play_done['德国'])",
		"  ok('借用激活执行效果：苏联陆军被消除', g.location[sovId] == null)",
	].join('\n')
	const newSeg = [
		"  /*",
		"  * 【2026-11-05 · B12 玩家口径】借用不再免费 —— 代价由【借款方意大利】支付：",
		"  *   15242 需要 弃 1 张[发起陆战] 且 跳过出牌阶段，两项都落在意大利身上（德国不受影响）。",
		"  * requires 仍按原卡：需要有[发起陆战]这张牌可弃（从意大利手牌里给）。",
		"  */",
		"  g.hands['德国'] = g.hands['德国'] || []",
		"  g.hands['德国'].push('15201#1')            /* requires 用：德国手牌里有一张[发起陆战] */",
		"  g.hands['意大利'] = g.hands['意大利'] || []",
		"  g.hands['意大利'].push('17701#1')          /* 意大利自己的[发起陆战]，作为代价被弃 */",
		"  const deHandBefore = (g.hands['德国'] || []).length",
		"  const itHandBefore = (g.hands['意大利'] || []).length",
		"  rules.action(g, 'Axis', 'activate_status', { card: gst, discard: ['17701#1'] })",
		"  ok('借用激活：德国手牌不受影响', (g.hands['德国'] || []).length === deHandBefore)",
		"  ok('借用激活：★意大利付了弃牌代价（-1）', (g.hands['意大利'] || []).length === itHandBefore - 1,",
		"    (g.hands['意大利'] || []).length + ' vs ' + itHandBefore)",
		"  ok('借用激活：★跳过出牌阶段落在意大利', !!(g.skip_play_done && g.skip_play_done['意大利']),",
		"    JSON.stringify(g.skip_play_done))",
		"  ok('借用激活：德国未被跳过出牌阶段', !(g.skip_play_done && g.skip_play_done['德国']))",
		"  ok('借用激活执行效果：苏联陆军被消除', g.location[sovId] == null)",
	].join('\n')
	s = s.replace(oldSeg, newSeg)
	wr(f, s)
	say(s !== before, 'italy_response：借用段改为"意大利付代价"')
}

console.log('完成')
