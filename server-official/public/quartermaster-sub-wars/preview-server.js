/*
 * 预览工具专用静态服务器（绕过 RTT 不对外提供模块目录文件的问题）。
 *
 * 用法：node preview-server.js  [端口，默认 8090]
 * 然后浏览器打开：http://127.0.0.1:<端口>/event-cards-preview.html
 *
 * 本服务器只服务于本目录（模块目录），并把 event-cards-preview.html 作为根路径默认页。
 * 预览页通过相对路径 fetch data.js / cards.js / rules.js，由本服务器提供。
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const PORT = parseInt(process.argv[2] || '8090', 10)

const MIME = {
	'.html': 'text/html; charset=UTF-8',
	'.js': 'text/javascript; charset=UTF-8',
	'.mjs': 'text/javascript; charset=UTF-8',
	'.css': 'text/css; charset=UTF-8',
	'.json': 'application/json; charset=UTF-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.ico': 'image/x-icon',
}

const server = http.createServer((req, res) => {
	let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
	if (urlPath === '/' || urlPath === '') urlPath = '/event-cards-preview.html'

	const filePath = path.normalize(path.join(ROOT, urlPath))
	if (!filePath.startsWith(ROOT)) {
		res.writeHead(403, { 'Content-Type': 'text/plain; charset=UTF-8' })
		res.end('forbidden')
		return
	}

	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' })
			res.end('not found: ' + urlPath)
			return
		}
		const ext = path.extname(filePath).toLowerCase()
		res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
		res.end(data)
	})
})

server.listen(PORT, () => {
	console.log('卡牌预览服务器已启动：http://127.0.0.1:' + PORT + '/event-cards-preview.html')
})
