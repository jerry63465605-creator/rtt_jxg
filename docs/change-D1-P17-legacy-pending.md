# D1 / P17 旧存档兼容：段窗口缺 `opponentDiscard` 导致弃牌 UI 不出现

> 前置：`docs/change-D1-P16-seg2-discard.md`。玩家实测 `play.html?game=21&role=Allies`：「当前英国没有显示通用弃牌 UI」。

## 1. 根因（只读 db 实测）

`game=21`（`Episode 2 德国单国`）的 `game_state.state`：

```
prelude.enabled=true, ended=false, phase=prelude_action
current_nation=德国, active=Axis
p.pending = { answerNation:'英国', owner:'德国', name:'进军莱茵兰',
              kind:'opponentOptOut', opponentCost:{discard:2},
              hasOpponentDiscard:false }   ← 关键
op_window=null；英国正式手牌 7 张
```

这个段窗口是 **P16 修复之前**建立的：P16 在 `prelude_resolve_card` 建窗口时才挂 `opponentDiscard`，**重启不会给旧存档补字段**。于是 `view.prelude.pending.opponentDiscard` 下发 `null` → 客户端 `prelude_opponent_discard_sel=null` → `echo_discard_modal` 不渲染。

判据本身没坏：`faction_role_of_nation('英国') === current`（`current='Allies'`）成立；`view(Allies).actions` 也正确含 `prelude_pay`/`prelude_skip`。**只是候选数据缺失**。

## 2. 修法（只改 `rules.js`，客户端零改动）

新增 `prelude_ensure_opponent_discard(game)`：

- `p.pending` 已有 `opponentDiscard` → 直接返回（**幂等**）；
- 否则首段是 `opponentOptOut` 且 `opponentCost.discard>0` → 从 `game.hands[answerNation]` 用 `prelude_cand_info` 生成 `{nation, need, candidates}`，**写回 `p.pending`**（随存档落盘）；
- 其它段窗口（如 `optional`）不补建；
- 刻意**不写日志**，避免 state 每次从 db 加载时重复污染 log。

调用两处：
1. `view` 的 `prelude` IIFE 开头 —— 保证旧对局一刷新就能拿到候选、弹框出现；
2. `prelude_answer_segment` 开头 —— 保证旧存档在答复时也能走 `arg.cards` 校验与逐张 `discard_card`。

`view` 仍只把 `opponentDiscard` 下发给答复方阵营，对手为 `null`，隐私不变。

## 3. 实测验证（game=21）

用只读探针 `R.view(state,'Allies')`：

| 视角 | 结果 |
|---|---|
| `Allies` | `my_nation=英国`；`opponentDiscard={nation:'英国',need:2,candidates:[7 张正式手牌带 img/type/text]}` |
| `Axis` | `opponentDiscard=null` |

两种情况都不需要新建对局：**刷新原页面即可**。

## 4. 验证与回归

- 新增 `tools/_real_test_P17_legacy_pending.js` **14/0**：A 旧存档 view 补建 + 双视角隐私 + 写回、B 幂等（多次 view 不重建对象、不污染日志）、C 旧存档下 `prelude_pay{cards}` 弃 2 张归还 / `prelude_skip` 开选牌窗口、D `optional` 段窗口不误补建且 `prelude_pay{}` 不回归、E 静态守卫。
- P16 F 组「无代价段窗口」的模拟方式同步修正：只删 `opponentDiscard` 会被兼容逻辑按 `opponentCost` 补建，需同时清掉段代价。
- 十七套 68/37/43/25/25/33/28/24/19/21/27/21/20/26/29/33/14 全过；B34–B39 六套全过；`test_basic_cards` 288/9、全量冒烟 4 个基线失败（**零新增**）、`_smoke_facedown_privacy` 20/0、阶段 key 18/0、`check_reuse` B/C 干净、lints 0。
- 客户端零改动 → **版本串仍 `20261112l`（不 bump）**；改了 `rules.js` → 硬重启 8091 + 探活。

## 5. 接线点索引

| 符号 | 作用 |
|---|---|
| `prelude_ensure_opponent_discard(game)` | 旧存档兼容唯一实现点（幂等、无日志） |
| `view` 的 `prelude` IIFE 开头调用 | UI 显示所需的候选来源 |
| `prelude_answer_segment` 开头调用 | 答复/校验/弃牌路径同样兼容旧存档 |
| `p.pending.segments[0].opponentCost.discard` | 补建时判定「是否有弃牌代价」的唯一依据 |
| `tools/_real_test_P17_legacy_pending.js` | A–E 五组 14 项验收 |

## 6. 后续指引

1. 今后若再给 `p.pending` 加字段，**都要考虑旧存档**：或惰性补建，或在 `view` 里做兜底，不能假设「重启后新字段一定存在」。
2. 本轮未改 P16 的核心语义（正式手牌、不物理切 `current_nation`、复用 P14 弹窗），只是补齐旧存档数据。
3. 逐卡核对下一条候选仍是 `14900` B 段编译层漏产出选牌 op；P11 段窗口覆盖挂起项也未并入。

未打包、未提交。
