/* 追加 2026-11-05 的四条 bug 待办（含只读排查证据与方案草案） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')

const text = `

---

## 2026-11-05 · 玩家报的 4 个 bug（**已登记，未修**；流程：先方案+真实测试，确认后再改）

> 证据来自 \`tools/_probe_4bugs.js\`（只读，不改对局）。

### B1. 15228《高速公路》：收回陆军后，驻留其上的空军没被处理

- **卡面**：按任意顺序收回所有德国陆军，再按任意顺序建设这些陆军。
- **实测**：
  \`\`\`
  打出前  de_a=德国 de_air=德国
  打出后  de_a=undefined  de_air=44（德国）   ← 空军原地留着
  pending_autobahn={actor:德国,remaining:2}
  \`\`\`
- **根因**：\`railroad_recall()\`（rules.js:3637）只对 \`piece_type==='army'\` 的棋子 \`remove_piece\`，
  **完全没有处理"该陆军的载体空军"**。同类问题见 15315 的"消灭陆军连带同国空军"修复（\`09c042f\`）。
- **玩家口径**：收回陆军时，该格空军 →
  ① 若存在**相邻本国海军** → 空军**撤离**到该海军所在格（不消灭）；
  ② 否则 → 空军**随陆军一起被消灭**。
- **待确认**：「相邻」是否含同格？撤离目标是否必须"该海军处于补给"？两处都要玩家拍板。
- **方案（预计 1 处 + 1 个新助手）**：
  \`\`\`js
  /* railroad_recall 里，remove_piece(陆军) 之前先算空军的去处 */
  const airs = pieces_on(game, space).filter(q => game.piece_nation[q] === who && game.piece_type[q] === 'air')
  for (const air of airs) {
      const host = pieces_on(game, space).filter(is_friendly_navy_of(who))   // 同格海军优先
      const nb   = get_connections(game, space, faction_of_nation(who))
                     .map(Number).find(s => pieces_on(game, s).some(is_friendly_navy_of(who)))
      if (host.length) { /* 移到同格海军 */ }
      else if (nb != null) { game.location[air] = nb; log('空军撤离到 ...') }
      else eliminate_piece(game, who, air)     // 无海军 -> 一起死
  }
  \`\`\`
  "两张"里另一张是 \`14902 建设高速公路\`（前奏，把 15228 洗入牌堆）——它本身不收回部队，
  真正的收回点只有 \`railroad_recall\`（15228 与 17827《西伯利亚大铁路》共用），
  **改一处即覆盖两张**（这两张是否都要"飞机撤离"需确认，我会按同一原子处理）。
- **真实测试（待建 \`tools/_real_test_15228_air.js\`）**：
  - A 德国陆军+空军@德国，**无**相邻海军 → 打出 15228 后空军被消灭（\`game.location[air]==null\`）；
  - B 德国陆军+空军@德国，**同格**有德国海军 → 空军不动（留在原格）；
  - C 相邻格（如 北海）有德国海军 → 空军 \`location\` 变成该格，日志含「撤离」；
  - D 17827《西伯利亚大铁路》同款三支 → 行为一致（共用原子）；
  - E 回归：15228 原有 smoke（收回数、逐次建设、pending_autobahn 残留）。

### B2. 17747《西班牙控制直布罗陀》：同盟不该相邻，现在相邻

- **卡面**：\`<北海>\`和\`<地中海>\`、\`<非洲北部>\`和\`<西欧>\` **仅对友方国家相邻**。
- **实测**（\`_probe_4bugs.js\`）：
  \`\`\`
  未打出该卡： 北海-地中海   同盟相邻=true   轴心相邻=false
              非洲北部-西欧 同盟相邻=false  轴心相邻=false
  写入该卡 pair（side=axis）后：
              北海-地中海   同盟相邻=true   轴心相邻=true   ← 同盟仍然相邻
              非洲北部-西欧 同盟相邻=false  轴心相邻=true
  \`\`\`
- **根因**：机制只会"加相邻"。\`status_connections\` 里 \`{a,b,side:'axis'}\` 只对轴心追加；
  而 **北海↔地中海在基础数据里对同盟本来就相邻**（海峡默认对控制方开放），
  卡面要求的是"对同盟**断开**"——当前**没有"减相邻"的表达能力**。
- **方案（推荐 ②，需玩家先确认口径）**：
  1. **① 改基础数据**：把 北海↔地中海 从 \`data.spaces[].connections\` 移除，再由本卡给轴心加。
     ⚠ 影响面大：所有未打出该卡的局，这条海峡对**双方**都不通（补给/发起单位/海峡控制整套回归）。
  2. **② 新增"否定邻接"**（推荐）：\`status_connections\` 支持 \`deny:true\`，
     \`get_connections\` 里先加后减；本卡写 \`[{a,b,side:'axis'},{a,b,side:'allies',deny:true}]\`。
     只影响这张卡生效后的对局，基础数据不动。
- **真实测试（待建 \`tools/_real_test_17747_strait.js\`）**：
  - A 未打出：断言现状（同盟 true / 轴心 false）——作为对照基线；
  - B 打出后：**同盟 false / 轴心 true**（双向断言，正好卡住本次 bug）；
  - C 补给与"发起单位合法性"两条链路同步变化（\`compute_supply\` / \`battle_initiators\` 各一条）；
  - D 回归：17744《土耳其开放海峡》同样走 \`pair_adjacency\`，必须不受 \`deny\` 影响。

### B3. 15407《秋水火箭战斗机》：变成自动了，应为可选

- **卡面**：弃牌阶段开始时：消灭 1 支相邻日本空军的敌方国家空军。
- **实测**：\`CARD_TRIGGERS['15407'] = { kind:'self', phase:'discard', nation:'日本' }\`
  → \`kind:'self'\` 表示**自动执行**，玩家没有"发动/不发动"的选择。
- **根因**：这张是"弃牌阶段开始"的**可选**效果（卡面没有"必须"字样），却被登记为自动触发。
- **方案**：
  1. 把 \`kind:'self'\` 改成**开窗**范式（与 15408 \`play_start\` / 15207 \`play_start\` 同款）：
     \`CARD_TRIGGERS['15407'] = { kind:'any', window:'discard_start', nation:'日本', cost:null }\`
     并由 \`armed_offers\`（\`when:'discard_start'\`）派发"发动/不发动"；
  2. \`run\` 里改成"从候选里选 1 支"（\`need:'piece'\` 或 \`pending_echo\`），
     而不是自己 for 循环挑第一支；
  3. 若弃牌阶段开始没有合法目标 → 不开窗（\`ready\` 判据）。
- **待确认**：可选形式是"发动/不发动"两键，还是"先选目标再确认"（后者需要 \`need:'piece'\`）。
- **真实测试（待建 \`_real_test_15407_qiushui.js\`）**：
  - A 有合法目标时**开出窗口**、且 \`view.armed_offer.when='discard_start'\`；
  - B 选「不发动」→ 敌方空军**仍在**、无代价、无残留；
  - C 选「发动」→ 指定那支敌方空军被消灭（**不是**服务端自选第一支）；
  - D 无合法目标 → 不开窗、不报错；
  - E 回归：15407 原有 smoke + 弃牌阶段推进（\`advance_phase\`）不受影响。

### B4. 15206《轰炸伦敦》：只数了 1 个地区（应为「不列颠」2 地区）

- **卡面**：打出[经济战]时，若目标是英国：\`<不列颠>\`2 地区内每有 1 支德国空军，该经济战损耗数 +2。
- **实测**：
  \`\`\`
  run 里计数用  const bt = space_id('不列颠')     → 只有 1 个格（id=2，land）
  REGION_GROUPS 里有"不列颠"吗 = false（只有：中国 / 太平洋 / 非洲 / 美洲）
  是否遍历地区组 = false
  \`\`\`
- **根因**：把"地区组「不列颠」（2 个地区）"当成单个地区格，导致**最多只数 1 格**；
  若那张德国空军在另一格，则完全不计。
- **待确认（关键）**：地图上只有 id=2 一个「不列颠」（相邻仅 北海），
  "2 地区"到底指哪两格？候选：① 不列颠 + 北海；② 不列颠 + 一个需新增/另名的格；
  ③ 原版棋盘是两块（伦敦/苏格兰），本图合并为一格 → 需按"该格 + 指定第 2 格"实现。
  **请玩家指明第二格**，我再写死进 \`REGION_GROUPS['不列颠']\`（不硬编码在卡里，符合反硬编码规范）。
- **方案**：
  1. 在 \`data.js\`/\`REGION_GROUPS\` 增加 \`不列颠: [2, <第二格>]\`（配置化，不写死在卡内）；
  2. \`run\` 改成遍历该组所有格计数：
     \`\`\`js
     const grp = REGION_GROUPS['不列颠'] || []
     let k = 0
     for (const sp of grp) for (const p of pieces_on(game, sp))
         if (game.piece_nation[p] === '德国' && game.piece_type[p] === 'air') k++
     \`\`\`
  3. **顺带排查此类**（玩家要求）：全库搜 \`space_id('<泛称>')\` / \`id_of('<泛称>')\`
     但该名字实际是地区组的卡（\`REGION_GROUPS\` 只有 4 组，怀疑还有别的卡把组名当地名用）。
     产出清单后逐张给方案。
- **真实测试（待建 \`_real_test_15206_london.js\`）**：
  - A 两格各 1 支德国空军 → 英国额外损耗 **4** 张（\`2*2\`）；
  - B 只有第 1 格 1 支 → 2 张；C 只有第 2 格 1 支 → 2 张（**覆盖"组"而非"单格"**）；
  - D 0 支 → 不发动（\`skip\`）；
  - E 目标非英国 → \`cond\` 不开窗；
  - F 回归：经济战损耗链（15206 + 经济战基础卡）整体不变。

---

### 这四条的执行顺序建议

\`\`\`
B3（秋水可选，最独立，改动小）
 → B1（高速公路空军，收口在 railroad_recall 一处）
 → B4（轰炸伦敦 + "此类"清单，需玩家先指定第二格）
 → B2（直布罗陀，需要新增"否定邻接"能力，影响面最大，放最后）
\`\`\`
`

const cur = fs.readFileSync(p, 'utf8')
if (cur.indexOf('2026-11-05 · 玩家报的 4 个 bug') >= 0) {
	console.log('已存在，跳过')
} else {
	fs.appendFileSync(p, text, 'utf8')
	console.log('已追加 4 条待办，行数 +' + text.split('\n').length)
}
