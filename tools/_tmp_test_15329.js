/*
 * 临时验证：15329 反潜战术 拦截经济战（新口径：进弃牌堆 / 占出牌名额 / 拦截即效果无效）
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

let g = rules.setup(1)
g.current_nation = '德国'
g.active = 'Axis'
g.turn_phase = 'play'
g.play_done = {}

function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) process.exitCode = 1
	return cond
}

/* 英国（同盟）把 15329 暗置桌面 */
g.table_responses = g.table_responses || []
g.table_responses.push({ card_id: '15329#1', owner_side: 'allies' })

/* 德国（轴心=敌方）手里拿到一张经济战卡 15313（type=ECON） */
g.hands['德国'] = g.hands['德国'] || []
g.hands['德国'].push('15313#1')

console.log('=== 敌方(德国)打出经济战 15313 ===')
g = rules.action(g, 'Axis', 'play_card', { card: '15313#1', target: '苏联' })
ok('经济战被打出即占出牌名额', !!g.play_done['德国'],
	'play_done=' + JSON.stringify(g.play_done))
ok('经济战卡暂留手牌（待拦截决定）', g.hands['德国'].includes('15313#1'))
ok('响应队列已挂起 15329 拦截',
	(g.response_queue || []).some(q => q.candidates.some(c => c.card_face === '15329')))
ok('15313 效果未结算（苏联未损耗）', (g.discard['苏联'] || []).length === 0,
	'苏联弃牌堆=' + JSON.stringify(g.discard['苏联']))

console.log('\n=== 同盟发动 15329 拦截 ===')
g = rules.action(g, 'Allies', 'trigger_response', {})
ok('拦截后经济战卡进弃牌堆（不在手牌）', !g.hands['德国'].includes('15313#1'))
ok('经济战卡进入弃牌堆', (g.discard['德国'] || []).includes('15313#1'),
	'德国弃牌堆=' + JSON.stringify(g.discard['德国']))
ok('15313 效果仍无效（苏联未损耗）', (g.discard['苏联'] || []).length === 0)
ok('15329 自身被消耗进入弃牌堆', (g.discard['英国'] || []).includes('15329#1'))
ok('拦截后不再有挂起的响应', (g.response_queue || []).length === 0)
