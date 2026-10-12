/*
 * 英国国家技能「一步式 + mode:'play'」自检 — status_response 版本
 * 验证：发动后可选打出 1 张【状态卡】（正面结算进桌面）或【响应卡】（暗置进 table_responses）。
 * 用法：node tools/_smoke_uk_skill.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++; else pass++
}

/* 构造英国在摸牌阶段的局面：
 *   手牌 = 1 张状态卡(15348) + 1 张响应卡(15328) + 4 张基本卡(15300-15303，作弃置代价)
 *   15348《殖民帝国》= STATUS；15328《破译恩尼格码》= RESPONSE（英国） */
function fresh() {
	let g = rules.setup(1)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'draw'
	g.play_done = {}
	g.turn = g.turn || 1
	g.national_skill_used = {}
	g.hands['英国'] = ['15348#1', '15328#1', '15300#1', '15301#1', '15302#1', '15303#1']
	g.national_skill_offer = {
		nation: '英国',
		trigger: 'draw',
		source: '英国国家技能',
		source_name: '英国国家技能',
		cost: { discard: 3 },
		grant: { filter: 'status_response', mode: 'play' },
	}
	return g
}

console.log('=== 英国国家技能：offer 形状（status_response + mode:play）===')
let g0 = fresh()
ok('offer 存在', !!g0.national_skill_offer)
ok('grant.filter = status_response', g0.national_skill_offer.grant.filter === 'status_response')
ok('grant.mode = play（直接结算 / 响应卡暗置）', g0.national_skill_offer.grant.mode === 'play')

console.log('\n=== 打出 1 张【状态卡】15348《殖民帝国》：正面结算进桌面 ===')
let g = fresh()
g = rules.action(g, '英国', 'use_national_skill', {
	drop: ['15300#1', '15301#1', '15302#1'],
	play: '15348#1',
})
ok('代价牌已从手牌移除', !g.hands['英国'].includes('15300#1') &&
	!g.hands['英国'].includes('15301#1') && !g.hands['英国'].includes('15302#1'))
ok('打出牌 15348 已从手牌移除', !g.hands['英国'].includes('15348#1'))
ok('15348 进入桌面状态区 game.table[英国]',
	(g.table['英国'] || []).includes('15348#1'),
	'hand=' + JSON.stringify(g.hands['英国']))
ok('一回合一次：national_skill_used[英国] === turn', g.national_skill_used['英国'] === g.turn)
ok('使用后 offer 已清空', g.national_skill_offer === null)

console.log('\n=== 打出 1 张【响应卡】15328《破译恩尼格码》：暗置进 table_responses ===')
let g2 = fresh()
g2 = rules.action(g2, '英国', 'use_national_skill', {
	drop: ['15300#1', '15301#1', '15302#1'],
	play: '15328#1',
})
ok('响应牌 15328 已从手牌移除', !g2.hands['英国'].includes('15328#1'))
ok('15328 暗置进 game.table_responses',
	(g2.table_responses || []).some(r => r.card_id === '15328#1'),
	'resp=' + JSON.stringify(g2.table_responses))
ok('状态卡 15348 仍留在手牌（本次未被打出）', g2.hands['英国'].includes('15348#1'))
ok('响应暗置不进桌面状态区 game.table[英国]', !(g2.table['英国'] || []).includes('15328#1'))
ok('一回合一次：national_skill_used[英国] === turn', g2.national_skill_used['英国'] === g2.turn)

console.log('\n=== filter 校验：非 状态/响应 牌不能打出 ===')
{
	let h = fresh()
	const logBefore = h.log.length
	h = rules.action(h, '英国', 'use_national_skill', {
		drop: ['15300#1', '15301#1', '15302#1'], play: '15303#1', /* 15303 是基本卡，不在 status_response 范围 */
	})
	const rejected = h.log.slice(logBefore).some(l => /不在可打出|不能由|filter/.test(l))
	ok('打出非 status_response 牌被拒绝（15303 仍在手牌）',
		rejected || h.hands['英国'].includes('15303#1'))
	ok('被拒的牌未进入 table_responses', !(h.table_responses || []).some(r => r.card_id === '15303#1'))
}

console.log('\n=== 一回合一次 guard ===')
{
	let h = fresh()
	/* 第一次发动：打出 15348（状态） */
	h = rules.action(h, '英国', 'use_national_skill', {
		drop: ['15300#1', '15301#1', '15302#1'], play: '15348#1',
	})
	/* 重新给 offer（模拟本回合内再次触发），因 used 已置，应被拒 */
	h.national_skill_offer = {
		nation: '英国', trigger: 'draw', source: '英国国家技能',
		source_name: '英国国家技能', cost: { discard: 3 },
		grant: { filter: 'status_response', mode: 'play' },
	}
	const beforeResp = (h.table_responses || []).length
	h = rules.action(h, '英国', 'use_national_skill', {
		drop: ['15303#1'], play: '15328#1',
	})
	ok('已用过则再次发动不生效（table_responses 无新增）',
		(h.table_responses || []).length === beforeResp)
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
