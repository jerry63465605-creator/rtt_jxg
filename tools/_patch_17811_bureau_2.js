/* 17811 特例（第二步）：air_used 过滤 + 续跑 + 门禁 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const L = fs.readFileSync(P, 'utf8').split('\n')
const bare = i => L[i].replace(/\r$/, '')
const hit = (ok, m) => console.log((ok ? '✓ ' : '✗ ') + m)
const find = (pred, from) => { for (let i = from || 0; i < L.length; i++) if (pred(bare(i), i)) return i; return -1 }

/* ① make_counter_pending：候选排除已用过的空军 + 记录 air_used */
{
	const i = find(l => l.indexOf('counter_airs: counter_air_options(game, nation, space)') >= 0)
	hit(i >= 0, '定位 counter_airs 字段 @' + (i + 1))
	if (i >= 0) {
		L[i] = "\t\t\tcounter_airs: counter_air_options(game, nation, space)" +
			"\r\n\t\t\t\t.filter(o => ((opt && opt._air_used) || []).map(String).indexOf(String(o.id)) < 0)"
		/* 下一行原本是 .slice().sort(...)，保留 */
		L.splice(i + 2, 0,
			"\t\t\t/* 本场已用过的空军（代受/抵消/17811 补机）—— 每支只能用一次 */\r",
			"\t\t\tair_used: ((opt && opt._air_used) || []).concat([defend_air]).filter(Boolean).map(String),\r")
		console.log('  ✓ 已加过滤 + air_used')
	}
}

/* ② 抵消校验：counterOpts 同样排除已用过的 */
{
	const i = find(l => l.indexOf('const counterOpts = counter_air_options(game, nation, space)') >= 0)
	hit(i >= 0, '定位 counterOpts @' + (i + 1))
	if (i >= 0) L[i] = "\t\tconst counterOpts = counter_air_options(game, nation, space)" +
		"\r\n\t\t\t.filter(o => ((opt && opt._air_used) || []).map(String).indexOf(String(o.id)) < 0)"
}

/* ③ resolve_battle：两个 opt 都带上 _air_used / _bureau_depth */
{
	let n = 0
	for (let i = 0; i < L.length; i++) {
		if (bare(i).indexOf('guard_done: true,') >= 0 && bare(i + 1) && bare(i + 1).indexOf('}') >= 0) {
			L.splice(i + 1, 0,
				"\t\t\t/* 【2026-11-06 · 17811 特例】把本场已用空军与 bureau 深度传回 do_battle */\r",
				"\t\t\t_air_used: (pb.air_used || []),\r",
				"\t\t\t_bureau_depth: (pb.bureau_depth || 0),\r")
			n++
			i += 3
		}
		if (bare(i).indexOf('declined_counter: !wants,') >= 0) {
			L.splice(i + 1, 0,
				"\t\t\t/* 【2026-11-06 · 17811 特例】同上 */\r",
				"\t\t\t_air_used: (pb.air_used || []),\r",
				"\t\t\t_bureau_depth: (pb.bureau_depth || 0),\r")
			n++
			i += 3
		}
	}
	hit(n >= 2, 'resolve_battle 传参处（命中 ' + n + ' 处）')
}

/* ④ action 出口：flush 之后续跑 bureau */
{
	const i = find(l => l.indexOf('flush_piece_removed_offers(game)') >= 0)
	hit(i >= 0, '定位 flush 调用 @' + (i + 1))
	if (i >= 0 && L.slice(i, i + 3).join('').indexOf('maybe_ask_bureau') < 0) {
		L.splice(i + 1, 0,
			"\t\t/* 【2026-11-06 · 17811 特例】窗口都处理完后推进 bureau_wait */\r",
			"\t\ttry { maybe_ask_bureau(game) } catch (e) { game.log.push('17811 特例续跑错误：' + e.message) }\r")
		console.log('  ✓ 已加 maybe_ask_bureau 调用')
	}
}

/* ⑤ 门禁：bureau_wait 期间只放行表态类动作 */
{
	const i = find(l => l.indexOf("if (game.pending_status_react &&") >= 0)
	hit(i >= 0, '定位状态卡门禁 @' + (i + 1))
	if (i >= 0) {
		const block = [
			"\t/* 【2026-11-06 · 17811 特例】bureau_wait 期间必须先表态（用设计局 / 不发动 / 二次代受） */",
			"\tif (game.pending_battle && game.pending_battle.stage === 'bureau_wait' &&",
			"\t\taction !== 'use_armed_offer' && action !== 'skip_armed_offer' &&",
			"\t\taction !== 'resolve_battle' && action !== 'log' &&",
			"\t\t!(arg && arg.__debug) && !String(action).startsWith('debug_')) {",
			"\t\tgame.log.push('请先处理《雅科夫列夫设计局》的询问（是否补机保护本次陆军）')",
			"\t\treturn game",
			"\t}",
			"",
		].map(x => x + '\r')
		L.splice(i, 0, ...block)
		console.log('  ✓ 已加 bureau_wait 门禁')
	}
}

fs.writeFileSync(P, L.join('\n'), 'utf8')
console.log('已写入')
