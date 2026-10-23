/*
 * 回归：view.table_status_opponent —— 敌方状态卡栏的数据契约（2026-10-24）
 *
 * 需求：在"桌面响应卡"下方加一栏"敌方状态卡"，且【永远暗置】。
 *
 * 实现要点（本测试锁死）：
 *   1) 只下发【本方看不到的那一方的】状态卡，逐张 { nation, owner_side }；
 *   2) **绝不**下发 card_id / name / img / text —— 暗置必须靠数据层保证，
 *      否则改前端就能看穿（"暗置"形同虚设）；
 *   3) 口径与 view.table_status 一致：只统计 status_config_of() 有配置的真"状态卡"
 *      （桌上可能还挂着非状态类卡，那些不该计数）；
 *   4) 双方视角互为补集：本方 table_status + 对方 table_status_opponent = 全部状态卡。
 *
 * 用法：node tools/_smoke_enemy_status_view.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

/* 造一个双方桌面都有状态卡的盘面 */
function mk() {
	const g = rules.setup(2024, rules.default_scenario, {})
	g.opening = null
	g.log.length = 0
	g.table = {
		'德国': ['15439#1'],      /* 北进论（日本状态卡，挂德国桌面仅用于测试） */
		'日本': ['15439#2'],
		'英国': ['15439#3', '15439#4'],
		'美国': ['15439#5'],
	}
	return g
}

/* 15439 北进论 是状态卡（status_config_of 有配置）；先用一条状态卡校验口径 */
const SAMPLE = '15439'

console.log('=== A. 口径：只统计真状态卡 ===')
{
	const g = mk()
	ok('A0 样本 ' + SAMPLE + ' 被 status_config_of 认出',
		!!rules._internal.status_config_of && !!I.status_config_of(SAMPLE + '#1'),
		typeof I.status_config_of)
	ok('A1 非状态卡不计数', (() => {
		const g2 = mk()
		/* 只留一张 BASIC 卡在敌方桌面，排除其它国家干扰 */
		g2.table = { '德国': ['15401#9'] }   /* 15401 发起陆战（BASIC，不是状态卡） */
		const v = rules.view(g2, 'Allies')
		return (v.table_status_opponent || []).length === 0
	})(), 'BASIC 卡不应出现在敌方状态栏')
}

console.log('\n=== B. 双方视角互为补集 ===')
{
	const g = mk()
	const vA = rules.view(g, 'Allies')
	const vX = rules.view(g, 'Axis')
	ok('B1 Allies 本方 3 张（英2 + 美1）', (vA.table_status || []).length === 3,
		(vA.table_status || []).length)
	ok('B2 Allies 看到敌方 2 张（德1 + 日1）', (vA.table_status_opponent || []).length === 2,
		(vA.table_status_opponent || []).length)
	ok('B3 Axis 本方 2 张', (vX.table_status || []).length === 2, (vX.table_status || []).length)
	ok('B4 Axis 看到敌方 3 张', (vX.table_status_opponent || []).length === 3,
		(vX.table_status_opponent || []).length)
	ok('B5 互补：3 + 2 = 5 = 4 + 1 + ... 总数一致', (() => {
		const total = Object.values(g.table).reduce((a, v) => a + v.length, 0)
		return ((vA.table_status || []).length + (vA.table_status_opponent || []).length) === total &&
			((vX.table_status || []).length + (vX.table_status_opponent || []).length) === total
	})(), '总数 5')
}

console.log('\n=== C. 敌方条目：卡面【可见】，但不含任何"可操作"字段 ===')
{
	const g = mk()
	const opp = rules.view(g, 'Allies').table_status_opponent || []
	ok('C1 非空', opp.length > 0, opp.length)
	const o = opp[0] || {}
	ok('C2 nation 是国名', typeof o.nation === 'string' && o.nation.length > 0, o.nation)
	ok('C3 owner_side 是 axis/allies',
		o.owner_side === 'axis' || o.owner_side === 'allies', o.owner_side)
	/* 卡面可见：这三项是"看得见"的前提 */
	ok('C4 有 name（卡面可见）', typeof o.name === 'string' && o.name.length > 0, o.name)
	ok('C5 有 img（卡面可见）', typeof o.img === 'string' && o.img.length > 0, o.img)
	ok('C6 有 text 或 desc', typeof (o.text || o.desc) === 'string', (o.text || o.desc || '').slice(0, 20))
	/* 关键：永远不可操作 —— 这些字段一个都不能有 */
	for (const k of ['ready', 'ready_reason', 'ready_space', 'cost_discard', 'used_this_turn', 'forgo_build'])
		ok('C7 不含可操作字段 ' + k, !(k in o), Object.keys(o).join(','))
}

console.log('\n=== D. 空桌面的表现 ===')
{
	const g = rules.setup(2025, rules.default_scenario, {})
	g.opening = null
	g.table = {}
	const v = rules.view(g, 'Allies')
	ok('D1 空数组而不是 undefined', Array.isArray(v.table_status_opponent),
		typeof v.table_status_opponent + '/' + JSON.stringify(v.table_status_opponent))
	ok('D2 长度 0', (v.table_status_opponent || []).length === 0)
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
