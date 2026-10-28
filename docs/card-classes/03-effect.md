# 03 增强卡 EFFECT（75 张，已实现 73）

> **一句话判据**：`type === 'EFFECT'`，登记在 `rules.js` 的 **`ECHO_EFFECTS`**。
> 进一步分两种：**armed 触发型（35 张，等窗口）** 与 **直接打出型（38 张，打出即结算）**。

## 一、怎么认出这类卡

```js
_internal.ECHO_EFFECTS[id]        // 有 = 已接入
_internal.ECHO_EFFECTS[id].armed  // 有 = 触发型；无 = 直接打出型
```

`ECHO_EFFECTS[id]` 字段全集（实测）：

```
name, actor, armed, choice, cond, cost, desc, kind, modifiers, notes, one_step, pickUnit, run, steps
```

## 二、共性：直接打出型 vs armed 触发型

| | 直接打出型（38） | armed 触发型（35） |
|---|---|---|
| 何时生效 | 自己回合打出**立刻**结算 | 等到 `when` 描述的**时机**才问玩家 |
| 玩家看到 | 选地区/选部队 → 结算 | 「打出 / 不打出」框 |
| 主体字段 | `steps` / `run` / `one_step` / `pickUnit` | `armed: { when, actor, watch, ready, cost, run, ... }` |
| 典型 | 建设/征召/消灭类 | 「XX 时：损耗 N，做 Y」 |

> **判断口诀**：卡面写「**……时**，做 Y」= 触发型；写「**做 Y**」= 直接打出型。

## 三、共性：15 个 `armed.when` 时点（实测全量）

| 时点 | 张数 | 派发点 | 备注 |
|---|---:|---|---|
| `after_build_navy` | 5 | 建设海军后 | 派发点**不带**本次新部队 id（见坑 4） |
| `piece_removed` | 5 | 部队被移除后 | ctx 用 `piece`（不是 `piece_id`） |
| `after_battle` | 5 | 战斗结算后 | 代受/抵消分支也会派发 |
| `after_deploy_air` | 4 | 部署空军后 | 同上，无本次部队 id |
| `econ_used` | 4 | 经济战结算后 | |
| `after_build_army` | 4 | 建设陆军后 | |
| `enemy_echo_played` | 2 | 敌方打出增强卡 | |
| `play_start` | 2 | 出牌阶段开始（`phase_play`） | **按国过滤**，时机安全 |
| `after_recruit` | 2 | 征召后 | |
| `turn_start` | 1 | `on_turn_start()` 末尾 | ⚠ `active` **还没**重置，且不传 nation |
| `scoring_north` | 1 | 北方计分 | ⚠ 硬编码 `{nation:'德国'}` |
| `enemy_status_effect` | 1 | 敌方发动状态卡效果 | ⚠ 只在 `activate_status` 派发，纯 ongoing 卡不走这里 |
| `piece_attacked` | 1 | 被攻击瞬间 | ⚠ **不走** `offer_armed_effects`，走 `suspend` 专用路径 |
| `nation_turn_start` | 1 | `phase_resource` 里 | ⚠ 只对**苏/德/英**派发；已被 17805 以 `watch` 占用 |
| `draw_phase_end` | 1 | 抽牌阶段末 | |

## 四、共同范式（骨架）

```js
'16804': {
    name: '花园口决堤', actor: '美国',
    armed: {
        when: ['after_recruit', 'after_build_army'],   // 数组 = 一张卡监听多个窗口
        actor: '美国', watch: true,                     // 敌方动作时也要弹给我方
        cost: { attrition: 2 },
        desc: '敌方在<中国东部>征召或建设陆军时：损耗2张牌，消灭该地区1支敌方陆军',
        ready(game, ctx) {                              // 不满足就别弹（否则"弹了点了没用"）
            if (!ctx || !ctx.nation) return false
            if (faction_of_nation(ctx.nation) === faction_of_nation('美国')) return false
            if (Number(ctx.space) !== space_id('中国东部')) return false
            return eliminate_candidates(game, '美国', space_id('中国东部'), 'army').length > 0
        },
        run(game, ctx, arg) {
            /* 多目标必须让玩家选，不能 find() 取第一个 */
            if (cands.length > 1 && !picked) {
                return { need: 'piece', candidates: [...], pick: 1, pickMin: 1 }
            }
            …
        },
    },
},
```

`armed` 字段清单（实测出现次数）：`when(35) desc(35) run(35) actor(34) ready(29) cost(23) watch(11) cond(5) tag(1) filter(1) suspend(1)`

## 五、共同易错点

| # | 坑 | 后果 |
|---|---|---|
| 1 | **`when` 写了但全仓没有派发点** | 抽到就是死牌（16804 旧版 `after_land` 即此） |
| 2 | **跨阵营效果忘加 `watch: true`** | `offer_armed_effects` 按"发起国 == 持有国"过滤 → 永不触发 |
| 3 | **`turn_start` 派发在 `active` 重置之前**，且不传 `nation` | 让权基准过期 → 点「不打出」后全场卡死（15207） |
| 4 | 派发 `ctx` 缺本次部队 id（`after_build_navy` / `after_deploy_air`） | 卡想"消灭刚建的那支"却拿不到 id |
| 5 | `run` 里多个合法目标时 `find()` 取第一个 | 服务端静默替玩家决定（与 15316 同类） |
| 6 | `ready()` 判得太松 | 框弹出来但点了无效 |
| 7 | 同一 `when` 上多个国家的卡共用窗口 | `pushArmedWindow` 按 `when` 去重，窗口归属取 `cards[0].nation` → **别国手牌名泄露** |
| 8 | 改 `when` 只改一处 | 数组时点要确认两个派发点都在（`after_recruit` + `after_build_army` 是两条链） |

## 六、参考实现（照抄优先级）

| 想做 | 抄哪张 |
|---|---|
| 单一窗口、单目标 | 15205 / 15406 类 |
| **数组窗口 + watch（敌方动作触发）** | **17711 维希法国殖民地**、16804 花园口决堤 |
| **多目标自选** | **15316 佩塔尔二世即位**（`need:'piece'` 协议） |
| 跨阵营让权执行 | 17721 钢铁条约 / 17729 卡佩里尼（见 [10-delegate.md](10-delegate.md)） |
| 纯 flag（打出后改全局状态） | 见 `ECHO_EFFECTS` 里只有 `run` 无 `ready` 的卡 |

## 七、验收写法

```js
// 1. 直接派发窗口（跳过早前置流程，专测 ready/run）
I.offer_armed_effects(g, 'after_build_army', { nation: '日本', space: SP, type: 'army', piece_id: 'pJA1' })
ok(hasOffer(g), '进入窗口')

// 2. 走真实结算
rules.action(g, 'Allies', 'use_armed_offer', { card: ID })

// 3. 断言盘面 + 卡离开手牌 + 代价已付
ok(g.location['pJA1'] == null, '目标被消灭')
ok((g.hands['美国'] || []).indexOf(ID) < 0, '卡已离开手牌')
```

**必测的三条边界**（每张触发型都要）：

1. 条件**不**满足 → **不弹**（`ready` 拦住）
2. 条件满足 → 弹 → 打出 → 效果落地
3. 敌方/己方身份反转 → 该弹的弹、不该弹的不弹（`watch` 与 filter 双向验证）
