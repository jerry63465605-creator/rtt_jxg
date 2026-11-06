/* 扫描 server.js：/join 路由与 play-socket 的处理逻辑 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'server.js')
const L = fs.readFileSync(P, 'utf8').split('\n')
const show = (a, b, tag) => {
	console.log('\n===== ' + tag + ' @' + a)
	console.log(L.slice(a - 1, b).map((x, i) => (a + i) + ': ' + x.replace(/\r$/, '')).join('\n'))
}
let i = L.findIndex(l => l.indexOf('/join') >= 0 && l.indexOf('app.') >= 0)
if (i >= 0) show(i + 1, i + 18, '/join 路由')
let j = L.findIndex(l => l.indexOf('play-socket') >= 0)
if (j >= 0) show(j + 1, j + 40, 'play-socket')
let k = L.findIndex(l => l.indexOf('on("message"') >= 0 || l.indexOf("on('message'") >= 0)
if (k >= 0) show(k + 1, k + 26, 'socket message')
