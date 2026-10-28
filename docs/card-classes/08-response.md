# 08 响应卡 RESPONSE（57 张，全部已登记）

> **一句话判据**：`type === 'RESPONSE'`，必须**先暗置到桌面**（`game.table_responses`），
> 命中 `trigger.on` 时进入**响应栈**，由持有方决定是否发动。

## 一、怎么认出这类卡

```js
RESPONSE_EFFECTS[id]        // { name, actor, trigger: { on, filter? }, optional? }   —— 57 张全有
RESPONSE_EFFECT_IMPL[id]    // (game, side, ctx, choice, extra) => { ok, desc, cancel? } —— 55 张有
```

> ⚠ **触发时点的权威是 `RESPONSE_EFFECTS[id].trigger.on`**。
> `CARD_TRIGGERS[id].on` 只给人看、**不参与逻辑**（改了无效，还会误导后人）。

## 二、共性：三段链路（缺一不可）

```
① 桌面暗置：facedown_response(game, nation, card_id, from)
     -> game.table_responses.push({ card_id, owner_side, nation, id })

② 命中派发：request_responses(game, on, ctx, pre)
     -> fire_trigger(game, on, ctx)           // 只扫【桌面】的响应卡，不扫手牌
     -> push_response_frame({ ctx: ctx || {} })  // ctx 完整持久化（含跨 action）
     -> 跨阵营则 handoff_to(owner_side)

③ 表态结算：rules.action(side, 'trigger_response' | 'pass_response', {})
     -> RESPONSE_EFFECT_IMPL[face](game, side, ctx, choice, extra)
     -> consume_response() 把卡移入弃牌堆
```

## 三、共性：`trigger` 字段

| 字段 | 作用 | 缺了会怎样 |
|---|---|---|
| `on` | 触发时点字符串（或数组） | 永不命中 |
| `filter(game, ctx, owner_side)` | 二次筛选（国家/地区/兵种/补给） | 弹得太宽，"弹了点了没用" |
| `optional` | 是否可选发动 | — |

**filter 是这一类的核心**。实测三种写法：

```js
/* 1) 只判国家 + 地区（不判兵种，"部队"泛称）—— 15332 皇家空军 */
(game, ctx) => ctx.piece_nation === '英国' &&
    (data.name_of(ctx.space) === '不列颠' || data.name_of(ctx.space) === '北海')

/* 2) 判国家 + 兵种 —— 15436 战舰修理 */
(g, ctx) => ctx.piece_nation === '日本' && ctx.piece_type === 'navy'

/* 3) 判国家 + 兵种 + 补给（用移除前算好的 was_supplied）—— 15330 防御姿态 */
(game, ctx) => ctx.piece_nation === '英国' && ctx.piece_type === 'army' && ctx.was_supplied === true
```

## 四、共同范式（骨架）

```js
/* 登记（RESPONSE_EFFECTS） */
'15330': {
    name: '防御姿态', actor: '英国',
    trigger: {
        on: 'piece_removed',
        filter: (game, ctx) => ctx.piece_nation === '英国'
            && ctx.piece_type === 'army' && ctx.was_supplied === true,
    },
},

/* 实现（RESPONSE_EFFECT_IMPL） */
'15330': (game, side, ctx) => {
    restore_piece(game, ctx)                    // 救回 victim
    register_modifier(game, { key: 'protect', nation: ctx.piece_nation,
        type: ctx.piece_type, spaces: [ctx.space], untilTurn: game.turn })
    restore_retreated_airs(game, ctx)           // 顺手拉回同场撤退的空军
    return { ok: true, desc: '该英国陆军本回合不会被移除' }
},
```

## 五、共性：免死/还原类的两个原子（别混）

| 原子 | 救谁 |
|---|---|
| `restore_piece(game, ctx)` | **victim**（被移除的那支部队，`ctx.piece`） |
| `restore_retreated_airs(game, ctx)` | **`ctx.retreated_airs`**（同场因不代受撤走的其它空军） |

10 张免死/还原卡（15330/15332/15334/15337/15420/15421/15436/17730/17733/17735）**两者都要调**。

> **2026-10-28 起更省事的做法**：`restore_piece()` 内部已经会调 `restore_retreated_airs()`
> —— 任何"救回部队"自动带上飞机复原。所以**新写的还原卡只要调 `restore_piece` 就够了**，
> 显式调用只是双保险（幂等）。
>
> 覆盖范围因此从"响应卡"扩展到三条路径：响应卡（含苏联 17832/17833/17835/17836）、
> 增强卡（15311 马奇诺）、状态卡（17543 雷达）。

## 五之二、还原类只需一行：`protect_restored`

2026-10-28 起，「还原部队 + 本回合保护」有**唯一入口**，14 张卡全部改用它
（原来是普通 10 张一套、苏联 4 张走 `su_defense_protect` 另一套，已删除后者）：

```js
/* 默认：保护 victim 所在地区、用 victim 的国家/兵种 */
'15330': (game, side, ctx) =>
    protect_restored(game, ctx, { desc: '该英国陆军本回合不会被移除' }),

/* 需要保护多个地区 / 指定兵种时传 opts —— 17836 保护两区 */
'17836': (game, side, ctx) => protect_restored(game, ctx, {
    nation: '苏联', type: 'army',
    spaces: ['西伯利亚', '中亚'].map(space_id_of).filter(x => x != null),
    desc: '苏联陆军已还原，<西伯利亚><中亚>的苏联陆军本回合内不会被移除',
}),
```

| `opt` 字段 | 默认 | 说明 |
|---|---|---|
| `nation` | `ctx.piece_nation` | 受保护部队的国家 |
| `type` | `ctx.piece_type` | 兵种（比硬编码 `'army'` 稳） |
| `spaces` | `[ctx.space]` | 保护地区数组；**卡面写多个地区时必须显式传** |
| `desc` | `'该部队本回合不会被移除'` | 日志文案 |

内部依次做：`restore_piece`（含飞机复原）→ `register_modifier`（`turnNation` 自动补）。
**不要**再手工 `game.modifiers.push` —— 会漏掉 `register_modifier` 将来新增的字段。

## 六、共同易错点

| # | 坑 | 后果 |
|---|---|---|
| 1 | 改 `CARD_TRIGGERS[id].on` 以为改了时点 | 无效（权威在 `RESPONSE_EFFECTS`） |
| 2 | **同一事件多次命中同一张卡** | 一次断补 2 支部队 → 同一张卡救回 2 支（16615 已用 `_queuedIds` 去重） |
| 3 | `ctx` 里缺字段（如 `was_supplied`、`retreated_airs`） | filter 恒 false / 撤退的飞机救不回 |
| 4 | 用 `piece_id` 当 `piece`（或反过来） | 找不到目标；`piece_removed` 用 `piece`，部分派发点用 `piece_id` |
| 5 | 表态方判断用 `game.current_nation` | 跨阵营时判错人（该用动作入口的 `side`） |
| 6 | `owner_side` 大小写 | `faction_of_nation()` 返回小写，`game.active` 是大写，混用导致"只有持有方才能决定"被误拒 |
| 7 | 响应卡还在**手牌**就指望触发 | `fire_trigger` 只扫桌面（`table_responses`） |
| 8 | 在 impl 里弹窗/挂起 | 响应结算必须同步完成，挂起会打乱栈 |
| 9 | 忘记 `consume_response` | 卡留在桌面可重复发动 |

## 七、验收写法

```js
// 1. 桌面摆卡（测试惯例：owner_side 用【小写】）
g.table_responses = [{ card_id: '15330#1', nation: '英国', owner_side: 'allies' }]

// 2. 走真实引擎制造 piece_removed
I.resolve_supply(g, '英国')          // 或 do_battle + resolve_battle

// 3. 断言压帧
ok(hasFrame(g, '15330'), '响应帧入栈')
ok((frameOf(g,'15330').ctx.retreated_airs || []).length >= 0, 'ctx 字段齐全')

// 4. 表态结算
rules.action(g, 'Allies', 'trigger_response', {})

// 5. 断言盘面 + 卡已消费
ok(g.location['uk_army'] === SPACE, 'victim 已还原')
ok(!g.table_responses.some(r => r.card_id === '15330#1'), '卡已进弃牌堆')
```

**必测**：① filter 命中 ② filter 不命中不弹 ③ 结算后卡离开桌面 ④ 跨阵营让权后能表态 ⑤ 同一事件不多次压帧。

## 八、参考实现

| 想做 | 抄哪张 |
|---|---|
| 免死还原（陆军/海军/部队） | 15330 / 15436 / 15332（见 05 与 fix-log 第 13 条） |
| 多目标自选 | 15316（`need:'piece'` 协议） |
| 拦截 / 取消对方动作 | 15329（返回 `{ cancel: true }`） |
| 打完洗回牌堆 | 15333（注意 #13 触发范围问题） |
| 借用他国状态卡 | 17732 德国军事顾问（见 #9） |
