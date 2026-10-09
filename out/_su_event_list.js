const fs = require('fs')
const RULES = 'c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/rules.js'
const C = require(RULES.replace('/rules.js', '/cards.js'))
const su = C.CARDS.filter(c => c.nation === '苏联')
const ev = su.filter(c => c.type === 'EVENT')
console.log('苏联 EVENT 卡数:', ev.length)
ev.forEach(c => console.log('  ' + String(c.id).padEnd(6), (c.name||'').padEnd(14), '| ' + (c.text||'').slice(0,110)))

// 检查 rules.js 中这些 id 是否有实现（EVENT 配置或特例）
const src = fs.readFileSync(RULES, 'utf8')
console.log('\n--- rules.js 中苏联 EVENT id 出现情况 ---')
ev.forEach(c => {
  const re = new RegExp("'" + String(c.id) + "'", 'g')
  const cnt = (src.match(re) || []).length
  console.log('  ' + String(c.id).padEnd(6), '出现 ' + cnt + ' 次', cnt > 0 ? '已实现?' : 'XX未')
})
