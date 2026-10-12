const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = require(path.join(MOD, 'data.js')).data
function newGame() { const g = rules.setup(1,'Standard',{}); g.current_nation='德国'; g.active='Axis'; g.hands['德国']=[]; I.refresh(g); return g }
function put(g,id,n,ty,sp){ g.location[id]=sp; g.piece_nation[id]=n; g.piece_type[id]=ty; I.refresh(g) }

// 1) 亚速尔
let azId=null
for (let i=1;i<data.spaces.length;i++){ if(data.spaces[i]&&data.spaces[i].name&&data.spaces[i].name.indexOf('亚速尔')>=0){ azId=i; break } }
console.log('azId=',azId, azId?data.spaces[azId].name:'', 'conns=', azId?JSON.stringify((data.spaces[azId].connections||[]).map(x=>x[0])):'')
if(azId){
  for(const c of (data.spaces[azId].connections||[]).map(x=>x[0])){
    console.log('  conn',c,data.spaces[c]?data.spaces[c].name:'?', data.spaces[c]?data.spaces[c].terrain:'?')
  }
}

// 2) 找一个: 海域 sp，相邻陆地 c；把 c 设为补给点后能否建海军且 sp 的海军在补给
let found=null
for (let i=1;i<data.spaces.length;i++){
  if(!data.spaces[i]||data.spaces[i].terrain!=='sea') continue
  const conns=(data.spaces[i].connections||[]).map(x=>x[0])
  for(const c of conns){
    if(data.spaces[c]&&data.spaces[c].terrain==='land'){
      const g=newGame()
      put(g,'de_navy','德国','navy',i)
      put(g,'de_army','德国','army',c)
      I.set_supply_point(g,c)
      I.refresh(g)
      const sup=I.compute_supply(g)
      const navySup = sup.in_supply['de_navy']
      const chk=I.can_build_at(g,'德国',i,'navy')
      console.log('sp=',i,data.spaces[i].name,'c=',c,data.spaces[c].name,'navySup=',navySup,'canBuild=',JSON.stringify(chk))
      if(navySup){ found={sp:i,c:c}; break }
    }
  }
  if(found) break
}
console.log('FOUND', JSON.stringify(found))
