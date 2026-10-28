const s = require('fs').readFileSync('cards.js', 'utf8');
const parts = s.split(/"id":\s*(\d+)/).slice(1);
const rows = [];
for (let i = 0; i < parts.length; i += 2) {
  const b = parts[i + 1];
  const n = (b.match(/"nation":\s*"([^"]*)"/) || [])[1];
  if (n === '苏联') rows.push(parts[i] + ' ' + (b.match(/"deck":\s*"([^"]*)"/) || [])[1] + ' ' + (b.match(/"type":\s*"([^"]*)"/) || [])[1] + ' ' + (b.match(/"name":\s*"([^"]*)"/) || [])[1]);
}
console.log(rows.join('\n'));
console.log('--- 苏联段 155xx/156xx 空位检查 ---');
for (let id = 15500; id <= 15699; id++) {
  if (new RegExp('"id": ' + id + '\\b').test(s)) console.log(id, '占用');
}
console.log('done');
