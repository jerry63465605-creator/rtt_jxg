/* 登记 B26（17505/17513 待核查）与 B27（SUPP 牌库未入池） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(P, 'utf8')

const b26 = [
	'',
	'### B26. 17505《P-51 野马》/ 17513《战时生产委员会》待核查（疑似还有其它 bug）',
	'',
	'- **已知**：这两张卡在 `rules.js` 里以「被动修正 / `play_card` 特例」命令式实现（L13209 注释明写），',
	'  但**没有登记到任何注册表**（`ECHO_EFFECTS` / `CMD_IMPL` 都没有）→',
	'  预览页 `card_effect_of()` 读不到，会误显示红色「尚未实现」。',
	'- **待核查（玩家口径：可能还有其他 bug）**：',
	'  1. 17505「P-51 野马」的被动修正是挂在哪个时点？（检查它是否只在 `play_card` 特例里生效、',
	'     被 `ECHO_EFFECTS` 之外的分支处理时会不会漏；是否影响空战/代受判定）',
	'  2. 17513「战时生产委员会」是**定向重置**（把某张已发动状态卡重置为未发动），',
	'     需核查：① 重置后 `status_used` / `status_extra` 是否同时清；② `status_suppressed_this_turn` 是否该清；',
	'     ③ 与 15343/15353 压制同时存在时的口径。',
	'- **修法（待确认后执行）**：',
	'  1. 两张卡补登记进 `CMD_IMPL`（各 1 行，预览页立刻转绿）；',
	'  2. 按上面 1/2 逐条跑真实测试（建议 `_real_test_17505_17513.js`），把「被动修正」的触发时点钉死；',
	'  3. 若发现分支缺失，按 `rtt-fix-workflow` 补实现 + 测试。',
	'',
].join('\n')

const b27 = [
	'',
	'### B27. SUPP 补充牌库 37 张「已实装但从不入池」——玩家"很多卡没见过"的主因',
	'',
	'- **实测**（`tools/_audit_deck_pool.js` + `tools/_mk_board_real.js`，标准 setup、真实起手）：',
	'  - 六国牌堆合计 368 张、全池不同牌面 **326** 种；`cards.js` 全表 446 张；',
	'  - **120 张永远不出现**：`SUPP 37` + `PRELUDE 76` + `ARMAMENT 7`。',
	'- **根因**：`rules.js:1435` `init_nation_deck()` 里 `if (c.deck !== \'CORE\') continue`，',
	'  且 L1428 注释写着「SUPP 牌堆（增援）暂不混入核心牌堆，待规则明确后处理」——',
	'  于是这 37 张（实装率 100%，见 `docs/audit-card-implementation.md`）任何一局都摸不到。',
	'- **分布**：英国 4、德国 6、日本 8、苏联 3、意大利 4、美国 12。',
	'  代表卡：12501 皇冠上的明珠、6600 伊朗加入轴心国、7903 菊水特攻、17900 八月风暴、16700 一日之狮、16302 诺曼底登陆。',
	'- **待决策（需玩家/规则口径）**：',
	'  1. 是否把 SUPP 直接混入核心牌堆？（每国 +3~12 张，牌堆厚度与抽到率会变）',
	'  2. 还是做成**可选补充包/剧本选项**（`scenario` 或 `options` 开关）？',
	'  3. 若混入，需要重跑：牌库构成审计、`test_basic_cards`、全量冒烟、若干起手敏感的真实测试。',
	'',
].join('\n')

if (s.indexOf('B26. 17505') < 0) s = s.replace(/\s*$/, '\n') + b26
if (s.indexOf('B27. SUPP 补充牌库') < 0) s = s.replace(/\s*$/, '\n') + b27
fs.writeFileSync(P, s, 'utf8')
const back = fs.readFileSync(P, 'utf8')
console.log('B26 =', back.indexOf('B26. 17505') >= 0, ' B27 =', back.indexOf('B27. SUPP 补充牌库') >= 0)
