// Find references to the horse-head / RTT-logo icon across public files.
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..', 'server-official', 'public')
const files = [
  'index.md', 'join.js', 'style.css', 'common/client.js', 'common/client.css',
  'quartermaster-sub-wars/play.html', 'quartermaster-sub-wars/play.css',
]
for (const f of files) {
  const p = path.join(root, f)
  if (!fs.existsSync(p)) continue
  fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
    if (/mounted-knight|rally-the-troops|logo|lobby|href="\/"/i.test(l))
      console.log(f + ':' + (i + 1) + ': ' + l.trim().slice(0, 130))
  })
}
