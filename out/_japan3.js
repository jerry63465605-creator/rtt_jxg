const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
const mod = JSON.parse(fs.readFileSync(`${base}/Mods/Workshop/3763225217.json`,'utf8'));
const target = '17875124258557834658';
function ugcId(url){ const m=url.match(/ugc\/(\d+)/); return m?m[1]:null; }

const containers=[];
function walk(list){
  for(const o of list||[]){
    if(o.ContainedObjects && Array.isArray(o.ContainedObjects)){
      const kids=o.ContainedObjects;
      const sheetOk = (o.CustomDeck && ugcId(Object.values(o.CustomDeck)[0].FaceURL)===target)
        || kids.some(c=>c.CustomDeck && ugcId(Object.values(c.CustomDeck)[0].FaceURL)===target);
      if(sheetOk){
        const ids=kids.filter(c=>c.CardID!=null).map(c=>c.CardID);
        const d=o.CustomDeck?Object.values(o.CustomDeck)[0]:(kids[0].CustomDeck?Object.values(kids[0].CustomDeck)[0]:null);
        containers.push({n:ids.length, range:(ids.length?Math.min(...ids)+'~'+Math.max(...ids):'-'), grid:(d?d.NumWidth+'x'+d.NumHeight:'?'), ids});
      }
    }
    if(o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);
console.log('引用该雪碧图的卡组容器数:', containers.length);
containers.sort((a,b)=>b.n-a.n);
containers.forEach((c,i)=>console.log(`  [${i}] 卡数=${c.n} 段=${c.range} grid=${c.grid}`));
if(containers[0]) console.log('\n最大容器 id 段:', containers[0].ids.join(','));
