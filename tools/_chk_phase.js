const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const fs = require('fs')
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

/* PHASES 定义 */
const m = src.match(/const PHASES = \[[\s\S]*?\]/)
console.log('=== PHASES ===')
console.log(m ? m[0] : '(未找到)')

/* turn_phase 的赋值处 */
console.log('\n=== turn_phase 赋值 ===')
;[...src.matchAll(/turn_phase\s*=\s*['"](\w+)['"]/g)].forEach(x => console.log('  ' + x[1]))

/* 摸牌逻辑 */
console.log('\n=== 摸牌（draw）相关 ===')
;[...src.matchAll(/function \w*draft\w*|function \w*draw\w*|摸牌/g)].slice(0, 10)
	.forEach(x => console.log('  ' + x[0]))
