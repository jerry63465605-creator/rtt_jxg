/*
 * P3-1 只读审计：need:'piece' 点击链
 *
 * 输出清单：服务端每一处返回 need:'piece' 的归属卡 + 所属通道（armed / echo-run / event-multistep），
 * 以及客户端是否有对应的"选部队"处理分支（否则玩家点不到 = 假死）。
 *
 * 用法：node tools/_audit_need_piece.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const rules = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
const play = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')

/* 客户端三种挂起各自的"piece"分支 */
const client = {
	echo: /pending_echo[\s\S]{0,4000}?step === 'piece'/.test(play),
	armed: /pending_armed[\s\S]{0,4000}?piece/.test(play) && /on_click_piece/.test(play),
	event_targets: /pending_event_targets[\s\S]{0,3000}?piece/.test(play) && /submit_event_piece/.test(play),
}

/* 找 each need:piece 的归属卡（向上找最近的 '\t<id>': { 或 '\t\t'<id>': {） */
function ownerOf(idx) {
	for (let i = idx; i >= 0 && i > idx - 600; i--) {
		const m = rules[i].match(/^\t+'(\d{4,5})': \{/)
		if (m) return m[1]
	}
	return '?'
}
/* 通道判定：看归属卡块内是否出现 armed: */
function channelOf(cardId) {
	const start = rules.findIndex(l => new RegExp("^\\t+'" + cardId + "': \\{").test(l))
	if (start < 0) return '?'
	for (let i = start; i < start + 400 && i < rules.length; i++) {
		if (rules[i].includes('armed: {')) return 'armed'
		if (rules[i].includes('steps: [')) return 'event-multistep'
	}
	return 'echo-run'
}

const hits = []
rules.forEach((l, i) => {
	if (!/need: 'piece'/.test(l)) return
	if (/^\s*\*/.test(l)) return                       /* 注释行 */
	const owner = ownerOf(i)
	hits.push({ line: i + 1, owner, channel: channelOf(owner), text: l.trim().slice(0, 70) })
})

/* 去重（同卡多处） */
const byCard = {}
for (const h of hits) {
	const k = h.owner + '|' + h.channel
	if (!byCard[k]) byCard[k] = { owner: h.owner, channel: h.channel, lines: [], n: 0 }
	byCard[k].lines.push(h.line)
	byCard[k].n++
}

const C = require(path.join(MOD, 'cards.js'))
const arr = Array.isArray(C) ? C : (C.cards || Object.values(C)[0])
const nameOf = id => ((arr.find(c => String(c.id) === String(id)) || {}).name) || '?'

const rows = Object.values(byCard).sort((a, b) => a.owner.localeCompare(b.owner))

const L = []
L.push('# P3-1 审计：`need:\'piece\'` 点击链（只读）')
L.push('')
L.push('生成脚本：`tools/_audit_need_piece.js`　生成日期：2026-11-05')
L.push('')
L.push('## 0. 客户端三种挂起是否支持"选部队"')
L.push('')
L.push('| 挂起 | 客户端分支 | 说明 |')
L.push('|---|---|---|')
L.push('| `pending_echo`（增强卡多步） | ' + (client.echo ? '✅' : '❌') + ' | 需要 `step === \'piece\'` 才画选择框；**只有 choice / space 时 piece 会点不到** |')
L.push('| `pending_armed`（机会卡多步） | ' + (client.armed ? '✅' : '❌') + ' | `on_click_piece` + 候选归一是必需（V26） |')
L.push('| `pending_event_targets`（事件卡分步） | ' + (client.event_targets ? '✅' : '❌') + ' | `submit_event_piece` 通道 |')
L.push('')
L.push('## 1. 服务端返回 `need:\'piece\'` 的卡（去重）')
L.push('')
L.push('| 卡号 | 卡名 | 通道 | 出现处 | 客户端可用? | 结论 |')
L.push('|---|---|---|---|---|---|')
for (const r of rows) {
	/* owner '?' = 框架层（event_card_needs / 事件卡分步）→ 走 pending_event_targets 通道 */
	const can = r.owner === '?'
		? client.event_targets
		: (r.channel === 'armed' ? client.armed : (r.channel === 'event-multistep' ? client.event_targets : client.echo))
	L.push(`| ${r.owner} | ${nameOf(r.owner)} | ${r.channel} | ${r.lines.join(',')} | ${can ? '✅' : '❌'} | ${can ? '走现成分支' : '⚠ 需改走 choice/space 或补客户端 piece 分支'} |`)
}
L.push('')
L.push('> 备注：15407《秋水火箭战斗机》原本走 `need:\'piece\'`，2026-11-05 已改为 `need:\'choice\'`（见 B3），')
L.push('> 因此上面的清单里不会出现它；改造理由是 `pending_echo` 当时没有 piece 分支。')
L.push('')

fs.writeFileSync(path.join(ROOT, 'docs', 'audit-need-piece.md'), L.join('\n'), 'utf8')
console.log(L.join('\n'))
