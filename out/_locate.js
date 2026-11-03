const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
const mod = JSON.parse(fs.readFileSync(`${base}/Mods/Workshop/3763225217.json`,'utf8'));

const targets = [15349,15350,15351,15352,15353,15354,17851,17852,17853,17854,17855];

function ugc(url){ const m=url.match(/ugc\/(\d+)/); return m?m[1]:null; }

// 给每个 deck 收集它包含的 CardID 列表
const decks = [];
function walk(list){
  for(const o of list||[]){
    const d = o.CustomDeck ? Object.values(o.CustomDeck)[0] : null;
    if(d && o.ContainedObjects){
      const ids = o.ContainedObjects.filter(c=>c.CardID!=null).map(c=>c.CardID);
      decks.push({ugc: ugc(d.FaceURL), nw:d.NumWidth||10, nh:d.NumHeight||7, ids, obj:o});
    }
    if(o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);

for(const t of targets){
  let found=null;
  for(const dk of decks){
    if(dk.ids.includes(t)){
      const idx = dk.ids.indexOf(t);
      const row = Math.floor(idx/dk.nw), col = idx%dk.nw;
      found = {ugc:dk.ugc, nw:dk.nw, nh:dk.nh, idx, row, col, range:`${Math.min(...dk.ids)}~${Math.max(...dk.ids)}`};
      break;
    }
  }
  if(found){
    console.log(`CardID ${t}: 命中 deck ugc${found.ugc} grid=${found.nw}x${found.nh} range[${found.range}] -> 第${found.idx}张 r${found.row}c${found.col}`);
  } else {
    console.log(`CardID ${t}: 在 mod 中未找到（可能不在 TTS）`);
  }
}

// 顺带报告 UK/USSR 主卡组实际 id 范围，验证我们对齐没
console.log('\n--- 含 153xx / 178xx 的 deck 范围 ---');
decks.filter(d=>d.ids.some(i=> (i>=15300&&i<=15399)||(i>=17800&&i<=17899)))
  .forEach(d=>console.log(`  ugc${d.ugc} grid=${d.nw}x${d.nh} ids=${Math.min(...d.ids)}~${Math.max(...d.ids)} (n=${d.ids.length})`));
