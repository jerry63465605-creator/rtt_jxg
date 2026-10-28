# 卡牌分类目录（按实现机制）

> 目的：**看到一张卡，10 秒内知道它该写在哪张表、走哪条派发链、照哪张卡抄、会踩哪些坑。**
>
> 每份文档只讲「这一类的**共性**」，不重复单卡细节。单卡复盘见 `docs/<卡id>-*.md` 与 `docs/fix-log-*.md`。

## 一、判据树（三问定性）

```
① 看 cards.js 的 type
   ├─ BASIC     -> 01-basic.md
   ├─ EVENT     -> 02-event.md
   ├─ EFFECT    -> 03-effect.md
   ├─ STATUS    -> 再看 status_effects 里的形态（②）
   ├─ RESPONSE  -> 08-response.md
   ├─ ECON      -> 09-econ.md
   ├─ ARMAMENT  -> 11-unwired.md（未接入）
   └─ PRELUDE   -> 11-unwired.md（未接入）

② STATUS 的三（四）种形态，看 rules.js 里 STATUS_EFFECTS[id] 的键
   ├─ auto     -> 04-status-auto.md      （计分阶段自动结算，26 张）
   ├─ ongoing  -> 05-status-ongoing.md   （持续光环，写 game.status_aura）
   ├─ trigger  -> 06-status-trigger.md   （发动型，trigger.window 窗口）
   └─ react    -> 07-status-react.md     （被动反应，战斗/经济结算内部自动）

③ 一张卡可能在【非卡类型维度】上属于以下交互形态（与 ① 正交，必须同时看）
   └─ 让权 / 委托 -> 10-delegate.md
```

## 二、类型 × 实现载体 × 派发/结算函数

| 类型 | 张数 | 登记表（rules.js） | 派发 / 结算入口 | 玩家看到 |
|---|---:|---|---|---|
| BASIC | 30 | `deck_basics` / `resolve_basic_card` / `basic_targets` | `play_card` | 手牌直接打出 |
| EVENT | 86（已实现 **79**） | `EVENT_EFFECTS` | `resolve_event_card` + `steps` 逐步推进 | 选地区/选部队后结算 |
| EFFECT | 75（已实现 **73**） | `ECHO_EFFECTS`（`armed.*`） | `offer_armed_effects(when, ctx)` | 「打出 / 不打出」框 |
| STATUS | 83（**83** 全覆盖） | `STATUS_EFFECTS` | 见 04–07 四份文档 | 打出后置于桌面 |
| RESPONSE | 57（**57** 全覆盖） | `RESPONSE_EFFECTS` + `RESPONSE_EFFECT_IMPL` | `request_responses` → 响应栈 → `trigger_response` | 「发动 / 不发动」框 |
| ECON | 32 | `ECON_CARDS`（`tag` / `targets` / `run`） | `set_pending_econ` → `resolve_econ` | 选方案、损耗牌 |
| ARMAMENT | 39 | **无** | **无** | 不存在（未接入） |
| PRELUDE | 44 | **无** | **无** | 不存在（未接入） |

> 04–07 的四个数字是**形态计数，可叠加**（一张状态卡可同时有 `ongoing` + `auto`，
> 例如 6601），所以 26 + 24 + 36 + 6 > 83 是正常的，不是统计错误。

> **已实现口径的唯一真相**：`cards.js` 只是卡面数据，**不代表已接入**。
> 判断"有没有实现"看登记表有没有这个 id（`_internal.EVENT_EFFECTS[face]` 等），
> 或看 `card_effect_of()` / `COMMAND_IMPL`。预览页（8090）就是按这个口径着色的。

## 三、跨类铁律（所有类型都适用，违反必出 bug）

| # | 铁律 | 违反后果 |
|---|---|---|
| 1 | **新增 action 必须登记 `build_actions` 白名单** | 客户端点了静默无反应（服务端拒绝，前端无提示） |
| 2 | **`query` 是只读 RPC**，在里面写状态不会广播 | 状态"看起来改了"，别人看不到 |
| 3 | **判定同源**：服务端算好的候选/结论要下发，客户端不许自己再算一遍 | 两端不一致 → 看得见点不中 / 高亮但无效 |
| 4 | **卡 id 有两张脸**：`card_id`（实例，`'15430#1'`）/ `card_face`（面，`'15430'`） | 按实例比较→永不命中；按面比较→两张同名卡串味 |
| 5 | **阵营值**：`faction_of_nation()` 返回小写 `'axis'/'allies'`；`game.active` / `owner_side` 用 `'Axis'/'Allies'` | 大写小写混用 → 分数静默丢失、补给点失效 |
| 6 | **「回合」= 一个国家回合**，不是整轮 | "本回合内"实现成整轮 → 跨国家残留 |
| 7 | **弃牌 ≠ 损耗**：代价支付走 `discard`，牌库顶进弃牌堆走 `attrition_cards` | 两者混用 → 代价/结算全错 |
| 8 | **棋子离场判据看 `game.location`**，`piece_nation` 删除后仍保留 | 用 `piece_nation` 判存活 → 假"没被消灭" |
| 9 | **不要自己重写遍历**：建设/战斗/补给/连通都有原子（`rules.js` 的 `_internal`） | 边界条件漏（补给、载体、连通快照） |

## 四、索引

| 文档 | 类 | 张数 | 一句话 |
|---|---|---:|---|
| [01-basic.md](01-basic.md) | 基本卡 | 30 | 六国各 5 张，行动本身，无效果配置 |
| [02-event.md](02-event.md) | 事件卡 | 86 / 79 | `EVENT_EFFECTS.steps` 声明式逐步执行 |
| [03-effect.md](03-effect.md) | 增强卡 | 75 / 73 | `ECHO_EFFECTS.armed.when` 等窗口触发 |
| [04-status-auto.md](04-status-auto.md) | 状态卡·自动 | 26 | 计分阶段静默结算，无窗口 |
| [05-status-ongoing.md](05-status-ongoing.md) | 状态卡·光环 | 24 | 写 `game.status_aura`，持续改判 |
| [06-status-trigger.md](06-status-trigger.md) | 状态卡·发动 | 36 | `trigger.window` 到点问「是否发动」 |
| [07-status-react.md](07-status-react.md) | 状态卡·反应 | 6 | 被打 / 被经济战时自动结算 |
| [08-response.md](08-response.md) | 响应卡 | 57 | 桌面暗置，进响应栈才有效 |
| [09-econ.md](09-econ.md) | 经济战 | 32 | `ECON_CARDS` + 损耗牌 |
| [10-delegate.md](10-delegate.md) | 让权 / 委托 | 跨类 | 翻 `game.active` 让别国执行 |
| [11-unwired.md](11-unwired.md) | 武装 / 前奏 | 39 + 44 | **数据在、代码不认** |

## 五、怎么用这套文档

1. 拿到一张要改的卡 → 按 §一 定位到对应文档
2. 读该文档的「共同范式」→ **照抄参考实现**，不要重新发明
3. 写完必过该文档的「共同易错点」清单
4. 验收按该文档的「验收写法」写脚本，放 `tools/_smoke_<卡id>_*.js`
5. 改完跑 `node tools/_run_smoke_report.js`，与基线对比**零新增**
