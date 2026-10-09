const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const d = require(path.join(MOD, 'data.js')).data

// 找德国大本营：home_base 为 true 且名为 德国
let hb = d.id_of('德国')
console.log('德国 id =', hb, 'home_base =', d.spaces[hb].home_base, 'name =', d.name_of(hb))
console.log('home connections =', (d.spaces[hb].connections || []).map(i => d.name_of(i)))

const targets = ['西欧','北海','北大西洋','巴尔干','黑海','中东','波罗的海','北欧','东欧','意大利','冰岛','亚速尔','乌克兰','中亚','不列颠','罗斯','法国']
for (const t of targets) {
  const id = d.id_of(t)
  if (id == null) { console.log(t + ' : NOT FOUND'); continue }
  const conns = (d.spaces[id].connections || []).map(i => d.name_of(i))
  const adjHome = (d.spaces[id].connections || []).filter(n => (d.spaces[n].connections||[]).indexOf(hb) >= 0).map(i => d.name_of(i))
  console.log(t + '(' + id + ') conn=' + JSON.stringify(conns) + ' adjHome=' + JSON.stringify(adjHome))
}
