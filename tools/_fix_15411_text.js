/* 15411 卡面文案改为「日本回合开始时…」（去掉"任意时机"；目标不再限"无补给"） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js')
let s = fs.readFileSync(P, 'utf8')
const OLD = '"text": "任意时机，弃置1张[响应卡]，选择1支日本陆军或海军：其在本回合内总是处于补给状态。"'
const NEW = '"text": "日本回合开始时，弃置1张[响应卡]，选择1支日本陆军或海军：其在本回合内总是处于补给状态。"'
if (s.indexOf(OLD) < 0) {
	const m = s.match(/"id": 15411[\s\S]{0,400}?"text": "([^"]*)"/)
	console.log('未精确匹配；当前文案 = ' + (m ? m[1] : '(未找到)'))
} else {
	fs.writeFileSync(P, s.split(OLD).join(NEW), 'utf8')
	console.log('✓ 15411 文案已改')
}
