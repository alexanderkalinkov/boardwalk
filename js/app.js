
(function(){
'use strict';
/* ---------- storage (on device only) ---------- */
var store={
  get:function(k,d){try{var v=localStorage.getItem('bw.'+k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
  set:function(k,v){try{localStorage.setItem('bw.'+k,JSON.stringify(v));}catch(e){}},
  clear:function(){try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('bw.')===0)localStorage.removeItem(k);});}catch(e){}}
};

/* ---------- walking graph for the loaded airport ---------- */
var AP=null,POIS=[],GATES=[],GATEMAP={},BUILDINGS=[],N={},ADJ={},BASE=[],STEP=20,MPU=1;
/* where the plan sits on the real map; the traveller can fine-tune it (Settings → Line up the map) */
var PV='.v2'; // plan version: the real outlines replaced the sketches, so older per-airport fixes are ignored
function geo(){return (AP&&store.get('geo.'+AP.key+PV,null))||AP.geo;}
function addN(id,x,y,b,l){N[id]={id:id,x:x,y:y,b:b,l:l||0};ADJ[id]=ADJ[id]||[];}
function link(a,b,cost,transit,kind){
  if(cost==null){var dx=N[a].x-N[b].x,dy=N[a].y-N[b].y;cost=Math.sqrt(dx*dx+dy*dy)*MPU/WALK;}
  ADJ[a].push({to:b,c:cost,t:!!transit,k:kind||''});ADJ[b].push({to:a,c:cost,t:!!transit,k:kind||''});
}
function nearestBase(x,y,b,l){var best=null,bd=1e9;BASE.forEach(function(id){var n=N[id];if(b&&n.b!==b)return;if(l!=null&&n.l!==l)return;var d=(n.x-x)*(n.x-x)+(n.y-y)*(n.y-y);if(d<bd){bd=d;best=id;}});return best;}
function attach(id,x,y,b,l){addN(id,x,y,b,l);link(id,nearestBase(x,y,b,l||0));}
/* areas are rectangles {x,y,w,h} or real outlines {poly:[[x,y],…]} from OpenStreetMap */
function areaPts(a){if(!a._p)a._p=a.poly||[[a.x,a.y],[a.x+a.w,a.y],[a.x+a.w,a.y+a.h],[a.x,a.y+a.h]];return a._p;}
function areaBB(a){if(!a._bb){var b=[1e9,1e9,-1e9,-1e9];areaPts(a).forEach(function(p){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);});a._bb=b;}return a._bb;}
function inPoly(x,y,pts){var c=false;for(var i=0,j=pts.length-1;i<pts.length;j=i++){var a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function segDist(x,y,a,b){var dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/L)):0;return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
function edgeDist(x,y,pts){var d=1e9;for(var i=0,j=pts.length-1;i<pts.length;j=i++)d=Math.min(d,segDist(x,y,pts[i],pts[j]));return d;}
function areaHas(a,x,y,pad){var b=areaBB(a);if(x<b[0]+pad||x>b[2]-pad||y<b[1]+pad||y>b[3]-pad)return false;if(!a.poly)return true;var p=areaPts(a);return inPoly(x,y,p)&&(!pad||edgeDist(x,y,p)>=pad);}
function areaPath(a){return 'M'+areaPts(a).map(function(p){return p[0]+' '+p[1];}).join('L')+'Z';}
function allBB(skip){var bb=[1e9,1e9,-1e9,-1e9];BUILDINGS.forEach(function(a){if(skip&&skip(a))return;var b=areaBB(a);bb[0]=Math.min(bb[0],b[0]);bb[1]=Math.min(bb[1],b[1]);bb[2]=Math.max(bb[2],b[2]);bb[3]=Math.max(bb[3],b[3]);});return bb;}
function walkable(x,y,b,l){return BUILDINGS.some(function(a){return !a.nowalk&&a.b===b&&(a.l||0)===l&&areaHas(a,x,y,0);});}
var VCOST={lift:45,escalator:25,stairs:30};
function expandVerts(a){if(a._v||!a.verts)return;a._v=1;
  a.verts.forEach(function(v){[v.from,v.to].forEach(function(l){a.pois.push({id:v.id+'_'+l,n:{lift:'Lift',escalator:'Escalators',stairs:'Stairs'}[v.kind],c:v.kind,b:v.b,x:v.x,y:v.y,l:l,
    loc:(l===v.from?'Up to ':'Down to ')+levelName(a,l===v.from?v.to:v.from)+(v.note?' · '+v.note:''),h:'',s:v.s||'',vert:v});});});}
function lvlPre(p){return AP.levels&&p.l!=null?'Level '+p.l+' · ':'';}
function levelName(a,l){var lv=(a.levels||[]).find(function(x){return x.id===l;});return lv?'Level '+l+' ('+lv.name+')':'Level '+l;}
function loadAirport(key){
  expandVerts(AIRPORTS[key]);
  AP=AIRPORTS[key];POIS=AP.pois;GATES=AP.gates;BUILDINGS=AP.areas;GATEMAP={};GATES.forEach(function(g){GATEMAP[g.id]=g;});
  N={};ADJ={};BASE=[];MPU=geo().s||1;
  var seen={};
  BUILDINGS.forEach(function(a){if(a.nowalk)return;var l=a.l||0,bb=areaBB(a),pad=a.poly?4:6;
    for(var x=Math.ceil((bb[0]+pad)/STEP)*STEP;x<=bb[2]-pad;x+=STEP)for(var y=Math.ceil((bb[1]+pad)/STEP)*STEP;y<=bb[3]-pad;y+=STEP){
      if(!areaHas(a,x,y,pad))continue;
      var id='n'+a.b+l+'_'+x+'_'+y;if(seen[id])continue;seen[id]=1;addN(id,x,y,a.b,l);BASE.push(id);}
  });
  // link grid neighbours (also diagonally, for angled piers) when the way between them stays indoors;
  // bridge a one-cell gap where two areas of the same kind meet (e.g. a door to the pavement)
  BASE.forEach(function(id){var n=N[id],pre='n'+n.b+n.l+'_';[[STEP,0],[0,STEP],[STEP,STEP],[STEP,-STEP]].forEach(function(d){var diag=d[0]&&d[1];
    var o=pre+(n.x+d[0])+'_'+(n.y+d[1]);
    if(N[o]){if(walkable(n.x+d[0]/2,n.y+d[1]/2,n.b,n.l))link(id,o);}
    else if(!diag){o=pre+(n.x+2*d[0])+'_'+(n.y+2*d[1]);if(N[o])link(id,o);}});});
  // make sure every place joins the network even if the outline has a narrow neck
  connectIslands();
  (AP.joins||[]).forEach(function(j,i){var a='ja'+i,b='jb'+i;attach(a,j.a[0],j.a[1],j.a[2],j.a[3]);attach(b,j.b[0],j.b[1],j.b[2],j.b[3]);link(a,b,j.c,j.t);});
  GATES.forEach(function(g){attach('g'+g.id,g.x,g.y,g.b,g.l);});
  POIS.forEach(function(p){attach('p'+p.id,p.x,p.y,p.b,p.l);});
  // lifts, escalators and stairs join the floors
  POIS.forEach(function(p){if(!p.vert||p.l!==p.vert.from)return;var up=POIS.find(function(q){return q.vert&&q.vert.id===p.vert.id&&q.l===p.vert.to;});if(up)link('p'+p.id,'p'+up.id,VCOST[p.c],false,p.c);});
  myPlaces.filter(function(p){return p.v===2&&p.ap===key;}).forEach(function(p){attach('p'+p.id,p.x,p.y,p.b,p.l);});
  state.me=store.get('me.'+key+PV,'p'+AP.start);if(!N[state.me])state.me='p'+AP.start;
  state.sel=null;state.lvl=N[state.me].l;
}

function connectIslands(){
  if(!BASE.length)return;var comp={},cid=0;
  BASE.forEach(function(id){if(comp[id]!=null)return;var st=[id];comp[id]=cid;while(st.length){var u=st.pop();ADJ[u].forEach(function(e){if(comp[e.to]==null&&N[e.to]&&e.to[0]==='n'&&!e.k&&!e.t){comp[e.to]=cid;st.push(e.to);}});}cid++;});
  // join each smaller island of the same zone and floor to its nearest neighbour in another island
  for(var guard=0;guard<40;guard++){var groups={};BASE.forEach(function(id){var n=N[id],key=n.b+'|'+n.l;(groups[key]=groups[key]||{})[comp[id]]=1;});
    var merged=false;Object.keys(groups).forEach(function(key){var cs=Object.keys(groups[key]);if(cs.length<2||merged)return;
      var c0=+cs[0],best=null,bd=1e18;BASE.forEach(function(a){if(comp[a]!==c0)return;var na=N[a];BASE.forEach(function(b){var nb=N[b];if(comp[b]===c0||nb.b!==na.b||nb.l!==na.l)return;var d=(na.x-nb.x)*(na.x-nb.x)+(na.y-nb.y)*(na.y-nb.y);if(d<bd){bd=d;best=[a,b];}});});
      if(best){link(best[0],best[1]);var from=comp[best[1]];BASE.forEach(function(id){if(comp[id]===from)comp[id]=c0;});merged=true;}});
    if(!merged)break;}
}
function dijkstra(src){
  var dist={},prev={},done={},q=[src];dist[src]=0;
  while(q.length){
    var bi=0;for(var k=1;k<q.length;k++)if(dist[q[k]]<dist[q[bi]])bi=k;
    var u=q.splice(bi,1)[0];if(done[u])continue;done[u]=1;
    ADJ[u].forEach(function(e){if(e.k&&state.stepfree&&e.k!=='lift')return;var nd=dist[u]+e.c;if(dist[e.to]==null||nd<dist[e.to]){dist[e.to]=nd;prev[e.to]={from:u,t:e.t};q.push(e.to);}});
  }
  return {dist:dist,prev:prev};
}
function pathTo(res,dst){
  var out=[],cur=dst;if(res.dist[dst]==null)return null;
  while(cur){out.unshift({id:cur,t:res.prev[cur]?res.prev[cur].t:false});cur=res.prev[cur]?res.prev[cur].from:null;}
  return out;
}
function walkMetres(path){var m=0;for(var i=1;i<path.length;i++){if(path[i].t)continue;var a=N[path[i-1].id],b=N[path[i].id];m+=Math.hypot(a.x-b.x,a.y-b.y);}return m*MPU;}
function usesTransit(path){return path.some(function(p){return p.t;});}

/* ---------- user data ---------- */
var trips=store.get('trips',[]);
var reports=store.get('reports',[]);
var myPlaces=store.get('places',[]);
var state={activeId:store.get('active',null),ap:store.get('ap','SOF2'),stepfree:store.get('stepfree',false),lvl:0,me:null,sel:null,expanded:false,walking:null};
if(!AIRPORTS[state.ap])state.ap='SOF2';
function save(){store.set('trips',trips);store.set('reports',reports);store.set('places',myPlaces);store.set('active',state.activeId);store.set('ap',state.ap);if(AP)store.set('me.'+AP.key+PV,state.me);}

function allPlaces(){return POIS.concat(myPlaces.filter(function(p){return p.v===2&&p.ap===AP.key;}));}
function placeById(id){return allPlaces().find(function(p){return p.id===id;});}
function activeTrip(){var t=trips.find(function(x){return x.id===state.activeId;});if(t)return t;var up=trips.slice().sort(function(a,b){return a.dep-b.dep;});return up[0]||null;}
function mapped(t){return !!apFor(t);}
function boardingAt(t){return t.dep-40*60000;}
function fmtTime(ms){var d=new Date(ms);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function fmtDate(ms){return new Date(ms).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});}
function minsUntil(ms){return Math.round((ms-Date.now())/60000);}
function fmtDur(min){if(min<60)return min+' min';var h=Math.floor(min/60),m=min%60;return h+' h'+(m?' '+m+' min':'');}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

function sampleTrip(key){
  var a=AIRPORTS[key||state.ap],sm=a.sample,dep=Date.now()+85*60000;dep=Math.ceil(dep/300000)*300000;
  return {id:'t'+Date.now(),carrier:sm.carrier,num:sm.num,from:a.code,to:sm.to,dep:dep,gate:sm.gate,seat:sm.seat,sample:true,ap:a.key};
}

/* ---------- boarding pass (IATA BCBP) ---------- */
function parseBCBP(raw){
  var s=(raw||'').replace(/\r?\n/g,'');
  if(s.length<58||s[0]!=='M')return null;
  var from=s.substr(30,3).trim(),to=s.substr(33,3).trim(),carrier=s.substr(36,3).trim(),num=s.substr(39,5).trim().replace(/^0+/,'');
  var jd=parseInt(s.substr(44,3),10),seat=s.substr(48,4).trim().replace(/^0+/,'');
  if(!/^[A-Z]{3}$/.test(from)||!/^[A-Z]{3}$/.test(to)||!jd)return null;
  var now=new Date(),y=now.getFullYear(),d=new Date(y,0,jd);
  if(d.getTime()<now.getTime()-2*86400000)d=new Date(y+1,0,jd);
  return {from:from,to:to,carrier:carrier,num:num,date:d,seat:seat,name:s.substr(2,20).trim()};
}
function exampleBCBP(){
  var d=new Date(),start=new Date(d.getFullYear(),0,0),jd=Math.floor((d-start)/86400000);
  function pad(v,n){v=String(v);while(v.length<n)v+=' ';return v.slice(0,n);}
  var sm=AP.sample;return 'M1'+pad('SAMPLE/TRAVELLER',20)+'E'+pad('ABC123',7)+AP.code+sm.to+pad(sm.carrier,3)+pad(sm.num.padStart(4,'0'),5)+String(jd).padStart(3,'0')+'Y'+'014A'+'0042 '+'100';
}

/* ---------- DOM ---------- */
var $=function(id){return document.getElementById(id);};
var svg=$('map'),NS='http://www.w3.org/2000/svg';
function el(tag,attrs,parent){var e=document.createElementNS(NS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
var gWorld,gRoute,gPins,gMe,gMine,gAcc,meCone;
var vb={x:-40,y:-40,w:480,h:800},k=1;

var PLANE='M0,-12C1.6,-12 1.7,-9 1.7,-8L1.7,-2.5L11,3.5L11,5.5L1.7,2.8L1.7,8.5L5,11L5,12.6L0,11.6L-5,12.6L-5,11L-1.7,8.5L-1.7,2.8L-11,5.5L-11,3.5L-1.7,-2.5L-1.7,-8C-1.7,-9 -1.6,-12 0,-12Z';
function gateSide(g){return g.sd||'T';}
/* which way the aircraft is from the gate: [dx, dy, rotation]; a = compass-style angle in the plan (0 = up) */
function gateVec(g){if(g.a!=null){var r=g.a*Math.PI/180;return [Math.sin(r),-Math.cos(r),g.a];}var sd=gateSide(g);return [{T:0,D:0,L:-1,R:1}[sd],{T:-1,D:1,L:0,R:0}[sd],{T:0,D:180,L:270,R:90}[sd]];}
function tag(e,l){if(AP.levels&&l!=null)e.setAttribute('data-l',l);return e;}
function buildMap(){
  svg.innerHTML='';
  if(!basemap.ok)el('rect',{x:-3000,y:-3000,width:7000,height:7000,fill:'var(--map-bg)'},svg);
  gWorld=el('g',{},svg);
  // airfield: grass, apron, taxiway centre lines (per airport, or drawn around the buildings)
  var bb=allBB(function(a){return a.out||a.b==='L';});
  if(!basemap.ok){el('rect',{x:bb[0]-900,y:bb[1]-900,width:bb[2]-bb[0]+1800,height:bb[3]-bb[1]+1800,class:'grass'},gWorld);
  (AP.apron||[[bb[0]-120,bb[1]-110,bb[2]-bb[0]+240,bb[3]-bb[1]+150]]).forEach(function(r){el('rect',{x:r[0],y:r[1],width:r[2],height:r[3],rx:30,class:'apron'},gWorld);});
  (AP.taxi||[[bb[0]-120,bb[1]-80,bb[2]+120,bb[1]-80],[bb[0]-90,bb[1]-110,bb[0]-90,bb[3]+40],[bb[2]+90,bb[1]-110,bb[2]+90,bb[3]+40]]).forEach(function(l){el('line',{x1:l[0],y1:l[1],x2:l[2],y2:l[3],class:'taxi'},gWorld);});}
  // aircraft on stand: jet bridges at bridge gates, a parked plane and a stand line at bus gates
  GATES.forEach(function(g){var v=gateVec(g),dx=v[0],dy=v[1],rot=v[2];
    var off=g.bus?(g.a!=null?50:46):(g.a!=null?31:27),sc=g.a!=null?1.6:1.15;
    if(!g.bus){var bx=g.x+dx*(off-14)/2,by=g.y+dy*(off-14)/2,len=off-12;tag(el('rect',{x:-1.6,y:-len/2,width:3.2,height:len,rx:1,class:'jb',transform:'translate('+bx+' '+by+') rotate('+rot+')'},gWorld),g.l);}
    else tag(el('line',{x1:g.x+dx*6,y1:g.y+dy*6,x2:g.x+dx*(off-16),y2:g.y+dy*(off-16),class:'taxi',style:'stroke-dasharray:3 3'},gWorld),g.l);
    var cx=g.x+dx*off,cy=g.y+dy*off;tag(el('path',{d:PLANE,class:'plane',transform:'translate('+cx+' '+cy+') rotate('+(rot+180)+') scale('+sc+')'},gWorld),g.l);});
  // decorative stands along piers whose gates aren't mapped yet
  BUILDINGS.forEach(function(a){if(!a.planes||a.poly)return;for(var y=a.y+16;y<a.y+a.h-20;y+=34){el('path',{d:PLANE,class:'plane',transform:'translate('+(a.x-26)+' '+y+') rotate(90) scale(1.15)'},gWorld);el('path',{d:PLANE,class:'plane',transform:'translate('+(a.x+a.w+26)+' '+y+') rotate(-90) scale(1.15)'},gWorld);}});
  // ground side (only when the real street map can't load): landside land, roads, car parks, pavements
  if(!basemap.ok){
  (AP.land||[]).forEach(function(r){el('rect',{x:r[0],y:r[1],width:r[2],height:r[3],rx:20,class:'land'},gWorld);});
  (AP.lots||[]).forEach(function(l){el('rect',{x:l.x,y:l.y,width:l.w,height:l.h,rx:l.multi?6:4,class:l.multi?'lotm':'lot'},gWorld);
    if(!l.multi){for(var y=l.y+8;y<l.y+l.h-4;y+=12)el('line',{x1:l.x+4,y1:y,x2:l.x+l.w-4,y2:y,class:'stall'},gWorld);}
    var t=el('text',{x:l.x+l.w/2,y:l.y+l.h/2+3,'text-anchor':'middle','font-size':9,class:'halo lbl1 lotname'},gWorld);t.textContent=l.name;});
  (AP.roads||[]).forEach(function(r){var pts=r.pts.map(function(p){return p.join(',');}).join(' ');
    el('polyline',{points:pts,class:'road-case',style:'stroke-width:'+(r.w+3)+'px'},gWorld);el('polyline',{points:pts,class:'road',style:'stroke-width:'+r.w+'px'},gWorld);
    if(r.name){var m=r.lab||r.pts[0];var t=el('text',{x:m[0],y:m[1]+3,'text-anchor':'middle','font-size':8,class:'halo lbl1 roadname'},gWorld);t.textContent=r.name;}});
  BUILDINGS.forEach(function(b){if(!b.out)return;if(b.poly)tag(el('path',{d:areaPath(b),class:'paved'},gWorld),b.l);else tag(el('rect',{x:b.x,y:b.y,width:b.w,height:b.h,rx:b.r||4,class:'paved'},gWorld),b.l);});
  (AP.rails||[]).forEach(function(r){el('polyline',{points:r.map(function(p){return p.join(',');}).join(' '),class:'rail'},gWorld);});
  }
  // buildings with a walkable hall inside
  BUILDINGS.forEach(function(b){if(b.out)return;
    if(b.poly){var d=areaPath(b);tag(el('path',{d:d,class:b.nowalk?'hall closed':'hall',style:'stroke:var(--bldg);stroke-width:9;stroke-linejoin:round'},gWorld),b.l);tag(el('path',{d:d,class:'bldg',style:'fill:none'},gWorld),b.l);return;}
    tag(el('rect',{x:b.x,y:b.y,width:b.w,height:b.h,rx:b.r,class:'bldg'},gWorld),b.l);
    tag(el('rect',{x:b.x+6,y:b.y+6,width:b.w-12,height:b.h-12,rx:Math.max(4,b.r-6),class:b.nowalk?'hall closed':'hall'},gWorld),b.l);});
  // security halls
  (AP.secs||[]).forEach(function(r){tag(el('rect',{x:r[0],y:r[1],width:r[2],height:r[3],rx:3,class:'sec'},gWorld),r[4]);for(var i=1;i<6;i++)tag(el('line',{x1:r[0]+i*r[2]/6,y1:r[1]+2,x2:r[0]+i*r[2]/6,y2:r[1]+r[3]-2,stroke:'var(--bldg-stroke)','stroke-width':1,'vector-effect':'non-scaling-stroke'},gWorld),r[4]);});
  // units for shops, restaurants, bars and lounges, tinted by type
  POIS.forEach(function(p){if(p.c==='service'||p.c==='toilet'||p.c==='security'||CAT[p.c].ground||CAT[p.c].move)return;var w=p.c==='lounge'?40:30,h=p.c==='lounge'?22:18;
    tag(el('rect',{x:p.x-w/2,y:p.y-h/2,width:w,height:h,rx:4,class:'unit',fill:'var('+CAT[p.c].color+')','fill-opacity':.14,stroke:'var('+CAT[p.c].color+')','stroke-opacity':.32},gWorld),p.l);});
  (AP.transitLines||[]).forEach(function(l){el('line',{x1:l[0],y1:l[1],x2:l[2],y2:l[3],class:'transit'},gWorld);});
  (AP.labels||[]).forEach(function(L){var t=tag(el('text',{x:L.x,y:L.y,'text-anchor':'middle','font-size':L.area?8:9,class:(L.area?'area ':'')+'halo lbl1'},gWorld),L.l);t.textContent=L.t;});
  gRoute=el('g',{},gWorld);
  gPins=el('g',{},gWorld);
  (AP.bigLabels||[]).forEach(function(b){var g=el('g',{class:'pin','data-x':b[1],'data-y':b[2],style:'pointer-events:none'},gPins);var tx=el('text',{x:0,y:0,'text-anchor':'middle','font-size':13,class:'bname halo'},g);tx.textContent=b[0];});
  GATES.forEach(function(gt){var v=gateVec(gt),ox=-v[0]*15,oy=-v[1]*15;
    var g=tag(el('g',{class:'pin gate','data-x':gt.x+ox,'data-y':gt.y+oy,'data-gate':gt.id},gPins),gt.l);
    el('rect',{x:-14,y:-7.5,width:28,height:15,rx:4,fill:'var(--gate)',stroke:'var(--bldg-stroke)','stroke-width':.8},g);
    var tx=el('text',{x:0,y:3.5,'text-anchor':'middle','font-size':gt.id.length>2?8:9,style:'fill:var(--gate-ink);font-weight:700'},g);tx.textContent=gt.id;});
  gMine=el('g',{},gPins);
  POIS.forEach(function(p){drawPoi(p,gPins);});
  myPlaces.filter(function(p){return p.v===2&&p.ap===AP.key;}).forEach(function(p){drawPoi(p,gMine);});
  svg.setAttribute('aria-label','Indoor map of '+AP.name+' '+AP.term);
  gAcc=el('circle',{r:0,class:'acc',fill:'var(--accent)','fill-opacity':.10,stroke:'var(--accent)','stroke-opacity':.35,'stroke-width':1,'vector-effect':'non-scaling-stroke'},gWorld);
  gMe=el('g',{class:'pin','data-x':0,'data-y':0,style:'pointer-events:none'},gWorld);
  meCone=el('path',{d:'M0 0 L30 -17 A34 34 0 0 1 30 17 Z',fill:'var(--accent)','fill-opacity':.32,class:'cone'},gMe);
  setCone();
  showLevel();
  el('circle',{r:20,fill:'var(--accent)','fill-opacity':.14},gMe);
  el('circle',{r:8.5,fill:'var(--accent)',stroke:'#FFFFFF','stroke-width':3.5},gMe);
}
function drawPoi(p,parent){
  var g=tag(el('g',{class:'pin poi'+(p.c==='toilet'?' wc':''),'data-x':p.x,'data-y':p.y,'data-poi':p.id,role:'button','aria-label':p.n},parent),p.l);
  var google=$('phone').classList.contains('g'),cy=0;
  if(google){cy=-15;el('path',{d:'M0,0C-6,-7 -9,-10.5 -9,-15A9,9 0 1 1 9,-15C9,-10.5 6,-7 0,0Z',class:'bg',fill:'var('+CAT[p.c].color+')',stroke:'#FFFFFF','stroke-width':1},g);}
  else el('circle',{r:10,class:'bg',fill:'var('+CAT[p.c].color+')',stroke:'#FFFFFF','stroke-width':1.2},g);
  el('path',{d:ICON[p.c],fill:'none',stroke:'#FFFFFF','stroke-width':1.6,'stroke-linecap':'round','stroke-linejoin':'round',transform:'translate(0 '+cy+') scale(.92)'},g);
  var tier=(p.c==='service'||p.c==='toilet'||p.c==='coffee'||p.c==='security')?'lbl2':'lbl1';
  var nm=p.n.length>24?p.n.slice(0,23)+'…':p.n;
  var t=el('text',{x:0,y:google?11:22,'text-anchor':'middle','font-size':10,class:'halo '+tier,style:'fill:var('+CAT[p.c].color+');font-weight:700'},g);t.textContent=nm;
}
function applyView(){
  var r=svg.getBoundingClientRect();if(!r.width)return;
  vb.h=vb.w*r.height/r.width;k=r.width/vb.w;
  svg.setAttribute('viewBox',vb.x+' '+vb.y+' '+vb.w+' '+vb.h);
  var s=1/k; s=Math.max(.35,Math.min(s*1.0,1.6));
  var pins=svg.querySelectorAll('.pin');
  for(var i=0;i<pins.length;i++){var p=pins[i];p.setAttribute('transform','translate('+p.getAttribute('data-x')+' '+p.getAttribute('data-y')+') scale('+s+')');}
  svg.classList.toggle('zin',k>1.5);svg.classList.toggle('zt',k>.8);svg.classList.toggle('z1',k>1.35);svg.classList.toggle('z2',k>1.9);
  syncBasemap();
  var kk=k/MPU,target=80/kk,nice=[10,20,25,50,100,200,250,500],m=nice[0];for(var j=0;j<nice.length;j++){if(nice[j]<=target)m=nice[j];}
  var sb=$('scaleBar');if(sb){sb.style.width=Math.round(m*kk)+'px';$('scaleTxt').textContent=m+' m';}
  posMoveChip();
}
function fit(b,anim){
  var r=svg.getBoundingClientRect(),top=150,bottom=state.sel?220:110,left=24,right=70;
  var bw=Math.max(b[2]-b[0],60),bh=Math.max(b[3]-b[1],60);
  var sc=Math.min((r.width-left-right)/bw,(r.height-top-bottom)/bh);sc=Math.max(.3,Math.min(sc,2.4));
  var cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
  var to={w:r.width/sc,x:cx-(left+(r.width-left-right)/2)/sc,y:cy-(top+(r.height-top-bottom)/2)/sc};
  if(!anim){vb.w=to.w;vb.x=to.x;vb.y=to.y;applyView();return;}
  var from={w:vb.w,x:vb.x,y:vb.y},t0=performance.now(),D=reduce?1:380;
  (function step(now){var t=Math.min(1,(now-t0)/D),e=1-Math.pow(1-t,3);vb.w=from.w+(to.w-from.w)*e;vb.x=from.x+(to.x-from.x)*e;vb.y=from.y+(to.y-from.y)*e;applyView();if(t<1)requestAnimationFrame(step);})(t0);
}
var reduce=false;try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}

/* pan / zoom / tap */
var ptrs={},gesture=null;
function toMap(cx,cy){var r=svg.getBoundingClientRect();return {x:vb.x+(cx-r.left)/k,y:vb.y+(cy-r.top)/k};}
function zoomAt(cx,cy,f){var m=toMap(cx,cy),nk=Math.max(.3,Math.min(k*f,7));var r=svg.getBoundingClientRect();vb.w=r.width/nk;vb.x=m.x-(cx-r.left)/nk;vb.y=m.y-(cy-r.top)/nk;applyView();}
svg.addEventListener('pointerdown',function(e){svg.setPointerCapture(e.pointerId);ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
  var ids=Object.keys(ptrs);
  if(ids.length===1)gesture={t0:Date.now(),sx:e.clientX,sy:e.clientY,moved:false,target:e.target};
  else if(ids.length===2){var a=ptrs[ids[0]],b=ptrs[ids[1]];gesture={pinch:true,d:Math.hypot(a.x-b.x,a.y-b.y),moved:true};}
});
svg.addEventListener('pointermove',function(e){var p=ptrs[e.pointerId];if(!p||!gesture)return;
  var ids=Object.keys(ptrs);
  if(gesture.pinch&&ids.length===2){p.x=e.clientX;p.y=e.clientY;var a=ptrs[ids[0]],b=ptrs[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y);zoomAt((a.x+b.x)/2,(a.y+b.y)/2,d/gesture.d);gesture.d=d;return;}
  var dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(Math.hypot(e.clientX-gesture.sx,e.clientY-gesture.sy)>6)gesture.moved=true;
  if(gesture.moved&&adjust){var ag=adjust.g;ag.x+=dx/k;ag.y+=dy/k;store.set('geo.'+AP.key+PV,ag);syncBasemap();return;}
  if(gesture.moved){vb.x-=dx/k;vb.y-=dy/k;applyView();hideMoveChip();if(live.follow){live.follow=false;locBtn();}}
});
function endPtr(e){var g=gesture;delete ptrs[e.pointerId];
  if(Object.keys(ptrs).length===0){if(g&&!g.moved&&!g.pinch&&Date.now()-g.t0<500)onTap(e,g.target);gesture=null;}
}
svg.addEventListener('pointerup',endPtr);svg.addEventListener('pointercancel',function(e){delete ptrs[e.pointerId];gesture=null;});
svg.addEventListener('wheel',function(e){e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0018));},{passive:false});
function onTap(e,target){
  var poiEl=target.closest&&target.closest('[data-poi]'),gateEl=target.closest&&target.closest('[data-gate]');
  if(poiEl){selectPlace(poiEl.getAttribute('data-poi'));return;}
  if(gateEl){toast('Gate '+gateEl.getAttribute('data-gate'));return;}
  if(state.sel){clearSel();return;}
  var m=toMap(e.clientX,e.clientY),inB=BUILDINGS.find(function(b){return !b.nowalk&&(b.l||0)===state.lvl&&areaHas(b,m.x,m.y,0);});
  if(!inB){hideMoveChip();return;}
  moveTarget={x:m.x,y:m.y,b:inB.b};showMoveChip();
}
var moveTarget=null;
function showMoveChip(){var c=$('movechip');c.textContent=(live.on&&live.here)?'I’m actually here':'Move me here';c.hidden=false;posMoveChip();}
function hideMoveChip(){$('movechip').hidden=true;}
function posMoveChip(){var c=$('movechip');if(c.hidden||!moveTarget)return;var r=svg.getBoundingClientRect(),pr=$('phone').getBoundingClientRect();c.style.left=(r.left-pr.left+(moveTarget.x-vb.x)*k)+'px';c.style.top=(r.top-pr.top+(moveTarget.y-vb.y)*k)+'px';}
$('movechip').addEventListener('click',function(){if(!moveTarget)return;
  if(live.on&&live.here&&live.raw){var o={dx:moveTarget.x-live.raw.x,dy:moveTarget.y-live.raw.y};store.set('cal.'+AP.key+PV,o);live.pos={x:moveTarget.x,y:moveTarget.y};hideMoveChip();toast('Thanks. Your position is corrected for this airport.');onLiveMoved(true);return;}
var id=nearestBase(moveTarget.x,moveTarget.y,moveTarget.b,state.lvl);state.me=id;save();hideMoveChip();render();toast('Location set. Real phones use Wi-Fi and motion sensors for this.');});

/* ---------- rendering ---------- */
function meXY(){if(state.walking)return state.walking.pos;if(live.on&&live.here&&live.pos)return live.pos;var n=N[state.me]||N['p'+AP.start];return {x:n.x,y:n.y};}
function destNode(){if(state.sel)return 'p'+state.sel;var t=activeTrip();if(t&&t.gate&&GATEMAP[t.gate])return 'g'+t.gate;return null;}
function computeRoute(){
  var d=destNode();if(!d)return null;
  var res=dijkstra(state.me),p=pathTo(res,d);if(!p)return null;
  return {path:p,secs:res.dist[d],metres:walkMetres(p),transit:usesTransit(p),res:res};
}
function drawRoute(rt){
  gRoute.innerHTML='';if(!rt)return;
  var segs=[],cur=null;
  var changes=[];
  rt.path.forEach(function(s,i){var n=N[s.id];if(i===0){cur={t:false,l:n.l,pts:[meXY()]};segs.push(cur);return;}
    if(n.l!==cur.l){changes.push({n:n,from:cur.l,to:n.l,k:(ADJ[rt.path[i-1].id].find(function(e){return e.to===s.id;})||{}).k});}
    if(s.t!==cur.t||n.l!==cur.l){var last=cur.pts[cur.pts.length-1];cur={t:s.t,l:n.l,pts:[last]};segs.push(cur);}cur.pts.push(n);});
  segs.forEach(function(sg){var pts=sg.pts.map(function(n){return n.x+','+n.y;}).join(' '),other=AP.levels&&sg.l!==state.lvl;
    if(!sg.t&&!other)el('polyline',{points:pts,class:'route-under'},gRoute);
    el('polyline',{points:pts,class:'route'+(sg.t?' t':'')+(other?' other':'')},gRoute);});
  changes.forEach(function(c){var g=el('g',{class:'pin chg','data-x':c.n.x,'data-y':c.n.y-26,style:'pointer-events:auto;cursor:pointer'},gRoute);
    var lab=(c.to>c.from?'↑ ':'↓ ')+'Level '+c.to;el('rect',{x:-30,y:-12,width:60,height:24,rx:12,fill:'var(--accent)'},g);
    var tx=el('text',{x:0,y:4.5,'text-anchor':'middle','font-size':12,style:'fill:#fff;font-weight:700'},g);tx.textContent=lab;
    g.addEventListener('click',function(){setLevel(state.lvl===c.to?c.from:c.to);});});
  var d=N[rt.path[rt.path.length-1].id];
  if(!state.sel&&(!AP.levels||d.l===state.lvl)){var g=el('g',{class:'pin','data-x':d.x,'data-y':d.y-22,style:'pointer-events:none'},gRoute);
    el('rect',{x:-24,y:-14,width:48,height:28,rx:9,fill:'var(--dest)'},g);var tx=el('text',{x:0,y:5,'text-anchor':'middle','font-size':14,style:'fill:var(--dest-ink);font-weight:700'},g);tx.textContent=activeTrip().gate;}
}
function drawMe(){var p=meXY();gMe.setAttribute('data-x',p.x);gMe.setAttribute('data-y',p.y);
  if(gAcc){var show=live.on&&live.here&&live.pos&&!state.walking;gAcc.setAttribute('cx',p.x);gAcc.setAttribute('cy',p.y);gAcc.setAttribute('r',show?Math.min(live.acc||0,80):0);}}

var lastRoute=null;
var justLoaded=false;
function ensureAirport(){
  var t=activeTrip(),a=t?apFor(t):null,want=a?a.key:state.ap;
  if(a&&state.ap!==a.key){state.ap=a.key;store.set('ap',state.ap);}
  if(!AP||AP.key!==want){loadAirport(want);buildMap();justLoaded=true;
    $('searchLbl').textContent='Search '+(AP.short==='Schiphol'?'Schiphol':AP.term);$('btnAirport').textContent=AP.code==='AMS'?'AMS':AP.code+' '+AP.short;}
}
function render(){
  ensureAirport();
  var t=activeTrip();
  $('nomap').hidden=!(t&&!mapped(t));
  if(t&&!mapped(t)){
    var known=AIRPORT_LIST.some(function(k){return AIRPORTS[k].code===t.from;});
    $('nomapTitle').textContent=known?'This terminal isn’t mapped yet':'Maps for '+t.from+' aren’t ready yet';
    $('nomapText').textContent=known?'Your '+t.carrier+' flight leaves from a terminal Boardwalk hasn’t mapped yet. The prototype covers '+AIRPORT_LIST.map(function(k){return AIRPORTS[k].name+' '+AIRPORTS[k].term;}).join(', ')+'.':'Boardwalk is launching airport by airport. Your trip and countdown still work, and you’ll get a notification when '+t.from+' maps are ready.';
  }
  lastRoute=(t&&mapped(t))?computeRoute():null;
  drawRoute(lastRoute);drawMe();
  svg.querySelectorAll('.poi').forEach(function(g){g.classList.toggle('sel',g.getAttribute('data-poi')===state.sel);});
  renderTop();renderPlace();applyView();
  if(justLoaded){justLoaded=false;requestAnimationFrame(function(){fitRoute(false);});}
}
function gateRoute(){var t=activeTrip();if(!t||!t.gate||!GATEMAP[t.gate])return null;var res=dijkstra(state.me),p=pathTo(res,'g'+t.gate);return p?{secs:res.dist['g'+t.gate],metres:walkMetres(p),transit:usesTransit(p)}:null;}
function renderTop(){
  var top=$('top'),t=activeTrip();
  if(!t){top.innerHTML='<button class="pill glass" id="pillAdd" type="button"><span><span class="k">No trips yet</span><span class="v" style="font-size:17px">Add a flight</span></span><span class="chev" aria-hidden="true">+</span></button>';$('pillAdd').onclick=openAdd;return;}
  var gr=mapped(t)?gateRoute():null,mins=minsUntil(boardingAt(t));
  var cd=mins>0?fmtDur(mins):(minsUntil(t.dep)>0?'Now':'Closed');
  var walk=gr?Math.max(1,Math.ceil(gr.secs/60))+' min':'—';
  if(!state.expanded){
    top.innerHTML='<button class="pill glass" id="pill" type="button" aria-expanded="false">'+
      '<span><span class="k">'+(mins>0?'Boarding in':'Boarding')+'</span><span class="v accent">'+cd+'</span></span><span class="vsep"></span>'+
      '<span><span class="k">Gate</span><span class="v">'+(t.gate||'—')+'</span></span><span class="vsep"></span>'+
      '<span style="min-width:0"><span class="k">Walk</span><span class="v" style="font-size:17px">'+walk+'</span></span>'+
      '<span class="chev" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span></button>';
    $('pill').onclick=function(){state.expanded=true;renderTop();};
    return;
  }
  var total=Math.max(1,(boardingAt(t)-(t.added||t.dep-6*3600000))),prog=Math.max(0,Math.min(100,100-100*(boardingAt(t)-Date.now())/total));
  var gateInfo=!t.gate?'<span class="muted">Gate not announced yet. '+esc(AP.gateCall)+'</span>':
    (gr?'<span>'+Math.round(gr.metres/10)*10+' m · '+walk+' walk'+(gr.transit?' incl. transit train':'')+'</span>':'<span class="muted">Gate '+esc(t.gate)+' isn’t on the '+esc(AP.term)+' map.</span>');
  var fits='';
  if(gr&&mins>0){var spare=mins-Math.ceil(gr.secs/60);fits=spare>15?'<span class="chip g">'+spare+' min to spare</span>':(spare>0?'<span class="chip o">Head to the gate soon</span>':'<span class="chip r">Go to the gate now</span>');}
  top.innerHTML='<div class="card glass strong">'+
    '<div class="row between"><span class="b">'+esc(t.carrier+' '+t.num)+' · '+esc(t.from)+' to '+esc(t.to)+'</span>'+
    '<button class="chev" id="collapse" type="button" aria-label="Close trip card" style="border:none"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button></div>'+
    '<div class="row between" style="align-items:flex-end"><div><div class="small b muted">'+(mins>0?'Boarding in':'Boarding')+'</div><div class="big" style="color:var(--accent-ink)">'+cd+'</div></div>'+
    '<div style="text-align:right"><div class="small b muted">Gate</div><div class="big">'+esc(t.gate||'—')+'</div></div></div>'+
    '<div class="row between small" style="font-size:15px">'+gateInfo+fits+'</div>'+
    '<div class="bar"><i style="width:'+prog.toFixed(0)+'%"></i></div>'+
    '<div class="grid3"><div class="tile"><span class="k">Boards</span><span class="v">'+fmtTime(boardingAt(t))+'</span></div><div class="tile"><span class="k">Departs</span><span class="v">'+fmtTime(t.dep)+'</span></div><div class="tile"><span class="k">Seat</span><span class="v">'+esc(t.seat||'—')+'</span></div></div>'+
    '<div class="row"><button class="btn primary" style="flex:1" id="goGate" type="button"'+(gr?'':' disabled')+'>Walk to gate</button><button class="btn soft" style="flex:1" id="gateChange" type="button">'+(t.gate?'Simulate gate change':'Simulate gate call')+'</button></div>'+
    '</div>';
  $('collapse').onclick=function(){state.expanded=false;renderTop();};
  $('goGate').onclick=function(){state.expanded=false;clearSel(true);startWalk();};
  $('gateChange').onclick=simulateGate;
}
function placeTiming(p,rMe,rGate){
  var t=activeTrip(),n='p'+p.id,t1=rMe.dist[n],t2=rGate?rGate.dist[n]:null;
  var o={t1:t1,mins:Math.max(1,Math.ceil(t1/60)),tags:[]};
  if(t&&rGate&&t.gate){var direct=rGate.dist[state.me],detour=t1+t2-direct,left=minsUntil(boardingAt(t));
    if(detour<90)o.tags.push('<span class="chip a">On your way</span>');
    var need=Math.ceil((t1+t2)/60)+CAT[p.c].dwell;
    if(p.c!=='security'&&p.c!=='service'&&p.c!=='toilet'&&!CAT[p.c].ground&&!CAT[p.c].move){if(left<=0)o.tags.push('<span class="chip r">Boarding now</span>');else if(need<=left)o.tags.push('<span class="chip g">Fits before boarding</span>');else o.tags.push('<span class="chip r">Too tight</span>');}
  }
  var rp=activeReports(p.id);if(rp.length){var last=rp[rp.length-1];o.tags.push('<span class="chip '+(REPORT[last.type].tone)+'">'+REPORT[last.type].label+' · '+agoText(last.ts)+'</span>');}
  if(p.c==='mine')o.tags.push('<span class="chip n">Added by you</span>');
  return o;
}
function renderPlace(){
  var c=$('placeCard');if(!state.sel){c.hidden=true;return;}
  var p=placeById(state.sel);if(!p){c.hidden=true;return;}
  var rMe=dijkstra(state.me),t=activeTrip(),rG=(t&&t.gate&&GATEMAP[t.gate])?dijkstra('g'+t.gate):null,o=placeTiming(p,rMe,rG);
  c.hidden=false;
  c.innerHTML='<div class="row" style="align-items:flex-start"><div class="dot" style="background:var('+CAT[p.c].color+')"><svg width="22" height="22" viewBox="-8 -8 16 16" aria-hidden="true"><path d="'+ICON[p.c]+'" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'+
    '<div style="flex:1;min-width:0"><div class="b" style="font-size:17px">'+esc(p.n)+'</div><div class="small muted">'+esc(lvlPre(p)+p.loc)+(p.h?' · '+esc(p.h):'')+'</div><div class="tags">'+o.tags.join('')+'</div></div>'+
    '<button class="chev" id="pcClose" type="button" aria-label="Close" style="border:none;margin-left:0">✕</button></div>'+
    '<div class="row"><button class="btn primary" style="flex:1" id="pcGo" type="button">Walk · '+o.mins+' min</button><button class="btn soft" id="pcReport" type="button">Report</button></div>';
  $('pcClose').onclick=function(){clearSel();};
  $('pcGo').onclick=function(){startWalk();};
  $('pcReport').onclick=function(){openReport(p.id);};
}
function selectPlace(id){state.sel=id;hideMoveChip();var p=placeById(id);if(AP.levels&&p&&p.l!=null&&p.l!==state.lvl){state.lvl=p.l;showLevel();}render();var m=meXY();fit([Math.min(p.x,m.x)-20,Math.min(p.y,m.y)-20,Math.max(p.x,m.x)+20,Math.max(p.y,m.y)+20],true);}
function clearSel(silent){state.sel=null;if(!silent)render();}

/* walking animation (fast-forward) */
function startWalk(){
  var rt=computeRoute();if(!rt){toast('Pick a place or add a gate first');return;}
  var pts=rt.path.map(function(s){return {x:N[s.id].x,y:N[s.id].y,t:s.t};});
  setLevel(N[rt.path[0].id].l);
  var segs=[],tot=0;for(var i=1;i<pts.length;i++){var c=pts[i].t?(i>1&&pts[i-1]?0:0):0;var len=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y)*MPU;var ed=ADJ[rt.path[i-1].id].find(function(e){return e.to===rt.path[i].id;}),dur=ed?ed.c:len/WALK;segs.push({a:pts[i-1],b:pts[i],d:dur,k:ed?ed.k:'',lb:N[rt.path[i].id].l});tot+=dur;}
  var SPEED=30,t0=performance.now(),destId=rt.path[rt.path.length-1].id;
  state.walking={pos:{x:pts[0].x,y:pts[0].y}};
  var w=$('walking');w.hidden=false;
  w.innerHTML='<span id="wtxt"></span><button class="btn plain" id="wstop" type="button" style="height:30px">Stop</button>';
  $('wstop').onclick=function(){finish(true);};
  var raf;
  function finish(stopped){cancelAnimationFrame(raf);var p=state.walking.pos;state.walking=null;w.hidden=true;
    state.me=stopped?nearestAny(p):destId;if(N[state.me])setLevel(N[state.me].l);save();render();if(!stopped)toast(state.sel?'You’ve arrived':'You’re at gate '+activeTrip().gate);}
  function step(now){var el2=(now-t0)/1000*SPEED,acc=0;
    for(var i=0;i<segs.length;i++){if(el2<=acc+segs[i].d){var f=(el2-acc)/segs[i].d;state.walking.pos={x:segs[i].a.x+(segs[i].b.x-segs[i].a.x)*f,y:segs[i].a.y+(segs[i].b.y-segs[i].a.y)*f};if(!live.compass&&Math.hypot(segs[i].b.x-segs[i].a.x,segs[i].b.y-segs[i].a.y)>1){walkHeading=Math.atan2(segs[i].b.x-segs[i].a.x,-(segs[i].b.y-segs[i].a.y))*180/Math.PI;setCone();}
      if(segs[i].k&&state.lvl!==segs[i].lb){setLevel(segs[i].lb);}
      $('wtxt').textContent=(segs[i].k?({lift:'In the lift',escalator:'On the escalator',stairs:'On the stairs'}[segs[i].k])+' to Level '+segs[i].lb:segs[i].b.t?'On the transit train':'Walking')+' · '+Math.max(0,Math.ceil((tot-el2)/60))+' min left · 30× speed';drawMe();applyView();raf=requestAnimationFrame(step);return;}acc+=segs[i].d;}
    finish(false);}
  fit(bboxOf(pts),true);raf=requestAnimationFrame(step);
}
function nearestAny(p){var best=null,bd=1e9;Object.keys(N).forEach(function(id){var n=N[id];if(n.l!==state.lvl)return;var d=(n.x-p.x)*(n.x-p.x)+(n.y-p.y)*(n.y-p.y);if(d<bd){bd=d;best=id;}});return best;}
function bboxOf(pts){var b=[1e9,1e9,-1e9,-1e9];pts.forEach(function(p){b[0]=Math.min(b[0],p.x);b[1]=Math.min(b[1],p.y);b[2]=Math.max(b[2],p.x);b[3]=Math.max(b[3],p.y);});return [b[0]-20,b[1]-20,b[2]+20,b[3]+20];}
function fitRoute(anim){var t=activeTrip();if(t&&!mapped(t))return;if(lastRoute){var r=bboxOf(lastRoute.path.map(function(s){return N[s.id];})),cx=(r[0]+r[2])/2,cy=(r[1]+r[3])/2,hw=Math.max((r[2]-r[0])/2,130),hh=Math.max((r[3]-r[1])/2,150);fit([cx-hw,cy-hh,cx+hw,cy+hh],anim);}else fit(allBB(),anim);}

function simulateGate(){
  var t=activeTrip();if(!t)return;var opts=GATES.filter(function(g){return g.id!==t.gate;});var g=opts[Math.floor(Math.random()*opts.length)].id;
  var was=t.gate;t.gate=g;save();state.expanded=false;state.sel=null;render();fitRoute(true);
  var gr=gateRoute();
  banner(was?'Gate change: now '+g:'Your gate is '+g, (was?'Was '+was+'. ':'')+'It’s a '+Math.ceil(gr.secs/60)+' min walk'+(gr.transit?' including the transit train':'')+'.');
}

/* ---------- reports (stored on this phone) ---------- */
var REPORT={open:{label:'Open',tone:'g'},closed:{label:'Closed',tone:'r'},longq:{label:'Long queue',tone:'o'},shortq:{label:'Short queue',tone:'g'},busy:{label:'Busy',tone:'o'},quiet:{label:'Quiet',tone:'g'}};
function activeReports(pid){var now=Date.now();return reports.filter(function(r){return r.pid===pid&&now-r.ts<60*60000;});}
function agoText(ts){var m=Math.round((Date.now()-ts)/60000);return m<1?'just now':m+' min ago';}

/* ---------- sheets ---------- */
function openSheet(title,html,after){$('sheetTitle').textContent=title;$('sheetBody').innerHTML=html;$('scrim').classList.add('show');$('sheet').classList.add('show');if(after)after();}
function closeSheet(){$('scrim').classList.remove('show');$('sheet').classList.remove('show');}
$('sheetClose').onclick=closeSheet;$('scrim').onclick=closeSheet;

var searchCat=null;
function openSearch(){
  var cats=['toilet','food','coffee','bar','shop','lounge','service','transit','taxi','car','parking','lift','escalator','stairs'].filter(function(c){return allPlaces().some(function(p){return p.c===c;});});
  openSheet('Search '+AP.term,'<div class="sfield"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="color:var(--fg3)"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="q" type="search" placeholder="Coffee, lounge, gate '+esc(AP.sample.gate)+'…" aria-label="Search '+esc(AP.term)+'" autocomplete="off"></div>'+
    '<div class="chips" id="cats">'+cats.map(function(c){return '<button class="fchip" type="button" data-c="'+c+'" aria-pressed="'+(searchCat===c)+'">'+CAT[c].label+'</button>';}).join('')+'</div>'+
    '<div class="note" id="timeNote"></div><div class="group" id="results"></div>',function(){
      $('q').addEventListener('input',renderResults);
      $('cats').querySelectorAll('button').forEach(function(b){b.onclick=function(){searchCat=searchCat===b.getAttribute('data-c')?null:b.getAttribute('data-c');$('cats').querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x.getAttribute('data-c')===searchCat);});renderResults();};});
      renderResults();setTimeout(function(){try{$('q').focus({preventScroll:true});}catch(e){}},350);
    });
}
function renderResults(){
  var q=($('q').value||'').trim().toLowerCase(),t=activeTrip(),rMe=dijkstra(state.me),rG=(t&&t.gate&&GATEMAP[t.gate])?dijkstra('g'+t.gate):null;
  var left=t?minsUntil(boardingAt(t)):null;
  $('timeNote').textContent=t&&left>0?'Boarding in '+fmtDur(left)+'. Times include walking back to gate '+(t.gate||'(not announced)')+' and a typical stay.':'';
  var gm=q.match(/^(gate\s*)?[a-z]?\s?\d{1,2}[a-z]?$/i);
  var html='';
  if(gm){var gid=q.replace(/^gate/i,'').replace(/\s/g,'').toUpperCase();if(GATEMAP[gid]){var s=rMe.dist['g'+gid];html+='<button class="res" type="button" data-gate="'+gid+'"><div class="dot" style="background:var(--dest);color:var(--dest-ink);font-weight:700;font-size:13px">'+esc(gid)+'</div><div style="flex:1"><div class="row between"><span class="t">Gate '+gid+'</span><span class="b">'+Math.ceil(s/60)+' min</span></div><div class="m">'+esc(AP.bnames[GATEMAP[gid].b]||AP.term)+(GATEMAP[gid].bus?' · bus gate':'')+'</div></div></button>';}}
  var list=allPlaces().filter(function(p){if(p.c==='security'&&!q)return false;if(searchCat&&p.c!==searchCat)return false;if(!q)return true;return (p.n+' '+p.loc+' '+CAT[p.c].label).toLowerCase().indexOf(q)>=0;})
    .map(function(p){return {p:p,o:placeTiming(p,rMe,rG)};}).sort(function(a,b){return a.o.t1-b.o.t1;});
  list.forEach(function(r){var p=r.p;html+='<button class="res" type="button" data-poi="'+p.id+'"><div class="dot" style="background:var('+CAT[p.c].color+')"><svg width="20" height="20" viewBox="-8 -8 16 16" aria-hidden="true"><path d="'+ICON[p.c]+'" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div style="flex:1;min-width:0"><div class="row between"><span class="t">'+esc(p.n)+'</span><span class="b" style="white-space:nowrap">'+r.o.mins+' min</span></div><div class="m">'+esc(lvlPre(p)+p.loc)+(p.h?' · '+esc(p.h):'')+'</div><div class="tags">'+r.o.tags.join('')+'</div></div></button>';});
  if(!html){html='<div class="cell" style="flex-direction:column;align-items:flex-start;gap:6px"><span class="b">Nothing found for “'+esc(q)+'”</span><span class="small muted">Many shops aren’t mapped yet in this prototype. Add a missing place from the + button and it will appear for you here.</span></div>';}
  $('results').innerHTML=html;
  $('results').querySelectorAll('[data-poi]').forEach(function(b){b.onclick=function(){closeSheet();selectPlace(b.getAttribute('data-poi'));};});
  $('results').querySelectorAll('[data-gate]').forEach(function(b){b.onclick=function(){closeSheet();var g=GATEMAP[b.getAttribute('data-gate')],m=meXY();fit([Math.min(g.x,m.x)-30,Math.min(g.y,m.y)-30,Math.max(g.x,m.x)+30,Math.max(g.y,m.y)+30],true);};});
}

function openReport(pid){
  var p=pid?placeById(pid):null;
  if(p){
    openSheet('Report: '+p.n,'<div class="rgrid">'+['open','closed','longq','shortq'].map(function(r){return '<button class="rtile" type="button" data-r="'+r+'">'+REPORT[r].label+'</button>';}).join('')+'</div><div class="note">Reports are saved on this phone and expire after an hour. In the full app other travellers would see them too, anonymously.</div>',function(){
      $('sheetBody').querySelectorAll('[data-r]').forEach(function(b){b.onclick=function(){reports.push({pid:p.id,type:b.getAttribute('data-r'),ts:Date.now()});save();closeSheet();render();toast('Thanks. Reported “'+REPORT[b.getAttribute('data-r')].label+'”');};});});
    return;
  }
  openSheet('What’s happening here?','<div class="rgrid"><button class="rtile" type="button" data-r="busy">Busy here</button><button class="rtile" type="button" data-r="quiet">Quiet here</button></div>'+
    '<div class="glabel">Add a missing place where you are</div><div class="group"><div class="cell"><label for="np-name">Name</label><input id="np-name" placeholder="e.g. Toilets" autocomplete="off"></div>'+
    '<div class="cell"><label for="np-cat">Type</label><select id="np-cat"><option value="service">Service or toilets</option><option value="food">Food</option><option value="coffee">Coffee</option><option value="bar">Bar</option><option value="shop">Shop</option><option value="lounge">Lounge</option></select></div></div>'+
    '<div class="err" id="np-err" hidden></div><button class="btn primary full" id="np-save" type="button">Add place</button><div class="note">New places go on the map at your blue dot. Move the dot first by tapping the map.</div>',function(){
      $('sheetBody').querySelectorAll('[data-r]').forEach(function(b){b.onclick=function(){closeSheet();toast('Thanks. Noted as “'+REPORT[b.getAttribute('data-r')].label+'”');};});
      $('np-save').onclick=function(){var name=$('np-name').value.trim();if(!name){$('np-err').hidden=false;$('np-err').textContent='Give the place a name, for example “Toilets”.';return;}
        var me=meXY(),n=N[state.me],nb=n?n.b:BUILDINGS[0].b,np={id:'m'+Date.now(),v:2,ap:AP.key,l:state.lvl,n:name,c:'mine',kind:$('np-cat').value,b:nb,x:Math.round(me.x+14),y:Math.round(me.y-10),loc:'Added by you · '+(AP.bnames[nb]||AP.term),h:''};
        myPlaces.push(np);attach('p'+np.id,np.x,np.y,np.b,np.l);drawPoi(np,gMine);save();closeSheet();render();toast('Added “'+name+'” to your map');};
    });
}

function openTrips(){
  var list=trips.slice().sort(function(a,b){return a.dep-b.dep;});
  var html='<div class="group">'+(list.length?list.map(function(t){var on=activeTrip()&&activeTrip().id===t.id;return '<div class="cell" style="gap:10px"><button type="button" data-pick="'+t.id+'" style="flex:1;text-align:left;border:none;background:transparent;padding:0;min-width:0"><div class="b">'+esc(t.carrier+' '+t.num)+' · '+esc(t.from)+' → '+esc(t.to)+(on?' <span class="chip a">Showing</span>':'')+'</div><div class="small muted">'+fmtDate(t.dep)+' · departs '+fmtTime(t.dep)+(t.gate?' · gate '+esc(t.gate):'')+(mapped(t)?'':' · no map yet')+'</div></button><button class="btn plain" type="button" data-del="'+t.id+'" aria-label="Delete trip">Delete</button></div>';}).join(''):'<div class="cell muted">No trips yet</div>')+'</div>'+
    '<button class="btn primary full" id="tAdd" type="button">Add a flight</button><button class="btn soft full" id="tSample" type="button">Try another airport</button>';
  openSheet('Your trips',html,function(){
    $('sheetBody').querySelectorAll('[data-pick]').forEach(function(b){b.onclick=function(){state.activeId=b.getAttribute('data-pick');state.sel=null;save();closeSheet();render();fitRoute(true);};});
    $('sheetBody').querySelectorAll('[data-del]').forEach(function(b){b.onclick=function(){var id=b.getAttribute('data-del');trips=trips.filter(function(t){return t.id!==id;});if(state.activeId===id)state.activeId=null;save();render();openTrips();};});
    $('tAdd').onclick=openAdd;$('tSample').onclick=openAirports;
  });
}

function openAdd(mode){
  mode=mode==='pass'?'pass':'num';
  var today=new Date(),ds=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  var soon=new Date(Date.now()+90*60000),ts=String(soon.getHours()).padStart(2,'0')+':'+String(Math.floor(soon.getMinutes()/5)*5).padStart(2,'0');
  var html='<div class="seg" role="group" aria-label="How to add"><button type="button" id="mNum" aria-pressed="'+(mode==='num')+'">Flight number</button><button type="button" id="mPass" aria-pressed="'+(mode==='pass')+'">Boarding pass</button></div>'+
   '<div id="passBox"'+(mode==='pass'?'':' hidden')+' style="display:flex;flex-direction:column;gap:10px"><div class="group"><div class="cell"><textarea id="f-bcbp" aria-label="Boarding pass barcode text" placeholder="M1SURNAME/NAME  EABC123 LHRSOFBA 0890 311Y014A0042 100"></textarea></div></div>'+
   '<div class="note">Paste the text inside a boarding pass barcode. The real app scans it with the camera; nothing leaves your phone.</div><div class="row"><button class="btn soft" style="flex:1" type="button" id="exPass">Use an example pass</button><button class="btn primary" style="flex:1" type="button" id="readPass">Read pass</button></div></div>'+
   '<div id="numBox"'+(mode==='num'?'':' hidden')+' style="display:flex;flex-direction:column;gap:14px"><div class="group">'+
   '<div class="cell"><label for="f-flight">Flight</label><input id="f-flight" placeholder="BA 890" autocomplete="off" autocapitalize="characters"></div>'+
   '<div class="cell"><label for="f-from">From</label><input id="f-from" placeholder="LHR" maxlength="3" autocomplete="off" autocapitalize="characters"></div>'+
   '<div class="cell"><label for="f-to">To</label><input id="f-to" placeholder="SOF" maxlength="3" autocomplete="off" autocapitalize="characters"></div>'+
   '<div class="cell"><label for="f-date">Date</label><input id="f-date" type="date" value="'+ds+'"></div>'+
   '<div class="cell"><label for="f-time">Departs</label><input id="f-time" type="time" value="'+ts+'"></div>'+
   '<div class="cell"><label for="f-gate">Gate</label><input id="f-gate" placeholder="If known, e.g. A10" autocomplete="off" autocapitalize="characters"></div>'+
   '<div class="cell"><label for="f-seat">Seat</label><input id="f-seat" placeholder="Optional" autocomplete="off" autocapitalize="characters"></div></div>'+
   '<div class="err" id="f-err" hidden></div><button class="btn primary full" type="button" id="saveFlight">Add to Boardwalk</button>'+
   '<div class="note">This prototype has no live flight feed, so enter the time and gate from your booking. Flights from Sofia (SOF), Amsterdam (AMS) and from Heathrow with British Airways or Iberia open a map. Wizz Air and easyJet from Sofia use Terminal 1. Any other airport shows the trip without a map.</div></div>';
  openSheet('Add a flight',html,function(){
    function setMode(m){$('mNum').setAttribute('aria-pressed',m==='num');$('mPass').setAttribute('aria-pressed',m==='pass');$('numBox').hidden=m!=='num';$('passBox').hidden=m!=='pass';}
    $('mNum').onclick=function(){setMode('num');};$('mPass').onclick=function(){setMode('pass');};
    $('exPass').onclick=function(){$('f-bcbp').value=exampleBCBP();};
    $('readPass').onclick=function(){var r=parseBCBP($('f-bcbp').value);if(!r){toast('That doesn’t look like boarding pass text');return;}
      setMode('num');$('f-flight').value=r.carrier+' '+r.num;$('f-from').value=r.from;$('f-to').value=r.to;$('f-seat').value=r.seat;
      $('f-date').value=r.date.getFullYear()+'-'+String(r.date.getMonth()+1).padStart(2,'0')+'-'+String(r.date.getDate()).padStart(2,'0');
      var e=$('f-err');e.hidden=false;e.style.color='var(--green)';e.textContent='Read '+r.carrier+' '+r.num+', '+r.from+' to '+r.to+', seat '+(r.seat||'—')+'. Boarding passes don’t include the time, so check it below.';};
    $('saveFlight').onclick=function(){
      var e=$('f-err');e.style.color='';var fl=$('f-flight').value.toUpperCase().replace(/\s+/g,''),m=fl.match(/^([A-Z0-9]{2})(\d{1,4})$/);
      var from=$('f-from').value.trim().toUpperCase(),to=$('f-to').value.trim().toUpperCase();
      var err=!m?'Enter a flight like “BA 890”.':(!/^[A-Z]{3}$/.test(from)?'Enter the 3-letter departure airport, like LHR.':(!/^[A-Z]{3}$/.test(to)?'Enter the 3-letter destination airport, like SOF.':(!$('f-date').value||!$('f-time').value?'Enter the departure date and time.':'')));
      var gate=$('f-gate').value.trim().toUpperCase().replace(/\s+/g,'');
      var fa=apFor({from:from,carrier:m?m[1]:''});if(!err&&gate&&fa&&!fa.gates.some(function(g){return g.id===gate;}))err=fa.gateHint+' Leave it empty if you don’t know yet.';
      if(err){e.hidden=false;e.textContent=err;return;}
      var p=$('f-date').value.split('-'),tm=$('f-time').value.split(':'),dep=new Date(+p[0],+p[1]-1,+p[2],+tm[0],+tm[1]).getTime();
      addTrip({id:'t'+Date.now(),carrier:m[1],num:m[2],from:from,to:to,dep:dep,gate:gate||'',seat:$('f-seat').value.trim().toUpperCase(),added:Date.now()});
      closeSheet();
    };
  });
}
function addTrip(t){t.added=t.added||Date.now();trips.push(t);state.activeId=t.id;state.sel=null;state.expanded=false;save();render();fitRoute(false);
  if(mapped(t))setTimeout(function(){arrive(t);},700);else toast('Trip saved on this phone');}
function arrive(t){var gr=gateRoute();banner('Welcome to '+AP.name+' '+AP.term,'Indoor maps are ready. '+(t.gate?'Gate '+t.gate+' is about '+(gr?Math.ceil(gr.secs/60):'a few')+' min from security.':'We’ll tell you when your gate is announced.'));}

function openPrivacy(){
  var html='<div class="glabel">Look</div><div class="seg" role="group" aria-label="Look"><button type="button" id="stA" aria-pressed="'+(mapStyle==='apple')+'">iPhone · Apple Maps</button><button type="button" id="stG" aria-pressed="'+(mapStyle==='google')+'">Android · Google Maps</button></div><div class="group"><div class="cell" style="flex-direction:column;align-items:flex-start;gap:4px"><span class="b">No account. Nothing to sign in to.</span><span class="small muted">Everything you add is stored only on this device. Nothing is sent anywhere.</span></div>'+
   '<div class="cell row between"><span>Trips</span><span class="muted">'+trips.length+'</span></div><div class="cell row between"><span>Reports</span><span class="muted">'+reports.length+'</span></div><div class="cell row between"><span>Places you added</span><span class="muted">'+myPlaces.length+'</span></div></div>'+
   '<div class="glabel">Routes</div><div class="group"><label class="cell row between" for="sfree"><span>Step-free routes<br><span class="small muted">Use lifts instead of escalators and stairs</span></span><input type="checkbox" id="sfree" class="tgl"'+(state.stepfree?' checked':'')+'></label></div>'+
   '<div class="glabel">Use it like an app</div><div class="note">iPhone: in Safari tap Share, then “Add to Home Screen”. Android: in Chrome tap ⋮, then “Add to Home screen” or “Install app”. It then opens full screen and works offline.</div>'+
   (basemap.ok?'<button class="btn soft full" id="lineup" type="button">Line up the map with the streets</button><div class="note">If the terminal plan sits in the wrong place on the street map, drag it into place. The fix is saved on this phone, and you can copy it to send to us.</div>':'')+
   '<button class="btn danger full" id="wipe" type="button">Delete everything on this phone</button><div class="err" id="wipeAsk" hidden></div>'+
   '<div class="glabel">About the '+esc(AP.name+' '+AP.term)+' map</div><div class="note">'+esc(AP.note)+' Verify before you rely on it.</div>'+
   '<div class="group">'+AP.sources.map(function(s){return '<a class="cell" href="'+s[1]+'" target="_blank" rel="noopener" style="color:var(--accent-ink);text-decoration:none">'+s[0]+'</a>';}).join('')+'</div>'+
   '<div class="note">Location: browsers block indoor positioning inside this preview, so tap the map to move your blue dot. The real app would use airport Wi-Fi, Bluetooth beacons and the phone’s motion sensors.</div>';
  openSheet('Settings and privacy',html,function(){$('sfree').onchange=function(){state.stepfree=$('sfree').checked;store.set('stepfree',state.stepfree);render();toast(state.stepfree?'Routes now use lifts only':'Routes use the quickest way');};if($('lineup'))$('lineup').onclick=function(){closeSheet();startAdjust();};$('stA').onclick=function(){setStyle('apple');openPrivacy();};$('stG').onclick=function(){setStyle('google');openPrivacy();};var armed=false;$('wipe').onclick=function(){if(!armed){armed=true;$('wipe').textContent='Tap again to delete everything';return;}store.clear();location.reload();};});
}

/* banner + toast */
var bTimer,tTimer;
function banner(title,body){var b=$('banner');b.innerHTML='<div class="appicon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="M9 21l2-6 3 3v3"/><path d="M7 12l2-4 4 1 3 3"/></svg></div><div style="flex:1;min-width:0"><div class="row between"><span class="b" style="font-size:15px">'+esc(title)+'</span><span class="tiny muted">now</span></div><div style="font-size:15px;line-height:20px">'+esc(body)+'</div></div>';
  b.classList.add('show');clearTimeout(bTimer);bTimer=setTimeout(function(){b.classList.remove('show');},5200);b.onclick=function(){b.classList.remove('show');};}
function toast(msg){var t=$('toast');t.textContent=msg;t.style.whiteSpace=msg.length>38?'normal':'nowrap';t.style.width=msg.length>38?'86%':'';t.style.textAlign='center';t.classList.add('show');clearTimeout(tTimer);tTimer=setTimeout(function(){t.classList.remove('show');},2600);}

/* ---------- live location and compass ----------
   GPS gives the airport and a rough position (indoors it is often 10–30 m off), so the dot is smoothed,
   kept inside the walkable areas and can be corrected by the traveller. The compass turns the cone. */
/* ---------- floors ---------- */
function showLevel(){
  var on=!!AP.levels;svg.querySelectorAll('[data-l]').forEach(function(e){var vis=!on||+e.getAttribute('data-l')===state.lvl||(e.getAttribute('data-poi')&&e.getAttribute('data-poi')===state.sel);e.style.display=vis?'':'none';});
  var box=$('levels');if(!box)return;box.hidden=!on;if(!on)return;
  box.innerHTML=AP.levels.slice().sort(function(a,b){return b.id-a.id;}).map(function(l){return '<button type="button" data-lv="'+l.id+'" aria-pressed="'+(l.id===state.lvl)+'" aria-label="Level '+l.id+', '+esc(l.name)+'">'+l.id+'</button>';}).join('');
  box.querySelectorAll('[data-lv]').forEach(function(b){b.onclick=function(){setLevel(+b.getAttribute('data-lv'));var lv=AP.levels.find(function(x){return x.id===state.lvl;});toast('Level '+state.lvl+' · '+lv.name);};});
  if(gMe){var me=N[state.me];gMe.style.opacity=(state.walking||live.here||!me||me.l===state.lvl)?1:.35;}
}
function setLevel(l){if(!AP.levels||l===state.lvl&&$('levels').innerHTML)return;state.lvl=l;showLevel();if(lastRoute&&gRoute)drawRoute(lastRoute);applyView();}

/* line up the plan with the street map */
var adjust=null;
function startAdjust(){
  var g=geo();adjust={g:{lat:g.lat,lon:g.lon,x:g.x,y:g.y,rot:g.rot,s:g.s||1}};document.body.classList.add('adjusting');clearSel(true);render();
  var bar=$('adjbar');bar.hidden=false;
  bar.innerHTML='<div class="small b" style="text-align:center">Drag to line up '+esc(AP.term)+' with the streets</div><div class="row" style="justify-content:center;gap:8px">'+
    '<button class="round glass" type="button" data-a="r-" aria-label="Rotate left">⟲</button><button class="round glass" type="button" data-a="r+" aria-label="Rotate right">⟳</button>'+
    '<button class="round glass" type="button" data-a="s-" aria-label="Make the plan smaller">−</button><button class="round glass" type="button" data-a="s+" aria-label="Make the plan bigger">+</button>'+
    '<button class="btn soft" type="button" data-a="copy">Copy</button><button class="btn soft" type="button" data-a="reset">Reset</button><button class="btn primary" type="button" data-a="done">Done</button></div>';
  bar.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){var a=b.getAttribute('data-a'),g=adjust.g;
    if(a==='r-')g.rot=(g.rot+359)%360;else if(a==='r+')g.rot=(g.rot+1)%360;else if(a==='s-')g.s=+(g.s/1.03).toFixed(4);else if(a==='s+')g.s=+(g.s*1.03).toFixed(4);
    else if(a==='reset'){try{localStorage.removeItem('bw.geo.'+AP.key+PV);}catch(e){}var o=AP.geo;adjust.g={lat:o.lat,lon:o.lon,x:o.x,y:o.y,rot:o.rot,s:o.s||1};applyView();return;}
    else if(a==='copy'){var txt=AP.key+' geo:'+JSON.stringify({lat:+g.lat.toFixed(6),lon:+g.lon.toFixed(6),x:+g.x.toFixed(1),y:+g.y.toFixed(1),rot:g.rot,s:g.s});
      try{navigator.clipboard.writeText(txt).then(function(){toast('Copied. Paste it in a message to us.');},function(){toast(txt);});}catch(e){toast(txt);}return;}
    else if(a==='done'){endAdjust();return;}
    store.set('geo.'+AP.key+PV,g);if(a[0]==='s'){MPU=g.s;}applyView();};});
}
function endAdjust(){adjust=null;$('adjbar').hidden=true;document.body.classList.remove('adjusting');var key=AP.key;AP=null;ensureAirport();render();toast('Saved on this phone');}

/* small hook for automated checks */
window.BW={unreachable:function(){var r=dijkstra(state.me),out=[];GATES.forEach(function(g){if(r.dist['g'+g.id]==null)out.push('gate '+g.id);});allPlaces().forEach(function(p){if(r.dist['p'+p.id]==null)out.push(p.id);});return out;},nodes:function(){return BASE.length;},load:function(k){state.ap=k;state.activeId=null;AP=null;ensureAirport();render();return AP.key;},unproject:function(x,y){return unproject(x,y);},project:function(lat,lon){return project(AP,lat,lon);},map:function(){return basemap.map;},screen:function(x,y){var r=svg.getBoundingClientRect();return [r.left+(x-vb.x)*k,r.top+(y-vb.y)*k];}};
/* ---------- real street map underneath (OpenStreetMap via OpenFreeMap, drawn by MapLibre) ----------
   The plan's SVG stays in charge of panning and zooming; the street map follows it, rotated so the plan's "up" matches. */
var basemap={ok:false,map:null,style:null};
function baseStyle(){var dark=false;try{dark=matchMedia('(prefers-color-scheme: dark)').matches;}catch(e){}
  return 'https://tiles.openfreemap.org/styles/'+(dark?'dark':($('phone').classList.contains('g')?'bright':'positron'));}
function initBasemap(){
  if(!window.maplibregl||!document.getElementById('basemap'))return;
  try{
    basemap.style=baseStyle();
    basemap.map=new maplibregl.Map({container:'basemap',style:basemap.style,interactive:false,attributionControl:false,fadeDuration:0,center:[23.41,42.69],zoom:15});
    basemap.ok=true;document.body.classList.add('hasbase');
    basemap.map.on('error',function(e){if(!basemap.loaded&&e&&e.error&&/Failed to fetch|NetworkError|AJAXError/i.test(String(e.error.message||e.error))){fallbackBase();}});
    basemap.map.on('load',function(){basemap.loaded=true;});
    setTimeout(function(){if(!basemap.loaded)fallbackBase();},12000);
    try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',refreshBaseStyle);}catch(e){}
  }catch(e){basemap.ok=false;}
}
function fallbackBase(){if(!basemap.ok)return;basemap.ok=false;document.body.classList.remove('hasbase');if(AP){buildMap();render();}}
function refreshBaseStyle(){if(!basemap.ok)return;var st=baseStyle();if(st!==basemap.style){basemap.style=st;basemap.map.setStyle(st);}}
function syncBasemap(){
  if(!basemap.ok||!AP)return;var r=svg.getBoundingClientRect();if(!r.width)return;
  var g=geo(),c=unproject(vb.x+vb.w/2,vb.y+vb.h/2),mpp=(g.s||1)/k; // metres per screen pixel
  var z=Math.log2(40075016.686*Math.cos(c.lat*Math.PI/180)/(512*mpp));
  basemap.map.jumpTo({center:[c.lon,c.lat],zoom:Math.max(0,Math.min(22,z)),bearing:g.rot});
  var n=$('north');if(n){n.style.transform='rotate('+(-g.rot)+'deg)';n.hidden=Math.abs(((g.rot%360)+360)%360)<1;}
}

var live={on:false,follow:false,here:false,raw:null,pos:null,acc:null,compass:false,heading:null,watch:null,awayTold:false,lastRender:0};
var walkHeading=null;
function project(a,lat,lon){var g=(a===AP?geo():a.geo),sc=g.s||1,e=(lon-g.lon)*111320*Math.cos(g.lat*Math.PI/180),n=(lat-g.lat)*110540,r=g.rot*Math.PI/180;
  return {x:g.x+(e*Math.cos(r)-n*Math.sin(r))/sc,y:g.y-(e*Math.sin(r)+n*Math.cos(r))/sc};}
/* plan units → latitude/longitude (the inverse of project) */
function unproject(x,y){var g=geo(),sc=g.s||1,mx=(x-g.x)*sc,my=(g.y-y)*sc,r=g.rot*Math.PI/180,e=mx*Math.cos(r)+my*Math.sin(r),n=-mx*Math.sin(r)+my*Math.cos(r);
  return {lat:g.lat+n/110540,lon:g.lon+e/(111320*Math.cos(g.lat*Math.PI/180))};}
function metresFrom(a,lat,lon){var e=(lon-a.lon)*111320*Math.cos(a.lat*Math.PI/180),n=(lat-a.lat)*110540;return Math.hypot(e,n);}
function clampToAreas(p){
  var inside=BUILDINGS.find(function(a){return !a.nowalk&&(a.l||0)===state.lvl&&areaHas(a,p.x,p.y,6);});if(inside)return {x:p.x,y:p.y,b:inside.b};
  var id=nearestBase(p.x,p.y,null,state.lvl),n=id&&N[id];return n?{x:n.x,y:n.y,b:n.b}:{x:p.x,y:p.y,b:null};}
function locBtn(){var b=$('btnLocate');b.setAttribute('aria-pressed',live.on?'true':'false');b.classList.toggle('on',live.on);b.classList.toggle('follow',live.on&&live.follow);
  b.setAttribute('aria-label',!live.on?'Use my live location':(live.follow?'Turn off live location':'Follow my location'));}
function startLive(){
  if(!navigator.geolocation){toast('This browser can’t share your location.');return;}
  live.on=true;live.follow=true;live.awayTold=false;locBtn();
  startCompass();
  toast('Finding you…');
  live.watch=navigator.geolocation.watchPosition(onPos,function(err){
    if(err.code===1){stopLive();toast('Location is off for Boardwalk. Turn it on in your phone’s settings to see yourself on the map.');}
    else if(!live.here&&!live.errTold){live.errTold=true;toast('Still looking for you. Indoors this can take a moment; you can tap the map to place your dot.');}
  },{enableHighAccuracy:true,maximumAge:3000,timeout:20000});
}
function stopLive(){if(live.watch!=null)try{navigator.geolocation.clearWatch(live.watch);}catch(e){}live.watch=null;live.on=false;live.follow=false;live.here=false;live.pos=null;locBtn();drawMe();applyView();}
function onPos(p){
  var lat=p.coords.latitude,lon=p.coords.longitude,acc=p.coords.accuracy||50;
  // which mapped airport are you at?
  var near=null,nd=1e12;AIRPORT_LIST.forEach(function(k){var d=metresFrom(AIRPORTS[k],lat,lon);if(d<nd){nd=d;near=AIRPORTS[k];}});
  if(nd>2500){live.here=false;if(!live.awayTold){live.awayTold=true;toast('You’re '+(nd>=100000?Math.round(nd/1000):(nd/1000).toFixed(1))+' km from the nearest mapped airport. Your dot will follow you once you’re there; until then tap the map to move it.');}drawMe();return;}
  if(near.key!==AP.key){
    var t=activeTrip();
    if(!t||!mapped(t)||apFor(t).code!==near.code){state.ap=near.key;store.set('ap',near.key);if(t&&mapped(t))state.activeId=null;render();banner('You’re at '+near.name+' '+near.term,'Indoor maps are ready.');}
    else if(apFor(t).key!==near.key){/* same airport, other terminal: keep the trip's terminal */live.here=false;drawMe();return;}
  }
  var raw=project(AP,lat,lon),cal=store.get('cal.'+AP.key+PV,null);if(cal){raw.x+=cal.dx;raw.y+=cal.dy;}
  live.raw={x:raw.x-(cal?cal.dx:0),y:raw.y-(cal?cal.dy:0)};
  var c=clampToAreas(raw);
  if(!live.pos||!live.here){live.pos={x:c.x,y:c.y};}
  else{var al=Math.max(.15,Math.min(.6,12/(acc+12)));live.pos={x:live.pos.x+(c.x-live.pos.x)*al,y:live.pos.y+(c.y-live.pos.y)*al};}
  var first=!live.here;live.here=true;live.acc=acc;
  if(first)toast('Live location on'+(acc>25?' · indoor GPS is rough, tap the map to correct it':''));
  onLiveMoved(first);
}
function onLiveMoved(force){
  var id=nearestBase(live.pos.x,live.pos.y,null,state.lvl);if(id)state.me=id;
  drawMe();if(lastRoute&&gRoute)drawRoute(lastRoute);
  if(live.follow){var r=svg.getBoundingClientRect();if(force)fit([live.pos.x-90,live.pos.y-90,live.pos.x+90,live.pos.y+90],true);else{vb.x=live.pos.x-vb.w/2;vb.y=live.pos.y-vb.h*0.55;}}
  var now=Date.now();if(force||now-live.lastRender>2500){live.lastRender=now;render();}else applyView();
}
function setCone(){if(!meCone)return;var h=live.compass&&live.heading!=null?live.heading-(AP&&AP.geo?AP.geo.rot:0):walkHeading;
  if(h==null){meCone.setAttribute('opacity',0);return;}meCone.setAttribute('opacity',1);meCone.setAttribute('transform','rotate('+(h-90).toFixed(1)+')');}
function onOrient(e){var h=null;
  if(typeof e.webkitCompassHeading==='number')h=e.webkitCompassHeading;
  else if(e.absolute&&typeof e.alpha==='number')h=360-e.alpha;
  if(h==null||isNaN(h))return;
  var so=(screen.orientation&&screen.orientation.angle)||window.orientation||0;h=(h+so+360)%360;
  live.compass=true;
  if(live.heading==null)live.heading=h;else{var d=((h-live.heading+540)%360)-180;live.heading=(live.heading+d*.3+360)%360;}
  setCone();}
var compassOn=false;
function startCompass(){if(compassOn)return;
  function attach(){compassOn=true;if('ondeviceorientationabsolute' in window)window.addEventListener('deviceorientationabsolute',onOrient);else window.addEventListener('deviceorientation',onOrient);}
  try{if(window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function'){DeviceOrientationEvent.requestPermission().then(attach,attach);}
  else if(window.DeviceOrientationEvent)attach();}catch(e){}
}

/* wiring */
$('btnSearch').onclick=openSearch;
$('btnTrips').onclick=openTrips;
$('btnReport').onclick=function(){openReport(state.sel);};
$('btnPrivacy').onclick=openPrivacy;
$('btnLocate').onclick=function(){
  if(!live.on){startLive();return;}
  if(!live.follow){live.follow=true;locBtn();var m=meXY();fit([m.x-90,m.y-90,m.x+90,m.y+90],true);return;}
  stopLive();toast('Live location off. Tap the map to place your dot.');
};
$('btnWalk').onclick=function(){if(state.sel){startWalk();return;}var t=activeTrip();if(!t||!t.gate){toast(t?'Your gate isn’t announced yet':'Add a flight first');return;}startWalk();};
$('nomapSample').onclick=openAirports;
$('btnAirport').onclick=openAirports;
$('wSample').onclick=function(){store.set('welcomed',true);$('welcome').hidden=true;render();openAirports();};
$('wAdd').onclick=function(){store.set('welcomed',true);$('welcome').hidden=true;render();openAdd();};
window.addEventListener('resize',function(){applyView();});

/* try real location: if the browser allows it and you are at Heathrow, say so */
function tryGeo(){try{if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(function(pos){AIRPORT_LIST.forEach(function(k){var a=AIRPORTS[k],dLat=(pos.coords.latitude-a.lat)*111000,dLon=(pos.coords.longitude-a.lon)*111000*Math.cos(a.lat*Math.PI/180);if(Math.hypot(dLat,dLon)<1200)banner('You’re at '+a.name+' '+a.term,'Indoor maps are ready.');});},function(){},{timeout:4000});}catch(e){}}
/* airport picker (for testing) */
function openAirports(){
  var html='<div class="note" style="padding:0 4px">In the real app Boardwalk picks the airport from your flight or your location. For testing, pick one and a sample trip opens there.</div><div class="group">'+
    AIRPORT_LIST.map(function(k){var a=AIRPORTS[k],on=AP&&AP.key===k;return '<button class="cell" type="button" data-ap="'+k+'" style="gap:12px"><div class="dot" style="background:var(--fill);color:var(--fg);font-weight:700;font-size:13px">'+a.code+'</div><div style="flex:1;min-width:0;text-align:left"><div class="b">'+esc(a.name)+' · '+esc(a.term)+(on?' <span class="chip a">Showing</span>':'')+'</div><div class="small muted">'+a.pois.length+' places · '+a.gates.length+' gates'+(a.code==='SOF'?' · test in person':'')+'</div></div><span class="muted" aria-hidden="true">›</span></button>';}).join('')+'</div>';
  openSheet('Choose an airport',html,function(){$('sheetBody').querySelectorAll('[data-ap]').forEach(function(b){b.onclick=function(){pickAirport(b.getAttribute('data-ap'));};});});
}
function pickAirport(k){
  closeSheet();$('welcome').hidden=true;store.set('welcomed',true);
  var ex=trips.find(function(t){return t.sample&&(t.ap===k||(!t.ap&&k==='LHR5'));});
  state.ap=k;
  if(ex){state.activeId=ex.id;var d=Date.now()+85*60000;ex.dep=Math.ceil(d/300000)*300000;ex.added=Date.now();ex.gate=AIRPORTS[k].sample.gate;state.sel=null;state.expanded=false;save();render();fitRoute(false);setTimeout(function(){arrive(ex);},500);}
  else addTrip(sampleTrip(k));
}

var mapStyle=store.get('style',null)||(/Android/i.test(navigator.userAgent||'')?'google':'apple');
function setStyle(st){mapStyle=st;store.set('style',st);$('phone').classList.toggle('g',st==='google');refreshBaseStyle();buildMap();render();}
$('phone').classList.toggle('g',mapStyle==='google');
initBasemap();
ensureAirport();
requestAnimationFrame(function(){
  render();fitRoute(false);
  if(!store.get('welcomed',false)&&!trips.length){$('welcome').hidden=false;}
});
setInterval(function(){if(!state.walking&&!$('sheet').classList.contains('show'))renderTop();},15000);
})();
