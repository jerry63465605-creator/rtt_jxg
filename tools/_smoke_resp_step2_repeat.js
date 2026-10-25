/*
 * 「1 或 2 次」多步响应卡：第 2 次【允许】落回同一地区。
 *
 * 玩家裁决（2026-10-26）：**可以打重复地点是对的**。
 *   · 15425《海军空降部队》原本就是允许的 —— 它是对的，不要改。
 *   · 15423《潜艇支援》/ 15424《海军特别陆战队》/ 15426《驱逐舰运输》
 *     当时误加了"第 2 次排除首次地区"，现全部回退。
 *
 * 本脚本守护这条口径：第 2 步候选必须【包含】首次地区，且执行步不得拒绝。
 * （旧脚本 _smoke_resp_step2_norepeat.js 的断言方向相反，已删除。）
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = require(path.join(MOD, 'data.js')).data

const IMPL = I.RESPONSE_EFFECT_IMPL

let bad = 0
const flag = (name, ok, extra) => {
	console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '   [' + extra + ']' : ''))
	if (!ok) bad++
}
const info = (k, v) => console.log('    ' + k + ' =', typeof v === 'object' ? JSON.stringify(v) : v)
const nm = sp => data.name_of(sp) || String(sp)

function freshGame() {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	return g
}

function findBase(pool) {
	for (const sp0 of pool) {
		const sp = Number(sp0)
		const s = data.spaces[sp]
		if (!s) continue
		const near = I.get_connections(freshGame(), sp, 'axis')
			.map(Number).filter(x => data.spaces[x] && data.spaces[x].terrain === s.terrain)
		if (near.length >= 2) return sp
	}
	return null
}

const SEA_POOL = I.all_sea_space_ids().map(Number)
const LAND_POOL = (() => {
	const out = []
	for (let i = 1; i < data.spaces.length; i++) {
		const s = data.spaces[i]
		if (s && s.terrain === 'land') out.push(i)
	}
	return out
})()

const CASES = [
	{ face: '15423', name: '潜艇支援',       pool: SEA_POOL,  step: 'battle2' },
	{ face: '15424', name: '海军特别陆战队', pool: LAND_POOL, step: 'region2' },
	{ face: '15425', name: '海军空降部队',   pool: LAND_POOL, step: 'battle2' },
	{ face: '15426', name: '驱逐舰运输',     pool: LAND_POOL, step: 'region2' },
]

for (const c of CASES) {
	console.log('\n=== ' + c.face + ' ' + c.name + '（第 2 步 ' + c.step + '） ===')
	const eff = IMPL[c.face]
	if (typeof eff !== 'function') { console.log('  （未实现，跳过）'); continue }
	const base = findBase(c.pool)
	if (base == null) { console.log('  （找不到候选 ≥2 的基准地区，跳过）'); continue }

	const g = freshGame()
	const ctx = { nation: '日本', space: base }

	const first = eff(g, 'axis', ctx, undefined)
	const c1 = (first && first.candidates || []).map(x => Number(x.id))
	if (!c1.length) { console.log('  （第 1 步无候选，跳过）'); continue }
	const A = c1[0]
	info('基准=' + nm(base) + '(' + base + ') 第 1 步候选', c1.map(x => nm(x)))

	/* ① 第 2 步候选：ask2 里选"再发起一次" */
	const step2 = eff(g, 'axis', ctx, 1, { step: 'ask2', desc1: '首次：' + nm(A), used: A })
	const c2 = (step2 && step2.candidates || []).map(x => Number(x.id))
	info('第 2 步候选', c2.map(x => nm(x)))

	flag('★ 第 2 步候选【包含】首次地区（允许重复）',
		step2 && Array.isArray(step2.candidates) && c2.indexOf(A) >= 0,
		'首次=' + nm(A) + '(' + A + ') 候选=' + JSON.stringify(c2))
	flag('第 2 步候选未被过滤（与第 1 步等量）',
		c2.length === c1.length, '第1步=' + c1.length + ' 第2步=' + c2.length)

	/* ② 执行步接受同一地区（不得出现"不能与第 1 次"这类拦截） */
	const exec = eff(g, 'axis', ctx, A, { step: c.step, desc1: '首次：' + nm(A), used: A })
	info('直接对首次地区执行第 2 步的返回', exec && exec.desc)
	flag('★ 执行步不拒绝同一地区',
		!(exec && /不能与第 1 次选择同一地区/.test(exec.desc || '')),
		exec && exec.desc)
}

console.log('\n发现 BUG 项 = ' + bad)
