# 10 让权 / 委托（跨类型交互形态，非卡类型）

> **一句话判据**：卡面出现「**由某国**执行 / **让某国**选择 / 借用他国效果 / 归还控制权」
> → 这类卡不属于某个 type，而是**一套控制权转移协议**，与 type 正交。

## 一、怎么认出这类卡

卡面关键词：`让`、`由…选择`、`委托`、`借用`、`归还`、`由敌国决定`。

代码特征（任一）：

```js
handoff_to(game, side, reason)          // 控制权转移
game.delegate = { mode, nation, done, return_nation, return_active, ... }
set_pending_delegate(...) / finish_delegate(game, dg)
rectify_active(game)                    // 归还时校正 active
```

## 二、共性：两级控制权模型（**最核心的一条**）

| 字段 | 含义 | 谁在用 |
|---|---|---|
| `game.active` | 当前行动**阵营**（`'Axis'` / `'Allies'`） | 白名单、可见性、`build_actions` |
| `game.current_nation` | 当前行动**国家**（`'德国'`…） | 回合进度、补给、国家技能 |

**让权必须两级同时考虑**：

| 场景 | 做法 |
|---|---|
| **同阵营**（德国让意大利出牌） | **只切 `current_nation`**，`active` 不动 |
| **跨阵营**（德国让英国应答、英国卡在德国回合触发） | **翻 `active` + 切 `current_nation`**，并记录 `_handoff_base` 供归还 |

> ⚠ 最常见的致命错误：`handoff_to` 只翻 `active`、不切 `current_nation`（或反之），
> 结果是「当前国是 A、阵营是 B」的矛盾态 → 客户端显示"等待对方行动"，**全场卡死**。

## 三、共性：三种典型场景

| 场景 | 例子 | 机制 |
|---|---|---|
| **翻转控制让友国真的出牌** | 17721 钢铁条约 / 16703 罗马尼亚铁卫团 / 17729 卡佩里尼 / 17535 租借法案 | `game.delegate` + 翻 active + 归还 |
| **敌方动作时让我方应答** | 17805 红色管弦乐队 / 15207 JU-52 | `watch: true` + `handoff_to` + `rectify_active` |
| **让权他国选目标/弃牌** | 16304 中国远征军 / 17553 抗日义勇军 | `set_pending_delegate` + `finish_delegate` |

## 四、共同易错点（每一条都出过线上 bug）

| # | 坑 | 案例 |
|---|---|---|
| 1 | **`handoff_to` 只翻 `active`，对同阵营无效** | 同阵营委托时"点了没反应" |
| 2 | **`_handoff_base` 记录的归还点已过期** | 17805：armed 中间态覆盖基准 |
| 3 | **归还时用过期基准还原** | **15207**：`turn_start` 派发在 `active` 重置之前 → 记为 `'Allies'`，回合推进改成 `'Axis'`，归还时又改回 `'Allies'` → 卡死 |
| 4 | **委托期间被别的事件打断** | **17535 租借法案**：让权期间发生战斗/飞机免死 → 战斗结束行动权回到被委托国 |
| 5 | **不在白名单** | 被委托方提交 action 被拒 → 静默无反应 |
| 6 | **`view.delegate` 没下发** | 客户端不知道自己在被委托，不显示可操作 |
| 7 | 让权链（A→B→C）不记 `chain` | 只有第一环生效 |
| 8 | 让权期间 `game.current_nation` 被别的钩子改写 | 判定分歧，两端不一致 |

## 五、共同范式（安全写法）

```js
/* 发起委托：记全上下文 */
game.delegate = {
    mode: 'flip',                 // flip=跨阵营翻 active / single=同阵营只切国家
    nation: target,               // 让谁执行
    return_nation: game.current_nation,
    return_active: game.active,   // 归还基准（必须在【发起时】记，不要用 _handoff_base 兜底）
    done: false,
}
game.current_nation = target
if (mode === 'flip') game.active = faction_role_of_nation(target)   // 'Allies'/'Axis'

/* 归还：以 current_nation 为准，_handoff_base 只作兜底 */
function rectify_active(game) {
    const nat = game.current_nation
    const want = faction_role_of_nation(nat)
    if (game.active !== want) game.active = want
}
```

**15207 的修复结论（已上线）**：`rectify_active()` 的栈空分支**以 `current_nation` 为准**，
`_handoff_base` 只兜底，并加 `game_over` 保护。

## 六、验收写法

```js
// 1. 发起委托
rules.action(g, 'Axis', 'play_card', { card: DELEGATE_ID, ... })
ok(g.delegate && g.delegate.nation === '英国', '委托对象正确')
ok(g.current_nation === '英国', 'current_nation 已切')
ok(g.active === 'Allies', 'active 已翻（跨阵营）')

// 2. 被委托方表态
rules.action(g, 'Allies', 'delegate_choose', { ... })
ok(g.delegate.done === true, '委托已完成')

// 3. ★ 归还后两级一致（这是 15207/17805 的守卫）
ok(g.active === faction_role_of_nation(g.current_nation),
   '★ active 与 current_nation 阵营一致（否则全场卡死）')
```

**必测**：① 委托对象 ② 两级切换正确 ③ 被委托方能提交（白名单） ④ **归还后两级一致** ⑤ 委托期间插事件后仍能归还。

## 七、参考实现

| 想做 | 抄哪张 |
|---|---|
| 跨阵营翻控制（友国真出牌） | 17721 钢铁条约 |
| 同阵营只切国家 | 17711 维希法国殖民地（`watch` 类） |
| 敌方动作时我方应答 | 17805 红色管弦乐队 / 15207 JU-52 |
| 让权选目标（多步） | 16304 中国远征军 |
| 归还校正 | `rectify_active()`（rules.js 内，含 game 5731 现场注释） |
