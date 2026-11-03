const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
const mod = JSON.parse(fs.readFileSync(`${base}/Mods/Workshop/3763225217.json`,'utf8'));
const imgDir = `${base}/Mods/Images`;
const target = '17875124258557834658';
function ugcId(url){ const m=url.match(/ugc\/(\d+)/); return m?m[1]:null; }

let container=null, grid=null;
function walk(list){
  for(const o of list||[]){
    if(o.ContainedObjects && Array.isArray(o.ContainedObjects)){
      // 该容器是否用的目标雪碧图（看子卡或自身 deck）
      const kids = o.ContainedObjects;
      const used = (o.CustomDeck && ugcId(Object.values(o.CustomDeck)[0].FaceURL)===target)
        || kids.some(c=>c.CustomDeck && ugcId(Object.values(c.CustomDeck)[0].FaceURL)===target);
      if(used){
        const d = o.CustomDeck ? Object.values(o.CustomDeck)[0] : (kids[0].CustomDeck?Object.values(kids[0].CustomDeck)[0]:null);
        grid = d ? {nw:d.NumWidth, nh:d.NumHeight} : null;
        container = kids;
      }
    }
    if(o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);
if(!container){ console.log('未找到该 deck 容器'); process.exit(1); }
const ids = container.filter(c=>c.CardID!=null).map(c=>c.CardID);
console.log('日本卡组容器找到, 卡数 =', container.length);
console.log('mod 声明 grid =', grid? (grid.nw+'x'+grid.nh):'?');
console.log('CardID 范围:', Math.min(...ids), '~', Math.max(...ids));
console.log('全部id顺序:', ids.join(','));

const f = fs.readdirSync(imgDir).find(x=>x.indexOf('ugc'+target)>=0);
const buf = fs.readFileSync(`${imgDir}/${f}`);
const W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
console.log('图片:', f);
console.log('尺寸:', W+'x'+H, ' cellW=', (W/10), ' NH估算=', Math.round(H/(W/10)));
console.log('idx->r,c: r=floor(idx/10), c=idx%10');
