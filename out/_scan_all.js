const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
function list(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = dir + '\\' + e.name;
    if (e.isDirectory()) list(fp, acc);
    else if (e.name.endsWith('.json')) acc.push(fp);
  }
  return acc;
}
const files = list(base, []);
const names = ['萨宾行动','奇袭塔兰托','敦刻尔克','布莱切利','保持冷静','加拿大进入动员','天王星','罗科索夫斯基','一步也不许后退','共青城','间谍机构'];
console.log('共扫描 json 文件:', files.length);
for (const f of files) {
  let s;
  try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  const hit = names.filter(n => s.indexOf(n) >= 0);
  if (hit.length) {
    console.log('命中 ' + hit.length + ' 个: ' + f.replace(base, '') + '  -> ' + hit.join('、'));
  }
}
console.log('扫描完成');
