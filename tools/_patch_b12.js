/*
 * B12 代码手术：17732 借用改为「代价由借用方（意大利）支付」，并去重 discard 块。
 * 仅做文本级替换，逐条打印是否命中，便于核对。
 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let src = fs.readFileSync(P, 'utf8')
const lines = src.split('\n')
const hit = (cond, msg) => console.log((cond ? '✓ ' : '✗ ') + msg)

/* ---------- ① 去重：第二段 cost.discard 块（完全重复） ---------- */
{
	const HEAD = '\t\tif (cost.discard && !borrowed && !_costPaidNow) {'
	let idx = []
	for (let i = 31000; i < 32600 && i < lines.length; i++)
		if (lines[i] === HEAD) idx.push(i)
	hit(idx.length === 2, '定位到两段 cost.discard 块：' + JSON.stringify(idx.map(x => x + 1)))
	if (idx.length === 2) {
		/* 第二段从 idx[1] 起到同级 '\t\t}' 结束 */
		let end = idx[1]
		for (let i = idx[1]; i < idx[1] + 80; i++) {
			if (lines[i] === '\t\t}') { end = i; break }
		}
		const removed = end - idx[1] + 1
		lines.splice(idx[1], removed)
		console.log('  已删除第二段（' + removed + ' 行）')
	}
}

/* ---------- ② 三处代价不再对 borrowed 豁免 ---------- */
{
	let n = 0
	for (let i = 31000; i < lines.length; i++) {
		if (lines[i].indexOf('if (cost.discard && !borrowed && !_costPaidNow) {') >= 0) {
			lines[i] = lines[i].replace('!borrowed && ', '')
			n++
		}
		if (lines[i].indexOf('if (cost.attrition && !borrowed && !_costPaidNow) {') >= 0) {
			lines[i] = lines[i].replace('!borrowed && ', '')
			n++
		}
		if (lines[i].indexOf('if (cost.skip_play && !borrowed && !_costPaidNow) {') >= 0) {
			lines[i] = lines[i].replace('!borrowed && ', '')
			n++
		}
	}
	hit(n === 3, '三处代价去掉 borrowed 豁免（命中 ' + n + '）')
}

src = lines.join('\n')

/* ---------- ③ discard 代价：必须来自 costPayer 手牌 ---------- */
{
	const oldStr = [
		'\t\t\tconst picked = (arg && arg.discard) || []',
		'\t\t\tif (picked.length < cost.discard) {',
		'\t\t\t\tgame.log.push(\'请先选择要弃置的 \' + cost.discard + \' 张手牌\')',
		'\t\t\t\treturn game',
		'\t\t\t}',
	].join('\n')
	const newStr = [
		'\t\t\tconst picked = (arg && arg.discard) || []',
		'\t\t\tif (picked.length < cost.discard) {',
		'\t\t\t\tgame.log.push(\'请先选择要弃置的 \' + cost.discard + \' 张手牌\')',
		'\t\t\t\treturn game',
		'\t\t\t}',
		'\t\t\t/*',
		'\t\t\t * 【2026-11-05 · B12】代价必须来自【付款方】手牌。',
		'\t\t\t * 借用德国状态卡时 costPayer = 意大利：玩家点了德国的牌、或点了不在手牌里的牌，',
		'\t\t\t * 都会在 discard_card 里静默失败（牌没扣、效果照跑 = 白嫖），这里提前拒绝。',
		'\t\t\t */',
		'\t\t\tfor (const cid of picked.slice(0, cost.discard)) {',
		'\t\t\t\tif ((game.hands[costPayer] || []).indexOf(cid) < 0) {',
		'\t\t\t\t\tgame.log.push(\'《\' + cName + \'》的代价须从【\' + costPayer + \'】手牌中选择（未支付代价）\')',
		'\t\t\t\t\treturn game',
		'\t\t\t\t}',
		'\t\t\t}',
	].join('\n')
	hit(src.indexOf(oldStr) >= 0, '定位 discard 手牌校验插入点')
	src = src.replace(oldStr, newStr)
}

/* ---------- ④ 17732 候选放宽到「桌面全部德国状态卡」+ playable ---------- */
{
	const oldStr = [
		"\t\tconst germanyTable = (game.table && game.table['德国']) || []",
		'\t\tconst opts = germanyTable.filter(cid => {',
		'\t\t\tconst cfg = status_config_of(cid)',
		'\t\t\treturn cfg && cfg.trigger',
		'\t\t})',
		"\t\tif (!opts.length) return { ok: false, desc: '（桌上没有德国状态卡可借用）' }",
		"\t\tgame.italy_borrow = { pending: true, nation: '意大利', options: opts, turn: game.turn }",
	].join('\n')
	const newStr = [
		"\t\tconst germanyTable = (game.table && game.table['德国']) || []",
		'\t\t/*',
		'\t\t * 【2026-11-05 · B12 玩家口径】候选 = 该桌面【全部】德国状态卡。',
		'\t\t * 其中只有带 trigger（有点击发动条件）的才可激活；其余仅展示（playable:false），',
		'\t\t * 客户端按 playable 置灰，服务端在 activate_status 里已有第二道闸。',
		'\t\t */',
		'\t\tconst opts = germanyTable.slice()',
		'\t\tconst playable = {}',
		'\t\tfor (const cid of opts) {',
		'\t\t\tconst cfg = status_config_of(cid)',
		'\t\t\tplayable[cid] = !!(cfg && cfg.trigger)',
		'\t\t}',
		"\t\tif (!opts.length) return { ok: false, desc: '（桌上没有德国状态卡可借用）' }",
		"\t\tgame.italy_borrow = { pending: true, nation: '意大利', options: opts, playable: playable, turn: game.turn }",
	].join('\n')
	hit(src.indexOf(oldStr) >= 0, '定位 17732 候选生成')
	src = src.replace(oldStr, newStr)
}

/* ---------- ⑤ view 下发 playable ---------- */
{
	const oldStr = [
		'\t\t\t\t\t\toptions: (ib.options || []).map(cid => {',
		'\t\t\t\t\t\t\tconst c = inst_card(String(inst_card_id(cid)))',
		'\t\t\t\t\t\t\treturn { card_id: cid, name: c ? c.name : cid }',
		'\t\t\t\t\t\t}),',
	].join('\n')
	const newStr = [
		'\t\t\t\t\t\toptions: (ib.options || []).map(cid => {',
		'\t\t\t\t\t\t\tconst c = inst_card(String(inst_card_id(cid)))',
		'\t\t\t\t\t\t\t/* 【2026-11-05 · B12】playable=false 的卡只能看、不能点（客户端据此置灰） */',
		'\t\t\t\t\t\t\treturn {',
		'\t\t\t\t\t\t\t\tcard_id: cid, name: c ? c.name : cid,',
		'\t\t\t\t\t\t\t\tplayable: !ib.playable || ib.playable[cid] !== false,',
		'\t\t\t\t\t\t\t}',
		'\t\t\t\t\t\t}),',
	].join('\n')
	hit(src.indexOf(oldStr) >= 0, '定位 view.italy_borrow.options')
	src = src.replace(oldStr, newStr)
}

fs.writeFileSync(P, src, 'utf8')
console.log('已写入 rules.js')
