# 17900《八月风暴》：补齐通用增强卡弃牌代价框

> 2026-11-11 玩家口径 → 实施记录
> 相关：`docs/change-neutral-su-japan.md`、`docs/pitfalls.md`

## 1. 玩家口径（原话）

> 「缺失通用增强打出的弃牌框，复用其他苏联增强的弃牌代价实现，例如 17809」

| # | 口径 | 落地 |
|---|---|---|
| 1 | 打出 17900 要弹弃牌框 | 窗口 `cards[].cost` 原样下发对象（`{discard:1, filter:'build'}`） |
| 2 | 复用通用实现（17809 那套） | 走客户端既有 `pending_echo_discard.armed` → `echo_discard_modal`，不新造 UI |
| 3 | 服务端判定同源（顺带修） | `use_armed_offer` 补 `filter === 'build'` 类型校验 |

## 2. 现状与证据

`tools/_dom_test_17900_discard.js`（jsdom 加载真实 `play.html` + `play.js`）修复前表现：

| 环节 | 通用增强卡（17809 等） | 17900（修复前） |
|---|---|---|
| 窗口 `cards[].cost` | `ar.cost` **对象** | `(eff.armed.cost && eff.armed.cost.discard) \|\| 0` → **数字 `1`** |
| 客户端 `update_armed_offer_box` | `c.cost.discard=1` → `dis=1` → 弹弃牌框 | `c.cost.discard=undefined` → `dis=0` → **直接 `use_armed_offer{card}`** |
| 服务端 `use_armed_offer` | `ar.cost.discard=1`，要求 `gathered.drop` | 同样要求，收到空 → 拒绝并**保留窗口** |
| 结果 | 正常选牌 → 结算 | **点「打出」被拒 → 框还在 → 再点还是被拒 = 死锁** |

另有两处同源缺口：
1. `play.js` 的 `pending_echo_discard.card` 只传 `{id}`，而 `update_echo_discard_box` 标题用 `pd.card.name` → **所有** armed 弃牌代价都会显示「《undefined》」。
2. 服务端 `_picked` 只校验 `filter === 'response'`，**没有 `'build'`** → 直接调 action 可以拿任意手牌替代「建设陆军」（客户端过滤只是摆设）。

## 3. 修法

| # | 位置 | 改法 |
|---|---|---|
| 1 | `rules.js` `maybe_arm_su_augstorm` | `cost: eff.armed.cost \|\| {}`（原样对象），与 `scan_armed_cards` / `offer_armed_effects` 下发的形状同源 |
| 2 | `play.js` `update_armed_offer_box` | `pending_echo_discard.card` 补 `name: c.name`，修掉「《undefined》」标题 |
| 3 | `rules.js` `use_armed_offer` | `_picked` 补 `filter === 'build'`：BASIC 且 `name === '建设陆军'`；拒绝日志按 filter 输出「张[建设陆军]」 |

客户端选牌 UI 完全复用（`play.js:4804-4839` 早已把 `build` 映射为「BASIC 且 name=建设陆军」），**无需新增代码**。

## 4. 测试矩阵

`tools/_dom_test_17900_discard.js` — **19 项全过**：

| 组 | 覆盖 | 结果 |
|---|---|---|
| A | 服务端窗口形状：`cost` 是对象、`discard=1`、`filter='build'`、让权已切苏联 | 4/4 |
| B | `#ask_box` 出现「打出《八月风暴》（弃 1 张）」；点击**不直接发 action** 而是弹 `echo_discard_modal` | 4/4 |
| C | 标题含卡名（无 `undefined`）+ 写明「建设陆军」；候选只 2 张且都是建设陆军（不含 17801） | 4/4 |
| D | 选 1 张确认 → `use_armed_offer{card:17900 实例, drop:[17800 实例]}` | 3/3 |
| E | 服务端类型校验：拿《发起陆战》当代价被拒、窗口保留、17900 仍在手牌 | 3/3 |

## 5. 回归清单

| 项 | 结果 |
|---|---|
| `node --check rules.js` / `play.js` | 通过 |
| `_dom_test_17900_discard.js` | 19/0 |
| `_real_test_supp_su.js`（17900 基础链路） | 25/0 |
| `_real_test_neutral_17900.js`（让权 + 组合场景） | 33/0 |
| `_smoke_us_status3.js`（16304 共用 armed_delegate） | 41/0 |
| `test_basic_cards.js` | 288/9（与基线一致） |
| `_real_test_supp_us.js` | 3/29（与 HEAD 一致，预存） |
| `tools/check_reuse.js` | B/C 复用检查干净 |
| 全量冒烟 114 脚本 | 只剩 2 个未登记失败（`_smoke_17535_delegate_return.js`、`_smoke_us_event_a.js`），均为此前多次 HEAD 对照确认的预存 |

## 6. 边界

- 只修 17900 这条**手工构造窗口**的路径；`scan_armed_cards` / `offer_armed_effects` 生成的窗口本来就是对象，不受影响。
- `filter === 'build'` 的服务端校验只作用于**弃牌代价**；卡效果本身的「需要[建设陆军]」判定仍走原有 `resolve_event_card` 逻辑。
- 客户端 `filter` 支持 `response` / `build` / 其它类型字符串；新增代价类型时，服务端 `_picked` 必须同步补校验（否则客户端过滤可被直接调 action 绕过）。
