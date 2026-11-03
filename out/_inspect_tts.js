const fs = require('fs');
const p = 'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop/3763225217.json';
const mod = JSON.parse(fs.readFileSync(p, 'utf8'));
const states = mod.ObjectStates || [];
console.log('顶层 ObjectStates 数:', states.length);
const names = [];
function walk(list, depth) {
  for (const o of list || []) {
    if (o.Nickname) names.push((o.Name||'') + ' | ' + o.Nickname);
    if (o.ContainedObjects) walk(o.ContainedObjects, depth + 1);
  }
}
walk(states, 0);
console.log('含 Nickname 的对象数:', names.length);
console.log('--- 前 40 个 Nickname 样本 ---');
console.log(names.slice(0, 40).join('\n'));
// 看看有没有 CustomDeck 及其 FaceURL 模式
let deckCount = 0;
function walkDeck(list) {
  for (const o of list || []) {
    if (o.CustomDeck && Object.keys(o.CustomDeck).length) {
      deckCount++;
      if (deckCount <= 3) {
        const d = Object.values(o.CustomDeck)[0];
        console.log('Deck ' + deckCount + ' FaceURL=' + (d.FaceURL||'') + ' grid=' + (d.NumWidth||'?') + 'x' + (d.NumHeight||'?'));
      }
    }
    if (o.ContainedObjects) walkDeck(o.ContainedObjects);
  }
}
walkDeck(states);
console.log('总 Deck/CustomDeck 对象数:', deckCount);
