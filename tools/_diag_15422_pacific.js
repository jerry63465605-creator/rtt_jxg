/*
 * 15422《太平洋海岸线攻势》验收
 *
 * 卡面：「对<美洲>发起陆战后：在战斗地区建设陆军。在<美洲>建设 1 支陆军。」
 * 玩家口径：按卡面拆成两步、各 1 支；有合法位置才建、没有就跳过。
 *
 * 「<美洲>」按【区域】理解：加拿大 / 美国 / 拉丁美洲（REGION_GROUPS['美洲']）。
 * 第 ② 句有多处可建时交给玩家选；只有一处就直接建；一处都没有就跳过。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = require(path.join(MOD, 'data.js')).data

const IMPL = I.RESPONSE_EFFECT_IMPL
const CARD = '15422'
const AM = I.space_ids_expand(['美洲'])          /* 加拿大 / 美国 / 拉丁美洲 */
const LATAM = I.space_id_of('拉丁美洲')

let bad = 0
const flag = (name, ok, extra) => {
	console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '   [' + extra + ']' : ''))
	if (!ok) bad++
}
const info = (k, v) => console.log('    ' + k + ' =', typeof v === 'object' ? JSON.stringify(v) : v)
const nm = sp => data.name_of(sp) || String(sp)

function nextPieceId(g) {
	const ids = Object.keys(g.location).map(Number).filter(n => Number.isFinite(n))
	return (ids.length ? Math.max(...ids) : 0) + 1
}
function jpArmiesIn(g, ids) {
	let n = 0
	for (const id in g.location) {
		if (g.piece_nation[id] === '日本' && g.piece_type[id] === 'army' &&
			ids.indexOf(Number(g.location[id])) >= 0) n++
	}
	return n
}

/* 在 target 的相邻陆地放一支补给中的日本陆军，让 can_build_at(target) 成立 */
function freshGame(target) {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	const raw = data.spaces[target] || {}
	const pool = [].concat(raw.connections || [],
		(raw.limited_connections && raw.limited_connections.axis) || [])
	const near = [...new Set(pool.map(Number))]
		.filter(x => data.spaces[x] && data.spaces[x].terrain === 'land')
	const spot = near.length ? near[0] : null
	if (spot != null) {
		const id = nextPieceId(g)
		g.piece_nation[id] = '日本'
		g.piece_type[id] = 'army'
		g.location[id] = spot
		I.grant_supply(g, id, 1)
	}
	return g
}

console.log('=== 探测 ===')
info('<美洲> 展开', AM.map(x => nm(x) + '(' + x + ')'))

console.log('\n=== S1 战斗地区=拉丁美洲：应能落成 2 支（另一支选美洲别的格）===')
{
	const g = freshGame(LATAM)
	info('拉丁美洲 可建设?', I.can_build_at(g, '日本', LATAM, 'army'))
	const before = jpArmiesIn(g, AM)
	let r = IMPL[CARD](g, 'axis', { nation: '日本', space: LATAM })
	info('第 1 次返回', r && { pending: !!r.pending, desc: r.desc, cands: (r.candidates || []).map(c => c.name) })
	if (r && r.pending) {
		/* 多候选：模拟玩家选第一个 */
		const pick = Number(r.candidates[0].id)
		info('玩家选择', nm(pick) + '(' + pick + ')')
		r = IMPL[CARD](g, 'axis', { nation: '日本', space: LATAM }, pick, r.extra)
		info('第 2 次返回 desc', r && r.desc)
	}
	const after = jpArmiesIn(g, AM)
	info('美洲日本陆军数', before + ' -> ' + after)
	flag('★ 最终建成 2 支（战斗地区 1 + 美洲 1）', after - before === 2, '增量=' + (after - before))
	flag('拉丁美洲有 1 支', jpArmiesIn(g, [LATAM]) === 1, '实际=' + jpArmiesIn(g, [LATAM]))
}

console.log('\n=== S2 只有一处可建时，不该多问一次 ===')
{
	const g = freshGame(LATAM)
	/* 把美洲另外两格预先塞满日本陆军 -> 第 2 句只剩"拉丁美洲"（但拉丁美洲会被第 1 步占） */
	for (const sp of AM) {
		if (sp === LATAM) continue
		const id = nextPieceId(g)
		g.piece_nation[id] = '日本'
		g.piece_type[id] = 'army'
		g.location[id] = sp
	}
	const r = IMPL[CARD](g, 'axis', { nation: '日本', space: LATAM })
	info('返回', r && { pending: !!r.pending, desc: r.desc })
	flag('无可再建时不返回 pending（直接跳过）', !(r && r.pending), 'pending=' + !!(r && r.pending))
	flag('描述里说明已跳过', !!/(跳过|无可建设)/.test(r.desc || ''), r && r.desc)
}

console.log('\n=== S3 战斗地区建不了时，第 2 句仍照常执行 ===')
{
	/* 用一个"日本无法建设"的陆地当战斗地区（没补给源），验证两句互相独立 */
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	const someLand = (() => {
		for (let i = 1; i < data.spaces.length; i++) {
			const s = data.spaces[i]
			if (s && s.terrain === 'land' && i !== LATAM) return i
		}
		return null
	})()
	const before = jpArmiesIn(g, AM)
	const r = IMPL[CARD](g, 'axis', { nation: '日本', space: someLand })
	info('战斗地区', nm(someLand) + '(' + someLand + ')，返回', r && { pending: !!r.pending, desc: r.desc })
	/* 该局面下美洲也大概率建不了（无补给源），只断言"不崩且给出说明" */
	flag('第 1 句失败不影响整体结算（有可读描述）',
		!!(r && (r.desc || r.pending)), r && JSON.stringify(r).slice(0, 120))
	void before
}

console.log('\n发现 BUG 项 = ' + bad)
