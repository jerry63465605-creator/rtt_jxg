/* 验证游戏 19 当前服务器实际推送的 view：active 应为 Allies，且德国视角有 su_red_wait */
const path = require('path')
const base = path.join(__dirname, '..', 'server-official')
const Database = require(path.join(base, 'node_modules', 'better-sqlite3'))
const WebSocket = require(path.join(base, 'node_modules', 'ws'))
const db = new Database(path.join(base, 'db'))
const sid = db.prepare("insert into logins(sid,user_id,ip,expires) values (abs(random()) % (1<<48), 1, '127.0.0.1', julianday() + 1) returning sid").get().sid
const ws = new WebSocket('ws://localhost:8091/play-socket?title=quartermaster-sub-wars&game=19&role=Axis&seen=0', { headers: { Cookie: 'login=' + sid } })
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString())
  if (msg[0] === 'state') {
    const v = msg[1]
    console.log('view.active      :', v.active)
    console.log('view.turn_phase  :', v.turn_phase)
    console.log('view.current_nat :', v.current_nation)
    console.log('view.su_red_wait :', JSON.stringify(v.su_red_wait))
    console.log('view.phase_note  :', v.phase_note)
    console.log('view.actions     :', v.actions ? Object.keys(v.actions).join(',') : '(none)')
    ws.close()
  }
})
ws.on('error', (e) => { console.log('WS error:', e.message); done() })
ws.on('close', () => done())
function done() { try { db.prepare("delete from logins where sid=?").run(sid) } catch (e) {} process.exit(0) }
setTimeout(done, 8000)
