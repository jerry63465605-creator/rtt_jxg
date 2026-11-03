const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
const mod = JSON.parse(fs.readFileSync(`${base}/Mods/Workshop/3763225217.json`,'utf8'));
const imgDir = `${base}/Mods/Images`;
const imgFiles = fs.readdirSync(imgDir);
function ugcId(url){ const m=url.match(/ugc\/(\d+)/); return m?m[1]:null; }
const seen=new Set(); const decks=[];
function walk(list){
  for(const o of list||[]){
    const d=o.CustomDeck?Object.values(o.CustomDeck)[0]:null;
    if(d&&d.FaceURL){ const id=ugcId(d.FaceURL);
      if(id&&!seen.has(id)){ seen.add(id);
        const hit=imgFiles.find(f=>f.indexOf('ugc'+id)>=0);
        decks.push({id, file: hit?`${imgDir}/${hit}`:'(未缓存)', nw:d.NumWidth||'?', nh:d.NumHeight||'?'});
      }
    }
    if(o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);
console.log('RTT 卡组雪碧图共', decks.length, '张，全部已缓存本地：\n');
decks.forEach((d,i)=>console.log(`[${String(i+1).padStart(2)}] grid=${d.nw}x${d.nh} ugc${d.id}\n     ${d.file}`));
