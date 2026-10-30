/* 追加第 3 组真实测试记录 + via 标记补全 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
### 第 3 组：S1「代价不退」真实测试（15214 战术革新）

\`tools/_real_test_paradigm_15214.js\`（20 项，两支对照）：

| 支 | 链路 | 结果 |
|---|---|---|
| A | 德国 play 15214 → \`resolve_effect{discard_status}\` 弃桌面状态卡（**代价照付**）→ 英国 15352 拦 → 意大利 16700 反制窗口 → **放弃** → 15352 成立 | 15214 进弃牌堆；**桌面状态卡仍在弃牌堆（代价不退）**；手里状态卡未被免费打出（效果取消）；\`pending_echo\` 清空 |
| B | 同上但英国**直接放弃**拦截 | 效果照常：手里状态卡免费打到桌面；代价同样已付 |

日志关键行（可直接对照）：

\`\`\`
【英国】可打出 1 张增强卡
【德国】已付代价，等待【英国】的拦截应答（拦截只取消效果，代价不退）
《战术革新》效果被拦截：德国已付代价不退，剩余效果不发生
\`\`\`

**顺带补全**：\`via\` 标记此前只打在"触发"来源上，三处"打出"来源
（\`play_card\` 主路径 / \`arm_intercept_after_cost\` / \`resume_echo_queue\`）漏了
→ \`view.armed_offer.via\` 为 null，客户端按钮会误显示"打出/拦截"分支。
现三处统一补 \`via: 'play', window: 'enemy_echo_played'\`。

**教训**：新增窗口字段（via/window）时，必须**搜全部派发点**（\`offer_armed_effects(game,'enemy_echo_played'\` 共 4 处），
漏一处就会出现"某些卡显示不对、其它卡正常"的局部 bug —— 这类最适合用真实测试断言 \`view.armed_offer.via\` 兜住。
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
