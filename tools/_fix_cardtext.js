/*
 * 修正 out/uk_cards.csv 的【源头数据】。
 *
 * 背景：cards.js 由 tools/gen_module_cards.js 从本 CSV 自动生成，
 * 直接手改 cards.js 会在下次生成时被覆盖。
 * 所以类型/文本的更正一律改这里，然后重新生成。
 *
 * 本次修正（玩家 2026-09-24 确认）：
 *   ① 类型（依据卡面右上角图标，见 docs/card-icons.md）
 *      15305–15312 : EVENT -> EFFECT   （↑ 增强卡，不是 ! 事件卡）
 *      12503/12504 : EFFECT -> RESPONSE（? 响应卡）
 *   ② 卡面文本（OCR 有误，玩家给出正确文本）
 *      15326 : 之一 -> 之二
 *      12501 : 发起陆战 -> 消灭
 */
const fs = require('fs')
const path = require('path')

const csvPath = path.join(__dirname, '..', 'out', 'uk_cards.csv')
const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/)

/* CSV 列: deck,id,sheet,row,col,name,type,ops,text,img,src */
const TO_EFFECT = ['15305', '15306', '15307', '15308', '15309', '15310', '15311', '15312']
const TO_RESPONSE = ['12503', '12504']

const TEXT_FIX = {
	'15326': ['在<西欧><非洲北部><非洲南部>之一征召法国陆军',
		'在<西欧><非洲北部><非洲南部>之二征召法国陆军'],
	'12501': ['在<印度>或<缅甸>发起1次陆战',
		'在<印度>消灭一支敌方国家陆军'],
}

let nType = 0, nText = 0
const out = lines.map(line => {
	const cols = line.split(',')
	if (cols.length < 7) return line
	const id = cols[1]

	if (TO_EFFECT.indexOf(id) >= 0 && cols[6] === 'EVENT') { cols[6] = 'EFFECT'; nType++ }
	if (TO_RESPONSE.indexOf(id) >= 0 && cols[6] === 'EFFECT') { cols[6] = 'RESPONSE'; nType++ }

	/* 文本可能含逗号，所以用整行替换更安全 */
	return cols.join(',')
})

let txt = out.join('\n')
for (const id of Object.keys(TEXT_FIX)) {
	const [from, to] = TEXT_FIX[id]
	if (txt.indexOf(from) >= 0) { txt = txt.split(from).join(to); nText++ }
	else console.log('!! 未找到文本: ' + id + ' / ' + from)
}

fs.writeFileSync(csvPath, txt)
console.log('类型修正行数:', nType)
console.log('文本修正处数:', nText)
