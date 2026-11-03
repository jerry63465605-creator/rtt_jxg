const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
const mod = JSON.parse(fs.readFileSync(`${base}/Mods/Workshop/3763225217.json`,'utf8'));
const imgDir = `${base}/Mods/Images`;
const dst = 'c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/cards_tts';
const imgFiles = fs.readdirSync(imgDir);
function ugcId(url){ const m=url.match(/ugc\/(\d+)/); return m?m[1]:null; }
const seen=new Set(); const decks=[];
function walk(list){
  for(const o of list||[]){
    const d=o.CustomDeck?Object.values(o.CustomDeck)[0]:null;
    if(d&&d.FaceURL){ const id=ugcId(d.FaceURL);
      if(id&&!seen.has(id)){ seen.add(id);
        const hit=imgFiles.find(f=>f.indexOf('ugc'+id)>=0);
        decks.push({id, file: hit?`${imgDir}/${hit}`:null, nw:d.NumWidth||1, nh:d.NumHeight||1});
      }
    }
    if(o.ContainedObjects) walk(o.ContainedObjects);
  }
}
walk(mod.ObjectStates);
const sheets = decks.filter(d=>d.nw==10 && d.nh==7 && d.file);
console.log('找到 10x7 卡组图:', sheets.length, '张');
let ok=0;
for(const s of sheets){
  const name = `sheet_${s.id}.png`;
  fs.copyFileSync(s.file, `${dst}/${name}`);
  ok++;
  console.log('  复制 ->', name);
}
console.log('完成，共复制', ok, '张到 cards_tts/');
