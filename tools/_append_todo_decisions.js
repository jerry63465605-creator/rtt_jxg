/* 追加 2026-11-05 玩家对 8 条待办的【口径确认】与 B2/B4 细化方案 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')

const text = `

---

## 2026-11-05（口径确认）· 玩家对 B1~B8 的裁定 + B2/B4 细化方案

| 编号 | 玩家裁定 |
|---|---|
| **B1** 高速公路空军 | **不要求**撤离目标海军处于补给；同格有本国海军优先（撤离到该格） |
| **B2** 直布罗陀 | **参考海峡的实现**（见下方细化方案） |
| **B3** 秋水 | **先选目标再确认**（\`need:'piece'\` + 确认键，不是"发动/不发动"两键） |
| **B4** 轰炸伦敦 | **参考美国「轰炸行动」类卡的 2 范围**（\`radius: 2\`，含本格 + 2 跳） |
| **B7** 施佩伯爵 | "无法执行" = **建设海军失败（没建出来）**也要给触发时点 |
| **B8** 马奇诺等 | 挂起时**应该打断对手**（参考现有能打断的实现） |
| **B12** 军事顾问 | 候选 = **该桌面全部德国状态卡**；有发动条件的才可点；**损耗按意大利牌库、损耗意大利的卡** |

### B2 细化方案（参考 \`axis_only_seas\` 海峡实现，最贴合现有代码）

**现状机制**（已确认）：
\`\`\`
data.straits 里 id=15 = { name:'非洲北部', a:46(地中海), b:17(北海), def:'allies' }
compute_connections():
    ① 把该 pair 从两岸营列表里【全部移除】
    ② 按 strait_controller(game, 15) 的结果【只加回控制方】
    ③ 若 game.status_aura.strait_force_axis[15] 指向的卡仍生效 -> ctrl = AXIS
\`\`\`
即：**北海↔地中海的通行权由"直布罗陀海峡控制者"决定**，默认同盟（英国）——这就是"未打出 17747 时同盟相邻、轴心不相邻"的原因。
而 17747 目前只做 \`pair_adjacency\`（给轴心**加**一条），**没有夺走同盟的那条**，所以同盟仍然相邻。

**改法（3 处，全部复用现有机制、不加新概念）**：

1. \`axis_only_seas\` 支持**按"无序对"精确指定海峡**（现在只支持"给一个地区名 → \`straits.find\` 命中第一条"，北海会误命中北欧海峡 id=4）：
   \`\`\`js
   // 8301 附近
   if (og.kind === 'axis_only_seas') {
     const aura = status_aura(game); aura.strait_force_axis = aura.strait_force_axis || {}
     const hit = []
     for (const pr of (og.pairs || [])) {
       const a = space_id(pr[0]), b = space_id(pr[1])
       const st = data.straits.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a))
       if (st) hit.push(st.id)
     }
     for (const nm of (og.spaces || [])) { /* 旧写法保持 */ }
     for (const id of hit) aura.strait_force_axis[id] = card_id
     refresh_connections_cache(game)          // 现有刷新逻辑不变
   }
   \`\`\`
2. \`apply_status_ongoing\` 允许 \`ongoing\` 是**数组**（\`[].concat(og)\`），这样一张卡可同时声明"海峡强制轴心"+"陆地成对邻接"；
3. 17747 改成：
   \`\`\`js
   '17747': {
     ongoing: [
       { kind: 'axis_only_seas', pairs: [['北海', '地中海']], desc: '<北海>-<地中海> 仅对轴心相邻' },
       { kind: 'pair_adjacency', pairs: [['非洲北部', '西欧']], only: 'axis', desc: '<非洲北部>-<西欧> 仅对轴心相邻' },
     ],
     auto: { /* 计分不变 */ },
   }
   \`\`\`

**为什么这样最好**：不动 \`data.spaces\` 静态基线（不影响其它局），不新增"否定邻接"概念，
且 \`axis_only_seas\` 已被 \`status_card_effective\` 管着（15353 压制、卡离场自动恢复）——语义与卡面"仅对友方"完全一致。

**真实测试（\`_real_test_17747_strait.js\`）**
- A 未打出：北海-地中海 同盟 true / 轴心 false（对照基线，锁死"卡前状态"）；
- B 打出后：**同盟 false / 轴心 true**（双向，正是本 bug）；
- C 与 15254（\`axis_only_seas spaces:['北海','波罗的海']\`）**同时在场**：北欧海峡(id=4)仍归轴心、直布罗陀(id=15)归轴心、中东(id=16)不受影响（防"误命中第一条"回归）；
- D 15353《保持冷静》压制 17747 -> 恢复同盟 true / 轴心 false；解除压制后回到 B；
- E 补给链路：轴心海军经该海峡可连回补给；同盟海军不经该海峡（断言 \`compute_supply\` 两侧各一条）；
- F 回归：17744《土耳其开放海峡》（\`pair_adjacency\`）不受数组化改动影响。

### B4 细化方案（参考美国「轰炸行动」的 \`radius: 2\`）

**现状**：\`const bt = space_id('不列颠')\` + 单格遍历 → 只数 1 格。
**美股同款写法**（已确认存在）：\`count_pieces(game, { space: '中国西部', radius: 2, types:['air'], nation:'日本' })\`（\`rules.js:1977\` / \`2048\`）。

**改法（1 处）**：
\`\`\`js
/* 15206 轰炸伦敦 */
const k = count_pieces(game, { space: '不列颠', radius: 2, types: ['air'], nation: '德国' })
if (!k) return { ok: true, skip: true, desc: '半径2内无德国空军，未发动' }
const lost = attrition_cards(game, '英国', 2 * k)
\`\`\`
\`radius\` 走**几何邻接**（\`region_spaces\` 的 BFS，含本格 + 1..2 跳），与美军轰炸行动卡同源，
不再需要 \`REGION_GROUPS['不列颠']\`（也就绕开了"第二格是哪格"的问题）。

**真实测试（\`_real_test_15206_london.js\`）**
- A 不列颠本格 1 支德国空军 → 英国额外损耗 2；
- B 2 跳内的另一格 1 支 → 仍是 2（**证明覆盖半径 2，不是单格**）；
- C 3 跳外 1 支 → 不计（边界）；
- D 本格 + 2 跳内各 1 支 → 4 张；
- E 0 支 → \`skip\`；F 目标非英国 → \`cond\` 不开窗；
- G 回归：经济战损耗链（15206 + 基础经济战）整体不变。
- H **"此类"清单**：全库搜 \`space_id('<地区组/泛称>')\` 与 \`id_of('<泛称>')\`，
  产出"应走 \`radius\` / \`REGION_GROUPS\` 但写成单格"的卡清单，逐张列入待办（本次只出清单）。
`

const cur = fs.readFileSync(p, 'utf8')
if (cur.indexOf('2026-11-05（口径确认）') >= 0) { console.log('已存在，跳过') }
else { fs.appendFileSync(p, text, 'utf8'); console.log('已追加口径确认与 B2/B4 方案，行数 +' + text.split('\n').length) }
