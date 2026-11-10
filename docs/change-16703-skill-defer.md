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
