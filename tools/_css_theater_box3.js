/* 补齐：#event_step_box .eb-title/.eb-hint/.eb-log/button.action 四组也加上 #theater_box */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.css')
let s = fs.readFileSync(p, 'utf8')
const before = (s.match(/#theater_box/g) || []).length

s = s.replace(/(#event_step_box (?:\.eb-title|\.eb-hint|\.eb-log|button\.action),)(\r?\n)/g,
	(m, sel, nl) => sel + nl + sel.replace('#event_step_box ', '#theater_box ') + nl)

fs.writeFileSync(p, s, 'utf8')
const after = (s.match(/#theater_box/g) || []).length
console.log('theater_box 出现次数 ' + before + ' -> ' + after)
