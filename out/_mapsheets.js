const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
const mod = JSON.parse(fs.readFileSync(`${base}/Mods/Workshop/3763225217.json`,'utf8'));
const imgDir = `${base}/Mods/Images`;
const imgFiles = new Set(fs.readdirSync(imgDir));

function cacheName(url){
  return url.replace(/^https?:\/\//,'').replace(/\//g,'').replace(/\?.*$/,'');
}
const seen = new Set();
const decks = [];
function walk(list){
  for(const o of list||[]){
    const d = o.CustomDeck ? Object.values(o.CustomDeck)[0] : null;
    if(d && d.FaceURL){
      const key = d.FaceURL;
      if(!seen.has(key)){
        seen.add(key);
        const cn = cacheName(d.FaceURL);
        decks.push({cn, exists: imgFiles.has(cn), nw:d.NumWidth||'?', nh:d.NumHeight||'?', url:d.FaceURL.slice(0,70)});
      }
    }
    if(o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);
console.log('mod 中不同卡组雪碧图数:', decks.length);
console.log('其中本地已缓存数:', decks.filter(d=>d.exists).length);
console.log('--- 已缓存的卡组(网格尺寸) ---');
decks.filter(d=>d.exists).forEach(d=>console.log(`  grid=${d.nw}x${d.nh}  cache=${d.cn.slice(0,55)}..  exists=${d.exists}`));
console.log('--- 未缓存(需联网下载) ---');
decks.filter(d=>!d.exists).slice(0,10).forEach(d=>console.log('  '+d.url));
