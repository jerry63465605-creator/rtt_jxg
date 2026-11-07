/* 15311 卡面文案按实现（待命触发）改写；顺带核对 17836 情况 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js')
let s = fs.readFileSync(P, 'utf8')
const OLD = '"text": "任意时机，弃置 4 张手牌：<西欧>的法国陆军在本回合内不会被移除。"'
const NEW = '"text": "<西欧>的法国陆军将被移除时，弃置 4 张手牌：使其在本回合内不会被移除。"'
if (s.indexOf(OLD) < 0) {
	const m = s.match(/"id": 15311[\s\S]{0,400}?"text": "([^"]*)"/)
	console.log('未精确匹配，当前文案 = ' + (m ? m[1] : '(未找到)'))
} else {
	s = s.split(OLD).join(NEW)
	fs.writeFileSync(P, s, 'utf8')
	console.log('✓ 15311 文案已改为待命口径')
}
const m2 = s.match(/"id": 17836[\s\S]{0,500}?"type": "(\w+)"[\s\S]{0,200}?"text": "([^"]*)"/)
console.log('17836 现状 = ' + (m2 ? m2[1] + ' | ' + m2[2] : '(未匹配)'))
