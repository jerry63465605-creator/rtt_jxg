/* 合并后自检：关键修复是否都在 + play.html 的外链与版本串 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')

const MARKS = [
	['qm_piece_snapshot（外部交付：棋子快照）', /function qm_piece_snapshot/],
	['qm_log_piece_diff（外部交付：棋子差分日志）', /function qm_log_piece_diff/],
	['hand_viewer_for（本地：手牌保密收口）', /function hand_viewer_for/],
	['同阵营放行（外部：同阵营看牌面）', /faction_of_nation\(n\) === _myFaction/],
	['15315 连带空军', /随陆军一起被消灭的空军/],
	['雷达声明式 ready', /只有【美国海军】被移除的那一刻才武装/],
	['义勇军×预算死锁', /resolve_japan_delegate: 1/],
	['大清洗阵营过滤', /su_17817_pending && faction_of_nation/],
	['云雾 原地移除', /_airNoRetreat/],
]
console.log('=== rules.js 标记 ===')
for (const [n, re] of MARKS) console.log('  ' + (re.test(rules) ? '✅' : '❌') + ' ' + n)
console.log('  冲突标记残留: ' + (rules.match(/^(<<<<<<<|=======|>>>>>>>)/gm) || []).length)

console.log('\n=== play.html ===')
console.log('  版本串: ' + JSON.stringify([...new Set([...html.matchAll(/\?v=([0-9a-z]+)/g)].map(m => m[1]))]))
const refs = [...html.matchAll(/(?:href|src)=["']([^"']+\.(?:css|js))[^"']*["']/g)].map(m => m[1])
console.log('  引用的资源:'); refs.forEach(r => console.log('    ' + r))
console.log('  冲突标记残留: ' + (html.match(/^(<<<<<<<|=======|>>>>>>>)/gm) || []).length)
