/*
 * 静态一致性检查：peek_modal 的 DOM id 与 play.js 引用是否匹配。
 *
 * 为什么用静态检查而不是开浏览器：
 * 这个弹框只在【真实对局的摸牌阶段打出《双十字系统》】时才出现，
 * 用 playwright 需要先把对局推进到该状态，成本高。
 * 而它最容易出的错恰恰是"id 写错/函数名对不上"——
 * 这类错误静态检查就能 100% 覆盖。
 */
const fs = require('fs')
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

const html = fs.readFileSync(path.join(DIR, 'play.html'), 'utf8')
const js = fs.readFileSync(path.join(DIR, 'play.js'), 'utf8')
const css = fs.readFileSync(path.join(DIR, 'play.css'), 'utf8')

let pass = 0, fail = 0
const bad = []
const ck = (cond, name) => { if (cond) pass++; else { fail++; bad.push(name) } }

/* ① play.html 里必须有这些 id */
const NEED_IDS = [
	'peek_modal', 'peek_cards', 'peek_target_note',
	'peek_order_note', 'peek_order_desc', 'peek_confirm',
]
for (const id of NEED_IDS)
	ck(html.indexOf('id="' + id + '"') >= 0, 'HTML 缺少 id: ' + id)

/* ② play.html 的 onclick 引用的函数必须在 play.js 里有定义 */
const onclicks = [...html.matchAll(/onclick="(\w+)\(\)"/g)].map(m => m[1])
const peekOns = onclicks.filter(f => /peek/.test(f))
ck(peekOns.length >= 3, 'peek 相关 onclick 数量: ' + peekOns.length)
for (const f of peekOns)
	ck(new RegExp('function\\s+' + f + '\\s*\\(').test(js), 'play.js 未定义函数: ' + f)

/* ③ play.js 里 getElementById 引用的 id 必须在 html 里存在 */
const jsIds = [...js.matchAll(/getElementById\("(peek_\w+)"\)/g)].map(m => m[1])
const uniq = [...new Set(jsIds)]
ck(uniq.length >= 5, 'play.js 引用的 peek id 数量: ' + uniq.length)
for (const id of uniq)
	ck(html.indexOf('id="' + id + '"') >= 0, 'play.js 引用了不存在的 id: ' + id)

/* ④ CSS 类 */
ck(css.indexOf('.modal-desc') >= 0, 'CSS 缺少 .modal-desc')

/* ⑤ update_peek_box 必须被调用（挂进刷新循环） */
ck(/update_peek_box\(\)/.test(js), '未调用 update_peek_box()')
/* 至少两处：定义 + 调用（更新循环里） */
const callCount = (js.match(/update_peek_box\(\)/g) || []).length
ck(callCount >= 2, 'update_peek_box 调用次数不足: ' + callCount)

/* ⑥ 服务端 view 暴露 peek / card_triggers / my_faction / current_faction */
const rules = fs.readFileSync(path.join(DIR, 'rules.js'), 'utf8')
for (const k of ['peek:', 'card_triggers:', 'my_faction:', 'current_faction:'])
	ck(rules.indexOf(k) >= 0, 'rules.js view 缺少: ' + k)

/* ⑦ clear_peek action 存在 */
ck(rules.indexOf("action === 'clear_peek'") >= 0, 'rules.js 缺少 clear_peek action')

/* ⑧ 客户端时点判定引用了服务端给的字段 */
ck(js.indexOf('view.card_triggers') >= 0, 'play.js 未用 view.card_triggers')
ck(js.indexOf('view.current_faction') >= 0, 'play.js 未用 view.current_faction')

console.log('通过 ' + pass + ' / 失败 ' + fail)
if (fail) bad.forEach(b => console.log('  ✗ ' + b))
else console.log('全部通过')
if (fail) process.exit(1)
