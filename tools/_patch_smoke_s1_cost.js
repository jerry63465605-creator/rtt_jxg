/* 让 _smoke_s1_status_cost 提供合法的 space/from（S2-b 后"缺参数"会在付代价前被拦） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '_smoke_s1_status_cost.js')
let s = fs.readFileSync(p, 'utf8')

/* ① setup 里补一支德国陆军（供 15245 的 from 使用） */
if (!/de_a1/.test(s)) {
	s = s.replace(
		"\tI.refresh(g)\n\t/* 武装窗口：after_land（刚发起陆战） */",
		`\t/* 【2026-11-04 S2-b】15245 的 run 需要合法的发起单位，补一支德国陆军（摆前提，不冒充"建设"） */
\tg.location = g.location || {}
\tg.piece_nation = g.piece_nation || {}
\tg.piece_type = g.piece_type || {}
\tg.location['de_a1'] = d.id_of('德国')
\tg.piece_nation['de_a1'] = '德国'
\tg.piece_type['de_a1'] = 'army'
\tI.refresh(g)
\tI.grant_supply(g, 'de_a1', g.turn)
\tI.refresh(g)
\t/* 武装窗口：after_land（刚发起陆战） */`
	)
}

/* ② 三处 activate_status 补 space/from */
s = s.split("R.action(g, 'Axis', 'activate_status', { card: '15245#1' })")
	.join("R.action(g, 'Axis', 'activate_status', { card: '15245#1', space: d.id_of('法国'), from: 'de_a1' })")

fs.writeFileSync(p, s, 'utf8')
console.log('patched:',
	/de_a1/.test(s) ? 'army ok' : 'army miss',
	(s.match(/space: d\.id_of\('法国'\), from: 'de_a1'/g) || []).length + ' 处 activate 已补参')
