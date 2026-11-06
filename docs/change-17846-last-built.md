# B22：17846《坦克运输》找不到“刚建成的那支陆军”

> 日期：2026-11-06　范围：`rules.js`（3 处）　相关卡：17846 坦克运输

## 1. 玩家口径

> 「坦克运输找不到刚建设的陆军是哪个，导致无法发动。」

## 2. 根因（两个叠加，缺一都发不动）

### 2.1 预检拿到的 ctxSpace 是 `cardId`，不是地区

```js
// precheck_status_args（通用预检）
const r = tr.precheck(game, owner, arg, cardId)     // ← 第 4 参是 cardId（'17846#75'）
```

而 17846 的 precheck：

```js
precheck(game, nation, arg, ctxSpace) {
    const sp = Number(ctxSpace)                    // Number('17846#75') = NaN
    const cand = pieces_on(game, sp).filter(…)      // → 空
    if (pid == null) return { ok: false, reason: '请选择发起单位（必须是刚建成的这支陆军）' }
}
```

→ **无论玩家点哪支，都被这条挡住**，表现就是“无法发动”。
（另一处 `activate_status` 内的预检传的是正确的 `status_instant[].space`，两处口径不一致。）

### 2.2 客户端根本不知道“刚建成的是哪一支”

`game.last_built` 在 `view()` 里用完即被置空，且不含 `piece_id`；
客户端的发起单位列表是通用口径（相邻的本国陆/海军），玩家只能猜。

## 3. 修法（3 处）

| # | 位置 | 改动 |
|---|---|---|
| 1 | `precheck_status_args` | 第 4 参改为 `status_instant` 里该卡的 `space`（与 `activate_status` 内预检同源） |
| 2 | `build_piece` | `game.last_built` 增加 `piece_id: __r.id` |
| 3 | `view()` | 清空前存一份 `game.status_built = {…, turn}`，并下发 `view.last_built`（**只给建设方阵营**） |
| 4 | 17846 `precheck` / `run` | 发起单位一律锁定「建设地区的本国陆军」（每国每格限 1 支 => 就是刚建成那支）；`from` 传错不再拒绝，改为覆盖为正确的那支 |

> 附带：`view.last_built` 供客户端后续做“刚建成”高亮（本次未改客户端，避免 bump 版本串）。

## 4. 真实测试 `tools/_real_test_17846_last_built.js`（10 项）

```
A ★★ 建设后 view.last_built = {piece_id:'p9', space:东欧, nation:德国, type:army}
B ★★ 对手视角 last_built = null
C ★★ 不传 from → 「发动《坦克运输》—— 德国 发起陆战：罗斯 | 苏联陆军 从 罗斯 移除」
D ★★ 传错 from（德国本土那支）→ 同样成功（无“只能以刚刚建成的这支陆军”拒绝）
E ★  建设地没有本国陆军 → 明确拒绝、且不白扣代价
F 静态守卫 3 条
```

修复前 C/D 的日志是「《坦克运输》现在不能发动：请选择发起单位（必须是刚建成的这支陆军）」，
修复后是真正的战斗结算。

## 5. 回归

```
_real_test_precheck_17848 25、_real_test_precheck_attrition 11、_real_test_precheck_from 8、
_real_test_17848_once_per_turn 13、_real_test_17732_borrow_all 88
test_basic_cards 288/9（与基线一致）、全量冒烟 112 全绿
```

## 6. 边界

- `precheck` 的 `ctxSpace` 改口径后，其它带 `precheck` 的卡（17848 等）拿到的也是地区（它们本来就按地区判），回归已覆盖；
- 17846 若建设地区没有本国陆军（异常/老存档）→ 拒绝并保留窗口，不扣代价；
- `view.last_built` 仅当 `status_built.turn === game.turn` 时下发，跨轮次自动失效。
