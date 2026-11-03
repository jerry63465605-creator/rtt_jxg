const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
const mod = JSON.parse(fs.readFileSync(`${base}/Mods/Workshop/3763225217.json`,'utf8'));
const target = '17875124258557834658';
function ugcId(url){ const m=url.match(/ugc\/(\d+)/); return m?m[1]:null; }
let best=null;
function walk(list){
  for(const o of list||[]){
    if(o.ContainedObjects && Array.isArray(o.ContainedObjects)){
      const kids=o.ContainedObjects;
      const sheetOk=(o.CustomDeck&&ugcId(Object.values(o.CustomDeck)[0].FaceURL)===target)||kids.some(c=>c.CustomDeck&&ugcId(Object.values(c.CustomDeck)[0].FaceURL)===target);
      if(sheetOk){
        const ids=kids.filter(c=>c.CardID!=null).map(c=>c.CardID);
        if(!best||ids.length>best.ids.length) best={ids};
      }
    }
    if(o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);
const ids=best.ids;
fs.writeFileSync('c:/Users/24968/Desktop/rtt/out/japan_ids.json', JSON.stringify(ids));
console.log('导出', ids.length, '张, 段', Math.min(...ids)+'~'+Math.max(...ids));
// 泰国: 我们 cards.js 泰国=15448, 偏移假设 +3100 => 18548
const thaiMod=18548;
const ti=ids.indexOf(thaiMod);
console.log('泰国(15448) 若偏移+3100 -> mod '+thaiMod+(ti>=0?(' 在 idx='+ti+' -> r'+Math.floor(ti/10)+'c'+(ti%10)):' 未在该卡组找到'));
