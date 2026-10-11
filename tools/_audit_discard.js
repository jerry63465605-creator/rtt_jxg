const path = require('path')
const fs = require('fs')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { CARDS } = require(path.join(DIR, 'cards.js'))
const id2card = {}
CARDS.forEach(c => { id2card[String(c.id)] = c })

const SE = rules._internal.STATUS_EFFECTS
const ORDER = ['英国', '德国', '日本', '苏联', '意大利', '美国']
let buf = ''
for (const nat of ORDER) {
  const list = []
  for (const id of Object.keys(SE)) {
    const cfg = SE[id]
    const card = id2card[id]
    if (!card || card.nation !== nat) continue
    for (const kind of ['trigger', 'auto', 'ongoing', 'react']) {
      const c = cfg[kind]
      if (!c) continue
      if (!c.cost && !c.window && !c.when && !c.phase && !c.tag) continue
      const cost = c.cost || {}
      list.push({
        id, kind,
        window: c.window || (c.phase ? ('phase:' + c.phase) : (c.when ? ('when:' + c.when) : (c.tag ? ('tag:' + c.tag) : '-'))),
        cost: Object.keys(cost).length ? JSON.stringify(cost) : '(无代价)',
        text: card.text || ''
      })
    }
  }
  buf += '\n===== ' + nat + '（共 ' + list.length + ' 条）=====\n'
  list.forEach(r => {
    const hasQi = /弃/.test(r.text)
    const hasSun = /损耗|损失/.test(r.text)
    buf += '\n' + r.id + ' [' + r.kind + '] window=' + r.window + '\n'
    buf += '  代价: ' + r.cost + '\n'
    buf += '  卡面含弃置=' + hasQi + ' 含损耗=' + hasSun + '\n'
    buf += '  卡面text: ' + r.text + '\n'
  })
}
fs.writeFileSync(path.join(__dirname, '_audit_discard.out'), buf, 'utf8')
console.log('WROTE ' + buf.length + ' chars')
