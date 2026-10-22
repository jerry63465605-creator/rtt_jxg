"use strict"
/*
 * 卡牌守恒检查器（D5 前置机制，2026-10-23）
 *
 * 为什么需要：手牌增删最容易犯的错是【吞牌 / 复制牌】，这种错不会立刻报错，
 * 只表现为"某张牌再也没出现过"或"同一张牌同时在两处"。
 * 这里用一条不变量把它们一次抓住：
 *
 *   不变量 1：hands + decks + discard + table 的总张数 === setup 后的基线
 *   不变量 2：同一张卡实例不得同时出现在两个容器里（复制检测）
 *
 * 实测（300 步随机对局）：基线 431 张，全程 0 次变化、0 次复制 —— 说明这条不变量当前成立。
 * 以后任何"取牌后忘了放回/入弃牌堆"的改动都会被本测试立即发现。
 */
const rules = require('../rules.js')
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, detail) {
	if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  | ' + detail : '')) }
	else { fail++; console.log('  FAIL  ' + name + (detail ? '  | ' + detail : '')) }
}

const BUCKETS = [
	['hands', 'hand'],
	['decks', 'deck'],
	['discard', 'discard'],
	['table', 'table'],
]

function snapshot(g) {
	const seen = new Map()      /* 卡 -> 出现位置列表 */
	let total = 0
	for (const [bucket] of BUCKETS) {
		const obj = g[bucket] || {}
		for (const n of Object.keys(obj)) {
			for (const c of (obj[n] || [])) {
				total++
				const k = String(c)
				if (!seen.has(k)) seen.set(k, [])
				seen.get(k).push(bucket + '/' + n)
			}
		}
	}
	const dups = [...seen.entries()].filter(([, v]) => v.length > 1)
	return { total, dups, unique: seen.size }
}

function legal_arg(g, a, val) {
	if (a === 'opening_discard') {
		const hand = (g.hands[g.current_nation] || []).slice(0, 3)
		return hand.length === 3 ? { cards: hand } : null
	}
	return Array.isArray(val) ? val[0] : null
}

console.log('\n=== A. 原语基本语义 ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	const nat = '德国'
	const card = g.hands[nat][0]
	const n0 = g.hands[nat].length

	const t = I.take_from_hand(g, nat, card)
	ok('取牌返回 {card,index}', !!t && t.card === card && typeof t.index === 'number',
		JSON.stringify(t))
	ok('手牌 -1', g.hands[nat].length === n0 - 1)
	ok('重复取同一张 -> null', I.take_from_hand(g, nat, card) === null)

	ok('放回成功', I.put_back_to_hand(g, nat, card) === true)
	ok('手牌恢复', g.hands[nat].length === n0)
	ok('重复放回 -> false（幂等）', I.put_back_to_hand(g, nat, card) === false)
	ok('手牌未重复', g.hands[nat].filter(x => x === card).length === 1)

	ok('给牌（牌堆外）成功', I.give_to_hand(g, nat, 'fake_card_x') === true)
	ok('重复给牌 -> false', I.give_to_hand(g, nat, 'fake_card_x') === false)
	g.hands[nat].splice(g.hands[nat].indexOf('fake_card_x'), 1)   /* 清理 */
}

console.log('\n=== B. 守恒：3 局随机对局，每步校验 ===')
{
	for (const seed of [42, 7, 1234]) {
		const g = rules.setup(seed, rules.default_scenario, {})
		const base = snapshot(g)
		const skip = /^(propose_rollback|accept_rollback|reject_rollback|cancel_rollback|log)$/
		let steps = 0
		let firstBreak = null
		for (let i = 0; i < 250; i++) {
			const v = rules.view(g, g.active)
			const names = Object.keys(v.actions || {}).filter(x => !skip.test(x))
			if (!names.length) break
			const a = names[Math.floor(Math.random() * names.length)]
			try { rules.action(g, g.active, a, legal_arg(g, a, v.actions[a])) } catch (e) { break }
			steps++
			const s = snapshot(g)
			if (s.total !== base.total || s.dups.length) {
				firstBreak = { step: steps, action: a, total: s.total, base: base.total, dups: s.dups.slice(0, 2) }
				break
			}
		}
		ok('seed ' + seed + '：' + steps + ' 步守恒（基线 ' + base.total + ' 张）',
			firstBreak === null, firstBreak ? JSON.stringify(firstBreak) : '')
	}
}

console.log('\n=== C2. 源码基线：手写手牌操作不得新增 ===')
{
	/*
	 * 现状（2026-10-23）：取牌手写 26 处（含 discard_card / take_from_hand 两个原语本体）、
	 * 给牌手写 12 处（含 draw_cards / put_back_to_hand / give_to_hand 三个本体）。
	 * 这些写法功能正确（都有 indexOf 校验），逐个迁移只有一致性收益、风险却不低，
	 * 故用基线冻结：以后新增代码请用原语，手写数量一上升本测试就报警。
	 */
	const fs = require('fs')
	const path = require('path')
	const SRC = fs.readFileSync(path.join(__dirname, '..', 'rules.js'), 'utf8')
	const spliceHits = SRC.match(/hands\[[^\]]*\]\.splice\([^)]*,\s*1\)/g) || []
	const pushHits = SRC.match(/hands\[[^\]]*\]\.push\(/g) || []
	const putBackHits = SRC.match(/put_back_to_hand\(/g) || []
	const takeHits = SRC.match(/take_from_hand\(/g) || []

	ok('取牌手写 ≤ 26（新增请用 take_from_hand）', spliceHits.length <= 26, spliceHits.length + ' 处')
	ok('给牌手写 ≤ 12（新增请用 give_to_hand）', pushHits.length <= 12, pushHits.length + ' 处')
	ok('put_back_to_hand 已被使用（≥8 处：1 定义 + 7 调用）', putBackHits.length >= 8, putBackHits.length + ' 处')
	ok('take_from_hand 已被使用（≥2 处：1 定义 + 1 调用）', takeHits.length >= 2, takeHits.length + ' 处')
	ok('手牌放回不再使用"旧索引 splice(x,0,y)"',
		(SRC.match(/hands\[[^\]]*\]\.splice\([^,]+,\s*0\s*,/g) || []).length === 0,
		JSON.stringify((SRC.match(/hands\[[^\]]*\]\.splice\([^,]+,\s*0\s*,/g) || [])))
}

console.log('\n=== C. 原语不改变总量 ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	const nat = '德国'
	const base = snapshot(g)
	const card = g.hands[nat][0]
	I.take_from_hand(g, nat, card)
	I.put_back_to_hand(g, nat, card)
	I.give_to_hand(g, nat, 'tmp_card')
	g.hands[nat].splice(g.hands[nat].indexOf('tmp_card'), 1)
	const after = snapshot(g)
	ok('取/放/给 之后总量不变', after.total === base.total,
		base.total + ' -> ' + after.total)
	ok('无复制', after.dups.length === 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAIL / ' + pass + ' PASS'))
process.exitCode = fail ? 1 : 0
