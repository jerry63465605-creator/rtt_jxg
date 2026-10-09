/* 临时验证：意大利国家技能（扣 2 分 + 额外打出 状态/经济战卡）
 * 用法：node tools/_smoke_italy_skill.js
 * 跑完即删。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

let g = rules.setup(1)
g.current_nation = '意大利'
g.active = 'Axis'
g.turn_phase = 'play'
g.score = g.score || {}
const AX = I.faction_of_nation('意大利')
g.score[AX] = 10

const cfg = I.NATIONAL_SKILL['意大利']
console.log('=== NATIONAL_SKILL 结构 ===')
ok('意大利条目存在', !!cfg)
ok("trigger === 'star_resolved'", cfg && cfg.trigger === 'star_resolved', cfg && cfg.trigger)
ok('cost.points === 2', cfg && cfg.cost && cfg.cost.points === 2, cfg && JSON.stringify(cfg.cost))
ok("grant.filter === 'status_econ'", cfg && cfg.grant && cfg.grant.filter === 'status_econ', cfg && JSON.stringify(cfg.grant))

console.log('\n=== 代价扣分 ===')
ok('扣分前 ' + AX + ' 分数 = 10', g.score[AX] === 10)
ok('national_skill_cost_ok 永远 true（points 无校验）',
	I.national_skill_cost_ok(g, '意大利', cfg) === true)

console.log('\n=== 授予过滤 status_econ ===')
ok('STATUS 卡(15338) 可授予', I.national_skill_grant_ok(cfg, '15338') === true)
ok('ECON 卡(15313) 可授予', I.national_skill_grant_ok(cfg, '15313') === true)
ok('EVENT 卡(15225) 不可授予', I.national_skill_grant_ok(cfg, '15225') === false)

/* 模拟：玩家已打出★卡，offer 已生成 */
console.log('\n=== 使用技能：扣 2 分 + 授予额外打出 ===')
g.national_skill_offer = { nation: '意大利', source_name: cfg.name }
g = I.use_national_skill(g, '意大利')
ok('使用后端分：' + AX + ' = 8', g.score[AX] === 8, AX + '=' + g.score[AX])
ok('授予 extra_play', !!g.extra_play, JSON.stringify(g.extra_play && g.extra_play.filter))
ok("extra_play.filter === 'status_econ'", g.extra_play && g.extra_play.filter === 'status_econ')
ok('一回合一次：再次使用被拒', (function () {
	const before = g.score['Axis']
	g.national_skill_offer = { nation: '意大利', source_name: cfg.name }
	const g2 = I.use_national_skill(g, '意大利')
	return g2.score['Axis'] === before
})(), 'score 不变 = 未重复扣')

console.log('\n=== extra_play_allows 针对 status_econ ===')
ok('允许 STATUS 卡', I.extra_play_allows(g, '意大利', '15338') === true)
ok('允许 ECON 卡', I.extra_play_allows(g, '意大利', '15313') === true)
ok('拒绝 EVENT 卡', I.extra_play_allows(g, '意大利', '15225') === false)
ok("extra_play_filter_desc = 'status_econ' 文案",
	I.extra_play_filter_desc(g.extra_play).indexOf('状态卡或经济战卡') >= 0,
	I.extra_play_filter_desc(g.extra_play))

console.log('\n=== 触发链路：打出意大利★卡 -> offer 生成 ===')
let g2 = rules.setup(1)
g2.current_nation = '意大利'
g2.active = 'Axis'
g2.turn_phase = 'play'
g2.hands = g2.hands || {}
g2.hands['意大利'] = ['17712#1', '15338#1']  /* 17712=★卡(ECON)，15338=状态卡(可被授予) */
/* 先确认 17712 确实是★ */
ok('17712 是★卡（已登记 STARRED_CARDS）', I.is_starred_card('17712#1') === true)
/* 打出★卡后结算 -> after_card_resolved 应生成 offer */
g2 = I.after_card_resolved(g2, '意大利', '17712#1')
ok('star_resolved 后生成 national_skill_offer', !!g2.national_skill_offer,
	JSON.stringify(g2.national_skill_offer))
ok('offer.nation === 意大利', g2.national_skill_offer && g2.national_skill_offer.nation === '意大利')
/* 非★卡不应生成 offer（清掉旧的） */
let g3 = rules.setup(1)
g3.current_nation = '意大利'
g3.active = 'Axis'
g3.hands = g3.hands || {}
g3.hands['意大利'] = ['15225#1']  /* 德国★卡，但行动国是意大利，且 15225 非意大利★ */
g3 = I.after_card_resolved(g3, '意大利', '15225#1')
ok('非意大利★卡不生成 offer（offer 为 null）', g3.national_skill_offer === null || !g3.national_skill_offer)

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
