# 16703 让权 × 意大利国家技能：延后开窗，归还后立即补开（方案 B）

> 2026-11-11 玩家口径 → 实施记录
> 相关：`docs/change-17535-pending-target.md`、`docs/change-17543-radar-pause.md`

## 1. 玩家口径（原话）

> 「当前 16703 的让权，我希望参考 17721，保证不会让意大利国家技能和让权冲突」

逐项确认（2026-11-11）：

| # | 口径 | 落地 |
|---|---|---|
| 1 | 前者：**让权期间完全不弹**意大利国家技能窗口 | 通用延后判据，★卡权益记进 `national_skill_deferred`，不丢 |
| 2 | **B（彻底）**：把 17721 的专用标记与 `play_card` 卡面硬编码也收敛到通用机制 | 删 `pending_17721_skill`、`!== '17721'`、`after_card_resolved('意大利','17721')`；改用声明式配置 |
| 3 | 归还后**立刻**补开 | `exports.action` 统一出口 `flush_deferred_national_skill` |

## 2. 现状与只读探针证据

`tools/_probe_16703_skill_handoff.js`：`_board_lib.new_board` 真实盘面 + 真实 `play_card` +
`event_step_next` 推进 16703 分步机（step1 征召巴尔干 → step2 `run` 建 delegate），
全程不手填 `delegate` / `national_skill_offer`。

| 时点 | `current_nation` | `delegate` | `national_skill_offer` | 结论 |
|---|---|---|---|---|
| 16703 第 2 步完成 | 德国 | `german_draw` | **OPEN(意大利)** | ★ 两窗口并存（要避免的冲突） |
| 德国点手牌 → `italy_german_draw` | 意大利 | null | **null** | ★ 技能窗口被误清，★卡权益丢失 |
| 德国点「放弃」→ `event_delegate_decline` | 意大利 | null | OPEN(意大利) | 靠**硬编码 17721** 才补回，日志错写《钢铁条约》 |

对照 17721 真实路径：**让权全程不开窗，德国归还后才 OPEN(意大利)**。

**三个根因**

1. **开窗时机**：16703 是★卡（`STARRED_CARDS`），走 `finish_event_card` →
   `after_card_resolved` 无条件开窗；此时 step2 已把控制权翻给德国，
   `national_skill_offer` 与 `game.delegate` 抢 `active`/`current_nation`。
   17721 走 `play_card` EVENT 分支，那里有 `!== '17721'` 硬编码跳过。
2. **错过即失效误清**：`do_action` 守卫按
   `faction_of_nation(off.nation) === side` 判定；意大利与德国**同属 axis**，
   德国答 `italy_german_draw` 会把意大利技能窗口当作「本方已放弃」清掉。
3. **两条收尾路径不对称 + 卡面硬编码**：`italy_german_draw` 只 `finish_delegate`
   不补开；`event_delegate_decline` 对 `chain`/`german_draw` 共用，写死
   `after_card_resolved(game,'意大利','17721')` 和《钢铁条约》文案。

**与 #4 的关系（推翻依据）**：台账 #4（`0c92156`）修的是「让两窗口**并存**、
白名单叠加谁先答都行」，且 `_real_test_16703_delegate_skill.js` 的 4 项断言
**手工塞** `g.delegate`/`national_skill_offer`（假绿）。本次口径与该方向相反，
按约定先说明依据再实施。

## 3. 修法

| # | 位置 | 改法 | 为什么 |
|---|---|---|---|
| 1 | 新增 `delegate_skill_reason(game)` | 通用判据：① `game.delegate` 存在 ② `pending_cross_faction_handoff`（17553）③ 卡配置声明 `deferSkillUntilDelegateEnd` 且它的 `extra_play` 仍在 | 一类判据覆盖 16703/17721/17729/17535/17553；不写死卡面 id。③ 专门处理 17721「打出时 delegate 尚未建立」的链式形态 |
| 2 | `EVENT_EFFECTS['17721']` | 加声明式 `deferSkillUntilDelegateEnd: true` | 替代 `play_card` 里的 `!== '17721'` 硬编码 |
| 3 | `maybe_offer_national_skill` | 延后判据由「仅跨阵营 17553」换成 `delegate_skill_reason`；命中即写 `national_skill_deferred` 并 return | 延后不是丢弃；可用性 guard 在补开时再跑一次 |
| 4 | 新增 `flush_deferred_national_skill(game)` | 挂在 `exports.action` 的 **finally 末尾** | 所有 `after_card_resolved`/清窗/`finish_delegate` 都跑完才补开；避开 17721 德国状态卡是★时覆盖窗口的时序坑；一处覆盖所有收尾路径 |
| 5 | `play_card` EVENT 分支 | 删 `!== '17721'` 特判，一律 `after_card_resolved` | 是否延后由通用判据决定 |
| 6 | `play_status_card_impl` / extra_play 钩子 | 删 `pending_17721_skill` 的设置与消费 | 不再维护第二份延后状态 |
| 7 | `event_delegate_decline` | 按 `mode` 分流文案；删写死的 `after_card_resolved('意大利','17721')` | 16703 两条收尾路径都由 #4 统一补开 |
| 8 | `finish_us_japan_delegate` | 删本地补开，收敛到统一出口 | 17553 与 16703/17721 共走一条路径 |
| 9 | `build_actions` 的 #4 叠加 / `finish_acts` | **保留不动** | 防御性兜底，避免扩大改动面 |

客户端零改动：国家技能框在独立 `#national_skill_box`，让权框在 `#ask_box`，
两者不抢容器；延后后更不会同屏。因此**不 bump `play.html` 版本串**。

## 4. 真实测试矩阵

`tools/_real_test_16703_delegate_skill.js` — **重写，37 项全过**
（真实 `play_card` + `event_step_next`，不手填状态）：

| 组 | 覆盖 | 结果 |
|---|---|---|
| A | 让权期间不开窗、延后权益登记、白名单仍可收尾、不给技能键 | 9/9 |
| B | `italy_german_draw` 归还后立即补开、窗口可用、按 mode 写《罗马尼亚铁卫团》 | 7/7 |
| C | `event_delegate_decline` 同样立即补开（两条路径一致） | 4/4 |
| D | 补开的窗口**真能结算**（扣 2 分 + 授权额外打出） | 3/3 |
| E | 方案 B 静态守卫：无 `pending_17721_skill`/卡面硬编码、声明式配置、统一判据与出口 | 7/7 |
| F | 17729 / 17535 让权链不回归（含「大萧条的余波」真实代价路径） | 7/7 |

`tools/_real_test_17721_skill_defer.js` — **新增，23 项全过**：

| 组 | 覆盖 | 结果 |
|---|---|---|
| A | 17721 打出后不开窗、延后登记、打出响应牌建链后仍不开窗 | 8/8 |
| B | 德国**打出状态卡**归还后立即补开（旧 `pending_17721_skill` 路径） | 6/6 |
| C | 德国放弃归还后同样补开、chain 文案 | 4/4 |
| D | 补开的窗口真能结算 | 2/2 |
| E | 普通★卡（17717，也是分步卡）不被通用判据误延后 | 3/3 |

## 5. 回归清单

| 项 | 结果 |
|---|---|
| `node --check rules.js` | 通过 |
| `_real_test_16703_delegate_skill.js` | 37/0 |
| `_real_test_17721_skill_defer.js` | 23/0 |
| `_diag_17554_post_skill.js` | 发现 BUG 项 = 0（17553 跨阵营让权补开正常） |
| `_smoke_us_status3.js` | 41/0 |
| `_smoke_17721.js` / `_smoke_delegate.js` | 1 / 8 FAIL，`git stash` 对照 HEAD 数值**完全一致**，预存 |
| `tools/check_reuse.js` | B/C 复用检查干净；A 类 WARN 为 skill 索引行号漂移（预存） |
| 全量冒烟 114 脚本 | 剩 2 个未登记失败：`_smoke_17535_delegate_return.js`(23/4)、`_smoke_us_event_a.js`(56/1)；HEAD 对照完全一致，预存 |

## 6. 边界 / 仍会卡的情形

- **延后只在 ★卡 `after_card_resolved` 被调用时登记**。若某张让权卡不是★卡、
  或让权发生在技能窗口已开之后，本机制不介入（沿用既有语义）。
- **`deferSkillUntilDelegateEnd` 依赖 `extra_play.source` 能查到卡配置**。
  若将来有链式让权卡不通过 `grant_extra_play` 建立，需要同步扩展
  `delegate_skill_reason` 的第 ③ 条判据。
- **补开时机是动作出口（finally）**，不是 `finish_delegate` 内部：
  内部重放（`internal_action`）不走 `exports.action`，但让权归还都是顶层动作，
  已由 B/C/D 三组真测覆盖。
- 台账 #4 的 `#4 叠加` 白名单保留作防御性兜底，主路径不再依赖「两窗口并存」。
- `national_skill_deferred` 是既有字段（原只服务 17553），本次未新增状态字段，
  无需旧存档迁移。

## 7. 两套机制并存：新卡该复用哪一套

> 本节是 `rtt-effect-recipes` §2.3 / `rtt-national-skill-framework` §4
> 新增判定的实现细节落点（skill 只留判定，细节留 docs 可 git 追溯）。

玩家可见语义是同一条（让权未决期间不弹国家技能窗口，归还后给），
但引擎里是**两条不同路径**，不是「一个通用方法」：

| | 旧套：推迟整个 ★卡结算 | 新套：延后开窗 |
|---|---|---|
| 适用卡 | 17526 / 17529 / 17535 | 16703 / 17721 / 17553 |
| ★卡何时结算 | 委托结束后才第一次结算 | **打出时就结算完**（分步卡 `finish_event_card` 或 EVENT 常规分支） |
| 打出时 | `play_card` 分支直接 `return game`，**从不调** `after_card_resolved`，窗口从未被请求 | 会调 `after_card_resolved` → `maybe_offer_national_skill`，窗口「本该开」 |
| 让权载体 | 独立字段 `uk_build_delegate` / `su_build_delegate`（17526/17529）；`game.delegate` `mode:'single'`（17535） | `game.delegate`（翻转类）/ `us_japan_delegate`（17553 跨阵营）/ 声明式 `deferSkillUntilDelegateEnd`（17721 链式） |
| 补开方式 | 各自 `finish_*` 里手写 `after_card_resolved(game, return_nation, '<face>')`：`finish_uk_build_delegate`、`finish_su_build_budget`、`finish_su_build_delegate`、`finish_us_lend_lease`，共 4 份 | `delegate_skill_reason` 判让权未决 → 写 `national_skill_deferred` → `exports.action` 出口 `flush_deferred_national_skill` 归还后立刻补开，**一处覆盖所有收尾路径** |
| 是否通用 | ❌ 人工照抄（17526 注释自写「仿 17535 先例」） | ✅ 统一判据 + 统一出口 |

**为什么旧套没被判据误伤**：它们的 `finish_*` 都先把独立字段置 null **再**补调
`after_card_resolved`（如 `rules.js:6639` 清空 → `6645` 补开），所以
`maybe_offer_national_skill` 走到 `delegate_skill_reason` 时让权已结束，
判据返回 null → 正常开窗。它们靠「补开时让权已经没了」绕过判据，
不是靠判据识别它们。

**`delegate_skill_reason` 的实际覆盖范围**（`rules.js:6418`）：只认三条 ——
① `game.delegate`；② `us_japan_delegate`；③ `extra_play.source` 声明了
`deferSkillUntilDelegateEnd`。**不认** `uk_build_delegate` / `su_build_delegate` /
`us_china_delegate` / `us_theater_delegate` / `su_purge_delegate`。这是「维持现状」
的既定边界，不是遗漏。

### 新卡复用判据

1. **控制层一律走 `game.delegate` + `set_pending_delegate` / `finish_delegate`**
   （`rtt-delegate-flip` 铁律 1「单一状态对象」）。不要再新开 `xxx_delegate`
   独立字段 —— 那样判据①认不到，只能再手写一份补开，等于复制旧套的债。
2. **若 ★卡打出即结算完**（绝大多数）→ 用新套，通常**零接线**：
   判据①自动识别 `game.delegate`，补开由统一出口负责。
3. **若让权链要等后续 `extra_play` 才建立**（17721 型）→ 卡配置加声明式
   `deferSkillUntilDelegateEnd: true`，让判据③覆盖「打出瞬间 delegate 还不存在」的窗口。
4. **仅当卡面明确要求「委托完成后才结算」**（17526/17529/17535 型）才用旧套：
   `play_card` 分支 `return game`，在 `finish_*` 里先清字段/归还控制权，
   **再**补调 `after_card_resolved`。注意这是「推迟结算」，不是「延后开窗」。
5. **补开顺序铁律不变**：先归还 `current_nation` / `active`，再补开；
   且必须排在所有 `after_card_resolved` 之后（否则被让权方的★卡会覆盖窗口）。

### 若将来要真正收敛成一个机制（未实施，玩家裁定「维持现状」）

- 把 `delegate_skill_reason` 扩成**声明式让权注册表**，登记各 `*_delegate` 字段；
- 把旧套 4 份 `finish_*` 手写补开收敛到「延后登记 + 统一出口补开」。
- 风险：会碰 17535 刚修过的委托残留（`bb4906c`）、17529 建设预算收尾、
  17526 的「大萧条的余波」前置挂起；当前没有玩家可见 bug，收益仅为消除重复。
