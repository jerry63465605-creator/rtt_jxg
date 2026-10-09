const base = require('path').join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const d = require(base + '/data.js').data

// 列出全部空格
console.log('=== 全部空格 (id : name : terrain : supply) ===')
for (let i = 1; i < d.spaces.length; i++) {
  const s = d.spaces[i]
  if (!s) continue
  console.log(i + ' : ' + s.name + ' : ' + (s.terrain || 'land') + ' : ' + (s.supply ? 'supply' : 'no'))
}

// 检查德国卡用到的地名能否解析（含文档映射后）
const names = ['波兰','东欧','捷克斯洛伐克','奥地利','波罗的海','北欧','西欧','法国','巴尔干','中东','中亚','乌克兰','北海','亚速尔','印度洋']
console.log('\n=== 地名解析 id_of ===')
for (const n of names) console.log(n + ' : ' + d.id_of(n))
