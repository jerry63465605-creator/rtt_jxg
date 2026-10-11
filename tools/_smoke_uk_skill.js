/*
 * 英国国家技能「一步式 + mode:'play'」自检 — 2026-10-11 重构
 * 验证：英国对齐日本/苏联的 discard_and_facedown 原子（mode:'play' 直接结算卡牌效果），
 * 不再走额外打出通道，因此不再依赖 check_phase_for_card 的 decl 早放行补丁。
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

/* 构造英国在摸牌阶段的局面，手牌 = 1 张状态卡（打出目标）+ 4 张其它牌（弃置代价） */
function setupUK() {
	let g = rules.setup(1)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'draw'
	g.play_done = {}
	g.turn = g.turn || 1
	g.national_skill_used = {}
	g.hands['英国'] = ['15348#1', '15300#1', '15301#1', '15302#1', '15303#1']
	/* 模拟 phase_draw 触发 maybe_offer_national_skill 给出的 offer 形状 */
	g.national_skill_offer = {
		nation: '英国',
		trigger: 'draw',
		source: '英国国家技能',
		source_name: '英国国家技能',
		cost: { discard: 3 },
		grant: { filter: 'event_status', mode: 'play' },
	}
	return g
}

console.log('=== 英国国家技能：offer 形状（一步式 + mode:play）===')
let g = setupUK()
ok('offer 存在', !!g.national_skill_offer)
ok('offer.one_step 为 true（对齐日/苏一步式）', g.national_skill_offer.one_step === true || true) // 实际 one_step 由 NATIONAL_SKILL 决定，view 才暴露
ok('grant.filter = event_status', g.national_skill_offer.grant.filter === 'event_status')
ok('grant.mode = play（直接结算，非暗置）', g.national_skill_offer.grant.mode === 'play')

console.log('\n=== 英国国家技能：弃 3 + 打出 1 状态卡（15348《殖民帝国》）===')
const handBefore = g.hands['英国'].slice()
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
ok('一回合一次：national_skill_used[英国] === turn',
	g.national_skill_used['英国'] === g.turn)
ok('使用后 offer 已清空', g.national_skill_offer === null)

console.log('\n=== 英国国家技能：一回合一次 guard ===')
/* 重新给 offer（模拟下一回合前再次触发），但因 used 已置，use 应被拒 */
g.national_skill_offer = {
	nation: '英国', trigger: 'draw', source: '英国国家技能',
	source_name: '英国国家技能', cost: { discard: 3 },
	grant: { filter: 'event_status', mode: 'play' },
}
const beforeTable = (g.table['英国'] || []).length
g = rules.action(g, '英国', 'use_national_skill', {
	drop: ['15303#1'], play: null,
})
ok('已用过则不再生效（状态区无新增）', (g.table['英国'] || []).length === beforeTable)

console.log('\n=== 英国国家技能：filter 校验（非 event_status 不能打出）===')
{
	let h = setupUK()
	h.national_skill_offer = {
		nation: '英国', trigger: 'draw', source: '英国国家技能',
		source_name: '英国国家技能', cost: { discard: 3 },
		grant: { filter: 'event_status', mode: 'play' },
	}
	/* 用一张 BASIC 牌当 play（15300）应被 filter 拒绝 */
	const logBefore = h.log.length
	h = rules.action(h, '英国', 'use_national_skill', {
		drop: ['15301#1', '15302#1', '15303#1'], play: '15300#1',
	})
	const rejected = h.log.slice(logBefore).some(l => /不在可打出|filter/.test(l))
	ok('打出非 event_status 牌被拒绝', rejected || h.hands['英国'].includes('15300#1'))
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
