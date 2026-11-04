/* 两处测试断言适配 S2-b 的"更早拦截" */
const fs = require('fs')
const path = require('path')

/* ① _smoke_15247_pick：缺 space 现在被预检拦（文案不同，语义相同） */
{
	const p = path.join(__dirname, '_smoke_15247_pick.js')
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf('请指定战斗地区') < 0) {
		s = s.replace('/请选择要攻击的相邻地区/.test(noSpaceMsg)', '/请选择要攻击的相邻地区|请指定战斗地区/.test(noSpaceMsg)')
		fs.writeFileSync(p, s, 'utf8')
		console.log('15247 断言已放宽:', s.indexOf('请指定战斗地区') >= 0)
	} else console.log('15247 已处理')
}

/* ② _real_test_precheck_17848：17544 用 wrapper（requireSpace:false） */
{
	const p = path.join(__dirname, '_real_test_precheck_17848.js')
	let s = fs.readFileSync(p, 'utf8')
	const oldBlock = `	for (const id of ['17848', '15245', '15247', '17544']) {
		const seg = src.split("'" + id + "': {")[1] || ''
		ok(id + ' 的 trigger 挂了 precheck', /precheck: precheck_launch_battle/.test(seg.slice(0, 400)))
	}`
	const newBlock = `	for (const id of ['17848', '15245', '15247', '17544']) {
		const seg = src.split("'" + id + "': {")[1] || ''
		/* 17544 用 wrapper（requireSpace:false）—— 它的 run 用"被武装那一刻的地区" */
		ok(id + ' 的 trigger 挂了 precheck', /precheck: (precheck_launch_battle|\\(g, o, a, c\\) =>)/.test(seg.slice(0, 500)))
	}`
	if (s.indexOf(newBlock) < 0) {
		s = s.replace(oldBlock, newBlock)
		fs.writeFileSync(p, s, 'utf8')
		console.log('17848 静态守卫已放宽:', s.indexOf('requireSpace:false') >= 0)
	} else console.log('17848 已处理')
}
