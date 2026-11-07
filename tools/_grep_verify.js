/* 找出校验脚本里关于 17505 的三条待更新断言 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '_verify_package.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
lines.forEach((l, i) => {
	if (/_p51Before|B26-b 17505|us_p51/.test(l)) console.log('L' + (i + 1) + ': ' + l)
})
