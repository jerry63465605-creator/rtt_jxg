# 11 未接入类型：ARMAMENT（39）/ PRELUDE（44）

> **一句话判据**：`cards.js` 里有数据，但 `rules.js` / `play.js` **全仓零引用** → 这类卡**不存在于对局中**。

## 一、两类各是什么

| type | 张数 | id 段 | 卡面语义 |
|---|---:|---|---|
| `PRELUDE` | 44 | 11300 ~ 18412 | **前奏**：开局前的事件（德奥合并、瓜分捷克斯洛伐克、建设高速公路…） |
| `ARMAMENT` | 39 | 11311 ~ 18421 | **武装**：装备/兵种强化（88mm 防空炮、俾斯麦级战列舰、合成橡胶…） |

## 二、怎么确认"未接入"

```powershell
# 在 rules.js / play.js 里搜该类卡的 id 段 —— 应无输出
Select-String -Path rules.js,play.js -Pattern "'149[0-9]{2}'"
```

**已验证（2026-10-28）**：

| 检查 | 结果 |
|---|---|
| `cards.js` 有数据 | ✅ PRELUDE 44 / ARMAMENT 39 |
| `EVENT_EFFECTS` / `ECHO_EFFECTS` / `STATUS_EFFECTS` / `RESPONSE_EFFECTS` / `ECON_CARDS` 登记 | ❌ **全部 0 条** |
| `rules.js` / `play.js` 引用 | ❌ **零引用** |
| 玩家能否见到 | ❌ 不进牌堆、不进手牌、不进桌面 |

## 三、共性：三类"已定义但未接入"的共同表现

1. **卡面数据完整**（`cards.js` 有 name/text/nation/type/id），所以预览页能显示卡图
2. **但预览页会判"未实现"**（`card_effect_of()` 读不到配置 → 显红）
3. **对局里永远抽不到** —— 牌堆构建只取 `deck_basics` + 已登记类型的牌堆
4. **排查卡片 bug 时不要花时间在它们身上** —— 它们不是"有 bug"，是"没接线"

## 四、如果要接入，需要做什么

以 ARMAMENT 为例（最小编织清单）：

| # | 步骤 | 落点 |
|---|---|---|
| 1 | 定语义：是"打出即结算"还是"附加到某支部队" | 决定走 `EVENT_EFFECTS`（事件式）还是新表（装备式） |
| 2 | 登记配置表 | `rules.js` 新表或复用 `EVENT_EFFECTS` |
| 3 | 牌堆构建 | 让该类型进入对应国家的牌堆（`deck_*` 函数） |
| 4 | `build_actions` 白名单 | 新增 action 必须登记，否则点了静默 |
| 5 | 客户端渲染 | `play.js` 打出流程 / 卡面类型图标 |
| 6 | 预览页 | `card_effect_of()` 命中即变绿（自动同步，无需改 HTML） |
| 7 | 验收脚本 | `tools/_smoke_<type>_*.js` |

> PRELUDE 更复杂：它是**开局前**的，需要 `setup()` 阶段的支持（现在 `setup` 不读这个类型）。

## 五、结论

| 问题 | 答案 |
|---|---|
| 这些卡有 bug 吗？ | **没有 —— 它们根本不在对局里** |
| 玩家会抽到吗？ | 不会 |
| 需要做什么？ | 除非明确要"启用前奏/武装系统"，否则**保持现状** |
| 验收怎么写？ | 不需要；若要防回归，只需断言"未登记"这一事实 |

```js
// 防误接入的守卫（可选）
const arm = C.CARDS.filter(c => c.type === 'ARMAMENT')
ok(arm.every(c => !I.EVENT_EFFECTS[String(c.id)]), 'ARMAMENT 仍未接入（若接入请更新本文档）')
```
