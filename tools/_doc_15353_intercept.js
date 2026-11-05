/* 15353 拦截非主动状态卡：fix-log + 待办（15328 相关） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

/* ① fix-log */
{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · 15353《保持冷静》可拦截「非主动发动」德国状态卡（react / auto）

- **症状**：15353 卡面「敌方国家发动[状态卡]效果时……使其在本回合中无效」，
  实际只对**主动发动类**（\`trigger\`）有效；15243/15250/15252（被攻击反应）、
  15246/15249/15251（经济战反应）、15241/15244/6601（计分自动）**完全拦不到**。
- **根因**：这些路径都是「**先结算、后上报**」——\`status_on_attacked\`/\`status_on_econ\`/
  \`phase_scoring\` 先把损耗/分数算掉，再 \`request_responses('status_attacked')\` 给 15328 弃卡，
  此时已无"无效"可言。
- **改法**（设计文档 \`docs/change-15353-status-intercept.md\`）：
  - 新增 \`status_suppressed_now / status_intercept_window_open / queue_status_react / step_status_react / apply_one_status_react\`；
  - \`status_on_attacked\` / 经济战改为「收集 → 逐张派发 \`enemy_status_effect\` → 玩家表态后结算」；
    新增 \`status_econ_items\` 收集经济战反应；
  - \`phase_scoring\` 入口加闸口（\`opts.__afterIntercept\` 由续跑路径设置），循环内跳过被压制卡；
  - \`exports.action\` 出口统一续跑（\`step_status_react\`），并用一道门禁保证挂起期间只能表态；
  - 15353 只对**主动发动类**写 \`status_used\`（react/auto 不占发动次数，只写压制）。
- **为什么不需要回滚**：询问发生在结算之前 —— 被拦的卡从未结算过（损耗没扣、分数没加）。
- **验证**：\`tools/_real_test_15353_status_intercept.js\` **23/23**
  A 15250 被攻击→挂起且**攻击方还没被扣牌**；B 发动 15353→压制、0 损耗、挂起清空、不写 status_used；
  C 同回合再被攻击→不再询问/不再损耗；D 下一国家回合→恢复询问；
  E 15249 经济战反应→先挂起，「不发动」则照常结算（分数加成生效）；F 15244 计分自动→先询问，被拦后分数不变。
  回归：\`test_basic_cards\` 288/9（与基线一致）、\`_real_test_17848_once_per_turn\` 13、\`_real_test_precheck_*\` 25/11/8、全量冒烟 112 全绿。
- **提交**：\`feat(quartermaster): 15353 对 react/auto 类德国状态卡提供拦截时点（结算前询问 + 压制）\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('15353《保持冷静》可拦截「非主动发动」') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · S1 状态卡'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 15353 拦截')
	}
}

/* ② 待办：15328 对 auto 类 */
{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf('### B14.') < 0) {
		s += `
### B14. 15328《破译恩尼格码》对 auto（计分自动）类德国状态卡不上报

- **现状**：\`notify_german_status_used\` 的注释明确「auto（计分阶段自动生效）→【不】上报」，
  所以 15241 / 15244 / 6601 自动加分后，15328 无法弃置它们（react 类已能上报）。
- **为什么本次没动**：15353 的拦截已覆盖 auto 类；**让 15328 也能弃 auto 卡属于规则强度变更**
  （会显著提高英国对德国计分卡的压制力），需玩家确认口径。
- **方案草案**：在 \`phase_scoring\` 中被判定"实际加分 > 0"的德国 auto 卡加入 \`game.uk_enigma_targets\`
  （已有该字段与大清洗式的延迟窗口），或直接 \`notify_german_status_used\` 上报。
- **真实测试**：15244 加分后被 15328 弃置；未加分时不进候选；15328 弃置后该卡当回合不再计分。
`
	}
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo B14 已登记:', s.indexOf('### B14.') >= 0)
}
