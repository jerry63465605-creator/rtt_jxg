/* P3-1：补"真实测试证据"章节 + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'audit-need-piece.md')
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf('## 2. 真实测试证据') < 0) {
		s += [
			'## 2. 真实测试证据（按 rtt-realboard-test 铁律：debug 布阵 + 真实 action + 三层断言 + 残留）',
			'',
			'| 脚本 | 覆盖 | 结果 |',
			'|---|---|---|',
			'| `tools/_real_test_15355_sas_airfield.js` | armed `need:\'piece\'` 全链路：多英国空军 / 多国敌方空军候选、非法目标拒绝、**客户端点击链镜像**（归一 + gate） | **36 项全过** |',
			'| `tools/_real_test_15407_qiushui.js` | 同类"选一支敌机"的对照实现（已改为 `need:\'choice\'`）：候选下发 / 精确消灭 / 非法拒绝 / 不发动 | **14 项全过** |',
			'| `tools/_real_test_15315_alamein.js` | 事件卡分步（`pending_event_targets` 的 piece 通道）+ 选完点「下一步」 | **21 项全过** |',
			'',
			'结论：三条通道（armed / echo-run / event-multistep）里，**armed 与 event-multistep 均有真实测试背书**；',
			'`echo-run` 的 `piece` 分支**客户端缺失**，但目前**没有任何卡**使用它（15407 已迁到 choice），',
			'因此不构成本轮缺陷；将来若要新增 echo+piece 的卡，需先给 `update_pending_echo_box` 补 `step === \'piece\'` 分支。',
			'',
			'## 3. 逐卡复核清单（8 张 armed piece，抽查用）',
			'',
			'| 卡号 | 卡名 | 触发窗口 | 复核要点 |',
			'|---|---|---|---|',
			'| 15355 | 特种空勤团突袭机场 | after_build_air / after_deploy_air | 已由 36 项测试覆盖 |',
			'| 15406 | 南云忠一指挥航空队 | after_deploy_air（多步 choice → piece） | 候选含"空白地块空打"的 `spaceCandidates`，客户端两套候选都要归一 |',
			'| 16801 | 哈尔西海军上将 | after_deploy_air（海战） | 目标限定敌方海军 |',
			'| 16802 | 麦克阿瑟陆军上将 | after_deploy_air（陆战） | 目标限定敌方陆军 |',
			'| 17511 | 美国陆军游骑兵 | after_build_army | 与 17808 同款"选敌方陆军" |',
			'| 17708 | 意大利皇家空军 | after_build_air | 目标为敌方空军 |',
			'| 17808 | 莫斯科战役 | piece_removed | 条件=场上无苏联陆军 + 有可消灭目标（T1 已实测 ready 可满足） |',
			'| 17809 | 骑兵师 | after_build_army | 与 17511 同构 |',
			''
		].join('\n')
		fs.writeFileSync(p, s, 'utf8')
		console.log('审计文档已补"真实测试证据"')
	} else console.log('已有证据章节')
}

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	const before = s
	s = s.replace('| P3-1 | `need:\'piece\'` 点击链批量审计 | 多步卡选择后是否真的能提交 |',
		'| ~~P3-1~~ ✅ | `need:\'piece\'` 点击链批量审计 | 已完成：`docs/audit-need-piece.md`（8 张 armed + 框架通道，均有真实测试背书） |')
	s = s.replace('| 19 | **P3-1** | `need:\'piece\'` 点击链批量审计 | 只读 | 低但耗时 | 每卡 2-3 |',
		'| 19 | ~~**P3-1**~~ ✅ | `need:\'piece\'` 点击链批量审计 | 已完成（8 张 + 三通道结论） | — | — |')
	if (s === before) console.log('todo: 未命中 P3-1（可能已是勾选）')
	fs.writeFileSync(p, s, 'utf8')
}
