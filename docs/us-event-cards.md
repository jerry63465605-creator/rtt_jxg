# 美国 EVENT 卡（组 A/B/C）实现跟踪

## 说明（重要背景）

RTT 当前只有 `Axis` / `Allies` 两个**角色（role）**，但规则里有英国、苏联、美国、中国、法国、日本等多个**国家（nation）**。
- 英国 / 苏联 / 美国 / 中国 / 法国 同属 `Allies` 阵营；
- 德国 / 意大利 / 日本 同属 `Axis` 阵营。

因此凡卡面写「让权给 X 国操作」「X 国建设/征召」，在**单人双角色**模式下，实际仍由你（对应阵营的玩家）在**挂起界面交互式**完成——
引擎翻转 `active` 给被让权方阵营、渲染候选合法地区、你点地图选点，放置的是 X 国单位、走 X 国判定。这正是「X 国操作」的语义，**不是**用 `as` 让美国代执行（方向性铁律：用户说"挂起给 X 国操作"＝让权 delegate，绝不自己代执行）。

---

## 组 A（17536 系列）— 已完成

声明式 `EVENT_EFFECTS` 同步结算（无挂起）。`tools/_smoke_us_event_a.js` 58/0 通过。

## 组 B（17526 / 17529）— 已完成

**让权挂起 delegate 范式**（仿 16304 中国远征军 / 17900 八月风暴 / 17721 钢铁条约 / 17817 进攻是最好的防守）：

- `rules.js`：`play_card` EVENT 分支加 hook（仿 17817 提前 return，占名额+移除手牌+offer）→ 新增 `offer_uk_build_delegate`/`offer_su_build_delegate`/`resolve_uk_build_delegate`/`resolve_su_build_delegate` → `view` 暴露 `uk_build_delegate`/`su_build_delegate`（候选用 `can_build_at`/`can_recruit_at` 实时算）→ `build_actions` 追加放行（避免白名单死锁）→ `action` 分发 + `_internal` 导出。
- `play.js`：`update_uk_build_box`/`update_su_build_box`（照抄 `update_us_china_box`）+ `update` 主循环调用 + `can_act_in_turn` 排除挂起 + `on_click_hand_card` toast 拦截 + `on_click_space` 点候选 `send_action`。
- `tools/_smoke_us_event_b.js` 29/0 通过。
- 详细机制见 `docs/pitfalls.md`【2026-10-10】B 组条目。

---

## 组 C — 已实施（2026-10-10 完成）

> 下列 7 张 C 组美国 EVENT 卡已全部实现并各有冒烟测试：
> - `17528` → `tools/_smoke_us_event_c5.js` 8/0
> - `17530` → `tools/_smoke_us_event_c1.js` 11/0
> - `17531` → `tools/_smoke_us_event_c6.js` 19/0
> - `17532` → `tools/_smoke_us_event_c3.js` 12/0
> - `17535` → `tools/_smoke_us_event_c7.js` 13/0
> - `16303` → `tools/_smoke_us_event_c4.js` 5/0
> - `17537` → `tools/_smoke_us_event_c2.js` 8/0
>
> ⚠️ 组 C 与组 B 不同点：B 组是「固定让权给某国」，C 组 17531/17535 是「玩家**选**一个友方国家」，需给 delegate 框架新增「选国」步骤；17535 还需「代理友方打出 1 张手牌」（现有 delegate 无此步）；16303 需新增「本回合日本响应压制」标记。

### 17528 广阔的资源 ✅
- **效果**：检视弃牌堆并选择 1 张牌，将其打出。
- **机制**：独立挂起 `game.us_replay`（不复用 `pending_echo`，避免与既有 echo 机制冲突）。候选 = **美国自身弃牌堆**全部卡，选 1 张「重新结算其效果」（`resolve_event_card` / `run_effect_tactics` 按卡类型分派，结算前先清 `us_replay` 避免递归挂起）。
- **已确认决策**：① 仅美国自身弃牌堆；② 不占出牌名额、照常结算效果、先不触发国家技能等额外机制；③ 打出的卡结算后仍落回弃牌堆、本次不二次打出（避免递归）。
- **注意**：卡牌 id 是**实例字符串**（如 `17501#15`），不能用 `Number()` 转换；`EVENT_EFFECTS` 查表用 `inst_card(id).id`（基础卡号）。

### 17530 代号：Magic
- **效果**：选择并暗牌弃置 1 张暗置的日本响应。
- **机制**：复用 14503 提尔比茨号 的 `uk_facedown_discard` 脚本类型，把"英国"参数化为"日本"——从 `game.table_responses` 中 `nation==='日本'` 的暗置响应里选 1 张移入弃牌堆。`SCRIPT_CARD_KIND` 新增 `jp_facedown_discard`（或泛化现有 kind 带 nation 参数）。
- **待确认**：无（机制成熟，改动面小）。

### 17531 现购自运政策 ✅
- **效果**：① 美国结束中立；② 选择 1 个友方国家，在该国家的大本营或相邻地区征召 1 支该国家的**合法部队**（兵种=陆军/海军/空军，美国直接操作）。
- **机制**：① 调 `end_neutral(game,'美国',...)`（中立状态在 `game.neutral[nation]`，值为 `false` 表示已参战，**不是** `game.neutral_status`）；② **不是 delegate**（不翻转 active）——美国直接操作，三步：先选国（英/苏/中/法）→ 点地图选地区（`us_merchant_targets` = `home_base_of(nation)` 及其 `connections` 中 `army/navy/air` 任一 `can_recruit_at` 合法者）→ 选合法兵种（`us_merchant_types` 按地区过滤兵种）再 `recruit_piece`。
- **已确认决策**：① 友方国家范围 = 全部 Allies 友方（英/苏/中/法）；② 征召走 `recruit_piece` 正常判定；③ 是"征召部队"而非"征召陆军"——不列颠可在相邻水域征召海军、在已有本国部队的格上征召空军，兵种由美国选定。
- **⚠️ 纠正（2026-10-11）**：此前误判"英/法候选为空（数据特性）"是**错的** —— 只用 `army` 过滤导致。真实情况：英/法大本营在 `setup(1)` 已被自己的起始陆军占住（"已有本国部队"不可再征召，属正确），但其**相邻海域**（英国→北海；法国→波罗的海/北海/地中海）对 `navy`/`air` 均合法。改为多兵种后，英/法候选**不为空**。`us_merchant_targets` 现返回 `{id,name,types}`，`view.us_merchant.step` = `space`（选地区）后进入 `type`（选兵种）。

### 17532 战区移动
- **效果**：移除 1 支美国陆军或海军；按任意顺序执行：建设 1 支海军 及 建设 1 支陆军。
- **机制**：复用 B 组 17526 的「两步建设」逻辑（但执行方=美国自身、非 delegate），前置加一步「移除 1 支美国陆军/海军」（交互选棋子）。新增一个 US 多步状态机 `resolve_us_build_steps`：remove → build navy → build army（地点交互式点地图，同 B）。
- **待确认**：① 「移除」是否允许移除处于补给/战斗中的单位（建议照 `remove_piece` 常规）；② 建设地点交互式点地图。

### 17535 租借法案 ✅
- **效果**：选择 1 个自己之外的友方国家，其打出 1 张手牌，摸 1 张牌。
- **机制**：**两步入式 delegate（翻转 active）**：step0 **选友方国家**（仅 {苏联, 英国}，中国/法国不可选），翻转 `active`/`current_nation` 给被委托国并记 `return_nation`/`return_active`；step1 该友方「打出 1 张手牌」（从该国手牌选卡，按类型走 `resolve_event_card`/`run_effect_tactics`，同 `play_card` 口径）+ `draw_cards` 摸 1 张；完成后还原 `active`/`current_nation`。
- **已确认决策**：① 可选友方限定为 **{苏联, 英国}**；② 友方打出的手牌照常触发其效果/国家技能；③ 摸 1 张后翻转回 `active` 还原。
- **注意**：`resolve_us_lend_lease_select` 必须赋值 `dg.nation = nat`（早期漏写导致委托国始终为 null）；代理打出的卡同样用**实例字符串 id** 传参，不能 `Number()`。

### 16303 中途岛海战
- **效果**：① 日本的[响应卡]在本回合中无法触发；② 对<中太平洋>发起 1 次海战。
- **机制**：① 新增本回合压制标记 `game.jp_response_suppressed=true`，在响应卡结算入口（`RESPONSE_PRE_CANCEL` / `build_actions` 响应挂钩处）拦截 nation==='日本' 的响应；② 复用地图/战斗发起：对 `<中太平洋>` 直接 `do_battle`（海战，需美国有相邻补给海军或满足发起条件）。
- **待确认**：① 压制标记清除时机（建议「当前美国回合结束」清，或进入敌方回合清）；② `<中太平洋>` 单格 id 确认（需查 `data.spaces`）。

### 17537 美国人民同情中国（本轮仅做前半，陆军后备延后）
- **效果**：中国增加 1 支陆军后备。中国建设 1 支陆军。
- **本轮实现**：仅做「中国建设 1 支陆军」——China delegate 征召（复用 B 组 delegate 框架，固定国=中国，翻转 active 给中国玩家点选建设/征召位置）。
- **延后**：『陆军后备 +1』——『陆军后备』机制未定义（日/苏/美卡面多次出现但 `rules.js` 无实现），需先定义该资源再补。
- **已确认决策**：本轮维持延后，只实现「中国建设 1 支陆军」，不阻塞 C 组其余卡。

---

## 组 C 实施需要的公共基础设施（新建/扩展）

1. **N1 「选国」交互**：仅 17535（delegate）需要玩家从 {苏联, 英国} 里选一个（客户端下拉/按钮 + 服务端 `game.<x>_delegate.nation` 先选后定）。注意 **17531 不需要 delegate 选国**——它是美国直接执行，用「非 delegate 的 2 步入式选国+选点」挂起（不翻 active）。
2. **N2「代理打出 1 张手牌」动作**：17535 需被让权友方 `play_card` 一张手牌。新增 `resolve_<x>_delegate_play` 类动作，以被让权方身份走 `play_card` 流程 + 摸 1 张。
3. **N3 本回合日本响应压制标记**：16303 用 `game.jp_response_suppressed`，在响应结算入口拦截日本响应；明确清除时机（建议「当前美国回合结束」清）。

---

## 验证方式

- 每张卡新建/扩展 `tools/_smoke_us_event_c*.js` 冒烟测试（delegate 状态机 + 逐步 resolve + 完成后清除 + 翻转还原 + 非法输入拒绝）。
- 回归 `test_basic_cards` / `test_supply` / A 组 / B 组无破坏。
- `play.js` / `rules.js` 语法检查 + `docs/pitfalls.md` 追加 C 组条目。
