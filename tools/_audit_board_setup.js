/*
 * 守卫：建盘脚本必须走 `_board_lib.new_board()`（= 已含六国「摸10弃3」初设）
 *
 * 违规判定：脚本里出现 `R.setup(` 且没有 `new_board(`
 *   → 这种脚本建出来的盘面手牌是 10 张（未弃 3），与真实开局不符。
 *
 * 用法：node tools/_audit_board_setup.js        退出码 0=全合规，1=有违规
 */
const fs = require('fs')
const path = require('path')
const DIR = path.join(__dirname)

const files = fs.readdirSync(DIR).filter(f => /^_mk_board.*\.js$/.test(f) && f !== '_board_lib.js')
/* 历史脚本（2026-09 一次性建盘，仅归档、不再运行）—— 明确豁免，避免噪音 */
const LEGACY = new Set(['_mk_board_7.js', '_mk_board_final.js'])
const violations = []
const okFiles = []
const legacySkip = []

for (const f of files) {
	const src = fs.readFileSync(path.join(DIR, f), 'utf8')
	const bareSetup = /R\.setup\(/.test(src)
	const usesLib = /new_board\(/.test(src)
	const libRequire = /require\(['"]\.\/_board_lib['"]\)/.test(src)
	/* 自己手写 opening_discard 也算合规（等价于 new_board 的初设） */
	const manualOpening = /opening_discard/.test(src)
	if (LEGACY.has(f)) { legacySkip.push(f); continue }
	if (bareSetup && !usesLib && !manualOpening) violations.push({ f, why: '裸调 R.setup() 且既没用 new_board() 也没手写 opening_discard → 手牌会停在 10 张' })
	else if (usesLib && !libRequire) violations.push({ f, why: '用了 new_board() 却没 require _board_lib（可能同名自定义）' })
	else okFiles.push(f)
}

console.log('=== 建盘脚本初设合规审计 ===')
console.log('合规 ' + okFiles.length + ' 个：' + (okFiles.join(', ') || '(无)'))
if (violations.length) {
	console.log('\n✗ 违规 ' + violations.length + ' 个：')
	for (const v of violations) console.log('  ' + v.f + ' —— ' + v.why)
	console.log('\n修法：把 `const g = R.setup(seed)` 换成')
	console.log("      const L = require('./_board_lib')")
	console.log("      const g = L.new_board(seed, { nation: '美国', phase: 'play' })")
	console.log('（new_board 内部已完成 setup + 六国摸 10 弃 3）')
} else {
	console.log('\n✅ 全部合规：建盘脚本都走 new_board()，初设弃 3 不会漏。')
}
process.exitCode = violations.length ? 1 : 0
