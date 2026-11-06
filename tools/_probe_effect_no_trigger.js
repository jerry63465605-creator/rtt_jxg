/* 盘点：无 CARD_TRIGGERS 声明、因而"随时可打（含对手回合亮起）"的 EFFECT 卡 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const cards = require(path.join(MOD, 'cards.js'))
const arr = cards.CARDS

/* CARD_TRIGGERS 未导出？试几种来源 */
let TR = I.CARD_TRIGGERS
if (!TR) {
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	TR = {}
	for (const m of src.matchAll(/CARD_TRIGGERS\['(\d{4,5})'\]\s*=/g)) TR[m[1]] = 1
	console.log('（CARD_TRIGGERS 由源码解析，共 ' + Object.keys(TR).length + ' 条）')
} else {
	console.log('（CARD_TRIGGERS 来自 _internal，共 ' + Object.keys(TR).length + ' 条）')
}

const eff = arr.filter(c => String(c.type).toUpperCase() === 'EFFECT')
const noTrig = eff.filter(c => !TR[String(c.id)])
console.log('EFFECT 共 ' + eff.length + ' 张；无 CARD_TRIGGERS 声明 = ' + noTrig.length + ' 张：')
for (const c of noTrig) {
	const inCmd = (I.CMD_IMPL || {})[String(c.id)]
	console.log('  ' + c.id + ' ' + c.name + '  [' + c.nation + ']' + (inCmd ? '  CMD_IMPL=' + (inCmd.kind || '已登记') : ''))
}
