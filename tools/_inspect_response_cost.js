/* 查：其他响应卡（15330 等）的【代价】是怎么收的？与 17853 的 su_step_back 有何不同 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const lines = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

const hits = (needle, limit = 12) => {
	const out = []
	lines.forEach((l, i) => { if (l.indexOf(needle) >= 0 && out.length < limit) out.push('L' + (i + 1) + ': ' + l.trim().slice(0, 130)) })
	return out
}
for (const k of ["action === 'trigger_response'", 'RESPONSE_COST', "15330", 'RESPONSE_IMPL', 'piece_attacked', 'su_step_back']) {
	console.log('\n=== ' + k + ' ===')
	console.log(hits(k).join('\n') || '（无）')
}
