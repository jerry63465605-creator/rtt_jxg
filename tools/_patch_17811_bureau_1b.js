/* 17811 特例（第一步-b）：在 counter 分支插入 bureau_wait（CRLF 安全，按行定位） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const L = fs.readFileSync(P, 'utf8').split('\n')
const bare = i => L[i].replace(/\r$/, '')

const line = "remove_air_with_piece_removed(game, counter_air, space, nation)"
const hits = []
for (let i = 0; i < L.length; i++) if (bare(i).trim() === line) hits.push(i)
console.log('counter_air 移除行：', JSON.stringify(hits.map(x => x + 1)))
if (hits.length !== 1) { console.log('✗ 定位不唯一，中止'); process.exit(1) }
if (L.some(l => l.indexOf("stage: 'bureau_wait'") >= 0)) { console.log('- 已有 bureau 分支'); process.exit(0) }

const at = hits[0]
const block = [
	"\t\t\t/*",
	"\t\t\t * 【2026-11-06 · 17811 特例】抵消成立 → 先问设计局能否【原地】补机保护这支陆军；",
	"\t\t\t * 条件不满足（非陆战 / 已保护 / 无卡 / 原地不可部署 / 超过深度上限）一律走原逻辑。",
	"\t\t\t */",
	"\t\t\t{",
	"\t\t\t\tconst _bc = bureau_card_for(game, vNation)",
	"\t\t\t\tconst _depth = ((opt && opt._bureau_depth) || 0) + 1",
	"\t\t\t\tconst _inPlace = su_air_deploy_spaces(game, space).indexOf(Number(space)) >= 0",
	"\t\t\t\tif (kind === 'land' && !is_protected(game, victim) && _bc && _inPlace && _depth <= 2) {",
	"\t\t\t\t\tstrip_bureau_offers(game)",
	"\t\t\t\t\tset_pending_battle(game, {",
	"\t\t\t\t\t\tstage: 'bureau_wait', bureau_depth: _depth, bureau_card: _bc, bureau_asked: false,",
	"\t\t\t\t\t\tspace: space, kind: kind, attacker: nation, attacker_piece: (opt.from || null),",
	"\t\t\t\t\t\tvictim: victim, victim_type: 'army', victim_nation: vNation, defender_nation: vNation,",
	"\t\t\t\t\t\tair_used: ((opt && opt._air_used) || []).concat([defend_air, counter_air]).map(String),",
	"\t\t\t\t\t})",
	"\t\t\t\t\tgame.log.push('【' + vNation + '】抵消成立 —— 可用《雅科夫列夫设计局》原地补机保护本次陆军（先处理窗口，再决定陆军是否被移除）')",
	"\t\t\t\t\trefresh(game)",
	"\t\t\t\t\treturn {",
	"\t\t\t\t\t\tok: true, pending: true, space: space,",
	"\t\t\t\t\t\tremoved: [defend_air, counter_air],",
	"\t\t\t\t\t\tdesc: '空战已结算，等待【' + vNation + '】决定是否用《雅科夫列夫设计局》补机保护陆军',",
	"\t\t\t\t\t}",
	"\t\t\t\t}",
	"\t\t\t}",
].map(x => x + '\r')

L.splice(at + 1, 0, ...block)
fs.writeFileSync(P, L.join('\n'), 'utf8')
console.log('✓ 已插入', block.length, '行')
