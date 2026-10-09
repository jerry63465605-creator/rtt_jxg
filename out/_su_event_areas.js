const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const d = require(path.join(MOD, 'data.js')).data
const names = ['莫斯科','罗斯','拉丁美洲','海参崴','中国东北','中国东部','蒙古','日本','东欧','巴尔干','西伯利亚','中国','东海','北海','不列颠','西欧','乌克兰','中东','非洲北部','东南亚','印度','印度尼西亚','新几内亚','南海','澳大利亚','加拿大','印度']
names.forEach(n => {
  const id = d.id_of(n)
  const ok = id != null && d.spaces[id]
  console.log((ok ? 'OK ' : 'XX ').padEnd(3), n.padEnd(8), ok ? ('id=' + id + ' terrain=' + d.spaces[id].terrain) : 'NOT FOUND')
})
