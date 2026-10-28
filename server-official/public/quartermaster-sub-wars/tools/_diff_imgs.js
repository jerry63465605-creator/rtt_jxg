const fs = require('fs');
const s = fs.readFileSync('cards.js', 'utf8');
const imgs = new Set([...s.matchAll(/"img":\s*"([^"]+)"/g)].map(m => m[1]));
const dir = fs.readdirSync('cards');
const unused = dir.filter(f => !imgs.has(f)).sort();
console.log('cards.js img 引用数:', imgs.size);
console.log('cards/ 文件总数:', dir.length);
console.log('未引用(疑似漏录)的 png:');
console.log(unused.join('\n'));
