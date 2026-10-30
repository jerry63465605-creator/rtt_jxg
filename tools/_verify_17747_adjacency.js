/*
 * 验证：<西欧>-<非洲北部> 的轴心专属相邻**只能来自 17747《西班牙控制直布罗陀》**。
 *
 *   ① 新局（无卡）：axis / allies 都不相邻
 *   ② 打出 17747（写入 game.status_connections）：axis 相邻、allies 仍不相邻
 *   ③ 17744《土耳其开放海峡》两对边同机制，行为不受影响
 *
 * 用法：node tools/_verify_17747_adjacency.js
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const d = I.data

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m + (extra ? '  ' + extra : '')) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  ' + extra : '')) }
}
const id = nm => d.id_of(nm)
const WE = id('西欧'), NA = id('非洲北部')

function fresh() {
	const g = rules.setup(1)
	g.opening = null
	I.refresh && I.refresh(g)
	return g
}
const linked = (g, a, b, side) => I.get_connections(g, a, side).indexOf(b) >= 0

console.log('\n=== ① 新局：不应相邻 ===')
{
	const g = fresh()
	ok('axis 西欧↛非洲北部', !linked(g, WE, NA, 'axis'))
	ok('axis 非洲北部↛西欧', !linked(g, NA, WE, 'axis'))
	ok('allies 西欧↛非洲北部', !linked(g, WE, NA, 'allies'))
	ok('data 里西欧没有 axis 私有表', !(d.spaces[WE].limited_connections || {}).axis)
	ok('data 里非洲北部没有 axis 私有表', !(d.spaces[NA].limited_connections || {}).axis)
}

console.log('\n=== ② 打出 17747 后：仅轴心相邻 ===')
{
	const g = fresh()
	const cfg = I.STATUS_EFFECTS['17747']
	ok('17747 配置存在且为 pair_adjacency',
		!!(cfg && cfg.ongoing && cfg.ongoing.kind === 'pair_adjacency'))
	/* 直接按卡配置写入永久成对邻接（等价于 apply_status_ongoing 的 pair_adjacency 分支） */
	g.status_connections = g.status_connections || []
	for (const pr of cfg.ongoing.pairs) {
		g.status_connections.push({ a: id(pr[0]), b: id(pr[1]), side: cfg.ongoing.only })
	}
	I.refresh && I.refresh(g)
	ok('axis 西欧↔非洲北部 相邻', linked(g, WE, NA, 'axis') && linked(g, NA, WE, 'axis'))
	ok('allies 西欧↛非洲北部（"仅对友方"= 仅轴心）', !linked(g, WE, NA, 'allies'))
	ok('axis 北海↔地中海 相邻（17747 另一对）',
		linked(g, id('北海'), id('地中海'), 'axis'))
}

console.log('\n=== ③ 17744 两对边不受影响 ===')
{
	const g = fresh()
	ok('新局 axis 黑海↛地中海', !linked(g, id('黑海'), id('地中海'), 'axis'))
	ok('新局 axis 巴尔干↛中东', !linked(g, id('巴尔干'), id('中东'), 'axis'))
	const cfg = I.STATUS_EFFECTS['17744']
	g.status_connections = g.status_connections || []
	for (const pr of cfg.ongoing.pairs)
		g.status_connections.push({ a: id(pr[0]), b: id(pr[1]), side: cfg.ongoing.only })
	I.refresh && I.refresh(g)
	ok('打出 17744 后 axis 黑海↔地中海 相邻', linked(g, id('黑海'), id('地中海'), 'axis'))
	ok('打出 17744 后 axis 巴尔干↔中东 相邻', linked(g, id('巴尔干'), id('中东'), 'axis'))
	ok('allies 仍不能走巴尔干↔中东', !linked(g, id('巴尔干'), id('中东'), 'allies'))
}

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
