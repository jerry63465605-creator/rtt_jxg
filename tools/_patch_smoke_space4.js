/* 真正把发起单位摆上（锚点：g.table = { '德国': [statusCard] }） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '_smoke_s1_status_cost.js')
let s = fs.readFileSync(p, 'utf8')
const MARK = "g.table = { '德国': [statusCard] }"
if (s.indexOf("g.location['de_a1']") < 0) {
	const block = [
		MARK,
		'\t/* 【2026-11-04 S2-b】15245 的 run 需要合法的发起单位（摆前提，不是冒充建设） */',
		'\tg.location = g.location || {}',
		'\tg.piece_nation = g.piece_nation || {}',
		'\tg.piece_type = g.piece_type || {}',
		"\tg.location['de_a1'] = d.id_of('德国')",
		"\tg.piece_nation['de_a1'] = '德国'",
		"\tg.piece_type['de_a1'] = 'army'",
	].join('\n')
	s = s.replace(MARK, block)
	fs.writeFileSync(p, s, 'utf8')
	console.log('inserted army: true')
} else {
	console.log('skip: army already there')
}
