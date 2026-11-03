const fs = require('fs');
const p = 'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop/2958107220.json';
const raw = fs.readFileSync(p, 'utf8');
const targets = ['萨宾行动','奇袭塔兰托','敦刻尔克','布莱切利','保持冷静','加拿大进入动员','天王星','罗科索夫斯基','一步也不许后退','共青城','间谍机构'];
console.log('=== 整份文本包含性检查 ===');
for (const t of targets) {
  console.log((raw.indexOf(t) >= 0 ? '有 ' : '无 ') + ' "' + t + '"');
}

// 看看顶层对象类型和样本昵称
const mod = JSON.parse(raw);
const types = {};
let sampleNames = [];
function walk(list) {
  for (const o of list || []) {
    const ty = o.Name || o.__class || '?';
    types[ty] = (types[ty] || 0) + 1;
    if (o.Nickname && sampleNames.length < 30) sampleNames.push(o.Nickname);
    if (o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);
console.log('\n=== 对象类型分布(顶层递归) ===');
console.log(types);
console.log('\n=== 样本 Nickname(前30) ===');
console.log(sampleNames.join(' | '));
