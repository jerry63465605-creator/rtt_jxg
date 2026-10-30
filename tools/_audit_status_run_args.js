/* 审计：没有 STATUS_UI 条目的可触发状态卡，其 run() 是否依赖客户端传参 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const SE = I.STATUS_EFFECTS || {}

const FACES = ['15253', '15255', '17538', '17540', '17541', '17542', '17543', '17546', '17554', '17901', '15243', '16304', '17838', '17840', '17844', '17845', '17847', '17850', '17545', '17548', '17549', '17551', '17553', '17555', '15343', '15344']

for (const f of FACES) {
	const cfg = SE[f]
	if (!cfg) continue
	const t = cfg.trigger || {}
	const run = t.run
	const src = run ? String(run) : ''
	const usesArg = /arg\s*\.|arg\s*\[/.test(src)
	const usesSpace = /arg\s*\.\s*space/.test(src)
	const usesFrom = /arg\s*\.\s*from/.test(src)
	const usesPiece = /arg\s*\.\s*(piece|victim|target)/.test(src)
	const usesDiscard = /arg\s*\.\s*discard/.test(src)
	console.log(f + '  window=' + (t.window || '-') +
		'  cost=' + Object.keys(t.cost || {}).join('+') +
		'  run=' + (run ? 'yes' : 'no') +
		(usesArg ? '  ⚠ 读 arg' : '  不读 arg') +
		(usesSpace ? ' [space]' : '') + (usesFrom ? ' [from]' : '') +
		(usesPiece ? ' [piece]' : '') + (usesDiscard ? ' [discard]' : ''))
	if (usesArg) console.log('      ' + src.replace(/\s+/g, ' ').slice(0, 240))
}
