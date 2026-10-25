# 委托类挂起的动作门禁缺口（待补，2026-10-25 核查）

> 状态：**已确认缺口、未修复**
> 定位：`docs/pending-gate-matrix.md` 第五节列出的 4 类「⚠ 未修」
> 本文只描述现状、风险与补法，**不含代码改动**

## 一、为什么单列一份

`pending-gate-matrix.md` 已把 4 类缺口标为「未修」，但它们与已修的 `event_budget` / `pending_status_play`
**不是同一个病灶**：

| | 已修的两类 | 本文 4 类 |
|---|---|---|
| 让权 | 不翻 `active`，当前行动方不变 | **都翻 `active`**（`handoff_to`）+ 记录 `return_*` |
| 后果 | 当前方直接打牌 / 推阶段 | 接受方（当前行动方）绕过前端做别的事 |
| 修法 | 收窄白名单 + 后端冻结 | 需逐卡确认「放行集合」，误伤风险更高 |

## 二、缺口清单

| # | 卡 / 来源 | 字段 | 前端 `build_actions` | 后端 `do_action` | 放行动作 | 让权 |
|---|---|---|---|---|---|---|
| 1 | 17900《八月风暴》 | `pending_armed_delegate` | **排他** return `{use_armed_offer, skip_armed_offer, log}` | ❌ 无 | `use_armed_offer` / `skip_armed_offer` | ✅ `handoff_to(..., 'armed_delegate')` |
| 2a | 16703《罗马尼亚铁卫团》 | `delegate.mode='german_draw'` | **排他** `{italy_german_draw, event_delegate_decline, log}` | ❌ 无 | 同上 | ✅ |
| 2b | 17721《钢铁条约》 | `delegate.mode='chain'` | **排他** `{play_card, event_delegate_decline, log}` | ❌ 无 | 同上（`play_card` 是委托内容，**故意放行**） | ✅ |
| 2c | 17729《卡佩里尼》 | `delegate.mode='order'` | **排他** `{resolve_italy_chain, resolve_italy_play, log}` | ❌ 无 | 同上 | ✅ |
| 2d | 17535《租借法案》等 | `delegate.mode='single'` | **追加** | ❌ 无 | 各自 resolve | ✅ |
| 3a | 17526《民主兵工厂》 | `uk_build_delegate` | **追加** | ❌ 无 | `resolve_uk_build_delegate` | ✅ |
| 3b | 17529《摩尔曼斯克运输船队》 | `su_build_delegate` | **追加** | ❌ 无 | `resolve_su_build_delegate` / `finish_su_build_budget` | ✅ |
| 4a | 17532《战区移动》 | `us_theater_delegate` | **追加** | ❌ 无 | `resolve_us_theater_delegate` | ✅（美国自己多步） |
| 4b | 16304《中国远征军》 | `us_china_delegate` | **追加** | ❌ 无 | `resolve_china_delegate` | ✅ |

字段结构（实测，供后续构造用例）：

```js
uk_build_delegate   = { nation:'英国', remaining:[{op:'build',type:'navy'},{op:'build',type:'army'}], return_nation }
su_build_delegate   = { nation:'苏联', steps:[...], ... }        // 建设阶段转 pending_autobahn
us_theater_delegate = { nation:'美国', steps:[{op:'remove',...},{op:'build',type:'navy'},{op:'build',type:'army'}], done:0 }
us_china_delegate   = { step:'space', sea:<id>, candidates:[...], return_nation }
pending_armed_delegate = { nation:'苏联', ... }                  // 由 set_pending_armed_delegate 建立
```

## 三、风险分级

### 高风险：前端**追加**型（当前方在委托期间能直接打牌）

| 字段 | 说明 |
|---|---|
| `uk_build_delegate`（17526） | 美国委托英国"建 1 海军 + 1 陆军"，`remaining` 是无序数组，玩家可随时点地块。**期间英国仍能打牌** —— 与已修的 `event_budget` 完全同型 |
| `us_theater_delegate`（17532） | 美国自己移除 1 支 + 建 1 海军 + 1 陆军，`steps` 多步推进。**期间美国仍能打牌/推阶段** |
| `us_china_delegate`（16304） | 单步选地区征召；只有一步，窗口短，但同样不冻结 |
| `delegate.mode='single'`（17535 等） | 追加型，需按卡逐个确认 |

### 中风险：前端**排他**、后端无

| 字段 | 说明 |
|---|---|
| `pending_armed_delegate`（17900） | 前端只给 use/skip；后端无冻结。因 `active` 已翻给苏联，另一方提交 `play_card` 会被「现在轮到【X】行动」拒绝；但**苏联自己**提交别的动作不受阻 |
| `delegate.mode='german_draw' / 'chain' / 'order'` | 同上。注意 `chain` 是**故意**放行 `play_card`（德国打状态卡就是委托内容），不能一刀切 |

### 已被间接覆盖（不需单独补）

`su_build_delegate` 的**建设阶段**实际走 `pending_autobahn`（`open_su_build_budget`），
而 `pending_autobahn` 前后端都已冻结（放行 `resolve_autobahn` / `activate_status` /
`use_armed_offer` / `skip_armed_offer` / `finish_su_build_budget`）。
所以 3b 真正裸露的只是「征召步之间」与「预算创建前/收尾后」的缝隙，**优先级低于 3a**。

## 四、为什么本次不修

1. **构造用例会抛错**：手工塞字段时 `view` 直接崩 ——
   ```
   TypeError: dg.remaining is not iterable   (rules.js ~22803, view 内)
   ```
   必须用真实卡（17526 / 17529 / 17532 / 16304）打到挂起态，才能拿到结构完整的 state。
2. **放行集合必须逐卡确认**：例如 `chain` 模式**必须**保留 `play_card`，
   而 `uk_build_delegate` **必须**保留 `activate_status` / `use_armed_offer`
   （建设会武装 `after_build_army` 窗口，如 15247 贵在行动）。
   一刀切冻结会把正常路径冻死 —— 这与 17846 那次「先扣代价后校验」的教训同类。
3. 这些不是线上已验证的 bug（当前只在 `event_budget` 上确认过实际卡死）。

## 五、待补方案（模板）

### 5.1 只加后端（先止损，不动前端）

前端按钮保持不变（不会出现"按钮消失"的新问题），只在 `do_action` 加白名单：

```js
/*
 * 委托类挂起：等待方完成委托期间，只放行委托自身的动作 + 必须能插队的窗口。
 * ⚠ 逐卡确认放行集合，不要照抄。
 */
const DELEGATE_ALLOWED = {
    'uk_build_delegate':   { resolve_uk_build_delegate:1, restore_uk_build:1,
                             activate_status:1, use_armed_offer:1, skip_armed_offer:1, log:1 },
    'su_build_delegate':   { resolve_su_build_delegate:1, finish_su_build_budget:1,
                             resolve_autobahn:1, activate_status:1,
                             use_armed_offer:1, skip_armed_offer:1, log:1 },
    'us_theater_delegate': { resolve_us_theater_delegate:1, activate_status:1,
                             use_armed_offer:1, skip_armed_offer:1, log:1 },
    'us_china_delegate':   { resolve_china_delegate:1, activate_status:1, log:1 },
}
for (const k in DELEGATE_ALLOWED) {
    if (game[k] && !DELEGATE_ALLOWED[k][action] &&
        !(arg && arg.__debug) && !String(action).startsWith('debug_')) {
        game.log.push('委托进行中：请先完成当前委托')
        return game
    }
}
```

`pending_armed_delegate` / `delegate.mode` 同理，但放行集合更窄
（`german_draw`: `italy_german_draw` + `event_delegate_decline`；
`chain`: `play_card` + `event_delegate_decline`；
`order`: `resolve_italy_chain` + `resolve_italy_play`）。

### 5.2 再改前端（消除"看得见点不中"）

后端加完并验证不误伤后，把 `uk_build_delegate` / `su_build_delegate` /
`us_theater_delegate` / `us_china_delegate` 的分支从「追加」改为「收窄 return」，
与 `event_budget` 的写法保持一致。

## 六、逐类验证清单

| 类 | 用哪张卡构造 | 断言 |
|---|---|---|
| `pending_armed_delegate` | 17900 苏联（友方攻击中国东北后） | 挂起期间 `play_card` 被拒；`use/skip_armed_offer` 放行 |
| `delegate.german_draw` | 16703 意大利打出 | `play_card` 被拒；`italy_german_draw` / `event_delegate_decline` 放行 |
| `delegate.chain` | 17721 钢铁条约 | **`play_card` 仍放行**（德国打状态卡）；`event_delegate_decline` 放行 |
| `delegate.order` | 17729 卡佩里尼 | `resolve_italy_chain` / `resolve_italy_play` 放行；`play_card` 被拒 |
| `uk_build_delegate` | 17526 美国打出 | `view.actions` 无 `play_card` / `next_phase`；`resolve_uk_build_delegate` 放行；建设后 `activate_status` 仍可用 |
| `su_build_delegate` | 17529 美国打出 | 征召步之间 `play_card` 被拒；建设阶段走 `pending_autobahn`（已有门禁）不回归 |
| `us_theater_delegate` | 17532 美国打出 | 三步之间 `play_card` / `next_phase` 被拒；`resolve_us_theater_delegate` 放行 |
| `us_china_delegate` | 16304 美国桌面 + 中国陆军被移除 | `play_card` 被拒；`resolve_china_delegate` 放行 |

统一验收：

1. 该挂起期间 `view.actions` 不含 `play_card` / `next_phase`（高风险的 4 个）
2. 直接提交 `play_card` → 被拒且日志有原因
3. 委托自身动作全部放行（含 `activate_status` 等插队窗口）
4. **委托正常走完一遍不卡死**（这是最容易翻车的地方）
5. 全量 smoke 回归无新增失败

## 七、相关代码位置

| 内容 | 位置（`server-official/public/quartermaster-sub-wars/rules.js`） |
|---|---|
| `build_actions_inner` 的委托分支 | 24617–24844 |
| `do_action` 冻结段（**需在此补**） | 25382–25510 |
| `pending_armed_delegate` 建立 | `set_pending_armed_delegate`（约 13169） |
| `uk_build_delegate` 建立 | 5624 |
| `su_build_delegate` 建立 | 5684（建设转 `pending_autobahn`） |
| `us_china_delegate` 建立 | 5605 |
| `us_theater_delegate` 建立 | 5980 |
| 各 resolve 动作 | 29241（china）/ 29256（uk）/ 29271（su）/ 29287（finish_su_budget）/ 29323（us_theater）/ 28058（event_delegate_decline） |
| 已修的同类参考 | `event_budget` 收窄 24756、后端 25467 |

参考文档：`docs/pending-gate-matrix.md`（总表 + 判别口径）
