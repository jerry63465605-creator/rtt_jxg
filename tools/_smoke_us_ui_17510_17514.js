/* 验证 17514 飞虎队（event_card_needs choice+space 分支）与 17510 我们的政治哲学（view.us_political 出口） */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

function spidByName(name) {
	for (const k in I.data.spaces) if (I.data.spaces[k].name === name) return Number(k)
	return null
}
let pass = 0, fail = 0
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg) } }

/* ---- 17514 飞虎队 ---- */
console.log('[17514 飞虎队] event_card_needs choice+space 分支')
{
	const g = rules.setup(1)
	const home = I.home_base_of('中国')
	ok(home != null, '中国大本营存在 id=' + home)

	// 默认棋盘中国本就有合法部署点：应返回带标签的 choice（option0 可用）
	const need0 = I.event_card_needs(g, '中国', '17514#0', {})
	ok(need0 && need0.need === 'choice' && need0.options[0].disabled === false, '默认棋盘返回 choice 且"部署空军"可用')

	// 在大本营放一支处于补给的中国陆军，使"部署空军"合法（确保候选含本营）
	const k = 'T' + Math.random().toString(36).slice(2, 8)
	g.location[k] = home; g.piece_nation[k] = '中国'; g.piece_type[k] = 'army'
	const sup = I.compute_supply(g)
	ok(sup && sup.in_supply[k], '中国陆军在其大本营处于补给')

	const need1 = I.event_card_needs(g, '中国', '17514#0', {})
	ok(need1 && need1.need === 'choice', '有候选时返回 need:choice')
	ok(need1 && Array.isArray(need1.options) && need1.options.length === 2, 'options 长度为 2')
	ok(need1 && need1.options[0].label === '部署 1 支中国空军', '选项0标签正确：' + (need1 && need1.options[0].label))
	ok(need1 && need1.options[1].label === '发起夺取制空权', '选项1标签正确：' + (need1 && need1.options[1].label))
	ok(need1 && need1.options[0].disabled === false, '选项0（部署空军）此时合法可用')

	// choice=0 后返回 need:space 且候选含中国大本营
	const need2 = I.event_card_needs(g, '中国', '17514#0', { choice: 0 })
	ok(need2 && need2.need === 'space', 'choice=0 后返回 need:space')
	ok(need2 && Array.isArray(need2.candidates) && need2.candidates.indexOf(home) >= 0, 'space 候选含中国大本营')
	ok(need2 && need2.cost === null, 'space 步 cost 显式 null（避免二次弹弃牌框）')

	// choice=1 后返回 need:space（夺取制空权候选，可能为空->返回null取决于局势）
	const need3 = I.event_card_needs(g, '中国', '17514#0', { choice: 1 })
	ok(need3 === null || (need3.need === 'space'), 'choice=1 后返回 null 或 need:space（取决于有无相邻敌占区）')
}

/* ---- 17510 我们的政治哲学 ---- */
console.log('\n[17510 我们的政治哲学] view.us_political 出口')
{
	const g = rules.setup(1)
	g.us_political = { nation: '英国', candidates: ['17500#0', '17501#0'] }

	// 美国（同盟）视角：应看到 candidates
	const vUS = rules.view(g, 'Allies')
	ok(vUS && vUS.us_political && vUS.us_political.step === 'play', '美国视角 us_political.step=play')
	ok(vUS && vUS.us_political && vUS.us_political.candidates.length === 2, '美国视角候选 2 张')
	ok(vUS && vUS.us_political && vUS.us_political.waiting_for === null, '美国视角 waiting_for=null')

	// 轴心视角：只看到 waiting_for:美国（不含候选）
	const vAX = rules.view(g, 'Axis')
	ok(vAX && vAX.us_political && vAX.us_political.waiting_for === '美国', '轴心视角 waiting_for=美国')
	ok(vAX && vAX.us_political && !vAX.us_political.candidates, '轴心视角不泄露英国弃牌堆候选')
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
