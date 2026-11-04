/*
 * 修正 _smoke_s1_status_cost 的局面：
 *   15245 的预检会拒绝"目标格只有本方部队"。原局面把发起单位放在德国、目标也是德国 → 被拦。
 * 改为：发起单位@德国，目标 = 德国的某个【空陆地相邻格】（空打合法），window 也用该格。
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '_smoke_s1_status_cost.js')
let s = fs.readFileSync(p, 'utf8')

/* 1) setup 里算一个空陆地相邻格，挂到 g 上供后续用 */
if (!/_gerSpace/.test(s)) {
	s = s.replace(
		"\tI.refresh(g)\n\tI.grant_supply(g, 'de_a1', g.turn)\n\tI.refresh(g)",
		`\tI.refresh(g)
\tI.grant_supply(g, 'de_a1', g.turn)
\tI.refresh(g)
\t/* 【2026-11-04 S2-b】目标格必须"没有本方部队"（预检会拦），取德国的空陆地相邻格做空打 */
\tconst _ger = d.id_of('德国')
\tconst _gerSpace = I.get_connections(g, _ger, 'axis').find(x =>
\t\td.spaces[x] && d.spaces[x].terrain !== 'sea' &&
\t\t!I.pieces_on(g, x).length)
\tg.__test_target = (_gerSpace != null ? _gerSpace : _ger)`
	)
}

/* 2) window 与 activate 的 space 都用 __test_target */
s = s.split("I.arm_status_instant(g, 'after_land', '德国', d.id_of('德国'))")
	.join("I.arm_status_instant(g, 'after_land', '德国', g.__test_target)")
s = s.split("space: d.id_of('德国'), from: 'de_a1'")
	.join("space: g.__test_target, from: 'de_a1'")

fs.writeFileSync(p, s, 'utf8')
console.log('patched:', /__test_target/.test(s))
