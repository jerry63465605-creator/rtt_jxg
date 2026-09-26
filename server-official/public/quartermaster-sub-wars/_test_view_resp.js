"use strict"
const fs = require('fs')
const path = require('path')

/* 仅测试用：加载 rules.js 并暴露内部函数（不修改源文件） */
let src = fs.readFileSync(path.join(__dirname, 'rules.js'), 'utf8')
src = src.replace(/(?<!function )build_map\(\)/g, 'void 0')
src += '\n;globalThis.__T = { setup: exports.setup, view: exports.view };'
eval(src)
const T = globalThis.__T

const scenario = 'Standard'
const g = T.setup('seed-resp', scenario, {})

// 模拟桌面响应卡：2 张 axis、1 张 allies
g.table_responses = [
	{ card_id: '15330#a', owner_side: 'axis', nation: '德国' },
	{ card_id: '15332#b', owner_side: 'axis', nation: '日本' },
	{ card_id: '15334#c', owner_side: 'allies', nation: '英国' },
]

const vAxis = T.view(g, 'Axis')
const vAllies = T.view(g, 'Allies')

console.log('=== AXIS 视角 ===')
console.log('own table_responses:', JSON.stringify(vAxis.table_responses, null, 2))
console.log('opponent count:', vAxis.table_responses_opponent_count)
console.log('=== ALLIES 视角 ===')
console.log('own table_responses:', JSON.stringify(vAllies.table_responses, null, 2))
console.log('opponent count:', vAllies.table_responses_opponent_count)

let ok = true
if (vAxis.table_responses.length !== 2) { console.error('FAIL axis own=2'); ok = false }
if (vAxis.table_responses_opponent_count !== 1) { console.error('FAIL axis opp=1'); ok = false }
if (vAllies.table_responses.length !== 1) { console.error('FAIL allies own=1'); ok = false }
if (vAllies.table_responses_opponent_count !== 2) { console.error('FAIL allies opp=2'); ok = false }
const c0 = vAxis.table_responses[0]
if (!c0.type || !('img' in c0) || !('text' in c0) || !c0.name) {
	console.error('FAIL own item missing type/img/text/name'); ok = false
}
console.log(ok ? '\nALL PASS' : '\nHAS FAILURE')
