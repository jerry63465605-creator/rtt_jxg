/* 记录：4 层拦截链上限的已知边角（待改用"栈式恢复"重写） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
### 第 4 组：双拦截方 + 层级上限真实测试 —— 结论与一个【已知边角】

\`tools/_real_test_paradigm_two_interceptors.js\`（16 项通过 + 4 项 KNOWN）：

**已验证通过（稳定）**

1. **同一窗口多候选只发生在"同一张卡的多份"**：英国两张 15352 → 窗口写「可打出 2 张增强卡」。
   **15352 与 16700 永远不会同窗** —— 15352 只拦轴心、16700 只拦同盟，阵营互斥（实测确认）。
2. 逐层反制：\`15352#a → 16700#a → 15352#b → 16700#b\`，每层 \`chain_depth\` 1→2→3 递增；
3. 第 4 层使用后 **CHAIN_CAP 生效**，日志「拦截链已达上限（3 层），本次不再询问拦截」，不再开第 5 层；
4. 全程无崩溃、\`pending_armed_use\` 最终为 null、\`chain_depth\` 归零。

**已知边角（未修，4 项 KNOWN）**

现象：撞上限后，最后一级恢复链里 \`release_echo_entry(15209)\` 报「手中没有这张牌」，
随后又给英国开出一个 \`enemy_echo_played\` 窗口（英国第二张 15352 仍在手），
最终残留：窗口 1 个、英国第二张 15352 与第二张代价牌未消耗。

根因：现在的"恢复"是**按层递归**（\`void\` → \`resume_suspended_use\` → 又触发 \`void\` …），
层数 ≥3 时同一件事会被恢复两次（一次来自 \`outer\`，一次来自 \`pu.orig\`），
第二次拿到的牌已不在手牌 → 报"手中没有这张牌"并重新派发窗口。

**建议修法（下一步）**：把恢复改成**栈式单循环**——一次只为"最外层未被处理者"做恢复，
恢复后重新入栈再判定，不再互相递归；同时给每个 \`pending_armed_use\` 打 \`recovered:true\` 标记防重复恢复。
（本组 4 项 KNOWN 已用 \`known()\` 标记，不算失败，便于持续跟踪。）

**教训**：递归恢复在 2 层内没问题（S1 之前的所有用例都是 ≤2 层），
但 \`CHAIN_CAP=3\` 打通后必须改成栈式恢复，否则会出现"重复恢复 + 过期窗口"。
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
