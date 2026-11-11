# P0（统一兜底 finish_acts / freeze_reason）影响面：受影响的卡清单

> 日期：2026-11-10　生成脚本：`tools/_audit_p0_impact.js`（可随时复跑）
> 结论：**直接影响 = 37 张 armed 窗口卡**（收益方）；**间接相关 = 制造排他挂起的宿主卡**（冻结语义不变，交互面变化）；
> 其余 410 张卡**零影响**（既不产生 armed 窗口、也不制造上述挂起）。

## 0. P0 到底改了什么（一句话）

「排他挂起期间，**本方持有 armed 窗口**时，`use_armed_offer` / `skip_armed_offer` 一律允许（客户端白名单 + 服务端门禁同源）」。
→ 只影响**有 armed 窗口的卡**；不改变任何卡的代价、效果、结算顺序。

## 1. 直接受影响：37 张 armed 窗口卡

### 1.1 影响等级判据

| 等级 | 含义 | 数量 |
|---|---|---|
| **高** | 时点天然发生在**对手回合 / 对手动作中途**（`piece_removed`、`after_build_*`、`after_recruit`、`after_deploy_air`、`after_battle`、`attacked`、`econ_used`、`enemy_*`、`nation_turn_start`） | **32** |
| 中 | 时点在**阶段边界**（`play_start`／`draw_phase_end`／`scoring_north`） | 5 |
| 低 | 其它 | 0 |

> 其中带 **`watch`（窗口归属 ≠ 行动方）** 的 **13 张**是本次修复的主要受益者 —— 以前它们在对手回合中途弹出来但点不动。

### 1.2 高（32 张）

| id | 卡名 | 国 | 时点 | watch | 代价 | 步数 |
|---|---|---|---|---|---|---|
| 15205 | JU-87 俯冲轰炸机 | 德国 | after_deploy_air | | 损耗 | 单步 |
| 15206 | 轰炸伦敦 | 德国 | econ_used | | 无（卡面无代价，B36 已删旧 cost） | 单步 |
| 15208 | 齐柏林伯爵号 | 德国 | after_build_navy | | 损耗 | 多步 |
| 15210 | 施佩伯爵海军上将号 | 德国 | after_build_navy | | 损耗 | 单步 |
| 15212 | G7e 鱼雷 | 德国 | econ_used | | 损耗 | 单步 |
| 16800 | 艾森豪威尔陆军上将 | 美国 | after_build_army | | 无 | 多步 |
| 16801 | 哈尔西海军上将 | 美国 | after_battle | | 无 | 多步 |
| 16802 | 麦克阿瑟陆军上将 | 美国 | after_battle | | 无 | 多步 |
| 16803 | 尼米兹海军上将 | 美国 | after_build_navy | | 无 | 多步 |
| 16804 | 花园口决堤 | 美国 | after_recruit / after_build_army | ★ | 损耗 | 单步 |
| 17505 | P-51 野马 | 美国 | econ_used | | 无 | 单步 |
| 17506 | 沉睡的巨人 | 美国 | after_build_navy | | 损耗 | 多步 |
| 17511 | 美国陆军游骑兵 | 美国 | after_deploy_air | | 损耗 | 多步 |
| 15405 | 大日本帝国海军 | 日本 | after_build_navy | | 弃牌(响应) | 多步 |
| 15406 | 南云忠一指挥航空队 | 日本 | after_deploy_air | | 弃牌(响应) | 多步 |
| 15410 | 武士道 | 日本 | piece_attacked | | 弃牌(响应) | 单步 |
| 15411 | 夜间运输 | 日本 | nation_turn_start | | 弃牌(响应) | 多步 |
| 17805 | 红色管弦乐队 | 苏联 | nation_turn_start | ★ | 无 | 多步 |
| 17806 | 空降部队 | 苏联 | after_deploy_air | | 弃牌(响应) | 多步 |
| 17808 | 莫斯科战役 | 苏联 | piece_removed | ★ | 弃牌(响应) | 多步 |
| 17811 | 雅科夫列夫设计局 | 苏联 | piece_removed | ★ | 无 | 多步 |
| 17814 | 进击的朱可夫 | 苏联 | after_battle | | 弃牌(响应) | 单步 |
| 17854 | 共青城 | 苏联 | after_build_army | | 无 | 单步 |
| 17900 | 八月风暴 | 苏联 | after_battle | | 弃牌(响应) | 多步 |
| 16700 | 一日之狮 | 意大利 | enemy_echo_played | ★ | 损耗 | 单步 |
| 17705 | 波尔多潜艇基地 | 意大利 | econ_used | ★ | 无 | 单步 |
| 17708 | 意大利皇家空军 | 意大利 | econ_used | ★ | 无 | 多步 |
| 17711 | 维希法国殖民地 | 意大利 | after_build_army / after_recruit / piece_removed / after_battle | ★ | 无 | 单步 |
| 15311 | 马奇诺防线 | 英国 | piece_removed | ★ | 弃 4 | 单步 |
| 15351 | 敦刻尔克大撤退 | 英国 | piece_removed | ★ | 弃 2 | 多步 |
| 15352 | 布莱切利园 | 英国 | enemy_echo_played | ★ | 弃 1 | 单步 |
| 15353 | 保持冷静·继续前进 | 英国 | enemy_status_effect | ★ | 弃 1 | 单步 |

### 1.3 中（5 张）

| id | 卡名 | 国 | 时点 | watch | 代价 | 步数 |
|---|---|---|---|---|---|---|
| 15207 | JU-52 空投补给 | 德国 | play_start | | 损耗 | 单步 |
| 15211 | 威瑟堡行动 | 德国 | scoring_north | | 损耗 | 单步 |
| 17809 | 骑兵师 | 苏联 | play_start | | 弃牌(响应) | 多步 |
| 17855 | 间谍机构 | 苏联 | draw_phase_end | ★ | 无 | 多步 |
| 15355 | 特种空勤团突袭机场 | 英国 | play_start | | 弃 1 | 多步 |

## 2. 间接相关：制造排他挂起的宿主（**行为不变**，只是"别处能动了"）

| 挂起 | 宿主卡 / 机制 |
|---|---|
| `pending_echo`（多步事件选地区/选牌） | `EVENT_EFFECTS` 里 79 张中带 steps 需 space/choice 的卡（如 17517 B-29、7900 竭泽而渔、15311 相关多步、17506/16800 等自身 need 步） |
| `pending_script`（多步脚本卡） | kind：`discard_pay_pick`(7900 竭泽而渔)、`draw_pick_discard`(15239)、`uk_facedown_discard`(英国暗置弃牌)、`jp_facedown_discard`(日本暗置弃牌)、status pick |
| `pending_status_play` | 苏联「选状态卡」相关（17851 天王星链等） |
| `pending_theater` | 17532《战区移动》 |
| `pending_autobahn` | 15228《高速公路》、17529 委托建设预算 |
| `pending_econ` | 链式经济战（15314 等，ECON_CARDS 33 张里的多目标链） |
| `pending_red` | 17805《红色管弦乐队》 |
| `pending_uranus` | 17851《天王星行动》 |
| `pending_armed_delegate` / `delegate` | 17861《八月风暴》让权、17703《罗马尼亚铁卫团》、卡佩里尼链 |

> 这些卡**自己不产生 armed 窗口** → P0 不会改变它们的代价/效果；唯一变化是：
> 当它们把状态机挂在半途、而**另一方**有 armed 窗口时，那一方现在能表态（以前点不动）。
> 副作用是"宿主方的进度会被对手的表态打断"——这正是 B19 已有的设计（对手时点必须等）。

## 3. 明确不受影响

- 445 张里除上表外的 **370+ 张**：无 armed 窗口 → P0 的豁免条件 `hasArmedOfferForSide()` 恒为假，`finish_acts` 不做任何追加、`freeze_reason` 的豁免分支不进 → **行为零变化**；
- 所有 `kind:'load'` / 响应卡 / 状态卡 / 国家技能：P0 只动 `use/skip_armed_offer` 两键，**不碰**它们的通道（P1 才做）。

## 4. 回归重点（按影响等级选）

| 优先 | 对象 | 为什么 |
|---|---|---|
| ★★★ | 13 张 `watch` 卡（窗口不属于行动方） | P0 的主要收益面，也是唯一"行为会变"的子集 |
| ★★★ | 20 张多步（need）卡 | 多步 = 一次发动要多次提交，最容易被挂起切断 |
| ★★ | `pending_script` / `pending_status_play` / `pending_theater(非 actor)` | 本次实测到的 3 个漏点 |
| ★★ | `econ/red/uranus` 期间 | 服务端门禁原来只放行自身动作 |
| ★ | 17805 / 17851 / 17532 / 15228 | 宿主侧不回退（B19 强挂起） |

## 5. 复跑

```powershell
node tools/_audit_p0_impact.js        # 37 张 armed 卡 + 影响等级（本表由它生成）
node tools/_audit_window_in_pending.js  # 8 种挂起 × 2 归属 的经验矩阵
```
