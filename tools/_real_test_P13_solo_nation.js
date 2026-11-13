/*
 * 【D1/P13】单国前奏验收场景（Episode 2 德国单国）编号真实测试
 * 真实 R.setup / R.action / R.view 驱动。用法：node tools/_real_test_P13_solo_nation.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const C = require(path.join(MOD, 'cards.js'))
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function started(scenario, options) {
	const g = R.setup(20261112, scenario, options)
	let guard = 0
	while (g.opening && guard++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
const SOLO = 'Episode 2 德国单国'
const nations = g => Object.keys(g.prelude.decks || {})

console.log('=== A. 场景入口与状态 ===')
{
	ok('★★ exports.scenarios 含单国验收场景',
		R.scenarios.indexOf(SOLO) >= 0 && R.scenarios.indexOf('Episode 2') >= 0,
		J(R.scenarios))
	const g = started(SOLO)
	ok('★★ 单国场景启用前奏', g.prelude.enabled === true &&
		g.options.prelude === true, J({ en: g.prelude.enabled, op: g.options.prelude }))
	ok('★★ solo 国家 = 德国（配置驱动）',
		g.options.prelude_solo_nation === '德国',
		J(g.options.prelude_solo_nation))
	ok('★ 开局日志标注单国范围',
		(g.log || []).some(l => /单国验收：仅【德国】/.test(l)),
		J((g.log || []).filter(l => /单国验收/.test(l))))
}

console.log('\n=== B. 只有德国有前奏牌 ===')
{
	const g = started(SOLO)
	const others = nations(g).filter(n => n !== '德国')
	ok('★★ 其余 5 国牌库/手牌/弃牌全空',
		others.length === 5 && others.every(n =>
			!(g.prelude.decks[n] || []).length &&
			!(g.prelude.hands[n] || []).length &&
			!(g.prelude.discard[n] || []).length),
		J(others.map(n => [n, (g.prelude.decks[n] || []).length,
			(g.prelude.hands[n] || []).length])))
	const deTotal = (g.prelude.decks['德国'] || []).length +
		(g.prelude.hands['德国'] || []).length
	const official = C.CARDS.filter(x => x.nation === '德国' &&
		(x.deck === 'PRELUDE' || x.deck === 'ARMAMENT')).length
	const specs = require(path.join(MOD, 'prelude_specs.js'))
	const diyDe = (specs.PRELUDE_SPECS || []).filter(s => s.nation === '德国').length
	ok('★★ 德国前奏牌总数 = 官方张数 + 本国 DIY 卡（开局摸 2 仍在总数内）',
		deTotal === official + diyDe,
		J({ total: deTotal, official, diyDe }))
	ok('★★ 德国开局摸到 2 张前奏手牌',
		(g.prelude.hands['德国'] || []).length === 2,
		J((g.prelude.hands['德国'] || []).length))
	const v = R.view(g, g.active)
	ok('★ 同阵营友军仍是数组型（空），敌方只见数字',
		Array.isArray(v.prelude.hands['日本']) &&
		typeof v.prelude.hands['英国'] === 'number',
		J({ jp: v.prelude.hands['日本'], uk: v.prelude.hands['英国'] }))
	ok('★ 空国家的牌堆顶为 null（不泄卡面）',
		v.prelude.deck_top['日本'] === null &&
		!!v.prelude.deck_top['德国'], J(v.prelude.deck_top['日本']))
}

console.log('\n=== C. 轮转跳过空国、每轮回到德国 ===')
{
	const g = started(SOLO)
	const t0 = g.turn
	/* 德国行动阶段打一张牌 → 卡牌阶段；点继续 → 轮转跳过 5 个空国回到德国 */
	const h = g.prelude.hands['德国'] || []
	R.action(g, g.active, 'prelude_play_hand', { card: h[0] })
	/* 可能出现段窗口/op 窗口，按双门禁答完 */
	let guard = 0
	while (g.prelude && (g.prelude.pending || g.prelude.op_window) && guard++ < 8) {
		const p = g.prelude
		if (p.op_window) {
			const s = ['Axis', 'Allies'].find(x =>
				(R.view(g, x).actions || {}).prelude_op_skip)
			if (!s) break
			R.action(g, s, 'prelude_op_skip', {})
		} else {
			const s = ['Axis', 'Allies'].find(x =>
				(R.view(g, x).actions || {}).prelude_skip)
			if (!s) break
			R.action(g, s, 'prelude_skip', {})
		}
	}
	if (g.prelude.phase === 'prelude_action' && !g.prelude.ended)
		R.action(g, g.active, 'prelude_next', {})
	guard = 0
	while (g.prelude && g.prelude.phase === 'prelude_cards' &&
		!g.prelude.ended && guard++ < 3)
		R.action(g, g.active, 'prelude_next', {})
	ok('★★ 轮转后仍是德国回合（没有卡在空国）',
		g.current_nation === '德国', J({ nation: g.current_nation, phase: g.prelude.phase }))
	ok('★★ 走完一轮 turn +1（跳过空国仍计 nations_done）',
		g.turn === t0 + 1, J({ before: t0, after: g.turn }))
	ok('★★ 日志有跳过空国记录',
		(g.log || []).some(l => /跳过该国前奏阶段/.test(l)),
		J((g.log || []).filter(l => /跳过该国/.test(l)).slice(0, 3)))
	ok('★ 德国仍有牌、前奏未误判结束',
		!g.prelude.ended && ((g.prelude.decks['德国'] || []).length > 0 ||
			(g.prelude.hands['德国'] || []).length > 0),
		J({ ended: g.prelude.ended }))
}

console.log('\n=== D. 现有 Episode 2 零回归 + 可换国家 ===')
{
	const g = started('Episode 2')
	ok('★★ 原场景 6 国都有 2 张前奏手牌',
		nations(g).length === 6 && nations(g).every(n =>
			(g.prelude.hands[n] || []).length === 2),
		J(nations(g).map(n => [n, (g.prelude.hands[n] || []).length])))
	ok('★★ 原场景 solo 选项为 null',
		!g.options.prelude_solo_nation, J(g.options.prelude_solo_nation))
	const g2 = started('Episode 2', { prelude_solo_nation: '日本' })
	ok('★★ options.prelude_solo_nation 可换国家（不写死德国）',
		g2.options.prelude_solo_nation === '日本' &&
		(g2.prelude.decks['日本'] || []).length > 0 &&
		!(g2.prelude.decks['德国'] || []).length,
		J({ solo: g2.options.prelude_solo_nation,
			jp: (g2.prelude.decks['日本'] || []).length,
			de: (g2.prelude.decks['德国'] || []).length }))
	const std = R.setup(20261112, 'Standard')
	ok('★ Standard 场景仍完全不启用前奏',
		std.prelude.enabled === false && !std.options.prelude,
		J(std.prelude.enabled))
}

console.log('\n=== E. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const initFn = src.slice(src.indexOf('function init_prelude_decks'),
		src.indexOf('function prelude_draw'))
	ok('★★ 国家名只在配置常量里，init 逻辑不硬编码',
		/const PRELUDE_SOLO_NATION_DE = '德国'/.test(src) &&
		!/'德国'/.test(initFn) && /if \(solo && n !== solo\)/.test(initFn))
	ok('★ init_prelude_decks 跳过空国 + DIY 注入同步跳过',
		/if \(solo && n !== solo\)/.test(src) &&
		/if \(solo && s\.nation !== solo\) continue/.test(src))
	ok('★ 创建页场景由 exports.scenarios 驱动（无需改模板）',
		/exports\.scenarios = \['Standard', 'Episode 2', 'Episode 2 德国单国'\]/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
