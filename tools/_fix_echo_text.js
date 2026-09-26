/*
 * 把 8 张增强卡（EFFECT）的【卡面文本】更正为 GLM 读图结果（2026-09-25）。
 *
 * 必须改源头 out/uk_cards.csv —— cards.js 由 gen_module_cards.js 生成，
 * 手改 cards.js 会在下次生成时被覆盖（见 docs/pitfalls.md）。
 *
 * CSV 列: deck,id,sheet,row,col,name_CN,type,ops,effect_CN,img_file,read
 * effect_CN 里可能含 ASCII 逗号，所以按 id 定位后重建整行，
 * 保留首尾字段（img_file、read）。
 */
const fs = require('fs')
const path = require('path')

const csvPath = path.join(__dirname, '..', 'out', 'uk_cards.csv')
const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/)

/* GLM 读图得到的正确卡面（2026-09-25 用户核对） */
const NEW_TEXT = {
	'15305': '摸牌阶段开始时：随机选择并观看 2 张德国的手牌，将这些牌以任意顺序置于德国牌堆顶。',
	'15306': '计分阶段开始时，弃置 2 张手牌：在<非洲北部>-<中东>-<东南亚>-<印度尼西亚>之一征召陆军。',
	'15307': '计分阶段开始时，弃置 2 张手牌：法国建设 1 支海军。',
	'15308': '空军阶段开始时：法国部署 1 支空军。',
	'15309': '计分阶段开始时，弃置 2 张手牌：法国建设 1 支陆军。',
	'15310': '计分阶段开始时，弃置 1 张手牌：法国在<非洲北部>-<非洲南部>-<马达加斯加>-<中东>-<东南亚>-<新几内亚>之一征召 1 支陆军。',
	'15311': '任意时机，弃置 4 张手牌：<西欧>的法国陆军在本回合内不会被移除。',
	'15312': '计分阶段开始时，弃置 2 张手牌：在<东欧>征召陆军。（卡底：华沙，起义！）',
}

let n = 0
const out = lines.map(line => {
	if (!line.trim()) return line
	const parts = line.split(',')
	if (parts.length < 9) return line
	const id = parts[1]
	const text = NEW_TEXT[id]
	if (!text) return line
	/* 保留 deck..ops(0..7)，替换 effect_CN，保留末两列 img_file, read */
	const head = parts.slice(0, 8).join(',')
	const tail = parts.slice(-2).join(',')
	n++
	return head + ',' + text + ',' + tail
})

fs.writeFileSync(csvPath, out.join('\n'))
console.log('已更新文本行数:', n)
