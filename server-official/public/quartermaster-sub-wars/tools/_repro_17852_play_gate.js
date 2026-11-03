/*
 * 复现：打出 17852《罗科索夫斯基 朱可夫 科涅夫》后，是否还能打出其它事件卡。
 *
 * 现象（线上 game 5721）：打出 17852 进入"选 2 张状态卡"挂起期间，
 * 仍可打出其它事件牌。
 *
 * 检查三层：
 *   ① 服务端是否建立 pending_status_play
 *   ② view.actions（= build_actions 白名单）是否还含 play_card
 *   ③ 直接提交 play_card 打第二张事件，服务端是"冻结"还是"放行"
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const { CARDS } = require(path.join(__dirname, '..', 'cards.js'))

function section(t) { console.log('\n=== ' + t + ' ===') }

const g = rules.setup(9401, rules.default_scenario, {})
g.opening = null
g.turn_phase = 'play'
g.active = 'allies'
g.current_nation = '苏联'

/* 找一张苏联 EVENT（非 17852）作为"第二张" */
const other = CARDS.find(c => c.nation === '苏联' && c.type === 'EVENT' && String(c.id) !== '17852')
console.log('第二张事件卡 =', other && other.id, other && other.name)

/* 苏联手牌：17852 + 第二张事件 + 两张状态卡 */
const st1 = (CARDS.find(c => c.nation === '苏联' && c.type === 'STATUS') || {}).id
g.hands['苏联'] = ['17852#1', String(other.id) + '#1', String(st1) + '#1']
console.log('苏联手牌 =', JSON.stringify(g.hands['苏联']))

section('① 打出 17852')
const r1 = rules.action(g, 'Allies', 'play_card', { card: '17852#1' })
console.log('pending_status_play =', JSON.stringify(r1.pending_status_play))
console.log('日志尾部：', (r1.log || []).slice(-2).join(' | '))
console.log('17852 还在手牌吗：', (r1.hands['苏联'] || []).indexOf('17852#1') >= 0)

section('② view.actions（苏联视角）')
const v = rules.view(r1, 'Allies')
console.log('actions =', JSON.stringify(v.actions))
console.log('block_reason =', v.block_reason)
console.log('play_card 是否在白名单：', !!(v.actions && v.actions.play_card))

section('③ 直接提交第二张事件 play_card')
const r2 = rules.action(r1, 'Allies', 'play_card', { card: String(other.id) + '#1' })
const tail = (r2.log || []).slice(-3)
console.log('日志尾部：')
for (const l of tail) console.log('  ' + l)
console.log('第二张还在手牌吗：', (r2.hands['苏联'] || []).indexOf(String(other.id) + '#1') >= 0)
console.log('判断：' + (tail.some(l => /等待|不能|只能|请先/.test(l))
	? '服务端【拦截】了第二张'
	: '服务端【放行】了第二张 —— BUG'))

section('④ 再看 pending_status_play 是否被顺带清掉')
console.log('pending_status_play =', JSON.stringify(r2.pending_status_play))
console.log('剩余手牌 =', JSON.stringify(r2.hands['苏联']))
