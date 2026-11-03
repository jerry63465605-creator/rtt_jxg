const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
const mod = JSON.parse(fs.readFileSync(`${base}/Mods/Workshop/3763225217.json`,'utf8'));
const imgDir = `${base}/Mods/Images`;
const imgFiles = fs.readdirSync(imgDir);

function ugcId(url){
  const m = url.match(/ugc\/(\d+)/);
  return m ? m[1] : null;
}
const seen = new Set(), decks = [];
function walk(list){
  for(const o of list||[]){
    const d = o.CustomDeck ? Object.values(o.CustomDeck)[0] : null;
    if(d && d.FaceURL){
      const id = ugcId(d.FaceURL);
      if(id && !seen.has(id)){
        seen.add(id);
        const hit = imgFiles.find(f => f.indexOf('ugc'+id) >= 0);
        decks.push({id, exists: !!hit, file: hit||'', nw:d.NumWidth||'?', nh:d.NumHeight||'?', url:d.FaceURL.slice(0,75)});
      }
    }
    if(o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);
console.log('mod 卡组雪碧图(去重):', decks.length, ' 本地已缓存:', decks.filter(d=>d.exists).length);
decks.filter(d=>d.exists).forEach(d=>console.log(`  [已缓存] grid=${d.nw}x${d.nh}  ${d.file}  (ugc${d.id})`));
console.log('--- 未缓存(需联网下载) ---');
decks.filter(d=>!d.exists).forEach(d=>console.log(`  [缺失] grid=${d.nw}x${d.nh} ugc${d.id} ${d.url}`));
