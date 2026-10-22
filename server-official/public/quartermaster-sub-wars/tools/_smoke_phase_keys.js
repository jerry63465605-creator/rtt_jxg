"use strict"
/*
 * D4 阶段 key 常量 —— 源码级约定检查 + 行为回归（2026-10-23）
 *
 * 本测试同时起两个作用：
 *   ① 源码 lint：禁止在"阶段语境"里写字面量字符串（新增代码也会被这条拦住）；
 *   ② 行为回归：确认替换成 PH.* 后，7 阶段推进与阶段判定没变。
 */
const fs = require('fs')
const path = require('path')
const rules = require('../rules.js')
const I = rules._internal
const SRC = fs.readFileSync(path.join(__dirname, '..', 'rules.js'), 'utf8')

let pass = 0, fail = 0
function ok(name, cond, detail) {
	if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  | ' + detail : '')) }
	else { fail++; console.log('  FAIL  ' + name + (detail ? '  | ' + detail : '')) }
}
function stripComments(src) {
	/* 只留代码行：去掉行注释与块注释（注释里出现字面量不算违规） */
	return src
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.map(l => l.replace(/\/\/.*$/, ''))
		.join('\n')
}
const CODE = stripComments(SRC)

console.log('\n=== A. PH 常量齐全 ===')
{
	const keys = ['RESOURCE', 'PLAY', 'AIRFORCE', 'SUPPLY', 'SCORING', 'DISCARD', 'DRAW']
	const vals = ['resource', 'play', 'airforce', 'supply', 'scoring', 'discard', 'draw']
	ok('PH 已导出到 _internal', !!I.PH, typeof I.PH)
	keys.forEach((k, i) => {
		ok('PH.' + k + " = '" + vals[i] + "'", I.PH && I.PH[k] === vals[i], String(I.PH && I.PH[k]))
	})
}

console.log('\n=== B. 源码约定：阶段语境不得使用字面量 ===')
{
	const patterns = [
		['turn_phase 比较', /turn_phase\s*[!=]==?\s*'/g],
		['turn_phase 赋值', /turn_phase\s*=\s*'/g],
		['turn_phase: 字段', /turn_phase\s*:\s*'/g],
		['run_phase_entry 字面量', /run_phase_entry\(\s*game\s*,\s*'/g],
		['phase_index 字面量', /phase_index\(\s*'/g],
	]
	for (const [name, re] of patterns) {
		const hits = CODE.match(re) || []
		ok(name + ' 无字面量', hits.length === 0, hits.length ? JSON.stringify(hits.slice(0, 3)) : '0 处')
	}
	ok('PH.* 已被实际使用（≥28 处）', (SRC.match(/\bPH\.(RESOURCE|PLAY|AIRFORCE|SUPPLY|SCORING|DISCARD|DRAW)\b/g) || []).length >= 28,
		String((SRC.match(/\bPH\.(RESOURCE|PLAY|AIRFORCE|SUPPLY|SCORING|DISCARD|DRAW)\b/g) || []).length) + ' 处')
}

console.log('\n=== C. 行为回归：7 阶段推进 ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	ok('初始阶段 = PH.RESOURCE', g.turn_phase === I.PH.RESOURCE, g.turn_phase)
	/* 直接驱动阶段推进（跳过开局弃牌：把 opening 置空并进入正式流程） */
	g.opening = null
	const seen = []
	for (let i = 0; i < 7; i++) {
		seen.push(g.turn_phase)
		rules.action(g, g.active, 'next_phase', {})
		if (g.opening) break
	}
	const order = ['resource', 'play', 'airforce', 'supply', 'scoring', 'discard', 'draw']
	const firstPart = seen.slice(0, 7)
	ok('阶段顺序正确', JSON.stringify(firstPart) === JSON.stringify(order),
		JSON.stringify(firstPart))
}

console.log('\n=== D. 行为回归：current_phase / phase_index ===')
{
	const g = rules.setup(42, rules.default_scenario, {})
	g.turn_phase = I.PH.SCORING
	const v = rules.view(g, 'Axis')
	ok('view 能正常渲染计分阶段', !!v && typeof v.prompt === 'string', v && v.prompt.slice(0, 30))
	ok('prompt 含"计分"', /计分/.test(v.prompt || ''), v && v.prompt)
}

console.log('\n' + (fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAIL / ' + pass + ' PASS'))
process.exitCode = fail ? 1 : 0
