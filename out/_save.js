const fs = require('fs');
const base = 'C:/Users/24968/Documents/My Games/Tabletop Simulator';
for (const n of ['TS_Save_67','TS_Save_66','TS_Save_65']) {
  const f = `${base}/Saves/${n}.json`;
  const m = JSON.parse(fs.readFileSync(f,'utf8'));
  const refs = m.SaveReferences && m.SaveReferences.References ? m.SaveReferences.References : [];
  const mods = refs.map(r => r.SaveName || r.ContainedObjects ? (r.TableURL||r.SteamID||JSON.stringify(r).slice(0,60)) : (r.SteamID||r.Name||'')).filter(Boolean);
  console.log(`\n=== ${n} ===`);
  console.log('SaveReferences count:', refs.length);
  refs.forEach((r,i)=> console.log('  ['+i+']', r.SteamID || r.Name || Object.keys(r).join('/')));
}
// 列出 Mods/Images 缓存
const imgDir = `${base}/Mods/Images`;
if (fs.existsSync(imgDir)) {
  const items = fs.readdirSync(imgDir).map(n=>{const s=fs.statSync(imgDir+'/'+n);return {n, mb:+(s.size/1e6).toFixed(2), d:s.isDirectory()};});
  console.log('\n=== Mods/Images ('+items.length+' 项) ===');
  items.sort((a,b)=>b.mb-a.mb).slice(0,30).forEach(it=>console.log('  '+it.n+'  '+it.mb+'MB'+(it.d?' (dir)':'')));
} else console.log('Mods/Images 不存在');
