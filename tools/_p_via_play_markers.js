/* 给"打出"来源的三处派发补 via='play' + window 标记（客户端据此显示"打出"而非"触发"） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let raw = fs.readFileSync(p, 'utf8')
const crlf = raw.indexOf('\r\n') >= 0
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw
let n = 0
const rep = (a, b, label) => {
	if (s.indexOf(a) < 0) { console.log('MISS: ' + label); return }
	s = s.split(a).join(b); n++
	console.log('ok: ' + label)
}

rep("{ nation: head.nation, card: head.card, space: null }",
	"{ nation: head.nation, card: head.card, space: null, via: 'play', window: 'enemy_echo_played' }",
	'① 队列续跑')

rep("\t\t\tnation: nation, card: card_id, space: null,\n\t\t})",
	"\t\t\tnation: nation, card: card_id, space: null,\n\t\t\tvia: 'play', window: 'enemy_echo_played',\n\t\t})",
	'② arm_intercept_after_cost（15214 付完代价后开窗）')

rep("\t\t\t\t\t\tnation: nation, card: card_id, space: null,\n\t\t\t\t\t})",
	"\t\t\t\t\t\tnation: nation, card: card_id, space: null,\n\t\t\t\t\t\tvia: 'play', window: 'enemy_echo_played',\n\t\t\t\t\t})",
	'③ play_card 主路径')

fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('完成 ' + n + ' 处')
