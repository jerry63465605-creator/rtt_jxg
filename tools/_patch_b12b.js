/*
 * B12 手术（第二轮，兼容 CRLF）：
 *  ① 删掉重复的第二段 cost.discard 块（否则会扣两次）
 *  ② 在唯一的那段里补「代价必须来自 costPayer 手牌」
 *  ③ 17732 候选放宽到桌面全部德国状态卡 + playable
 *  ④ view.italy_borrow.options 下发 playable
 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let lines = fs.readFileSync(P, 'utf8').split('\n')
const bare = i => lines[i].replace(/\r$/, '')

/* ---------- ① 删除重复的第二段 ---------- */
{
	const idx = []
	for (let i = 0; i < lines.length; i++)
		if (bare(i) === '\t\tif (cost.discard && !_costPaidNow) {') idx.push(i)
	console.log('cost.discard 块位置：', JSON.stringify(idx.map(x => x + 1)))
	if (idx.length === 2) {
		let end = idx[1]
		for (let i = idx[1]; i < idx[1] + 60; i++) {
			if (bare(i) === '\t\t}') { end = i; break }
		}
		const n = end - idx[1] + 1
		lines.splice(idx[1], n)
		console.log('  已删除第二段（' + n + ' 行）')
	}
}

/* ---------- ② 补 costPayer 手牌校验 ---------- */
{
	const key = "\t\t\tconst picked = (arg && arg.discard) || []"
	const i = lines.findIndex((_, k) => bare(k) === key)
	console.log('discard picked 行 =', i + 1)
	if (i >= 0) {
		const ins = [
			'\t\t\t/*',
			'\t\t\t * 【2026-11-05 · B12】代价必须来自【付款方】手牌。',
			'\t\t\t * 借用德国状态卡时 costPayer = 意大利：玩家点了德国的牌、或点了不在手里的牌，',
			'\t\t\t * discard_card 会静默失败（牌没扣、效果照跑 = 白嫖），这里提前拒绝。',
			'\t\t\t */',
			'\t\t\tfor (const _dc of ((arg && arg.discard) || []).slice(0, cost.discard)) {',
			'\t\t\t\tif ((game.hands[costPayer] || []).indexOf(_dc) < 0) {',
			'\t\t\t\t\tgame.log.push(\'《\' + cName + \'》的代价须从【\' + costPayer + \'】手牌中选择（未支付代价）\')',
			'\t\t\t\t\treturn game',
			'\t\t\t\t}',
			'\t\t\t}',
		].map(x => x + '\r')
		lines.splice(i + 1, 0, ...ins)
		console.log('  已插入手牌校验（' + ins.length + ' 行）')
	}
}

/* ---------- ③ 17732 候选放宽 ---------- */
{
	const i = lines.findIndex((_, k) => bare(k).indexOf('const opts = germanyTable.filter(cid => {') >= 0)
	console.log('17732 候选行 =', i + 1)
	if (i >= 0) {
		let end = i
		for (let k = i; k < i + 12; k++) if (bare(k) === '\t\t})') { end = k; break }
		const repl = [
			'\t\t/*',
			'\t\t * 【2026-11-05 · B12 玩家口径】候选 = 该桌面【全部】德国状态卡。',
			'\t\t * 只有带 trigger（有点击发动条件）的才可激活；其余仅展示（playable:false），',
			'\t\t * 客户端按 playable 置灰，服务端 activate_status 仍保留第二道闸。',
			'\t\t */',
			'\t\tconst opts = germanyTable.slice()',
			'\t\tconst playable = {}',
			'\t\tfor (const cid of opts) {',
			'\t\t\tconst cfg0 = status_config_of(cid)',
			'\t\t\tplayable[cid] = !!(cfg0 && cfg0.trigger)',
			'\t\t}',
		].map(x => x + '\r')
		lines.splice(i, end - i + 1, ...repl)
		console.log('  已替换候选生成（原 ' + (end - i + 1) + ' 行 → ' + repl.length + ' 行）')
	}
	/* italy_borrow 写入补 playable */
	const j = lines.findIndex((_, k) => bare(k).indexOf("game.italy_borrow = { pending: true, nation: '意大利', options: opts, turn: game.turn }") >= 0)
	console.log('italy_borrow 写入行 =', j + 1)
	if (j >= 0) {
		lines[j] = lines[j].replace('options: opts,', 'options: opts, playable: playable,').replace(/\r?\r?$/, '\r')
		console.log('  已补 playable 字段')
	}
}

/* ---------- ④ view 下发 playable ---------- */
{
	const i = lines.findIndex((_, k) => bare(k).indexOf('options: (ib.options || []).map(cid => {') >= 0)
	console.log('view options 行 =', i + 1)
	if (i >= 0) {
		let end = i
		for (let k = i; k < i + 10; k++) if (bare(k) === '\t\t\t\t\t\t}),') { end = k; break }
		const repl = [
			'\t\t\t\t\t\toptions: (ib.options || []).map(cid => {',
			'\t\t\t\t\t\t\tconst c = inst_card(String(inst_card_id(cid)))',
			'\t\t\t\t\t\t\t/* 【2026-11-05 · B12】playable=false 只能看不能点（客户端据此置灰） */',
			'\t\t\t\t\t\t\treturn {',
			'\t\t\t\t\t\t\t\tcard_id: cid, name: c ? c.name : cid,',
			'\t\t\t\t\t\t\t\tplayable: !ib.playable || ib.playable[cid] !== false,',
			'\t\t\t\t\t\t\t}',
			'\t\t\t\t\t\t}),',
		].map(x => x + '\r')
		lines.splice(i, end - i + 1, ...repl)
		console.log('  已替换 view options（原 ' + (end - i + 1) + ' 行）')
	}
}

fs.writeFileSync(P, lines.join('\n'), 'utf8')
console.log('已写入')
