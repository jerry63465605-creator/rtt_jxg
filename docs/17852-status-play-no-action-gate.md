# 17852《罗科索夫斯基 朱可夫 科涅夫》后端缺少 action 门禁（已修复，未提交）

> 状态：**已修复（工作区）+ 回归通过，未提交、未部署**（2026-10-25）
> ⚠ 定性：客户端白名单**一直是有效的**，线上"能打其他牌"实际来自 17851 的战斗预算路径
> （见 `docs/17851-uranus-event-budget-no-gate.md`）。本篇是"后端门禁缺失"加固项。
>
> ## 修复摘要
>
> - 改动：`do_action` 新增 `pending_status_play` 冻结段（25490–25496），
>   只放行 `su_status_play` / `su_status_skip`
> - 效果：`play_card`、`next_phase` 等绕过白名单的提交一律被拒；
>   阶段推进不再能把挂起晾在半空
> - 回归：`tools/_smoke_17851_budget_gate.js` D/E 段覆盖（`view.actions` 收窄、
>   `play_card`/`next_phase` 被拒、`su_status_skip` 与 `su_status_play` 正常放行）
> - 汇总见 `docs/pending-gate-matrix.md`
> 卡面：**打出 2 张[状态卡]。**
> 卡 id：`17852`｜国家：苏联｜类型：EVENT

## 一、现象

线上对局（testserver，game 5721）：**打出 17852 后，仍可以打出其它事件牌。**

17852 的结算分两步：

1. 打出时建立 `pending_status_play`（`remaining=2`），进入"选 1~2 张状态卡"的挂起
2. 玩家点「确认」提交 `su_status_play`，或点「结束」提交 `su_status_skip`

挂起期间**应该只能**做这两件事。

## 二、复现（真实引擎路径）

脚本：`tools/_repro_17852_play_gate.js`

```js
const g = rules.setup(...)
g.opening = null; g.turn_phase = 'play'; g.current_nation = '苏联'; g.active = 'allies'
g.hands['苏联'] = ['17852#1', '17816#1', '17838#1']   // 17852 + 一张事件 + 一张状态卡
rules.action(g, 'Allies', 'play_card', { card: '17852#1' })
```

### ① 挂起正常建立

```
pending_status_play = { actor:'苏联', remaining:2, total:2, source:'17852', card_id:'17852#1' }
日志：可打出最多 2 张[状态卡]（点选后确认；也可结束放弃）
```

### ② 客户端层面**挡住了**（这一层是对的）

```
view.actions   = { su_status_play:1, su_status_skip:1, log:1 }
block_reason   = pending_status_play: 状态卡打出等待【苏联】选择
play_card 在白名单吗 = false
```

### ③ 服务端层面**放行了**（问题所在）

直接提交 `play_card` 打第二张事件：

```
日志尾部：
  【苏联】《罗科索夫斯基 朱可夫 科涅夫》：可打出最多 2 张[状态卡]…
  【苏联】《RDS-1》无法执行：需要弃置 3 张手牌（当前可用 2 张）
第二张还在手牌吗：true
判定：服务端【放行】了第二张 —— BUG
```

注意：这条日志是**卡自身代价校验**打出来的，说明 `play_card` 已经**完整进入结算流程**，只是恰好被代价挡住。若换一张无代价或代价可付的事件牌，就会**真的打出去**。

### ④ 更严重：阶段推进也被放行

```
next_phase 日志：
  【苏联】出牌阶段 -> 空军阶段
  苏联 空军阶段：打出《空军力量》 / 弃 1 张手牌调度空军（二选一）

阶段：play -> airforce
pending_status_play 还在吗：true      ← 挂起残留
```

后果：

- 玩家可以**跳过** 17852 的选牌流程
- `pending_status_play` **残留不清**
- 之后 `build_actions` 会一直只放行 `su_status_play` / `su_status_skip` → 下一个阶段的所有操作**全部点不动**（新的死锁来源）

## 三、根因

服务端 action 入口有"挂起期间统一冻结"的一段（`pending_econ` / `pending_red` / `pending_uranus` / `pending_echo` / `pending_event_step` 等），**唯独漏了 `pending_status_play`**。

```js
/* 17805 红色管弦乐队挂起：等待德国抉择期间，除 resolve_red 外一切动作冻结 */
if (game.pending_red && action !== 'resolve_red' && ...) { ...; return game }

/* 17851 天王星行动：菜单挂起期间，除 uranus_choice 外一切动作冻结 */
if (game.pending_uranus && action !== 'uranus_choice' && ...) { ...; return game }
```

`pending_status_play` 只在 `build_actions`（白名单）里出现过：

```js
if (game.pending_status_play) {
    game.block_reason = 'pending_status_play: 状态卡打出等待【' + ... + '】选择'
    if (faction_of_nation(game.pending_status_play.actor) === side)
        return { su_status_play: 1, su_status_skip: 1, log: 1 }
    return { log: 1 }
}
```

**只有前端白名单，没有后端门禁** —— 这是典型的"客户端挡住、服务端不挡"。

| 挂起 | build_actions 白名单 | action 入口冻结 |
|---|---|---|
| `pending_econ` | ✅ | ✅ |
| `pending_red`（17805） | ✅ | ✅ |
| `pending_uranus`（17851） | ✅ | ✅ |
| `pending_autobahn` | ✅ | ✅ |
| **`pending_status_play`（17852）** | ✅ | ❌ **缺** |

## 四、与 17851 的关系（重要修正）

线上玩家反馈的"发起战斗期间可以打其他牌"，**根因不在本篇，而在 17851 的战斗预算路径** —— 见
`docs/17851-uranus-event-budget-no-gate.md`。

两者的区别必须分清：

| | 17852（本篇） | 17851 |
|---|---|---|
| 载体 | `pending_status_play` | `event_budget` |
| `build_actions` | **提前 return 独立白名单** → 客户端点不到 ✅ | 只**追加**，常规出牌权仍在 ❌ |
| action 入口门禁 | 缺 ❌ | 缺 ❌ |
| 玩家能否在 UI 上点到 | 不能（点了静默无反应） | **能**（`play_card` 就在白名单里） |

所以本篇的定性调整为：**后端门禁缺失（加固项）**，不是线上那次现象的直接原因。
它仍然需要修 —— 因为只要有任何绕过白名单的入口（日志面板重打、第三方客户端、服务端内部再次进入
`play_card`、历史回滚重放），后端就照单全收。

同时，本篇复现里的 ④（`next_phase` 可放行、且 `pending_status_play` 残留）依然是独立成立的缺陷：
即使玩家操作完全合法，阶段推进也能把挂起晾在半空。

## 五、修复方案（待实施）

在 action 入口的统一冻结段（`pending_red` 附近）补一段，语义与 `pending_uranus` 完全一致：

```js
/*
 * 17852 罗科索夫斯基：选牌打出状态卡挂起期间，除 su_status_play / su_status_skip
 * 外一切动作冻结（与 pending_uranus / pending_red 同款）。
 */
if (game.pending_status_play && action !== 'su_status_play' && action !== 'su_status_skip' &&
    !(arg && arg.__debug) && !String(action).startsWith('debug_')) {
    game.log.push('《罗科索夫斯基 朱可夫 科涅夫》等待选择状态卡中，当前只能提交「打出」或「结束」')
    return game
}
```

注意点：

- `su_status_play` / `su_status_skip` 自身的分支**必须在此之前**（它们已经在上方，不需要移动）
- 该段要放在 `play_card` 分支之前（与 `pending_uranus` 同一位置即可）
- 是否需要一个"超时/放弃"出口？现在的出口就是 `su_status_skip`（玩家可主动结束），挂起不会永久卡死

## 六、顺带发现的问题

1. **17852 打出后卡仍在手牌**（复现里 `17852 还在手牌吗：true`）。挂起期间卡未离手，若玩家此时通过其它路径弃牌 / 卡被抽走，`finish_status_play` 可能找不到卡。需确认 `finish_status_play` 里对"卡已不在手牌"的处理。
2. **`next_phase` 被放行后挂起残留**（见复现 ④）。即使补了门禁，也建议在 `finish_status_play` / `su_status_skip` 之外增加"阶段切换时清理残留挂起"的兜底，防止老存档里已残留的 `pending_status_play` 再次把界面锁死。

## 七、待办

- [ ] 在 action 入口补 `pending_status_play` 门禁（见第五节）
- [ ] 补 smoke：`tools/_smoke_17852_gate.js`
  - 用例 1：挂起期间 `play_card` → 被拒，日志有"等待选择状态卡"，手牌不变
  - 用例 2：挂起期间 `next_phase` → 被拒，`turn_phase` 不变，`pending_status_play` 仍在
  - 用例 3：`su_status_play` / `su_status_skip` 正常放行（不回归）
  - 用例 4：非苏联阵营提交 `su_status_play` → 被拒
- [ ] 排查线上 game 5721 是否已残留 `pending_status_play`（若残留需手动清理）
- [ ] 确认 `finish_status_play` 对"卡已不在手牌"的健壮性
- [ ] 回填本文档：最终修法与 commit

## 八、相关代码位置

| 内容 | 位置（`server-official/public/quartermaster-sub-wars/rules.js`） |
|---|---|
| 17852 卡配置（建立 `pending_status_play`） | 9014–9035 |
| `build_actions` 白名单分支 | 24476–24482 |
| `su_status_play` / `su_status_skip` 实现 | 26680–26716 |
| `finish_status_play`（收尾：弃卡 + 占出牌名额 + 国家技能窗口） | 24982–25000 |
| `view` 下发 17852 面板 | 23668–23680 |
| action 入口统一冻结段（**需在此补门禁**） | 25380–25400 |
| `next_phase` 分支 | 25446 |

复现脚本：`tools/_repro_17852_play_gate.js`
