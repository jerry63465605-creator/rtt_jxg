/*
 * 「1 或 2 次」多步响应卡：第 2 次不能落回同一地区。
 *
 * 覆盖（都是"日本建设/发起后"的同族卡）：
 *   15423 潜艇支援        —— 1 或 2 次海战
 *   15424 海军特别陆战队  —— 1 或 2 支陆军（建设）
 *   15425 海军空降部队    —— 1 或 2 次陆战   ← 原「方案 A 允许同一地区」，2026-10-26 改为排除
 *   15426 驱逐舰运输      —— 1 或 2 支陆军（建设）
 *
 * 两层判据：
 *   ① 候选层：eff(..., choice=1, {step:第2步, used:A}) 返回的 candidates 不含 A
 *   ② 执行层：eff(..., choice=A, {step:第2步, used:A}) 被拒（防客户端旧高亮 / 伪造提交）
 *
 * 直接调 RESPONSE_EFFECT_IMPL 做单元级验证，不依赖战斗能否打成，
 * 避免"海战没打起来"掩盖真正的候选逻辑。
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

/* 找一个相邻"同类地形"≥2 的基准地区 */
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
	{ face: '15423', name: '潜艇支援',       pool: SEA_POOL,  step: 'battle2', label: '海域' },
	{ face: '15424', name: '海军特别陆战队', pool: LAND_POOL, step: 'region2', label: '地区' },
	{ face: '15425', name: '海军空降部队',   pool: LAND_POOL, step: 'battle2', label: '地区' },
	{ face: '15426', name: '驱逐舰运输',     pool: LAND_POOL, step: 'region2', label: '地区' },
]

for (const c of CASES) {
	console.log('\n=== ' + c.face + ' ' + c.name + '（第 2 步 ' + c.step + '） ===')
	const eff = IMPL[c.face]
	if (typeof eff !== 'function') {
		console.log('  （未实现，跳过）')
		continue
	}
	const base = findBase(c.pool)
	if (base == null) {
		console.log('  （找不到候选 ≥2 的基准地区，跳过）')
		continue
	}
	const g = freshGame()
	const ctx = { nation: '日本', space: base }

	/* 第 1 步：拿到候选，取第一个作为"首次地区" */
	const first = eff(g, 'axis', ctx, undefined)
	const c1 = (first && first.candidates || []).map(x => Number(x.id))
	info('基准=' + nm(base) + '(' + base + ') 第 1 步候选', c1.map(x => nm(x)))
	if (!c1.length) { console.log('  （第 1 步无候选，跳过）'); continue }
	const A = c1[0]

	/* ① 第 2 步候选：ask2 分支里选"再发起一次"，才会生成第 2 步的地区候选 */
	const step2 = eff(g, 'axis', ctx, 1, { step: 'ask2', desc1: '首次：' + nm(A), used: A })
	const c2 = (step2 && step2.candidates || []).map(x => Number(x.id))
	info('第 2 步候选', c2.map(x => nm(x)))
	flag('★ 第 2 步候选排除首次地区',
		step2 && Array.isArray(step2.candidates) && c2.indexOf(A) < 0,
		'首次=' + nm(A) + '(' + A + ') 候选=' + JSON.stringify(c2))
	flag('第 2 步仍有其它可选地区（不是被清空）',
		c2.length > 0, '候选数=' + c2.length)

	/* ② 执行层二次校验：伪造提交首次地区（走执行步 battle2/region2） */
	const blocked = eff(g, 'axis', ctx, A, { step: c.step, desc1: '首次：' + nm(A), used: A })
	info('伪造提交首次地区的返回', blocked && blocked.desc)
	flag('★ 服务端二次校验拒绝同一地区',
		!!(blocked && /不能与第 1 次选择同一地区/.test(blocked.desc || '')),
		blocked && blocked.desc)

	/* ③ used 透传：第 2 步返回的 extra 必须带着 used，供执行步校验 */
	flag('第 2 步 extra 透传 used（step=' + c.step + '）',
		!!(step2 && step2.extra && Number(step2.extra.used) === Number(A)),
		step2 && JSON.stringify(step2.extra))
}

console.log('\n发现 BUG 项 = ' + bad)
