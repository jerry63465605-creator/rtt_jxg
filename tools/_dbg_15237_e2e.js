// 端到端测试场景 B：德国已占黑海邻接区(巴尔干)，手牌含 15237 + 15208 + 15210。
// 直接走 action(play_card) 打 15237，检查：
//   1) <黑海>是否真的建起德国海军
//   2) after_build_navy 武装窗口是否被创建（含 15208/15210）
//   3) 国家技能窗口是否被创建
//   4) view 白名单是否同时授权 use_armed_offer + use_national_skill
const path = require('path')
const rules = require(path.join('c:/Users/24968/Desktop/rtt', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))

const g = rules.setup(1)
g.opening = null
g.active = 'Axis'
g.current_nation = '德国'
g.turn_phase = 'play'            // 出牌阶段，EVENT 卡可打
// 德国在巴尔干(12)放一支陆军（黑海14邻接12），以确保能在黑海建海军
g.location['tp'] = 12
g.piece_nation['tp'] = '德国'
g.piece_type['tp'] = 'army'
// 手牌：15237 事件 + 15208/15210 两张 after_build_navy 武装卡 + 一张状态卡(15338)
// 德国国家技能 grant=status，要求手里有状态卡才能开窗，故加一张（类型判定，不看国别）
g.hands['德国'] = ['15237#1', '15208#1', '15210#1', '15338#1']
g.armed_offers = []
g.national_skill_offer = null

function occ(sp) {
	const ids = []
	for (const id in g.location) if (g.location[id] === sp && g.piece_nation[id] === '德国') ids.push(id + ':' + g.piece_type[id])
	return ids
}
console.log('打 15237 前：黑海(14)德国棋子 =', JSON.stringify(occ(14)), ' 巴尔干(12) =', JSON.stringify(occ(12)))

const out = rules.action(g, 'Axis', 'play_card', { card: '15237#1' })
console.log('--- action 返回 ---')
console.log('黑海(14)德国棋子 =', JSON.stringify(occ(14)))
console.log('armed_offers 数量 =', (g.armed_offers || []).length)
for (const w of (g.armed_offers || [])) {
	console.log('  -> when=', w.when, 'nation=', w.nation, 'cards=', JSON.stringify((w.cards || []).map(c => c.card_id)))
}
console.log('national_skill_offer =', JSON.stringify(g.national_skill_offer))

const acts = rules.view(g, 'Axis').actions || {}
console.log('view.actions 关键键:',
	'use_armed_offer=' + !!acts.use_armed_offer,
	'skip_armed_offer=' + !!acts.skip_armed_offer,
	'use_national_skill=' + !!acts.use_national_skill,
	'skip_national_skill=' + !!acts.skip_national_skill,
	'play_card=' + !!acts.play_card)
console.log('--- 最近日志 ---')
console.log((g.log.slice(-8)).join('\n'))
