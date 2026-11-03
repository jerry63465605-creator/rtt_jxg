// 扫描 TTS 卡包 CSV：列出每国 deck 类型分布 + 两种口径牌库总数
const fs = require('fs')
const path = require('path')
const OUT = 'c:/Users/24968/Desktop/rtt/out'
const files = { '德国': 'de_cards.csv', '英国': 'uk_cards.csv', '日本': 'ja_cards.csv', '苏联': 'su_cards.csv', '意大利': 'it_cards.csv', '美国': 'us_cards.csv' }
const BASIC_TOTAL = { '德国': 23, '英国': 24, '日本': 23, '苏联': 23, '意大利': 18, '美国': 24 }
const EXPECT = { '德国': 82, '日本': 75, '意大利': 69 }

for (const [nation, fn] of Object.entries(files)) {
  const rows = fs.readFileSync(path.join(OUT, fn), 'utf8').split('\n').map(l => l.trim()).filter(Boolean).slice(1)
  const decks = {}
  for (const r of rows) { const d = r.split(',')[0].trim(); decks[d] = (decks[d] || 0) + 1 }
  const core = decks['CORE'] || 0
  const other = Object.entries(decks).filter(([k]) => !/^(CORE|PRELUDE|ARMS)$/.test(k))
  const otherSum = other.reduce((s, [, v]) => s + v, 0)
  const onlyCore = core + (BASIC_TOTAL[nation] - 5)
  const corePlusOther = (core + otherSum) + (BASIC_TOTAL[nation] - 5)
  const exp = EXPECT[nation]
  console.log(`${nation}: deck分布=${JSON.stringify(decks)}`)
  console.log(`   仅CORE牌库=${onlyCore} | CORE+其他=${corePlusOther} | 期望=${exp || '-'} (仅CORE差${exp != null ? exp - onlyCore : '?'}, CORE+其他差${exp != null ? exp - corePlusOther : '?'})`)
}
