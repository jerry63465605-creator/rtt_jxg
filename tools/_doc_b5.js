/* B5 完成：todo 勾选 + 新增 B13 待办 + fix-log 追加 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('### B5. 15444《丘克群岛》被占领后失效',
		'### ✅ B5. 15444《丘克群岛》被占领后失效（已修：删掉港口光环的"敌占"守卫）')
	if (s.indexOf('### B13.') < 0) {
		s += `
### B13. 光环类 ongoing 无法被 15343 压制（port_as 没存 card_id）

- **现象**：英国回合 + 桌面 15343 时，15444《丘克群岛》的港口光环**仍然生效**（navy_ab_check 读 port_as 直接成立）。
- **根因**：\`status_aura.port_as\` 存的是 \`{space: nation}\`，**没有 card_id**，
  所以 \`status_card_effective()\`/压制撤销无法按卡失效（\`axis_only_seas\` 存的是 card_id，所以那条能撤）。
- **方案**：把 port_as / space_immune 等"按格"光环统一改成 \`{space: {nation, card_id}}\`（或另存映射），
  navy_ab_check / compute_supply 读取时校验 \`status_card_effective(card_id)\`；
  或沿用 axis_only_seas 的做法，在压制/解除时 apply/revert 一次。
- **风险**：改状态结构，需迁移旧存档读法（兼容两种形状）。
- **真实测试**：英国回合 + 15343 -> 港口失效；非英国回合 -> 恢复；旧存档形状仍能读。
`
	}
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo: B5 勾选 + B13 登记')
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · B5《丘克群岛》被占领后失效（服务端，1 行）

- **症状**：15444 打出后，\<硫磺岛\> 一旦被敌方陆军占领，港口光环整条失效（相邻海域既不能建海军、也不算补给源）。
- **根因**：\`navy_ab_check()\` 的港口分支多了一道 \`!has_pieces({space, enemyOf:nation})\` 守卫
  （注释写着"敌占时失效（与旧 virtual_army 同口径）"），但卡面只写"\<硫磺岛\>视为日本港口"，**没有"被占领失效"**。
- **改法**：删掉该守卫，保留 port_as 匹配（A 补给来源 + B 建造条件都保留）。玩家口径：**被占领仍有效**。
- **验证**：\`tools/_real_test_15444_occupied.js\` **10/10**
  A 无卡 false；B 打出 true；C 美陆军占领后 **仍 true**（修复点）；D 占领状态下真建出一支海军；
  E 计分 1 / 缺一支 0；F 现状记录（15343 压制不撤 port_as，已登记 B13）；G 静态守卫 2 条。
  回归：\`test_basic_cards\` 288/9、全量冒烟 112 全绿。
- **提交**：\`fix(quartermaster): B5 丘克群岛港口光环不再因被占领失效\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('B5《丘克群岛》被占领后失效') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · B2《西班牙控制直布罗陀》'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 B5')
	}
}
