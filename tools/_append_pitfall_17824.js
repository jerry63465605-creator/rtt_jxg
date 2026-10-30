/* 向 docs/pitfalls.md 追加：17824 grantSupply 超额（卡面无"始终处于补给状态"） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
---

## 2026-10-30 · recruit 的 \`grantSupply\` 必须有卡面依据（17824 苏德友好条约）

**症状**（zjr 报）：打 17824《苏德友好条约》后，日志多出一句
「（本回合内始终处于补给状态）」，两支新陆军凭空获得补给。

**排查结论**：确实送了。\`recruit\` 步骤带 \`grantSupply: true\` 时，框架在征召后调用
\`grant_supply(game, piece, game.turn)\`（rules.js:19374），写入
\`game.supply_granted[部队id] = 到期回合\`；\`compute_supply\` 开头
（rules.js:1005-1011）会把 \`supply_granted[pid] >= game.turn\` 的部队**直接当补给源**。
日志后缀「（本回合内始终处于补给状态）」也是 \`grantSupply\` 自动拼的（rules.js:19380）。

**判断依据（既定约定）**：卡面**必须有**「该部队始终处于补给状态」字样才能带
\`grantSupply\`。17821《华西列夫斯基出兵远东》当年就是因为卡面没写而**去掉**了它
（rules.js:10007 注释）。17824 卡面只有「在<罗斯><东欧>征召陆军。」→ 属于超额实现。

另外两点佐证：
- \`can_recruit_at\` **不检查补给**，征召不依赖补给链，不需要靠 grantSupply 才能执行；
- 罗斯/东欧 正常局面本就在苏联补给链上（莫斯科→罗斯→东欧），所以这条 grant 多数时候是
  no-op，只在断补时才会"多送"一整轮 —— 更难被发现。

**修法（方案 A，已实施）**：删掉 17824 的 \`grantSupply: true\`，并在配置处留注释说明依据。

**注意 \`game.turn\` 口径**：它是**整轮 6 国序号**（整轮才 +1），所以 \`grant_supply(..., game.turn)\`
实际有效到**本整轮结束**；若将来某张卡确实需要"本回合（单国）内"，不能直接用 \`game.turn\`。

**回归**：\`tools/_smoke_17824_no_supply.js\` 10/10 —— 配置无 \`grantSupply\` / 仍各 +1 支陆军 /
\`supply_granted\` 为空 / 日志无补给后缀 / 断补场景不会凭空补给。
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，当前行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
