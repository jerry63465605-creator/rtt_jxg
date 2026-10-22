/*
 * 回归测试：响应卡卡背分国家颜色（方案 B）的服务端契约
 *
 * 客户端据此给对手卡背上色，因此 view 必须：
 *   · table_responses（本方）每项带 nation；
 *   · table_responses_opponent（对手）逐张只带 nation / owner_side；
 *   · 对手条目【不得】含 card_id / instance_id / name / img / text（牌面保密）。
 *
 * 用法：node tools/_smoke_response_back.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}

function base() {
	const g = rules.setup(1)
	g.table_responses = [
		{ card_id: '15410#1', owner_side: 'axis', nation: '日本' },
		{ card_id: '17830#1', owner_side: 'allies', nation: '苏联' },
		{ card_id: '15328#1', owner_side: 'allies', nation: '英国' },
		{ card_id: '15251#1', owner_side: 'axis', nation: '意大利' },
	]
	return g
}

console.log('=== A. 轴心视角：本方 2 张（含 nation），对手 2 张（仅元数据） ===')
{
	const g = base()
	const v = rules.view(g, 'Axis')
	const own = v.table_responses || []
	const opp = v.table_responses_opponent || []
	ok('本方 2 张', own.length === 2, JSON.stringify(own.map(x => x.nation)))
	ok('本方带 nation', own.every(x => !!x.nation), JSON.stringify(own.map(x => x.nation)))
	ok('对手 2 张', opp.length === 2, JSON.stringify(opp))
	ok('对手带 nation', opp.every(x => !!x.nation), JSON.stringify(opp.map(x => x.nation)))
	ok('对手 nation 正确', opp.map(x => x.nation).sort().join(',') === ['苏联', '英国'].sort().join(','),
		JSON.stringify(opp.map(x => x.nation)))
	ok('对手 owner_side 都是 allies', opp.every(x => x.owner_side === 'allies'))
	ok('数量字段保持一致', v.table_responses_opponent_count === opp.length,
		v.table_responses_opponent_count + ' vs ' + opp.length)
}

console.log('\n=== B. 对手条目不得泄露牌面 ===')
{
	const g = base()
	const v = rules.view(g, 'Axis')
	const leaks = []
	for (const o of (v.table_responses_opponent || [])) {
		for (const k of Object.keys(o)) {
			if (k !== 'nation' && k !== 'owner_side') leaks.push(k)
		}
	}
	ok('只含 nation / owner_side 两个键', leaks.length === 0, '多出: ' + JSON.stringify(leaks))
	ok('整体 JSON 不含卡 id', JSON.stringify(v.table_responses_opponent).indexOf('#') < 0,
		JSON.stringify(v.table_responses_opponent))
}

console.log('\n=== C. 同盟视角：本方带 nation，对手是德/意 ===')
{
	const g = base()
	const v = rules.view(g, 'Allies')
	ok('本方带 nation', (v.table_responses || []).every(x => !!x.nation),
		JSON.stringify((v.table_responses || []).map(x => x.nation)))
	const opp = v.table_responses_opponent || []
	ok('对手 nation = 日/意', opp.map(x => x.nation).sort().join(',') === ['日本', '意大利'].sort().join(','),
		JSON.stringify(opp.map(x => x.nation)))
	ok('对手 owner_side 都是 axis', opp.every(x => x.owner_side === 'axis'))
}

console.log('\n=== D. 桌面没有响应卡时为空数组 ===')
{
	const g = rules.setup(1)
	g.table_responses = []
	const v = rules.view(g, 'Axis')
	ok('本方为空', (v.table_responses || []).length === 0)
	ok('对手为空数组（不是 undefined）', Array.isArray(v.table_responses_opponent) &&
		v.table_responses_opponent.length === 0, JSON.stringify(v.table_responses_opponent))
	ok('数量为 0', v.table_responses_opponent_count === 0)
}

console.log('\n=== E. 老存档缺 nation 字段时回落卡面国籍 ===')
{
	const g = rules.setup(1)
	g.table_responses = [{ card_id: '17830#1', owner_side: 'allies' }]   /* 无 nation */
	const v = rules.view(g, 'Axis')
	const opp = v.table_responses_opponent || []
	ok('从卡面补出 nation', opp.length === 1 && opp[0].nation === '苏联', JSON.stringify(opp))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
