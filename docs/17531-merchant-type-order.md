# 17531《现购自运政策》：补上"兵种选择"并调整为 国家 → 兵种 → 地区

> 状态：**✅ 已实现（2026-10-25，工作区未提交）**
> 回归：`node tools/_smoke_17531_merchant.js` —— 15 项全 PASS

## 一、玩家反馈

> 当前缺失兵种选择？没有给我选择兵种（空军）的机会，可以选完国家后，再选征哪种兵，只有合法的类型才能选。

## 二、原实现的问题

服务端其实**本来就有三步**（国家 → 地区 → 兵种，`resolve_us_merchant_select/build/type`），
但顺序是"先地区再兵种"，导致：

| 问题 | 表现 |
|---|---|
| 兵种列表不可预期 | 玩家在第二步只能看到"哪些地区能征"，看不到"有哪些兵种可选"，容易以为只有陆军 |
| 空军出现得太晚 | 空军合法性取决于地区（需载体：同格有本国补给陆/海军），玩家选完地区才知道有没有空军，往往已经选了陆军格 |
| 候选与直觉相反 | 同一国家不同地区能征的兵种不同，玩家要先猜地区再猜兵种 |

## 三、修复

### 顺序改为：国家 → **兵种** → 地区

| 步 | 服务端 | 客户端 |
|---|---|---|
| ① `step='nation'` | 英/苏/中/法 | 四个按钮 |
| ② `step='type'` | `us_merchant_nation_types()` = **该国全部目标地区能征的兵种并集**（合法才列出） | 兵种按钮（陆军/海军/空军） |
| ③ `step='space'` | `us_merchant_targets_of_type()` = **只保留该兵种合法**的地区 | 高亮这些地区，点击即征召 |

### 新增/改动函数

| 函数 | 作用 |
|---|---|
| `us_merchant_nation_types(game, nation)` | 兵种并集（`us_merchant_targets` 各 `types` 的并集），空则不列 |
| `us_merchant_targets_of_type(game, nation, type)` | 按兵种过滤目标地区 |
| `us_merchant_do_recruit(game, dg, space, type)` | 真正征召 + 收尾（★卡 → `after_card_resolved`） |
| `resolve_us_merchant_type` | 新流程：只**记录** `dg.type`；若 `dg.space` 已有（老存档）则直接征召收尾 |
| `resolve_us_merchant_build` | 新流程：校验"该地区该兵种合法"后**直接征召**；老流程（无 type）保留原行为 |

### 客户端

| 改动 | 说明 |
|---|---|
| `update_us_merchant` 按 `dg.step` 分支 | `type` 显示兵种按钮（空则明确提示"没有可合法征召的兵种"）；`space` 高亮地区 |
| 地区点击条件改为 `step === 'space'` | 与新的三段一致 |
| `reapply_all_highlights` 加 4.5 段 | 每帧按 `us_merchant.targets` 重贴，避免高亮只活一帧 |

## 四、老存档兼容

老存档 `game.us_merchant = { nation, space }`（无 `type`）：

- `view` 仍下发 `step='type'`，带 `space/space_name` 与**该地区**的合法兵种
- 选完兵种后 `resolve_us_merchant_type` 走"space 已设 → 直接征召"分支
- 验证：`_smoke_17531_merchant.js` 的 E 组

## 五、验证结果

```
A. 打牌 → step=nation；选英国 → step=type，兵种 [navy, air]
   每个列出的兵种都能落地（同源校验）；选空军 → step=space → 北海 → 空军征召成功
   ★卡收尾（大萧条的余波弃牌 + 美国国家技能窗口）正常
D. 海军建在陆地（冰岛）→ 被拒且停在 step=space，日志写明原因
E. 老存档（space 已设、type 空）→ step=type 带地区名，选完兵种即完成
```

## 六、注意

- 兵种列表**只列合法项**：如果该国此刻确实无法征空军（没有载体/没有合适地区），空军不会出现 —— 这是规则如此，不是遗漏
- 若玩家仍觉得"有兵种没出现"，看日志里 `us_merchant_types` 的判定即可定位是哪个地区不合法
