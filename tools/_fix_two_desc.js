/* 按玩家口径扩宽两条触发条件：#15 实例/面 id；#16 阵营/国家名 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const SK = path.join(os.homedir(), '.codebuddy', 'skills')

const NEW = {
	'rtt-card-id-face': 'RTT 卡牌身份判定：凡涉及【实例 id（15430#1）与面 id（15430）】区分时用（response_queue、pending_*、request_responses、建设结算、候选列表、日志回查）；混用会静默错配。',
	'rtt-faction-case': 'RTT 阵营/国家名铁律：凡涉及【阵营 axis/allies 与国家名字符串】时用（game.score/active/winner、response_queue.owner_side、view.current_faction）；大小写或字段混用会静默丢分。',
}

for (const [name, desc] of Object.entries(NEW)) {
	const f = path.join(SK, name, 'SKILL.md')
	if (!fs.existsSync(f)) { console.log('skip ' + name); continue }
	let t = fs.readFileSync(f, 'utf8')
	const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/)
	if (!m) { console.log('no fm ' + name); continue }
	const fm = m[1]
	const lines = fm.split(/\r?\n/)
	const i = lines.findIndex(l => /^description:/.test(l))
	if (i < 0) { console.log('no desc ' + name); continue }
	/* 删掉 description 及其缩进续行 */
	let end = i + 1
	while (end < lines.length && !/^[A-Za-z_]+:/.test(lines[end])) end++
	const oldLen = lines.slice(i, end).join(' ').replace(/^description:\s*[>|][+-]?\s*/, '').replace(/\s+/g, ' ').trim().length
	const newFm = lines.slice(0, i).concat(['description: ' + desc], lines.slice(end)).join('\n')
	const out = t.replace(fm, newFm)
	fs.writeFileSync(f, out, 'utf8')
	console.log('✓ ' + name.padEnd(22, ' ') + String(oldLen).padStart(4) + ' → ' + String(desc.length).padStart(3) + ' 字')
}
