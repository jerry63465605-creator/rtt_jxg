# 06 状态卡·发动型（`trigger.window`，36 张 / 11 种窗口）

> **一句话判据**：`STATUS_EFFECTS[id].trigger` 存在 → 到某个**时机**武装窗口，
> 问玩家「是否发动」，发动才执行 `run`。**与增强卡（03）的区别：它一直摆在桌面上，不是手牌。**

## 一、怎么认出这类卡

```js
STATUS_EFFECTS[id].trigger = { window, requires?, cost?, desc?, run }
```

## 二、共性：11 个窗口全表

| window | 张数 | 卡 |
|---|---:|---|
| `play_start` | **12** | 15242 人民冲锋队 / 15255 征兵 / 15338 反法西斯抵抗运动 / 15345 塞内加尔步兵团 / 15347 波兰主权 / 15348 殖民帝国 / 15356 地中海基地 / 17539 常设联合国防委员会 / 17554 重庆国民政府 / 17746 耀武 / 17841 近卫军 / 17849 中国人民解放军 |
| `after_build_army` | 6 | 15247 贵在行动 / 15248 合成燃料 / 17552 战时生产 / 17843 量与质兼得 / 17846 坦克运输 / 17901 工业心脏 |
| `after_land` | 5 | 15245 俯冲式轰炸机 / 15253 闪电战 / 17538 登陆作战 / 17842 喀秋莎 / 17848 正面攻击 |
| `after_build_navy` | 3 | 17544 美国海军陆战队 / 17547 人工港 / 17550 先进造船厂 |
| `build_army` | 3 | 15341 澳大利亚劳管局 / 15342 印度宣布参战 / 17742 拉丁世界 |
| `after_naval` | 2 | 15339 英国皇家海军 / 17540 航空母舰 |
| `after_ally_battle` | 1 | 15346 自由法国 |
| `after_play_basic` | 1 | 17541 工业巨头 |
| `after_play_bombing` | 1 | 17542 空中堡垒 |
| `discard_start` | 1 | 17546 铆钉女工 |
| `piece_removed` | 1 | 17543 雷达 |

## 三、共性：两条武装路径（最容易混）

| 路径 | 函数 | 存放字段 | 表现 |
|---|---|---|---|
| **瞬间窗口** | `arm_status_instant(game, window, nation, space)` | `game.status_instant` | 只在这一瞬间可发动，过了就没了 |
| **持续型** | `trigger.window` + `once_per_turn` / 阶段钩子 | 按窗口武装 | 在本阶段内可发动，通常每回合一次 |

两者**共用同一批 window 字符串**（`after_land` / `after_build_army` 等），
但派发函数不同 —— 查一张卡为什么"不弹"时，先确认它该走哪条路径。

## 四、共同范式（骨架）

```js
'15253': {
    desc: '发起陆战并成功后：在战斗地区建设陆军',
    trigger: {
        window: 'after_land',
        requires: (game, ctx) => !is_protected(game, ctx.space),  // 可选前提
        cost: { attrition: 1 },                                   // 可选代价（损耗）
        run(game, ctx) {
            const r = build_piece(game, '德国', 'army', ctx.space)
            return { ok: r.ok, desc: r.ok ? '在战斗地区建设陆军' : '（无法建设）' }
        },
    },
},
```

## 五、共同易错点

| # | 坑 | 后果 |
|---|---|---|
| 1 | **`trigger.window` 写了但没有派发点** | 永远不弹（与 03 的 `when` 死时点同源） |
| 2 | **在 `run` 里先扣代价、再判条件** | 条件不满足时**扣了牌却没效果**（#14 15255 征兵 / 17746 耀武 即此） |
| 3 | `once_per_turn` 忘了写 | 同一阶段反复弹（每点一次都结算） |
| 4 | 纯 `ongoing` 卡以为能走 `enemy_status_effect` 被拦截 | 该窗口只在 `activate_status` 派发，ongoing 卡**不经过**（15254 / 15353 案例） |
| 5 | `play_start` 上挤了 12 张卡 | 同窗口多卡 → 顺序问题；一次只结算一张，注意响应栈 LIFO |
| 6 | `run` 返回 `{ok:false}` 但不写 `desc` | 玩家看到"点了没反应" |
| 7 | 代价用 `discard` 却用 `attrition` 语义 | 见 README 铁律 7 |
| 8 | **跨阵营窗口没进白名单** | 窗口亮了，但 `activate_status` 拒绝「不能触发非本方的状态卡」→ **点了永远无效**（17543 雷达） |
| 9 | 还原类效果自己 `register_modifier` | 漏掉自动补字段（`turnNation` 等）；统一走 `protect_restored` |

## 五之二、跨阵营门禁：`CROSS_NATION_STATUS_WINDOWS`（必看）

`activate_status` 有一道「只能触发本方状态卡」的校验：

```js
if (!borrowed && !CROSS_NATION_STATUS_WINDOWS[tr.window] &&
    delegate_of_nation(owner) !== delegate_of_nation(game.current_nation)) {
    game.log.push('不能触发非本方的状态卡')   // ← 窗口亮着也点不动
    return game
}
```

**判据：这张卡的 `trigger.window` 会不会发生在「别人的回合」？**

| 情况 | 是否需要进白名单 | 例子 |
|---|---|---|
| 效果由**自己回合的动作**触发 | ❌ 不需要 | `play_start`（自己的出牌阶段） |
| 效果由**敌方动作**触发 | ✅ **必须** | **`piece_removed`**：谁打你，就是谁的行动轮 |
| 效果由**同阵营友军**动作触发 | ✅ 必须 | `after_ally_battle`（15346 自由法国） |
| 恒由事件驱动、无回合归属 | ✅ 已加 | `build_army`（`from_status` 专用通道） |

现状（`rules.js`）：

```js
const CROSS_NATION_STATUS_WINDOWS = { after_ally_battle: 1, build_army: 1, piece_removed: 1 }
```

- `piece_removed` 是 2026-10-28 为 **17543《雷达》**（「美国海军被攻击时」）新增的 ——
  不加它，这张卡**从来没生效过**（窗口亮、点了无效）
- 该白名单**按窗口**放行，不是按卡：将来再加别国的 `piece_removed` 状态卡会一并放行
  （这是期望行为，但要确认卡面没写「仅本国回合」）

**自查一句话**：卡面出现「**被攻击 / 被移除 / 被消灭时**」→ 先想「这一定在敌方回合」→ 检查白名单。

## 六、参考实现

| 想做 | 抄哪张 |
|---|---|
| 战斗后在原地建设/征召 | **15253 闪电战** |
| 出牌阶段开始（可 once_per_turn） | 15255 / 15338 等 12 张之一 |
| 带代价的发动 | 挑 `trigger.cost` 非空的卡 |
| 延迟到下一阶段发动 | 用 `★卡技能窗口延后补开` 范式（见 `rtt-effect-recipes`） |

## 七、验收写法

```js
// 1. 窗口武装：断言 status_instant / 窗口字段里出现该卡
I.arm_status_instant(g, 'after_land', '德国', SPACE)
ok((g.status_instant || []).some(x => String(x.card_id).indexOf('15253') === 0), '窗口武装')

// 2. 发动
rules.action(g, 'Axis', 'activate_status', { card: '15253#1' })
ok(g.location['newArmy'] != null, '效果落地')

// 3. 代价与效果顺序（#14 类 bug 的守卫）
//    条件不满足时：代价不许扣
const before = (g.decks['德国'] || []).length
rules.action(g, 'Axis', 'activate_status', { card: ID })   // 前提不成立
ok((g.decks['德国'] || []).length === before, '★ 条件不满足不得扣代价')
```

**必测**：① 窗口武装 ② 发动生效 ③ **条件不满足时代价不扣** ④ 每回合只一次。
