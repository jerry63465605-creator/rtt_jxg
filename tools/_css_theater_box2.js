/* 用正则把 #theater_box 插到每个含 #event_step_box 的选择器组里（兼容 CRLF） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.css')
let s = fs.readFileSync(p, 'utf8')
const before = (s.match(/#theater_box/g) || []).length

/* ① 普通选择器：#event_step_box,  ->  #event_step_box,\r\n#theater_box, */
s = s.replace(/(#event_step_box,)(\r?\n)/g, (m, sel, nl) => sel + nl + '#theater_box,' + nl)
/* ② .hide 组：#event_step_box.hide, */
s = s.replace(/(#event_step_box\.hide,)(\r?\n)/g, (m, sel, nl) => sel + nl + '#theater_box.hide,' + nl)

fs.writeFileSync(p, s, 'utf8')
const after = (s.match(/#theater_box/g) || []).length
console.log('theater_box 出现次数 ' + before + ' -> ' + after)
