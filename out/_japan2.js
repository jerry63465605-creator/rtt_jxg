const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
const mod = JSON.parse(fs.readFileSync(`${base}/Mods/Workshop/3763225217.json`,'utf8'));
const imgDir = `${base}/Mods/Images`;
const target = '17875124258557834658';
function ugcId(url){ const m=url.match(/ugc\/(\d+)/); return m?m[1]:null; }

let best=null;
function walk(list){
  for(const o of list||[]){
    if(o.ContainedObjects && Array.isArray(o.ContainedObjects)){
      const kids=o.ContainedObjects;
      const ids=kids.filter(c=>c.CardID!=null).map(c=>c.CardID);
      const jp = ids.filter(i=>(i>=15400&&i<=15499)||(i>=7900&&i<=7999));
      const sheetOk = (o.CustomDeck && ugcId(Object.values(o.CustomDeck)[0].FaceURL)===target)
        || kids.some(c=>c.CustomDeck && ugcId(Object.values(c.CustomDeck)[0].FaceURL)===target);
      if(jp.length>0 && sheetOk){
        if(!best || ids.length>best.ids.length){
          const d=o.CustomDeck?Object.values(o.CustomDeck)[0]:(kids[0].CustomDeck?Object.values(kids[0].CustomDeck)[0]:null);
          best={ids, kids, nw:d?d.NumWidth:10, nh:d?d.NumHeight:7};
        }
      }
    }
    if(o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);
if(!best){ console.log('未找到日本卡组容器'); process.exit(1); }
console.log('日本卡组容器: 卡数 =', best.ids.length);
console.log('mod grid =', best.nw+'x'+best.nh);
console.log('CardID 范围:', Math.min(...best.ids), '~', Math.max(...best.ids));
console.log('全部id顺序:', best.ids.join(','));

const f = fs.readdirSync(imgDir).find(x=>x.indexOf('ugc'+target)>=0);
const buf = fs.readFileSync(`${imgDir}/${f}`);
const W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
console.log('图片:', f, ' 尺寸', W+'x'+H);
// 用真实卡数推断行数
const NH = Math.ceil(best.ids.length/best.nw);
console.log('按卡数推断 NH =', NH, ' cellH =', Math.round(H/NH), ' (W/'+best.nw+'='+Math.round(W/best.nw)+')');
// 输出每张卡 idx->r,c 与 id
console.log('--- 卡序 -> 格子 ---');
best.ids.forEach((id,idx)=>{
  const r=Math.floor(idx/best.nw), c=idx%best.nw;
  console.log(`  idx${String(idx).padStart(2)} r${r}c${c}  id=${id}`);
});
