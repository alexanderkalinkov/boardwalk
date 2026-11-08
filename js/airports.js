/* Boardwalk airport data. Each terminal's outline, gates and toilets come from OpenStreetMap (js/outlines.js,
   built by tools/osm/build.py); shops, cafés, lounges and services come from published guides. */
'use strict';
/* ---------- shared categories ---------- */
var WALK=1.3; // metres per second
var CAT={
  food:{label:'Food',color:'--c-food',dwell:25},
  coffee:{label:'Coffee',color:'--c-coffee',dwell:8},
  bar:{label:'Bars',color:'--c-bar',dwell:20},
  shop:{label:'Shops',color:'--c-shop',dwell:12},
  lounge:{label:'Lounges',color:'--c-lounge',dwell:30},
  toilet:{label:'Toilets',color:'--c-service',dwell:4},
  service:{label:'Services',color:'--c-service',dwell:3},
  security:{label:'Security',color:'--c-security',dwell:0},
  mine:{label:'Added by you',color:'--c-mine',dwell:10},
  transit:{label:'Trains & buses',color:'--c-transit',dwell:0,ground:1},
  taxi:{label:'Taxis',color:'--c-taxi',dwell:0,ground:1},
  car:{label:'Drop-off & pick-up',color:'--c-car',dwell:0,ground:1},
  parking:{label:'Parking',color:'--c-parking',dwell:0,ground:1},
  lift:{label:'Lifts',color:'--c-move',dwell:0,move:1},
  escalator:{label:'Escalators',color:'--c-move',dwell:0,move:1},
  stairs:{label:'Stairs',color:'--c-move',dwell:0,move:1}
};
var ICON={
  food:'M-3-5v4a2 2 0 0 0 4 0v-4M-1-5v10M4-5c-1.5 1-2 3-2 5h2v5',
  coffee:'M-5-2h8v3a4 4 0 0 1-4 4h0a4 4 0 0 1-4-4zM3-1h1.5a1.8 1.8 0 0 1 0 3.6H3',
  bar:'M-4.5-5h9l-4.5 5zM0 0v5M-3 5h6',
  shop:'M-4.5-2h9l-1 7h-7zM-2-2v-1.5a2 2 0 0 1 4 0V-2',
  lounge:'M-5 1v-3a2 2 0 0 1 4 0v1h2v-1a2 2 0 0 1 4 0v3M-5 1h10v3M-5 4v1.5M5 4v1.5',
  service:'M0-1v5M0-4.5v.2',
  toilet:'M-3.5-4.5v.1M3.5-4.5v.1M-5.5-2h4l-.6 5h-2.8zM-3.5 3v2.5M1.5-2h4v4.5h-4zM2.5 2.5v3M4.5 2.5v3',
  security:'M0-5.5l4.5 1.8v3.2c0 2.7-2 4.8-4.5 5.4-2.5-.6-4.5-2.7-4.5-5.4v-3.2z',
  mine:'M-4 0h8M0-4v8',
  transit:'M-4-5.5h8v8.5h-8zM-4-0.5h8M-2.5 1.5h0M2.5 1.5h0M-3 5.5l1.2-2.5M3 5.5l-1.2-2.5',
  taxi:'M-1.5-6.5h3v1.6h-3zM-5.5 3v-2.5l1.6-3.4h7.8l1.6 3.4V3zM-4 3v1.8M4 3v1.8',
  car:'M-5.5 3v-2.5l1.6-3.4h7.8l1.6 3.4V3zM-4 3v1.8M4 3v1.8M-5.5 0.5h11',
  parking:'M-2.5 5.5v-11h3.2a3.2 3.2 0 0 1 0 6.4h-3.2',
  lift:'M-4.5-5.5h9v11h-9zM-2.5-1l1.5-2 1.5 2M-2.5 1.5l1.5 2 1.5-2M1.5-3v6.5',
  escalator:'M-5.5 4.5h3l5-8h3M-5.5 4.5v1M5.5-3.5v-1',
  stairs:'M-5.5 5h3v-3h3v-3h3v-3h2'
};

/* ---------- airports ----------
   Map units are metres in each terminal's own frame (see geo: the anchor point and the compass bearing of "up").
   areas: walkable outlines from OpenStreetMap, split into zones (same b = connected; joins link zones, e.g. security
   or a train). gates: OpenStreetMap positions (a = which way the aircraft is, 0 = up; bus = bus gate).
   pois, labels and sources as before. */
var AIRPORTS={};
function T(id,n,c,b,x,y,loc,h,s){return {id:id,n:n,c:c,b:b,x:x,y:y,loc:loc,h:h||'',s:s};}
function L(l,p){p.l=l;return p;}
var OSM_SRC=['OpenStreetMap contributors (ODbL): building outlines, gates and toilets','https://www.openstreetmap.org/copyright'];
/* gates from OpenStreetMap; bus(g) says which are bus gates */
function osmGates(key,bus,extra){return OUTLINES[key].gates.map(function(g){var o={id:g.id,b:g.b,x:g.x,y:g.y,a:g.a};if(g.l!=null)o.l=g.l;if(bus(g))o.bus=true;return o;}).concat(extra||[]);}
/* toilets from OpenStreetMap, described from their tags */
function osmToilets(key,floors){return OUTLINES[key].toilets.map(function(t,i){
  var bits=[];if(t.level!=null&&t.level!=='')bits.push('Level '+String(t.level).replace(';',' and '));
  if(t.wheelchair==='yes')bits.push('wheelchair accessible');if(t.changing==='yes')bits.push('baby changing');
  var p={id:'wc'+i,n:'Toilets',c:'toilet',b:t.b,x:t.x,y:t.y,loc:(bits.length?bits.join(' · '):'Toilets')+' · from OpenStreetMap',h:'',s:'osm'};
  if(floors&&t.l!=null)p.l=t.l;return p;});}

/* Heathrow Terminal 5: T5A at the bottom, T5B above it, T5C at the top, joined by the underground transit train.
   The frontal building (car park, drop-off, buses) is below T5A. */
AIRPORTS.LHR5=(function(){
  var O=OUTLINES.LHR5;
  return {key:'LHR5',geo:O.geo,code:'LHR',city:'London',name:'London Heathrow',term:'Terminal 5',short:'T5',lat:51.4720,lon:-0.4887,carriers:['BA','IB'],
    start:'secN',gateHint:'Terminal 5 gates run A1–A23, B32–B48 and C52–C66.',gateCall:'Heathrow usually shows it about an hour before departure.',
    sample:{carrier:'BA',num:'890',to:'SOF',gate:'B42',seat:'14A'},
    areas:O.areas,
    bnames:{A:'T5A main building',B:'T5B, by transit train',C:'T5C, by transit train',L:'Outside T5, landside'},
    joins:[{a:[-17,168,'A'],b:[25,-308,'B'],c:240,t:1},{a:[25,-308,'B'],b:[57,-660,'C'],c:120,t:1},{a:[-136,246,'A'],b:[-136,264,'L'],c:40},{a:[101,246,'A'],b:[101,264,'L'],c:40}],
    transitLines:[[57,-660,-17,168]],
    secs:[[-183,239,95,13],[54,239,95,13]],
    labels:[{t:'DEPARTURES LOUNGE',x:-17,y:190,area:1},{t:'Transit train (underground)',x:40,y:-60,small:1}],
    bigLabels:[['Terminal 5A',-17,62],['Terminal 5B',25,-250],['Terminal 5C',57,-702]],
    gates:osmGates('LHR5',function(g){return g.type==='bus';}),
    sources:[OSM_SRC,['British Airways: Heathrow T5','https://www.britishairways.com/content/en/us/information/airport-information/london-heathrow-airport/heathrow-t5'],['Upgraded Points: Heathrow terminal guide','https://upgradedpoints.com/travel/airports/london-heathrow-airport-lhr-terminal-guide/'],['Heathrow T5 food guide','https://heathrowairport-info.co.uk/heathrow-food-terminal-5'],['Heathrow Terminal 5 guide','https://heathrowairport-info.co.uk/terminal-5'],['The Points Analyst: Heathrow T5','https://www.thepointsanalyst.com/heathrow-terminal-5/'],['Wikipedia: Heathrow Terminal 5','https://en.wikipedia.org/wiki/Heathrow_Terminal_5'],['Wikipedia: Heathrow Terminal 5 station','https://en.wikipedia.org/wiki/Heathrow_Terminal_5_railway_station']],
    note:'The outlines of T5B, T5C and the frontal building, all gate positions and the toilets come from OpenStreetMap. T5A’s outline is missing there, so it is drawn from its published size (396 × 176 m) and the gates around it. Shops, cafés and lounges come from published guides (checked 7 November 2026) and are placed from their descriptions, so treat their exact spot as approximate. The plan shows one floor; levels are in each place’s description.',
    pois:[
 {id:'secN',n:'North Security',c:'security',b:'A',x:-136,y:246,loc:'T5A, north end of the security hall',h:'',s:'ba'},
 {id:'secS',n:'South Security',c:'security',b:'A',x:101,y:246,loc:'T5A, south end; Fast Track is to the left of North Security',h:'Fast Track 06:00–21:00',s:'ba'},
 {id:'plane',n:'Gordon Ramsay Plane Food Market',c:'food',b:'A',x:-77,y:138,loc:'Upstairs in the main T5A building',h:'05:00–21:30',s:'hf'},
 {id:'pilots',n:'Pilots Bar & Kitchen',c:'bar',b:'A',x:81,y:116,loc:'Upper level, on the A-gates side',h:'',s:'hf'},
 {id:'giraffe',n:'Giraffe',c:'food',b:'A',x:-116,y:175,loc:'Upper level of the main departures lounge',h:'About 05:30–21:30',s:'hf'},
 {id:'waga',n:'wagamama',c:'food',b:'A',x:18,y:114,loc:'Level 2, near the A gates',h:'Breakfast from 05:30',s:'hf'},
 {id:'fortnum',n:'Fortnum & Mason Bar',c:'bar',b:'A',x:132,y:118,loc:'Opposite the Fortnum store, near gate A17',h:'05:30–22:00',s:'hf'},
 {id:'curator',n:'The Curator',c:'bar',b:'A',x:-18,y:217,loc:'Main T5A departures lounge',h:'',s:'hf'},
 {id:'crown',n:'The Crown Rivers (Wetherspoon)',c:'bar',b:'A',x:-187,y:116,loc:'Near gate A5',h:'04:45–21:00',s:'hf'},
 {id:'fiveguys',n:'Five Guys',c:'food',b:'A',x:-57,y:217,loc:'Upper level of the main T5A airside building',h:'05:00–22:00',s:'hf'},
 {id:'itsu',n:'itsu',c:'food',b:'A',x:60,y:120,loc:'By gate A15',h:'',s:'hf'},
 {id:'joe',n:'Joe & The Juice',c:'coffee',b:'A',x:44,y:182,loc:'Airside in the main T5A building',h:'',s:'hf'},
 {id:'pret',n:'Pret A Manger',c:'coffee',b:'A',x:-87,y:234,loc:'Airside in the main building',h:'',s:'hf'},
 {id:'sbA',n:'Starbucks',c:'coffee',b:'A',x:63,y:228,loc:'Airside, main T5A building',h:'',s:'hf'},
 {id:'nero',n:'Caffè Nero',c:'coffee',b:'A',x:-158,y:182,loc:'Airside, T5A',h:'',s:'hf'},
 {id:'costa',n:'Costa Coffee',c:'coffee',b:'A',x:123,y:190,loc:'Airside, T5A',h:'',s:'hf'},
 {id:'plaza',n:'Plaza Premium Lounge',c:'lounge',b:'A',x:-170,y:110,loc:'Near gate A6',h:'04:45–21:30 · paid entry',s:'ug'},
 {id:'aspire',n:'Club Aspire Lounge',c:'lounge',b:'A',x:140,y:110,loc:'Near gate A18',h:'05:00–21:00 · paid entry',s:'ug'},
 {id:'galN',n:'Galleries Club Lounge North',c:'lounge',b:'A',x:-185,y:208,loc:'T5A North',h:'05:00–22:30',s:'ba'},
 {id:'galS',n:'Galleries Club Lounge South',c:'lounge',b:'A',x:152,y:208,loc:'T5A South',h:'05:00–22:30',s:'ba'},
 {id:'galF',n:'Galleries First',c:'lounge',b:'A',x:150,y:239,loc:'T5A South',h:'05:00–22:30',s:'ba'},
 {id:'concorde',n:'Concorde Room',c:'lounge',b:'A',x:118,y:226,loc:'T5A South, First passengers only',h:'05:00–22:30',s:'ba'},
 {id:'help',n:'Help point',c:'service',b:'A',x:162,y:150,loc:'Opposite gates A20 and A21',h:'',s:'ba'},
 {id:'pw4',n:'Charging point',c:'service',b:'A',x:-199,y:144,loc:'Near gate A4',h:'',s:'ug'},
 {id:'pw9',n:'Charging point',c:'service',b:'A',x:-93,y:101,loc:'Near gate A9',h:'',s:'ug'},
 {id:'pw18',n:'Charging point',c:'service',b:'A',x:131,y:101,loc:'Near gate A18',h:'',s:'ug'},
 {id:'atm10',n:'ATM and currency exchange',c:'service',b:'A',x:-67,y:101,loc:'Near gate A10',h:'',s:'ug'},
 {id:'atm15',n:'ATM and currency exchange',c:'service',b:'A',x:44,y:101,loc:'Near gate A15',h:'',s:'ug'},
 {id:'play',n:'Children’s play area',c:'service',b:'A',x:-199,y:223,loc:'Near gate A2',h:'',s:'ug'},
 {id:'pray',n:'Prayer room',c:'service',b:'A',x:-164,y:236,loc:'North end of the departures level',h:'',s:'ug'},
 {id:'sbB',n:'Starbucks',c:'coffee',b:'B',x:-25,y:-306,loc:'T5B, B gates',h:'',s:'hf'},
 {id:'wexp',n:'Wetherspoon Express',c:'bar',b:'B',x:60,y:-306,loc:'T5B',h:'About 05:30 to the last departure',s:'hf'},
 {id:'galB',n:'Galleries Club Lounge T5B',c:'lounge',b:'B',x:105,y:-292,loc:'T5B, near gate B36',h:'05:30–22:30',s:'ba'},
 {id:'sbC',n:'Starbucks',c:'coffee',b:'C',x:100,y:-660,loc:'T5C, C gates',h:'',s:'hf'},
      T('lhrstn','Heathrow Terminal 5 station','transit','L',-22,268,'Beneath the terminal, entrance in the courtyard · Heathrow Express, Elizabeth line, Piccadilly line','Express to Paddington 21 min, every 15 min','stn'),
      T('lhrpod','Pod to the business car park','transit','L',145,268,'Driverless pods, about 4 km','','t5w'),
      T('lhrdrop','Drop-off (level 5)','car','L',-125,299,'Departures level of the frontal building, skybridges into T5','','t5w'),
      T('lhrpark','Short stay car park','parking','L',80,299,'Levels 1–4 of the frontal building · 3,800 spaces','','t5w'),
      T('lhrbus','Bus and coach station','transit','L',-125,332,'Ground level of the frontal building · 350, 423, 482, 490, N9, National Express','','t5w'),
      T('lhrtaxi','Taxi rank','taxi','L',80,332,'Ground level of the frontal building, next to the bus station','','t5w')
    ].concat(osmToilets('LHR5'))};
})();

/* Sofia Terminal 2: the check-in hall at the bottom faces the forecourt; security leads up into the departures
   lounge and the pier with gates B1–B14. Two public floors: 0 Arrivals, 1 Departures. */
AIRPORTS.SOF2=(function(){
  var O=OUTLINES.SOF2;
  return {key:'SOF2',geo:O.geo,code:'SOF',city:'Sofia',name:'Sofia Airport',term:'Terminal 2',short:'T2',lat:42.6895,lon:23.4142,carriers:null,
    start:'s2sec',gateHint:'Terminal 2 gates are A1, B1–B14 (with B6A), C1 and D1.',gateCall:'Sofia usually shows it on the screens about an hour before departure.',
    sample:{carrier:'BA',num:'891',to:'LHR',gate:'B7',seat:'14A'},
    levels:[{id:0,name:'Arrivals'},{id:1,name:'Departures'}],
    areas:O.areas,
    verts:[{id:'s2esc1',kind:'escalator',b:'L',x:-25,y:40,from:0,to:1},{id:'s2esc2',kind:'escalator',b:'L',x:45,y:40,from:0,to:1},
      {id:'s2lift',kind:'lift',b:'L',x:10,y:80,from:0,to:1},{id:'s2stairs',kind:'stairs',b:'L',x:-60,y:100,from:0,to:1}],
    bnames:{S:'T2 departures, airside',L:'T2 public area, before security',R:'T2 baggage reclaim'},
    joins:[{a:[5,22,'L',1],b:[5,0,'S',1],c:120}],
    secs:[[-30,5,70,10,1]],
    labels:[{t:'PIER · GATES B1–B14',x:0,y:-205,area:1,l:1},{t:'DEPARTURES',x:-30,y:-32,area:1,l:1},{t:'CHECK-IN · 38 DESKS',x:10,y:62,area:1,l:1},{t:'BAGGAGE RECLAIM',x:5,y:-20,area:1,l:0},{t:'ARRIVALS HALL',x:-10,y:62,area:1,l:0},{t:'Metro M4 to the city',x:140,y:152,small:1}],
    bigLabels:[['Terminal 2',10,185]],
    gates:osmGates('SOF2',function(g){return g.osmLevel==='0';},[{id:'A1',b:'S',x:-8,y:-58,a:270,l:1}]),
    sources:[OSM_SRC,['Sleeping in Airports: Sofia guide','https://www.sleepinginairports.net/guides/sofia-airport-guide.htm'],['Exciting Bulgaria: Sofia Airport','https://excitingbulgaria.com/sofia-airport/'],['Cestee: services at Sofia Airport','https://www.cestee.com/airport/sofia-sof/services'],['VisaVerge: new dining at Terminal 2 (2025)','https://www.visaverge.com/news/sofia-airport-launches-new-dining-outlets-at-terminal-2/'],['Moodie Davitt: Sofia duty free (2026)','https://moodiedavittreport.com/sofia-airport-chief-shares-vision-as-avolta-reveals-duty-free-store-and-italian-dining-concept/'],['FlightQueue: Sofia gates','https://flightqueue.com/sofia-airport-terminal-map'],['Wikipedia: Sofia Airport','https://en.wikipedia.org/wiki/Sofia_Airport'],['Wikipedia: Sofia Airport metro station','https://en.wikipedia.org/wiki/Sofia_Airport_Metro_Station']],
    note:'The building outline, gates B1–B14, C1 and D1 and the toilets come from OpenStreetMap. OpenStreetMap puts the bus gates (B1–B3, B5 and B11–B14) on level 0; the map shows them at their place along the pier. Gate A1 isn’t in OpenStreetMap, so its spot is a guess. Where airside ends and the check-in hall begins, and where the escalators, lift and stairs are, is a best guess to check in person. Shops, cafés and lounges come from the guides listed (checked 7 November 2026) and are placed from their descriptions. Outside: metro, buses, shuttle, taxi and car park come from the guides; where to drop off and pick up isn’t published, so that pin is a guess.',
    pois:[
      L(1,T('s2sec','Security','security','S',5,0,'Between the check-in hall and departures','','sia')),
      L(1,T('s2df','Sofia Duty Free','shop','S',5,-14,'Walk-through store right after security, about 2,000 m²','','mdr')),
      L(1,T('s2sb','Starbucks','coffee','S',-42,-8,'Dining zone, airside','','vv')),
      L(1,T('s2camden','Camden Food Co.','food','S',-16,-20,'Dining zone, airside','','vv')),
      L(1,T('s2air','Air Craft','coffee','S',22,-20,'Transit area · sandwiches and coffee','05:00–23:00','ces')),
      L(1,T('s2eddy','Eddy’s Bakery & Deli','coffee','S',38,-3,'Transit area · bagels and coffee','04:00–23:00','ces')),
      L(1,T('s2garden','Air Garden','bar','S',0,-62,'Transit zone, start of the pier · snacks and drinks','By flight schedule','ces')),
      L(1,T('s2bistro','Bistro','food','S',-58,-2,'Transit zone','','ces')),
      L(1,T('s2relay','RELAY','shop','S',-2,-40,'Transit zone · newsagent','04:00 to last departure','ces')),
      L(1,T('s2preslav','Preslav Lounge','lounge','S',78,-1,'Level 0, below passport control · has the only smoking room airside','By flight schedule · €18 for 3 h','eb')),
      L(1,T('s2pliska','Pliska Lounge','lounge','S',52,-14,'Level +1, right after passport control','08:00–23:00 · €14.40 for 3 h','eb')),
      L(1,T('s2vitosha','Vitosha Aspire Lounge','lounge','S',-36,-12,'Level 1, airside','Pass or membership','sia')),
      L(1,T('s2pray','Prayer room','service','S',64,-12,'Level 1, opposite gate C1','','sia')),
      L(1,T('s2play','Children’s play area','service','S',0,-125,'First floor, transit hall on the pier','','wtg')),
      L(1,T('s2ice','ICE Exchange','service','S',-66,2,'Level 1 · currency exchange','','sia')),
      L(1,T('s2water','Water refill','service','S',2,-88,'Near the restrooms on the pier (traveller report)','','sia')),
      L(1,T('s2costa','Costa Coffee','coffee','L',-40,30,'Public area, before security','05:00–23:00','ces')),
      L(1,T('s2pharm','Pharmacy','service','L',62,34,'Public area, before security','08:30–19:30','ces')),
      L(1,T('s2post','Post office','service','L',-30,75,'Departures, before security','','sia')),
      L(1,T('s2wrap','Luggage wrapping','service','L',30,90,'Departures, before security','','sia')),
      L(0,T('s2atm','ATMs','service','L',60,90,'Public area · Postbank has no fee','','ces')),
      L(0,T('s2rent','Car rental desks','service','L',40,66,'Arrivals hall · Sixt, Avis, Enterprise, Hertz, Budget, Europcar, Thrifty','','eb')),
      L(0,T('s2metro','Metro station','transit','L',150,120,'Next to T2 on the east side, on your left as you walk out','About 05:00–24:00 · about 20 min to the centre','metro')),
      L(0,T('s2bus','Bus stop · 84, 184, 384','transit','L',-60,135,'In front of the terminal · 84 and 184 also stop at T1','No night buses','eb')),
      L(0,T('s2shuttle','Free shuttle to Terminal 1','transit','L',-25,124,'In front of the terminal · about 5 min, no stops','Every 15 min, 05:00–23:00','eb')),
      L(1,T('s2drop','Drop-off (departures)','car','L',40,113,'Departures kerb in front of the terminal · rules and fees aren’t published online, check on site','','eb')),
      L(0,T('s2pick','Pick-up (arrivals)','car','L',40,113,'Arrivals kerb below the departures road · a best guess, check on site','','eb')),
      L(0,T('s2taxi','Taxi stand (Yellow!)','taxi','L',75,124,'Outside arrivals · follow the yellow path','Licensed airport taxi since 2023','eb')),
      L(0,T('s2park','Car park (multi-storey)','parking','L',104,132,'Across the forecourt road · 820 spaces with lifts','Paid, 24/7','eb'))
    ].concat(osmToilets('SOF2',true))};
})();

/* Sofia Terminal 1: the older building used mainly by Wizz Air. Bus gates only, along the apron side (top). */
AIRPORTS.SOF1=(function(){
  var O=OUTLINES.SOF1,g=[],i,gx=[-45,-20,5,30,55,80,105];
  for(i=1;i<=7;i++)g.push({id:String(i),b:'S',x:gx[i-1],y:gx[i-1]>70?-24:-26,a:0,bus:true});
  return {key:'SOF1',geo:O.geo,code:'SOF',city:'Sofia',name:'Sofia Airport',term:'Terminal 1',short:'T1',lat:42.6896,lon:23.4026,carriers:['W6','W4','U2','5W'],
    start:'s1sec',gateHint:'This map shows gates 1–7.',gateCall:'Sofia usually shows it on the screens about an hour before departure.',
    sample:{carrier:'W6',num:'4301',to:'LTN',gate:'3',seat:'7C'},
    areas:O.areas,
    bnames:{S:'T1 departures, airside',L:'T1 check-in hall, before security'},
    joins:[{a:[0,8,'L'],b:[0,-8,'S'],c:120}],
    secs:[[-25,-4,50,8]],
    labels:[{t:'DEPARTURES · BUS GATES',x:-100,y:-8,area:1},{t:'CHECK-IN',x:-3,y:42,area:1},{t:'T2 is about 2 km east',x:140,y:85,small:1}],
    bigLabels:[['Terminal 1',0,100]],
    gates:g,
    sources:[OSM_SRC,['Exciting Bulgaria: Sofia Airport','https://excitingbulgaria.com/sofia-airport/'],['Sleeping in Airports: Sofia guide','https://www.sleepinginairports.net/guides/sofia-airport-guide.htm'],['Cestee: services at Sofia Airport','https://www.cestee.com/airport/sofia-sof/services'],['Moodie Davitt: Sofia duty free and Amo (2026)','https://moodiedavittreport.com/sofia-airport-chief-shares-vision-as-avolta-reveals-duty-free-store-and-italian-dining-concept/'],['AirportMaps: Sofia terminals','https://airportmaps.com/SOF'],['LoungeReview: Sofia Lounge','https://loungereview.com/lounges/sofia-lounge-sof/']],
    note:'The building outline and toilets come from OpenStreetMap. Neither OpenStreetMap nor any guide lists Terminal 1 gate numbers, only “opposite gate 1” for the lounge, so gates 1–7 are placeholders along the apron side. Terminal 1 has no air bridges. Where airside ends is a best guess. Places come from the guides listed (checked 7 November 2026) and are placed from their descriptions. Outside: where to drop off and pick up isn’t published, so that pin is a guess.',
    pois:[
      T('s1sec','Security','security','S',0,-8,'Between check-in and departures','','eb'),
      T('s1df','Sofia Duty Free','shop','S',14,-16,'Walk-through store after security, about 1,200 m²','','mdr'),
      T('s1amo','Amo','food','S',62,-16,'Italian all-day restaurant, opened 2026','','mdr'),
      T('s1onda','Onda','coffee','S',-26,-16,'Transit zone · bakery and café','04:00 to last departure','ces'),
      T('s1relay','RELAY','shop','S',38,-10,'Transit area · newsagent','04:00–23:00','ces'),
      T('s1wine','Bulgarian wine & spirits','shop','S',-14,-8,'After security','','eb'),
      T('s1souv','Souvenir shop','shop','S',88,-12,'After security','','eb'),
      T('s1bar1','Snack bar','bar','S',-60,-10,'After security · sandwiches and snacks','','eb'),
      T('s1bar2','Snack bar','bar','S',112,-10,'After security · sandwiches and snacks','','eb'),
      T('s1lounge','Sofia Lounge','lounge','S',-45,-16,'Level 2, opposite gate 1, left after passport control','Sources disagree on whether it is still open','sia'),
      T('s1nurse','Nursing room','service','S',-95,-9,'Airside','','sia'),
      T('s1costa','Costa Coffee','coffee','L',-60,12,'Public area, before security','05:00–23:00','ces'),
      T('s1post','Post office','service','L',40,16,'Departures, before security','','sia'),
      T('s1wrap','Luggage wrapping','service','L',72,14,'Departures, before security','','sia'),
      T('s1atm','Postbank ATM','service','L',-95,9,'Public area · no fee','','ces'),
      T('s1rent','Car rental desks','service','L',-20,24,'Arrivals · Top Rent-A-Car, Europcar, Choice, Easyrent, SurPrice','','eb'),
      T('s1bus','Bus stop · 84, 184','transit','L',-80,52,'In front of the terminal','No night buses','eb'),
      T('s1shuttle','Free shuttle to Terminal 2 and metro','transit','L',-40,50,'In front of the terminal · about 5 min to T2, where the metro is','Every 15 min, 05:00–23:00','eb'),
      T('s1drop','Drop-off and pick-up','car','L',30,46,'Kerb in front of the terminal · rules and fees aren’t published online, check on site','','eb'),
      T('s1taxi','Taxi stand (Yellow!)','taxi','L',80,42,'Outside the terminal','Licensed airport taxi since 2023','eb'),
      T('s1park','Car park (outdoor)','parking','L',112,48,'Across the forecourt road · about 400 spaces','Paid, 24/7','eb')
    ].concat(osmToilets('SOF1'))};
})();

/* Amsterdam Schiphol: one terminal. Departure halls 1–3 along the south-west front lead through security to
   Lounges 1–3 and the piers B, C, D, E, F, G and H/M. North is up. */
AIRPORTS.AMS=(function(){
  var O=OUTLINES.AMS;
  return {key:'AMS',geo:O.geo,code:'AMS',city:'Amsterdam',name:'Amsterdam Schiphol',term:'Lounges 1–3',short:'Schiphol',lat:52.3105,lon:4.7683,carriers:null,
    start:'amsec1',gateHint:'Schiphol gates run from piers B, C, D, E, F, G, H and M, for example D7.',gateCall:'Schiphol usually shows it about an hour before departure.',
    sample:{carrier:'KL',num:'1999',to:'SOF',gate:'D7',seat:'21F'},
    areas:O.areas,
    bnames:{M:'Airside',L:'Departure halls, before security'},
    joins:[{a:[4,28,'L'],b:[20,10,'M'],c:150},{a:[-63,-32,'L'],b:[-47,-50,'M'],c:150},{a:[-131,-92,'L'],b:[-115,-110,'M'],c:150}],
    secs:[[0,8,26,12],[-67,-52,26,12],[-135,-112,26,12]],
    labels:[{t:'LOUNGE 1',x:72,y:-40,area:1},{t:'LOUNGE 2',x:-20,y:-110,area:1},{t:'LOUNGE 3',x:-170,y:-170,area:1},{t:'HOLLAND BOULEVARD',x:-40,y:-200,small:1},
      {t:'Pier B',x:-90,y:540,small:1},{t:'Pier C',x:150,y:330,small:1},{t:'Pier D',x:330,y:100,small:1},{t:'Pier E',x:240,y:-300,small:1},{t:'Pier F',x:-155,y:-330,small:1},{t:'Pier G',x:-480,y:-330,small:1},{t:'Pier H/M',x:-560,y:-70,small:1},
      {t:'HALL 1',x:-10,y:80,area:1},{t:'HALL 2',x:-90,y:-5,area:1},{t:'HALL 3',x:-190,y:-75,area:1},{t:'Railway station below Schiphol Plaza',x:-150,y:110,small:1}],
    bigLabels:[['Schiphol Plaza',-110,150]],
    gates:osmGates('AMS',function(g){return g.type==='bus';}),
    sources:[OSM_SRC,['Sleeping in Airports: Amsterdam guide','https://www.sleepinginairports.net/guides/amsterdam-airport-guide.htm'],['Wikipedia: Amsterdam Airport Schiphol','https://en.wikipedia.org/wiki/Amsterdam_Airport_Schiphol'],['Schiphol: shopping','https://www.schiphol.nl/en/at-schiphol/'],['Wikipedia: Schiphol Airport station','https://en.wikipedia.org/wiki/Schiphol_Airport_railway_station']],
    note:'The building outline, about 130 gates and the toilets come from OpenStreetMap. Where the departure halls end and airside begins is a best guess, drawn as a band along the front of the building. Places and hours come from the guides listed (checked 7 November 2026) and are placed from their descriptions. Car parks and the drop-off and pick-up zones aren’t mapped yet. Sources disagree on whether Piers D and M are Schengen. The plan shows one floor; levels are in each place’s description.',
    pois:[
      T('amsec1','Security, Hall 1','security','M',20,10,'From Departure Hall 1 (mainly Schengen)','','wiki'),
      T('amsec2','Security, Hall 2','security','M',-47,-50,'From Departure Hall 2','','wiki'),
      T('amsec3','Security, Hall 3','security','M',-115,-110,'From Departure Hall 3','','wiki'),
      T('amcrown1','KLM Crown Lounge','lounge','M',78,8,'Lounge 1, Schengen, 2nd floor, opposite Pier D','04:45–22:00 · showers','sia'),
      T('amasp1','Aspire Lounge 26','lounge','M',96,30,'Lounge 1, Schengen, level 3, opposite Pier D','06:00–21:00','sia'),
      T('ampriv','Privium Express Lounge','lounge','M',112,52,'Lounge 1, Schengen, 2nd floor, start of Pier D','05:30–21:00','sia'),
      T('ammed','The Med','food','M',48,14,'Lounge 1','24 hours','sia'),
      T('ampark','Park Café','coffee','M',70,-16,'Lounge 1','24 hours','sia'),
      T('amsb1','Starbucks','coffee','M',40,-8,'Lounge 1','24 hours','sia'),
      T('amharvest','Harvest Market','food','M',200,62,'Pier D','24 hours','sia'),
      T('amgrab','Grab&Fly','food','M',262,66,'Pier D','24 hours','sia'),
      T('amxspa','XpresSpa','service','M',335,66,'Pier D, towards D1–D57 · sleep pods','07:00–21:00','sia'),
      T('ambread','Amsterdam Bread Company','coffee','M',-22,-62,'Lounge 2','24 hours','sia'),
      T('amyotel','YOTELAIR','service','M',8,-40,'Lounge 2, towards Pier D · day rooms','From €55 for 4 h','sia'),
      T('amasp2','Aspire Lounge 41','lounge','M',-30,-96,'Lounge 2, non-Schengen, 3rd floor, between D and E','06:00–21:00','sia'),
      T('amow','oneworld Lounge','lounge','M',-52,-122,'Lounge 2, non-Schengen, 3rd floor, between D and E','05:30–22:00 · premium and elite only','sia'),
      T('ammed2','Meditation centre','service','M',58,-150,'Lounge 2, near Pier E','','sia'),
      T('amnemo','NEMO Science Museum','service','M',-20,-188,'Holland Boulevard · small kids exhibit','24 hours','sia'),
      T('amrijks','Rijksmuseum gallery','service','M',-60,-210,'Holland Boulevard, between Piers E and F (sources disagree if it still runs)','','sia'),
      T('ambaby','Baby Care Lounge','service','M',-100,-168,'Holland Boulevard, between Lounges 2 and 3','','sia'),
      T('amlib','Airport Library','service','M',-132,-182,'Between Lounges 2 and 3','','sia'),
      T('amcrown3','KLM Crown Lounge','lounge','M',-150,-230,'Lounge 3, non-Schengen, 2nd floor, near Pier F','04:45–22:00 · sleep rooms','sia'),
      T('ammerc','Mercure showers','service','M',-182,-208,'Lounge 3 upper level, opposite the KLM Crown Lounge','About €25','sia'),
      T('amstar','Star Alliance Lounge','lounge','M',-268,-205,'Lounge 3, near Pier H, 3rd floor','05:30–21:00','sia'),
      T('ambulg','Bvlgari','shop','M',58,-34,'After security','','sch'),
      T('amvs','Victoria’s Secret','shop','M',-10,-26,'Before and after security','','sch'),
      T('amde','Douwe Egberts Coffee Bar','coffee','L',-170,-95,'Departure Hall 3, before security','24 hours','sia'),
      T('amprivcl','Privium ClubLounge','lounge','L',-32,20,'Between Halls 1 and 2, near check-in row 9','05:30–21:00','sia'),
      T('amstn','Schiphol station','transit','L',-42,72,'Level −1, beneath Schiphol Plaza · escalators and lifts from the Plaza','Amsterdam Centraal 15–20 min, every 10–15 min; hourly at night','sia'),
      T('amrent','Car rental desks','service','L',-12,92,'Schiphol Plaza, behind Arrivals 3 · Avis, Budget, Enterprise, Europcar, Hertz, Sixt','','sia'),
      T('ambus','Bus station · Schiphol Plaza','transit','L',-150,63,'In front of the terminal · many lines, plus night buses N30, N70, N90, N97','','wiki'),
      T('amtaxi','Taxi rank','taxi','L',-80,126,'In front of Schiphol Plaza, Arrivals level 0','€45–60 to the centre, 15–25 min','sia')
    ].concat(osmToilets('AMS'))};
})();
var AIRPORT_LIST=['SOF2','SOF1','LHR5','AMS'];
function apFor(t){if(!t)return null;var c=AIRPORT_LIST.map(function(k){return AIRPORTS[k];}).filter(function(a){return a.code===t.from;});
  return c.find(function(a){return a.carriers&&a.carriers.indexOf(t.carrier)>=0;})||c.find(function(a){return !a.carriers;})||null;}

