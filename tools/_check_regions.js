const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const d = require(path.join(MOD, 'data.js')).data
const names = ['地中海', '非洲北部', '非洲东部', '意大利', '罗斯', '乌克兰', '巴尔干']
for (const n of names) {
  const id = d.id_of(n)
  console.log((id != null ? 'OK ' : 'MISSING ') + n + ' -> ' + id)
}
