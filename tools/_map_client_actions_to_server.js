/* 校验：客户端能发出的每个动作，服务端（rules.js）是否都有 handler */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const lo = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const rules = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

const acts = [...new Set([...lo.matchAll(/send_action\(\s*["']([a-z0-9_]+)["']/g)].map(m => m[1]))].sort()
const handlers = new Set([...rules.matchAll(/action === ['"]([a-z0-9_]+)['"]/g)].map(m => m[1]))

const missing = acts.filter(a => !handlers.has(a))
console.log('客户端动作数 = ' + acts.length + '；服务端 handler 数 = ' + handlers.size)
console.log('客户端发但服务端无 handler（会白名单/未知动作报错）: ' + (missing.length ? missing.join(', ') : '无 ✅'))

/* 反向：服务端有 handler 但客户端从不发（可能由 query/内部调用，或前端缺失） */
const never = [...handlers].filter(h => !acts.includes(h)).sort()
console.log('\n服务端有、客户端从不直接发（' + never.length + ' 个）:')
console.log('  ' + never.join(', '))
