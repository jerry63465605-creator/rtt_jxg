const s = require('fs').readFileSync('cards.js', 'utf8');
const parts = s.split(/"id":\s*(\d+)/).slice(1);
const rows = [];
for (let i = 0; i < parts.length; i += 2) {
  const b = parts[i + 1];
  const n = (b.match(/"nation":\s*"([^"]*)"/) || [])[1];
  if (n === '英国') rows.push(parts[i] + ' ' + (b.match(/"deck":\s*"([^"]*)"/) || [])[1] + ' ' + (b.match(/"type":\s*"([^"]*)"/) || [])[1] + ' ' + (b.match(/"name":\s*"([^"]*)"/) || [])[1]);
}
console.log(rows.join('\n'));
console.log('--- 1535x 占用检查 ---');
for (let id = 15350; id <= 15359; id++) {
  const re = new RegExp('"id": ' + id + '\\b');
  if (re.test(s)) console.log(id, '已占用');
}
console.log('check done');
