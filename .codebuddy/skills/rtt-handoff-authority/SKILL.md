---
name: rtt-handoff-authority
description: RTT 让权/委托（让另一国执行建设、征召、出牌、弃牌、结算）时用：两级主体模型与同/跨阵营两种范式。
---

# RTT 让权范式(handoff / delegate authority)

## 目的
把"让权给另一国执行一段操作"做成可复用、不死锁、且为 6 人(按国家)模式铺路的统一范式。核心是选对【让权主体】：到底翻 `game.active` 还是切 `game.current_nation`。

## 何时使用
- 新增任何"A 国打出卡 → 让 B 国执行建设/征召/出牌/弃牌/选牌"的委托卡。
- 排查让权类 bug："看不到挂起框""点了没反应""不触发对方(被委托国)的状态卡""6 人模式下对方玩家收不到""选完卡死"。
- 改造旧让权(只用 handoff_to 翻 active)以支持被委托国状态触发 / 6 人模式。

## 核心模型：让权主体的两级
- `game.active` = 【阵营】(Allies/Axis，role 级)。`handoff_to(game, holder, id)` 只翻 `game.active`。
- `game.current_nation` = 【国家】(德/英/日/苏/意/美)。很多逻辑按它：状态卡触发守卫 `nation === game.current_nation`(rules.js status 处)、每国配额(`play_done` 等)、`view.my_nation`。
- `view.my_nation`：若 `current_nation` 属于本方阵营则取 `current_nation`，否则取本方"排最前"国家(view L18887-18889)。**客户端身份跟随 `current_nation`**。
- 阵营归属：Axis=德/意/日；Allies=英/法/苏/美/中(`NATION_FACTION`)。苏联/英国/中国都与美国同属 Allies。

## 决策：翻 active 还是切 current_nation？
| 场景 | 做法 | 例 |
|---|---|---|
| 跨阵营让权(A→B 不同阵营) | 切 `current_nation=B` **且** 翻 `game.active=B 的 role`，并记 `return_nation`/`return_active` | 17553 美国→日本(us_japan_delegate) |
| 同阵营让权(A→B 同阵营) | **只切 `current_nation=B`**，不翻 active(翻了也无变化)，记 `return_nation` | 17721 意→德(it_delegate)、17529 美→苏(su_build_delegate)、17526 美→英(uk_build_delegate) |

**判据**：只要要求"这段操作由 B 国为主体执行"(触发 B 的状态卡、B 的配额、6 人模式 B 玩家收到)，就必须切 `current_nation=B`——与是否同阵营无关。跨阵营额外还要翻 `active`(否则对方界面顶栏不变"可操作")。

## 铁律
1. **只 `handoff_to`(翻 active)对同阵营让权无效**：苏联/英国/中国与美国同属 Allies，翻 active 等于没翻，且不切 current_nation → ①不触发被委托国状态卡(触发守卫 `nation===current_nation` 失败)②`view.my_nation` 不变成 B 国 ③6 人模式 B 玩家收不到。**同阵营让权必须切 `current_nation`**。
2. **严禁在卡逻辑里裸写 `game.active`**：active 只能经 `handoff_to`/`reconcile_handoff`/`rectify_active` 改(见 rtt-pending-suspend)。同阵营让权根本不该碰 active。
3. **服务端必须 autoskip 兜底，绝不给客户端空候选**：被委托国某步"无合法目标"时(罗斯被占、无可建地、无后备)，服务端要自动跳过该步/该兵种；否则 view 下发的 `candidates=[]` → 客户端 `update_*_box` 的 `if(!cands.length)return` 静默不渲染 → 既看不到框、也点不动、退不出 → **死锁**。
4. **收尾必须归还 `current_nation`**：finish 时 `game.current_nation = dg.return_nation`(原行动国)。漏还 → 回合停在他国、后续阶段错乱。
5. **动作必须登记白名单**：`build_actions` 放行 `resolve_*_delegate` 给被委托方阵营(`faction_of_nation(dg.nation)===side`)；不在册=客户端静默不发(见 rtt-pending-whitelist-deadlock)。

## 标准实现结构(7 步)
可直接套用的代码骨架见 `references/delegation-template.md`。概要：
1. `offer_X_delegate`：设 `game.X_delegate={nation:B, steps/remaining, done:0, return_nation: fromNation||game.current_nation}`；`game.current_nation=B`；(跨阵营才 `handoff_to`/翻 active)；`X_autoskip`；log。
2. `X_autoskip`：从当前步起，凡 `can_build_at/can_recruit_at` 无合法目标的步/兵种自动跳过；全部处理完则 `finish_X_delegate`。
3. `finish_X_delegate`：清 `game.X_delegate`；归还 `game.current_nation=dg.return_nation`；(跨阵营才还 active)；★卡走 `after_card_resolved(game, return_nation, '<id>')`。
4. `resolve_X_delegate`：每步成功后调 `X_autoskip` + `refresh`。**不要**再写"仅当全部完成才收尾"的旧判断(中间步被跳过会漏收尾)。
5. view：下发 `X_delegate`，`candidates` **只对被委托方阵营**算并下发；元素是**对象 `{id,...}`**(不是裸数字)。
6. `build_actions`：`faction_of_nation(game.X_delegate.nation)===side` 时放行 `resolve_X_delegate`。
7. 客户端：`update_X_box`(按 candidates 高亮 + render_ask_box)与 `on_click_space` 分支；**点选用 `c.id`**，回传 `resolve_X_delegate {space: id}`。

## 客户端/服务端同步要点
- view `candidates` 是 `{id,...}` 对象数组；`on_click_space` 用 `c.id` 命中，`send_action('resolve_X_delegate', {space: <id>})`。传整个对象会让服务端 `Number(对象)=NaN` → "地区不存在"。
- `update_X_box` 保留 `if(!cands.length)return` 可以，但**前提是服务端已 autoskip 保证候选非空**；否则必须改成"显示无法执行/委托进行中"提示。
- 判定同源：客户端不自己维护时点/候选，全部读服务端 view 字段(避免两端漂移)。

## 测试驱动(`rules.action` 实跑)
- 同阵营让权：`current` 传**阵营 role**(苏联/英国=allies → 传 `'Allies'`)，`action(g,'Allies','resolve_X_delegate',{space:id})`。
- 必须断言：① offer 后 `game.current_nation==='B国'`(挂起主体)② 每步推进/自动跳过 ③ finish 后 `game.current_nation==='美国'`(归还)④ (跨阵营)`game.active` 归还。
- 取 view 候选用 `view.X_delegate.candidates[k].id`(对象)，别传整个对象。
- 参照 `_test17529.js` / `_test17526.js`。

## 6 人(按国家)模式剩余工作(本次已铺路，尚未做完)
切 `current_nation=B` 已让"挂起主体=B 国"成立；6 人还需两块框架级改造：
1. **view 按国家分发**：现在 `my_faction=side`(阵营)给所有人发同一份；6 人要把"会话→国家"落地(`my_faction` 或新增 `my_nation` 路由)。
2. **让权期间冻结原行动国**：`current_nation=B` 期间冻结 A 的回合操作，只放行 B 的 `resolve_*_delegate`(可仿 us_japan_delegate 的冻结块)。

## 交叉引用
- `rtt-pending-suspend`：挂起(active 翻转/让权)通用范式、跨 action 状态落盘。
- `rtt-pending-whitelist-deadlock`：动作白名单"不在册=静默不发"。
- `rtt-delegate-flip`：翻转类委托"控制权必须成对翻转/归还"(租借法案/钢铁条约/罗马尼亚铁卫团)。
- `rtt-card-bug-repro` / `rtt-realboard-test`：用 `rules.action` 实跑复现让权 bug。
