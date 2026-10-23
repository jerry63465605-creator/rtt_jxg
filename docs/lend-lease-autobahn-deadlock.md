# game 24 卡死排查：《租借法案》委托打出多步卡（2026-10-23）

## 一、现场

```
turn=11  phase=play  current=美国  active=Allies
pending_autobahn = { remaining: 5, total: 5, actor: '苏联', timing: false }
delegate = null
```

日志尾部：

```
【美国】《租借法案》委托【苏联】打出 1 张手牌并摸 1 张
【苏联】《西伯利亚大铁路》—— 收回 5 支苏联陆军，按任意顺序建设
【苏联】《租借法案》打出 1 张手牌并摸 1 张，操作权归还美国
只有【苏联】能选择建设位置     ← 反复出现，共 9 次
```

动作记录 `#790 ~ #798` 连发 9 次 `resolve_autobahn`，**剩余次数始终 5**，一次都没推动。

## 二、两个缺陷

### ① 17535 收尾过早：把「卡已结算」当成「委托可收尾」

17827《西伯利亚大铁路》的 run 建立 `pending_autobahn{actor:'苏联', remaining:5}`
后返回 `{ ok:true, desc }`，**没有 pending 标记**。于是 `resolve_us_lend_lease_play`
直接走到 `finish_us_lend_lease`：

```js
draw_cards(game, nat, 1)
game.log.push(...操作权归还美国)
finish_delegate(game, dg)          // ← current_nation 变回美国
```

但苏联还要点 5 次建设位 → 操作权已被收走。

### ② `autobahn_resolve` 用国家严格相等，与白名单口径不一致（真正的死锁点）

```js
if (nation !== pa.actor) { 拒绝 }        // 旧
```

而 `build_actions`（`if (game.pending_autobahn)` 分支）是**按阵营**放行：

```js
if (faction_of_nation(game.pending_autobahn.actor) === side)
    Object.assign(acts, register_status_actions(game, side, { resolve_autobahn: 1, log: 1 }))
```

→ 美国玩家（Allies）**看得见、能点**，提交后 `nation`（= current_nation = 美国）
被拿去和 `pa.actor`（苏联）比 → 拒绝。典型的**白名单放行 + 动作拒绝 = 看得见点不中**死锁。

## 三、修改（3 处）

| # | 位置 | 改法 |
|---|---|---|
| 1 | `autobahn_resolve` | 判定改为 `nation !== pa.actor && faction_of_nation(nation) !== faction_of_nation(pa.actor)` 才拒；建设目标仍用 `pa.actor` |
| 2 | `resolve_us_lend_lease_play` 即时结算分支 | 结算后若 `game.pending_autobahn` 存在 → **保留委托**（`delegate.nat` 有值、不 done），不提前归还 |
| 3 | `autobahn_resolve` 收尾（`remaining` 归 0） | 若 `game.delegate && !done && nat` → 调 `finish_us_lend_lease` 补做「摸 1 张 + 归还美国 + ★卡窗口」 |

顺带修正：收尾日志原写死「高速公路」，17827 也走这里，改按 `pa.actor` 区分。

跨阵营仍严格拒绝（不能越权替别国选位），见测试 E 段。

## 四、game 24 是否能救回

能。修 ① 只影响"以后发生的委托"；这份存档 `delegate` 已为空，
但 `pending_autobahn` 还在，**修 ② 上线后美国玩家点建设位即可继续**。

在真实存档副本上实跑（不写库）：

```
第1次 space=9(莫斯科)      remaining 5 -> 4
第2次 space=7(罗斯)        remaining 4 -> 3
第3次 space=10(中亚)       remaining 3 -> 2
第4次 space=16(中东)       remaining 2 -> 1
第5次 space=15(非洲北部)   remaining 1 -> null
→ pending_autobahn = null，苏联陆军 5 支，current_nation = 美国
```

## 五、测试

`tools/_smoke_lend_lease_autobahn.js`（20 项，ALL PASS）

| 段 | 覆盖 |
|---|---|
| A | 完整链路：打 17535 → 委托苏联 → 打 17827；**断言 delegate 未收尾、current_nation 仍苏联** |
| B | 逐次 `resolve_autobahn`，每次 remaining −1 |
| C | 建完后自动收尾：挂起清、委托结束、操作权归还美国、苏联净摸 1 张、陆军数量复原 |
| D | **修 ② 独立验证**：current=美国、actor=苏联 → 提交被接受，且建设的是苏联陆军 |
| E | 跨阵营（轴心国）提交 → 仍被拒，剩余次数不变 |

全量 63 个 smoke：失败 19 个，名单与改动前完全一致。

## 六、回修入口

| 症状 | 先看 |
|---|---|
| 点建设位只提示"只有【X】能选择" | `autobahn_resolve` 的 actor 判定是否又退回国家严格相等；`build_actions` 是否按 faction 放行（两边必须同口径） |
| 委托期间打出多步卡后操作权被提前收走 | `resolve_us_lend_lease_play` 各分支是否都检查了 `game.pending_autobahn` |
| 建设做完但委托不收尾 | `autobahn_resolve` 的 `else` 分支是否还调 `finish_us_lend_lease` |
| 委托收尾后★卡窗口没弹 | `finish_us_lend_lease` 内的 `after_card_resolved(game, dg.return_nation, llCard)` |
