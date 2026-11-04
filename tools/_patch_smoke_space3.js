/* 在 setup 里真正插入 __test_target 计算（上一版因 CRLF 未命中） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '_smoke_s1_status_cost.js')
let s = fs.readFileSync(p, 'utf8')

const MARK = '/* 武装窗口：after_land（刚发起陆战） */'
if (!/_gerSpace/.test(s) && s.indexOf(MARK) >= 0) {
	const block = [
		'/* 【2026-11-04 S2-b】目标格必须"没有本方部队"（预检会拦）→ 取德国的空陆地相邻格做空打 */',
		"\tconst _ger = d.id_of('德国')",
		'\tconst _gerSpace = I.get_connections(g, _ger, \'axis\').find(x =>',
		'\t\td.spaces[x] && d.spaces[x].terrain !== \'sea\' &&',
		'\t\t!I.pieces_on(g, x).length)',
		'\tg.__test_target = (_gerSpace != null ? _gerSpace : _ger)',
		'\tconsole.log(\'  [setup] 目标格 = \' + d.name_of(g.__test_target) + \'  from=de_a1@\' + d.name_of(g.location["de_a1"]))',
		'\t',
	].join('\n')
	s = s.replace(MARK, block + MARK)
	fs.writeFileSync(p, s, 'utf8')
	console.log('inserted:', /_gerSpace/.test(s))
} else {
	console.log('skip: already inserted or mark missing')
}
