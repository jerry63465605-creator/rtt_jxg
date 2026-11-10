# 16300《火炬行动》：4 分支 choice（顺序 × 兵种）+ 预算续跑保留玩家选择

> 日期：2026-11-10　玩家报障 #9：「火炬无法建设海军」
> 玩家口径：方案 A（复用 `eff.choice`），且卡面「按任意顺序执行」——**要能先发动陆战**
> 范式来源：**17532《战区移动》**（choiceLabels 表顺序）、**12502《告法国人民书》**（4 选项）、
> **15225《阿登闪击战》**（`[battle → build]` 陆战先行）、**15230《海狮计划》**（新海军可作陆战发起单位）

## 1. 根因

卡面：`按任意顺序执行：在<非洲北部>或相邻地区建设1支部队。对<非洲北部>发起1次陆战。`

```js
// 旧实现（rules.js EVENT_EFFECTS['16300']）
steps: [
    { op: 'build', type: 'army', around: '非洲北部' },
    { op: 'battle', kind: 'land', useNewPiece: true, spaces: space_ids_of(['非洲北部']) },
],
```

两层问题：

1. **建不出海军**：`step_space_candidates()` 的 `around` 分支用
   `can_build_at(game, actor, sp, st.type)` 过滤候选，对海域传 `'army'` 必然失败。
   非洲北部相邻 4 个海域（北海 / 南大西洋 / 阿拉伯海 / 地中海）**根本不进候选**。
2. **顺序被锁死**：`steps` 是固定数组，陆战带 `useNewPiece` 依赖第一步新建的单位，
   玩家想「先打陆战」做不到，与卡面「按任意顺序执行」不符。

> 只读探针另测出：`can_build_at(navy)` 要求「相邻有【本国】且连回补给源的部队」
> （`navy_ab_check` 的 A 条件，`rules.js:811`）。玩家真实对局若补给链不完整，
> 海域依旧会被过滤——这是规则口径，不是改卡能解决的；测试里用
> `set_supply_point(非洲北部)` + `compute_supply` 摆出真实补给链再验证。

## 2. 既有范式（全部复用，未新造卡框架机制）

| 需求 | 既有实现 | 位置 |
|---|---|---|
| 「任意顺序」用选项表达 | `eff.choice` + `choiceLabels`（"先建设海军，再建设陆军"） | `17532` |
| 4 个选项的 choice | `12502` 四选一 + `choiceLabels` | `rules.js:11444` |
| 陆战先行、后续建设 | `[battle, build]`，战斗预算结算后 `resumeStep` 续跑 | `15225` |
| 新海军发起陆战 | `useNewPiece` + `battle_initiators`（陆/海军皆可发起） | `15230` |
| 候选/落地合法性 | `step_space_candidates` / `can_build_at` / `build_piece` 原子 | 未改动 |

> 草案曾用 `type:'any'`（按地形隐式决定兵种）**已撤销**：它与 17506《沉睡的巨人》
> 「显式二选一选兵种」范式分叉，且会漏改 `event_step_label` / `_armedWhen` / 全图候选分支。

## 3. 改动（`rules.js` 3 处，客户端零改动）

### ① `EVENT_EFFECTS['16300']`：4 分支

| # | `choiceLabels` | steps 顺序 |
|---|---|---|
| 0 | 先对〈非洲北部〉发起陆战，再建设 1 支陆军 | `battle`（无 `useNewPiece`）→ `build army around` |
| 1 | 先对〈非洲北部〉发起陆战，再建设 1 支海军 | `battle`（无 `useNewPiece`）→ `build navy around` |
| 2 | 先建设 1 支陆军，再对〈非洲北部〉发起陆战 | `build army around` → `battle(useNewPiece)` |
| 3 | 先建设 1 支海军，再对〈非洲北部〉发起陆战 | `build navy around` → `battle(useNewPiece)` |

「先陆战」分支不带 `useNewPiece`（此刻尚无新单位，用现有发起单位）；
「先建设」分支保留 `useNewPiece`（照抄 15230，新海军同样可发起陆战）。

### ② `event_budget` 存打出参数（`rules.js:21127` 附近）

```js
accum: Object.assign({}, arg),   // 与 pending_event_step.accum 同款浅拷
```

### ③ `event_finish` 续跑合并参数（`rules.js:32472` 附近）

```js
const res = resolve_event_card(game, b.nation, b.card_id,
    Object.assign({}, b.accum || {}, { choice: b.choice }), b.resumeStep)
// 旧：{ choice: b.choice } —— 丢掉玩家已选 spaces[stepIndex]
```

**为什么必须补 ②③**：除 ① 之外，实测发现「先陆战」分支选〈地中海〉，
`event_finish` 结束预算后续跑却建在〈北海〉——续跑只回传 `choice`，
`resolve_event_card` 回落 `cands.slice(0, need)` **自动挑第一个候选**，
违反「服务端不替玩家做选择」。这是框架既有缺陷（15225 单候选看不出来），
4 分支有 4 个海域候选后暴露。打出时未传 `spaces` 的卡行为不变。

## 4. 验证 `tools/_real_test_16300_torch_choice.js` → 39/39

```
A ★★ 未选分支 -> need:'choice' + 恰好 4 个选项，标签覆盖「先陆战/先建设」×「陆军/海军」
B ★★ 海军分支(1/3)候选 = 4 个相邻海域，不含陆地
C ★★ 陆军分支(0/2)候选 = 3 个相邻陆地，不含海域
D ★★ choice=3 选【最后一个候选 地中海】-> 真的建出 美国/navy（旧实现做不到），分步停在第 2/2 步
E ★★ choice=2 选陆地 -> 建出 美国/army（旧行为不回归）
F ★★ choice=0/1 -> 先建立战斗预算（resumeStep=1、无 useNewPiece），此刻尚未建设
G ★★ 「先建设」链路：view.actions 放行 event_step_next；点下一步后建立战斗预算
H ★★ 「先陆战」链路：view.actions 放行 event_finish；结束预算后续跑建设，
     且【保留玩家选的海域】（选地中海就建地中海，不是自动挑北海）
I ★  残留检查：16300 已离手、无 17555 弃牌挂起残留、非洲北部原陆军未被误改、view 正常
```

测试全部走真实 `R.action`：含 17555《大萧条的余波》前置弃牌 →
`us_depression_discard` 付代价 → `resume` 重放；补给链用 `set_supply_point` +
`compute_supply` 摆出，未手写状态替代引擎流程。

## 5. 回归（与 HEAD 对照，确认无新增失败）

```
node --check rules.js                     SYNTAX=0
_real_test_16300_torch_choice.js          39 / 39
_real_test_17543_radar.js                 4 / 4
_real_test_16703_delegate_skill.js        5 / 5
_real_test_15243_atlantic.js              3 / 3
_real_test_17901_choose.js                8 / 8
_real_test_supp_su.js                    25 / 25
test_event_cards.js                       190 / 11   （HEAD 同）
test_basic_cards.js                       288 / 9    （HEAD 同）
_verify_multistep.js                      通过 5 / 失败 5（HEAD 同）
_smoke_german_effect.js                   PASS=88 FAIL=6（HEAD 同）
_smoke_status.js                         PASS=20 FAIL=2（HEAD 同）
_smoke_econ.js                           与 HEAD 一致
check_reuse.js                           B/C 类干净；21 个 WARN 全是
                                         存量 skill 原子索引行号漂移（非本次引入）
```

> 对照方法：`git stash push -- rules.js` → 同一批脚本在 HEAD 下重跑 → `git stash pop`。
> 所有失败项数量与 HEAD **完全一致**，均为预存失败。
>
> 另单独验证共享续跑路径上的既有卡 **15225《阿登闪击战》**：
> 当前版与 HEAD 的 `event_finish` 日志**完全相同**（该测试局面西欧被法国陆军占据、
> 德国无邻接补给，建设本就不可行，日志「null 地区不存在」属既有噪音）。
> 它打出时未传 `spaces`，`accum` 只含 `card`，与原 `{choice}` 等价，未产生回归。

## 6. 玩家可见变化

```
以前：只能建陆军，且必须先建设再陆战；想建海军时海域根本不高亮
现在：打出后弹 4 个选项，可先陆战或先建设，可选建陆军或建海军
      · 选海军 -> 地图只高亮 4 个相邻海域
      · 选陆军 -> 地图只高亮 3 个相邻陆地
      · 选「先陆战」-> 先开战斗预算，结束预算后【按你已选的地区】续建
```

> 客户端 `play.js` / `play.html` **未改动**，无需 bump 版本串、无需强刷；
> 但 `rules.js` 已改，必须**重启服务器**才生效。
