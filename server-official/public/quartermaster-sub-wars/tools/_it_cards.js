const fs = require('fs');
const s = fs.readFileSync('cards.js', 'utf8');
const parts = s.split(/"id":\s*(\d+)/).slice(1);
const out = [];
for (let i = 0; i < parts.length; i += 2) {
  const id = parts[i];
  const block = parts[i + 1];
  const name = (block.match(/"name":\s*"([^"]*)"/) || [])[1];
  const type = (block.match(/"type":\s*"([^"]*)"/) || [])[1];
  const deck = (block.match(/"deck":\s*"([^"]*)"/) || [])[1];
  const nation = (block.match(/"nation":\s*"([^"]*)"/) || [])[1];
  if (nation === '意大利') out.push(id + '\t' + deck + '\t' + type + '\t' + name);
}
console.log('意大利卡数量:', out.length);
console.log(out.join('\n'));
