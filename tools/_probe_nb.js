/* 查 33/39/42 的邻居，确定 ask2 第二块可建陆地的布置点 */
const path = require('path')
const data = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js')).data
function nb(id) { return (data.spaces[id] && data.spaces[id].connections) || [] }
for (const id of [33, 39, 42, 35]) {
  const sp = data.spaces[id]
  console.log(id, sp ? sp.name + '[' + sp.terrain + ']' : '?', '邻居=', nb(id).map(c => c + ':' + (data.spaces[c] ? data.spaces[c].name : '?')))
}
