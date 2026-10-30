/* 追加第 6 组：经济战 pre-cancel 真实测试 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
### 第 6 组：经济战侧 pre-cancel 真实测试（15329 反潜战术）

\`tools/_real_test_paradigm_econ_cancel.js\`（15 项）。这是第三种拦截范式（响应栈 \`pre=true\`），
与增强卡（\`enemy_echo_played\`）/ 状态卡（\`enemy_status_effect\`）完全不同：

| 范式 | 载体 | 卡是否需暗置 | 拦截动作 |
|---|---|---|---|
| 增强卡 | \`armed_offers\` | 否（握在手牌） | \`use_armed_offer\` |
| 状态卡 | \`armed_offers\` | 否 | \`use_armed_offer\` |
| **经济战** | \`response_stack\`（pre） | **是**（\`table_responses\`） | \`trigger_response\` / \`pass_response\` |

链路（合法单份）：
\`\`\`
① 英国出牌阶段：play 15329 -> 暗置到桌面（占名额，table_responses 追加 {card_id, owner_side, nation}）
② 切回德国出牌阶段：debug_add_card 15217《电动潜艇》（[潜艇行动]）
③ 德国 play_card 15217 {target:'英国'} -> 响应栈 pre-cancel 窗口给英国
④ 英国 trigger_response {card} -> 15217 效果不发生
\`\`\`

实测日志：
\`\`\`
【响应】《反潜战术》触发：使《电动潜艇》无效
《电动潜艇》被《15329 反潜战术》拦截，进弃牌堆（效果无效）
\`\`\`

断言要点：
- 拦截成立：英国牌库 **不变**、德国分数 **不变**、15217 进弃牌堆（照常打出）、15329 消耗、栈清空；
- 对照（`pass_response`）：英国 **-3 张**、德国 **+2 分**、15217 进弃牌堆、15329 **仍在桌面**（未发动）。

### 布阵踩到的两个坑（写测试时会再遇到）

1. \`game.table_responses\` 是【数组】，元素形如 \`{card_id, owner_side, nation, id}\`，
   不是 \`table_responses[nation]\` 的字典 —— 断言要用 \`.some(x => x.card_id === card)\`。
2. 经济战目标国的参数键是 **\`target\`**（\`play_card {card, target:'英国'}\`），不是 \`to\`；
   且 \`15223 V2 飞弹\` 有"<西欧>有德国陆军"的地面前提，用 \`debug_place\` 放不进去（该格已有他国部队会被拒），
   测试里换成无地面前提的 \`15217 电动潜艇\` 更稳。
3. \`game.score\` 的键是**小写** \`axis/allies\`，断言分数要兼容大小写。
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
