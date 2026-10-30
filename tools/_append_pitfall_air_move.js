/* 向 docs/pitfalls.md 追加：空军原地调度 + 候选按空军逐支 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
---

## 2026-10-30 · 空军「原地调度」与"候选按空军逐支"（targets_by_air）

**需求**（zjr）：空军允许**原地调度**，用来触发 \`after_deploy_air\` 类增强/响应卡
（15205 JU-87、15406 南云忠一、17511 美国陆军游骑兵、17806 空降部队）。

**两处卡点**（都在 \`air_support\` 路径上）：

1. 执行端：\`air_support\` 的「同一地区只能有 1 支同国空军」把**正在调度的这支自己**也算进去了
   → target == 原地区时恒被判 \`已有 1 支X空军\`。修法：\`p !== air\`。
2. 候选端：\`query air_options\` 里 \`hasArmyNavy && !hasAir\`
   → 空军所在格永远不进 targets，客户端（\`play.js\` \`on_click_space\` 用 \`air_move.targets\` 校验）
   根本点不到原地。

**为什么改成"按空军逐支"**：一旦允许原地，"某格能不能落"就取决于**哪支空军在动**
（自己那格可以，别人占着那格不行）。全局一份 \`targets\` 表达不了，会出现
"能点但不能成功"。所以 query 现在同时返回：

\`\`\`js
{ airs, targets, targets_by_air: { 空军id: [地区id...] } }
\`\`\`

客户端优先用 \`targets_by_air[选中空军]\`，服务端不带该字段时回退旧的 \`targets\` 并集。

**顺带对齐**：候选与执行端统一为「目标格须有**处于补给状态**的本国陆/海军」
（原来候选只看"有陆/海军"，不看补给，也是"能点不能成功"的一类）。

**原地调度仍算一次调度**：照常弃 1 张手牌、置 \`air_done\`、上报
\`offer_armed_effects('after_deploy_air', ...)\`，日志写「在原地 X 调度空军（不移动…）」。

**回归**：\`tools/_probe_air_move_same_space.js\` 12/12 ——
A 候选含自身格 / B 原地调度成功且扣代价 / C 15205 窗口出现 /
D \`targets_by_air\` 逐支区分（别的空军的格点不到，执行端也拒且不扣代价）/ E 无载体不进候选。
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，当前行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
