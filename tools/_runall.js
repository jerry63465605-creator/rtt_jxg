const { execFileSync } = require('child_process')
const path = require('path')

const tests = [
	'test_basic_cards',
	'test_supply',
	'test_neutral',
	'test_dynamic_supply',
	'test_counter_air',
	'test_event_cards',
	'test_echo_cards',
]

let totalFail = 0
for (const t of tests) {
	let out = ''
	try {
		out = execFileSync('node', [path.join(__dirname, t + '.js')], {
			cwd: path.join(__dirname, '..'),
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		})
	} catch (e) {
		out = (e.stdout || '') + (e.stderr || '')
	}
	const lines = out.split(/\r?\n/)
	const fails = lines.filter(l => l.includes('✗'))
	/* 汇总行：包含"通过"且包含"失败"，或"全部通过" */
	const summary = lines.filter(l =>
		(l.includes('通过') && l.includes('失败')) || l.includes('全部通过'))
	const crash = /TypeError|ReferenceError|Cannot read/.test(out)

	console.log('=== ' + t + ' ===')
	console.log('  crash: ' + (crash ? 'YES' : 'no'))
	console.log('  failed lines: ' + fails.length)
	fails.forEach(l => console.log('    ' + l))
	summary.forEach(l => console.log('  ' + l.trim()))
	if (crash) {
		const m = lines.filter(l => /Error|at Object/.test(l)).slice(0, 4)
		m.forEach(l => console.log('    ! ' + l.trim()))
	}
	totalFail += fails.length
	if (crash) totalFail++
}
console.log('\nTOTAL FAILED LINES / CRASHES: ' + totalFail)
