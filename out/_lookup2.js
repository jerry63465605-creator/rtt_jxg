const fs = require('fs');
const p = 'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop/2958107220.json';
const mod = JSON.parse(fs.readFileSync(p, 'utf8'));

const targets = {
  '萨宾行动': 15349, '奇袭塔兰托': 15350, '敦刻尔克': 15351, '布莱切利': 15352,
  '保持冷静': 15353, '加拿大进入动员': 15354,
  '天王星': 17851, '罗科索夫斯基': 17852, '一步也不许后退': 17853, '共青城': 17854, '间谍机构': 17855
};

function decode(cardID, nw, nh) {
  const sheetNum = Math.floor(cardID / 100);
  const within = cardID % 100;
  const row = Math.floor((within - 1) / nw);
  const col = (within - 1) % nw;
  return { sheetNum, row, col };
}

const found = {};
let indivFace = 0, deckObj = 0;
function walk(list) {
  for (const o of list || []) {
    const name = o.Nickname || '';
    // 统计存储方式
    if (o.FaceURL) indivFace++;
    if (o.CustomDeck && Object.keys(o.CustomDeck).length) deckObj++;
    for (const t of Object.keys(targets)) {
      if (name.indexOf(t) >= 0) {
        const deck = o.CustomDeck ? Object.values(o.CustomDeck)[0] : null;
        const nw = deck ? (deck.NumWidth || 10) : null;
        const nh = deck ? (deck.NumHeight || 7) : null;
        const cid = o.CardID;
        const d = (cid != null && nw) ? decode(cid, nw, nh) : null;
        found[t] = {
          nickname: name,
          cardID: cid,
          numWH: (nw && nh) ? (nw + 'x' + nh) : '?',
          sheetNum: d ? d.sheetNum : '?',
          row: d ? d.row : '?',
          col: d ? d.col : '?',
          faceURL: o.FaceURL || (deck ? deck.FaceURL : '(无)'),
          type: o.Name
        };
      }
    }
    if (o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);

console.log('含 FaceURL(单图) 的对象数:', indivFace);
console.log('含 CustomDeck(雪碧图) 的对象数:', deckObj);
console.log('--- 命中 ---');
for (const t of Object.keys(targets)) {
  const f = found[t];
  if (f) console.log(`命中 "${t}" (id=${targets[t]}): type=${f.type} CardID=${f.cardID} sheet=${f.sheetNum} r${f.row}c${f.col} grid=${f.numWH}\n   FaceURL=${String(f.faceURL).slice(0,90)}`);
  else console.log(`未命中 "${t}" (id=${targets[t]})`);
}
