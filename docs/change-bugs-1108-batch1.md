# 20261108 报障修复·第一批（雷达 / 罗马尼亚铁卫 / 大西洋防线）

> 日期：2026-11-10　范围：`rules.js`（3 处）
> 顺序：按玩家要求"逐个来，先查同类范式"

## 1. #7 雷达 17543：响应链挂起期间无法发动

**范式参考**：P0（`finish_acts` / `p0_armed_escape`）——"窗口在就必须给发送权，合法性由动作自校验"。

**根因**：`status_actions_frozen(game)` 只看 `pending_battle / pending_econ / response_queue`，
一旦响应链排队就整体冻结状态卡；`register_status_actions` 与 `activate_status` 两处共用该判据，
于是雷达窗口武装了也点不动。

**改法**：
```js
function status_actions_frozen(game, card_id) {
    /* 卡自己处在"立刻窗口"（status_instant 已武装）→ 不冻结 */
    if (card_id && status_instant_covers(game, card_id, null)) return null
    ...
}
```
+ `register_status_actions`：冻结期间**只放行**处于立刻窗口的那张卡（不放宽到任意状态卡）；
+ `activate_status` 入口改为 `status_actions_frozen(game, cardId)`（与白名单同源）。

**验证** `tools/_real_test_17543_radar.js` 4/4：

```
A 响应链挂起 + 雷达窗口武装 → actions 含 activate_status；真发：损耗 2 + 还原海军 ✓
B 挂起中无窗口 → 不放行任何状态卡 ✓
C 窗口未武装 → 不放行 ✓
```

实测日志：`【美国】损耗 2 张牌 | 【美国】发动《雷达》—— 美国海军在夏威夷 不被移除（已还原）`

## 2. #4 罗马尼亚铁卫 16703：德国弃牌期间发不了意大利国家技能

**范式参考**：同一分支上方既有注释——"与国家技能窗口并存时，必须**叠加**而非替换"（armed 那一段）。

**根因**：`national_skill_offer` 是排他分支，只给 `use/skip_national_skill + play_card`；
而 16703 的 `delegate[german_draw]` 需要 `italy_german_draw / event_delegate_decline`。
两者同刻出现时，德国那边的收尾动作被挤掉 → 委托走不完（表现为"技能发不了 / 卡住"）。

**改法**：
- `finish_acts()` 追加：本方持有 `national_skill_offer` → 补 `use/skip_national_skill`（覆盖 13 个排他分支）；
- `national_skill_offer` 分支追加：与 delegate 并存时叠加 `italy_german_draw` / `event_delegate_decline`。

**验证** `tools/_real_test_16703_delegate_skill.js` 5/5：

```
A 有技能窗口 + german_draw → Axis actions 含 use/skip_national_skill ✓
B 无窗口 → 不给键 ✓
C 德国弃牌通道未被挤掉 ✓
D 真发技能能结算（减 2 分 + 日志）✓
```

> 注：意大利与德国同属 Axis，客户端按阵营取 actions，故断言看 Axis 侧。

## 3. #6 大西洋防线 15243：应只对"友方陆军"

**范式参考**：同函数里既有的声明式过滤（`rc.space` / `rc.has_army` / `rc.type`）。

**根因**：`status_on_attacked()` 只有 `space / has_army / type` 三个过滤，**没有"受害方是否友方"**
→ 西欧遭攻击时，无论上面是轴心还是同盟部队，德国都能触发（玩家报障："应该是友方，当前是任意单位"）。

**改法**：新增声明式 `friendly_only`（`true` = 任意兵种；数组 = 限定兵种）：

```js
if (rc.friendly_only) {
    const _ownF = faction_of_nation(n)
    const _want = Array.isArray(rc.friendly_only) ? rc.friendly_only : null
    const _friendlyHere = Object.keys(game.location || {}).some(p =>
        Number(game.location[p]) === Number(space) &&
        faction_of_nation(game.piece_nation[p]) === _ownF &&
        (!_want || _want.indexOf(game.piece_type[p]) >= 0))
    if (!_friendlyHere) continue
}
```

15243 配置：`react: { when:'attacked', space:'西欧', attrition:3, friendly_only:['army'] }`
（卡面写"友方**陆军**"，故限定 army，海军被陆战攻击时不触发 —— 实测旧实现连海军也会触发。）

**验证** `tools/_real_test_15243_atlantic.js` 3/3：

```
A 西欧=德国陆军 → 触发，攻击方（英国）损耗 3 ✓
B 西欧=法国陆军（同盟）→ 不触发（该攻击本身也被规则拒绝）✓
C 西欧=德国海军 → 不触发 ✓
```

## 回归

```
_real_test_17543_radar 4　_real_test_16703_delegate_skill 5　_real_test_15243_atlantic 3
_real_test_window_in_pending 24（P0）　_real_test_16804_echo_window 10
test_basic_cards 288/9　全量冒烟 112 全绿
```
