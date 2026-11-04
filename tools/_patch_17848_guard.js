/* 放宽 _real_test_precheck_17848 的静态守卫：17544 用了 wrapper */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '_real_test_precheck_17848.js')
let s = fs.readFileSync(p, 'utf8')
const before = s
s = s.split("/precheck: precheck_launch_battle/.test").join("/precheck: (precheck_launch_battle|\\(g, o, a, c\\) =>)/.test")
if (s !== before) { fs.writeFileSync(p, s, 'utf8'); console.log('patched') } else console.log('no match')
