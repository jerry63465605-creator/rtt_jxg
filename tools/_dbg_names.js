const path = require('path')
const M = path.resolve('server-official/public/quartermaster-sub-wars')
const d = require(path.join(M, 'data.js')).data
/* 找所有非补给点且非home_base的地区名 */
const cands = d.spaces.filter(s => s && s.name && !s.star && !s.home_base)
	.map(s => s.name).slice(0, 20)
console.log('非补给点候选:', JSON.stringify(cands))
console.log('中国:', d.spaces.find(s => s && s.name && s.name.includes('中国')) ? 'found' : 'not found')
