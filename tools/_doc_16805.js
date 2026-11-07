/* fix-log 追加：16805 → 英国衍生卡 16899 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(P, 'utf8')
const E = [
	'',
	'---',
	'',
	'## 2026-11-08 · 16805《B-25 米切尔》：转手改为「生成英国版衍生卡 16899」',
	'',
	'- **玩家口径**：不要"把 16805 塞给英国"（引擎无实例改国籍，英国打出时仍按"美国海军"判定，与卡面矛盾）；',
	'  改为生成**一张英国新经济战牌**（不入卡组）：',
	'  「[轰炸行动]选择1个大本营2地区内有{英国}海军的敌方国家：其损耗4张牌。」',
	'- **改动**：`cards.js` 新增 `16899`（`deck:\'TOKEN\'`，id 避开已占用的 16806《大规模部署》）；',
	'  `cards_of_nation` 排除 `TOKEN`（否则会被塞进英国牌堆）；',
	'  `rules.js` 16805.post 改为铸 16899（幂等）+ 新增 `ECON_CARDS[\'16899\']`（英国海军判据，损耗 4）；',
	'  新增通用 `mint_card_instance()`；16805 的大本营口径改 `effective_home_base`（尊重迁都）。',
	'- **验证**：`_real_test_16805_token.js` 8/8；`_smoke_us_econ.js` 同步改口径；basic 288/9；冒烟 112 全绿。',
	'',
].join('\n')
if (s.indexOf('生成英国版衍生卡 16899') < 0) {
	fs.writeFileSync(P, s.replace(/\s*$/, '\n') + E, 'utf8')
	console.log('✓ fix-log 已追加')
} else console.log('• fix-log 已有条目')
