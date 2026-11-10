# 17842《喀秋莎》：after_land 窗口只认发起国本人（消除假窗口）

> 2026-11-11 玩家报障 → 实施记录
> 相关：`docs/change-neutral-su-japan.md`、`docs/change-17900-manual-finish.md`

## 1. 玩家口径（原话）

> 「噶秋沙疑似未能实际生效，排查是哪里有问题。」→ 确认修法 **A**：
> 「卡面『发起陆战后』的主语是卡主本人，不是同阵营任一友方。」

| # | 口径 | 落地 |
|---|---|---|
| 1 | 只在本国发起陆战后可发动 | `arm_status_instant` 对 `after_land` 只武装 `own === nation`（发起国本人） |
| 2 | `after_ally_battle`（卡面写"友方"）保持同阵营 | 不动 |

## 2. 问题描述（探针 `tools/_probe_17842_katyusha.js`）

| 场景 | 喀秋莎 `ready` | 发动结果 |
|---|---|---|
| **苏联自己发起陆战**（打`<中国东北>`，2 支日军） | `true`，`space=21` | ✅ 弃 1 张、发起陆战、**移除剩余日军**、次数消耗 |
| **英国发起陆战**（同一目标） | **`false`**「只能在苏联的回合发动（当前是英国）」 | ❌ 报「**不能触发非本方的状态卡**」，日军不动、代价不扣 |

**根因链（三处判据互相矛盾）**

1. `arm_status_instant` 按**同阵营**武装（`if (faction_of_nation(own) !== fac) continue`）——
   英国/美国发起陆战时，把苏联桌面的《喀秋莎》也塞进 `game.status_instant`。
   但注释本意是「武装**本国** after_land 状态卡」。
2. `status_window_ready` 的 owner 判据要求 `nation === game.current_nation` → 英国回合时苏联不满足 → 置灰。
3. 唯一豁免 `status_instant_covers` 要求 `delegate_of_nation(e.by) === delegate_of_nation(owner)`
   （英国 ≠ 苏联），且 `CROSS_NATION_STATUS_WINDOWS`（`after_ally_battle`/`build_army`/`piece_removed`）里**没有 `after_land`** → 不放行。

→ 典型**假窗口**：窗口亮着（或灰着）却永远点不动。与 #8（15432 阵营视角过宽）、
17543《雷达》同类；雷达当初用 `trigger.ready` 修过，喀秋莎没声明 `ready` 所以漏了。

## 3. 修法（方案 A）

`rules.js` `arm_status_instant` 的 `table` 遍历里，在 `after_land` 窗口下只匹配发起国本人：

```js
if (window === 'after_land' && own !== nation) continue
```

影响面（全是「本国发起陆战后」的卡，收紧后行为正确）：
15253《闪电战》、15245《俯冲式轰炸机》、17842《喀秋莎》、17846《坦克运输》、17848《正面攻击》。
`after_ally_battle` 保持同阵营（卡面明确写"友方"）。

客户端零改动、不 bump `play.html`（不涉及 UI 与白名单）。

## 4. 真实测试矩阵

`tools/_real_test_17842_katyusha.js` — **20 项全过**：

| 组 | 覆盖 | 结果 |
|---|---|---|
| A | 苏联自己发起：窗口在、`by=苏联`、`ready=true`、发动后**移除剩余日军**、代价扣、次数消耗 | 9/9 |
| B | 英国发起：喀秋莎**不入窗口**；直发被拒且日军未被移除（不白扣） | 4/4 |
| C | 跨阵营（德国发起打苏联陆军）：喀秋莎**不入窗口** | 2/2 |
| D | 17848《正面攻击》同款：苏联发起入窗口 / 英国发起不入窗口 | 2/2 |
| E | 静态守卫：收紧条件存在、`CROSS_NATION_STATUS_WINDOWS` 不含 `after_land`、`after_ally_battle` 仍未收窄 | 3/3 |

## 5. 回归清单

| 项 | 结果 |
|---|---|
| `node --check rules.js` | 通过 |
| `_real_test_17842_katyusha.js` | 20/0 |
| `_real_test_neutral_17900.js`（E6 按方案 A 反转：英国发起 → 不入窗口） | 33/0 |
| `_real_test_17900_manual_finish.js` | 28/0 |
| `_smoke_air_retreat_restore.js` | 72/0 |
| `_smoke_seq.js` | 52/0 |
| `_smoke_su_status.js` | 28/6，`git stash` 对照 HEAD **完全一致**（预存） |
| `test_basic_cards.js` | 288/9，与 HEAD 一致（预存） |
| 全量冒烟 114 脚本 | 只剩 2 个未登记失败（`_smoke_17535_delegate_return.js`、`_smoke_us_event_a.js`），均预存 |

## 6. 边界

- 只有 `after_land` 收紧；`after_ally_battle` / `build_army` / `piece_removed` 等跨阵营窗口维持原样。
- 若将来出现「同阵营友方发起也算」的 `after_land` 卡，不能简单放开——需该卡声明
  `trigger.ready` 并把 `after_land` 加进 `CROSS_NATION_STATUS_WINDOWS`，同时处理
  `current_nation` 判定（6 人模式下跨玩家发动），成本较高。
- 苏联自己回合路径未受影响（A 组 9 项真测覆盖）。

## 7. 17732《德国军事顾问》借用兼容（同日补修）

**玩家追问**：「本次改动对 17732 会有影响吗？」—— 会，是真回归。

`17732` 让意大利**借用一张德国状态卡**本回合自用（`game.italy_borrow = { nation, card_face:<德国卡实例id>, turn }`）。
德国桌面的 `after_land` 卡正是：
- `15253《闪电战》`（发起陆战后损耗 1 张 → 在战斗地区建设陆军）
- `15245《俯冲式轰炸机》`（发起陆战后损耗 1 张 → 在战斗地区或相邻发起 1 次陆战）

若收紧按 `own !== nation` 一刀切：意大利借用 15253 后自己发起陆战，`own='德国'≠'意大利'` → 不武装。
而 `status_window_ready`（`rules.js:7927`）与 `activate_status`（`rules.js:33340`）里的 `borrowed`
豁免只解决「**能不能发动**」，救不了「**有没有被武装**」→ 借用彻底失效。

**改法**：收紧下沉到**单卡**层，并对「正被 `nation` 借用的那一张」放行：

```js
if (window === 'after_land' && own !== nation) {
    const _ib = game.italy_borrow
    const _isBorrowed = !!(_ib && _ib.turn === game.turn &&
        _ib.nation === nation && String(_ib.card_face) === String(cid))
    if (!_isBorrowed) continue
}
```

只放行被借的那一张，不会连带点亮德国其它 `after_land` 卡；英/美发起时苏联喀秋莎仍不武装（方案 A 不回归）。

`tools/_real_test_17732_borrow_after_land.js` — **15 项全过**：

| 组 | 覆盖 | 结果 |
|---|---|---|
| A | 借用 15253 → 意大利发起陆战 → 入窗口、`by=意大利`、`ready`、发动后**真在战斗地区建设意大利陆军** | 8/8 |
| B | 窗口只含 15253；苏联喀秋莎不被连带点亮 | 2/2 |
| C | 对照：德国自己发起 → 15253 正常入窗口（`own===nation` 未破坏） | 2/2 |
| D | 对照：英国发起 → 苏联喀秋莎仍不入窗口（方案 A 不回归） | 1/1 |
| E | 静态守卫：收紧仍在 + 借用豁免存在 | 2/2 |
