/* 端到端验证：17741 海王 在计分阶段是否实际生效 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

const g = {
	turn: 1, current_nation: '意大利', active: 'Axis', turn_phase: 'scoring',
	location: {}, piece_nation: {}, piece_type: {},
	score: { axis: 0, allies: 0 }, markers: {}, table: { '意大利': ['17741'] },
	hands: {}, discard: {}, decks: {}, status_used: {}, log: [],
	bloc: ['意大利'],
}
let pid = 0
function put(nation, type, space) {
	const id = 'p' + (++pid)
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
const sea = I.space_id_of('地中海')
const blk = I.space_id_of('黑海')
const lat = I.space_id_of('拉丁美洲')

put('意大利', 'navy', sea)
put('意大利', 'navy', blk)
put('意大利', 'navy', lat)
put('德国', 'navy', sea)        // 不计入
put('意大利', 'army', sea)      // 不计入

console.log('space_id 解析: 地中海=%s 黑海=%s 拉丁美洲=%s', sea, blk, lat)
console.log('status_active(17741,意大利) =', I.status_active(g, '17741', '意大利'))
const cfg = I.STATUS_EFFECTS['17741']
console.log('cfg.auto.phase =', cfg && cfg.auto && cfg.auto.phase,
	'| trigger_nation =', cfg && cfg.auto && cfg.auto.trigger_nation,
	'| kind =', cfg && cfg.auto && cfg.auto.kind)
console.log('run() 直接调用 =', cfg.auto.run(g))

const before = g.score.axis
I.phase_scoring(g, '意大利')
const after = g.score.axis
console.log('score.axis: before=%d after=%d delta=%d', before, after, after - before)
console.log('最近日志:', g.log.slice(-3))
console.log(after - before === 3 ? 'PASS ✅ 海王实际生效' : 'FAIL ❌ 预期 +3')
