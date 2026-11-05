/* B2 完成：todo 勾选 + fix-log 追加 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('### B2. 17747《西班牙控制直布罗陀》：同盟不该相邻，现在相邻',
		'### ✅ B2. 17747《西班牙控制直布罗陀》：同盟不该相邻（已修：海峡强制轴心）')
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo B2 已勾选:', s.indexOf('✅ B2.') >= 0)
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · B2《西班牙控制直布罗陀》改为"海峡强制轴心"（服务端）

- **症状**：17747 打出后，\`<北海>\`↔\`<地中海>\` 对**同盟仍然相邻**（卡面是"仅对友方国家相邻"）。
- **根因**（两层）：
  ① \`北海↔地中海\` 本来就是 **data.straits id=15（def: allies，直布罗陀海峡）**——
     \`compute_connections\` 会把该 pair 从两岸营移除、再按控制方加回，所以"同盟相邻、轴心不相邻"是海峡控制权的结果；
  ② 17747 只用 \`pair_adjacency\` 给轴心**加**一条，无法"夺走同盟的通行权"，于是同盟照样相邻。
- **改法**：
  - \`axis_only_seas\` 支持按【无序对】精确指定海峡（\`pairs:[[名,名]]\`）；
    旧写法只给地区名 → \`straits.find\` 命中第一条包含它的海峡（"北海"会误命中北欧 id=4）；
  - \`apply_status_ongoing\` / \`revert_status_ongoing\` 支持 \`ongoing\` 为**数组**（一张卡同时声明多种光环）；
  - 17747 改为 \`[axis_only_seas(北海-地中海), pair_adjacency(非洲北部-西欧, only axis)]\`；
  - \`axis_only_seas\` 的提示文案改为按声明生成（不再写死 15254 的北欧海峡）。
- **验证**：\`tools/_real_test_17747_strait.js\` **16/16**
  A 卡前 同盟 true/轴心 false；B 打出后 **同盟 false/轴心 true**；
  C 与 15254 同时在场 → 只强制 id=4 与 id=15（不再误命中）；D 撤销后同盟恢复、轴心断（pair_adjacency 按设计永久保留）；
  E 非洲北部-西欧 仍只对轴心；F 回归 17744；G 静态守卫 3 条。
  回归：\`_smoke_italy_status\`（断言已更新为新结构）、\`test_basic_cards\` 288/9、全量冒烟 112 全绿。
- **提交**：\`fix(quartermaster): B2 直布罗陀改为海峡强制轴心（ongoing 支持数组 + pairs 精确匹配）\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B2《西班牙控制直布罗陀》') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · B1《高速公路》'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 B2')
	}
}
