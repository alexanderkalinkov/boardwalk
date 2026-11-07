/* Boardwalk airport data. Each airport is a schematic map in metres plus places from published guides. */
'use strict';
/* ---------- shared categories ---------- */
var WALK=1.3; // metres per second
var CAT={
  food:{label:'Food',color:'--c-food',dwell:25},
  coffee:{label:'Coffee',color:'--c-coffee',dwell:8},
  bar:{label:'Bars',color:'--c-bar',dwell:20},
  shop:{label:'Shops',color:'--c-shop',dwell:12},
  lounge:{label:'Lounges',color:'--c-lounge',dwell:30},
  service:{label:'Services',color:'--c-service',dwell:3},
  security:{label:'Security',color:'--c-security',dwell:0},
  mine:{label:'Added by you',color:'--c-mine',dwell:10}
};
var ICON={
  food:'M-3-5v4a2 2 0 0 0 4 0v-4M-1-5v10M4-5c-1.5 1-2 3-2 5h2v5',
  coffee:'M-5-2h8v3a4 4 0 0 1-4 4h0a4 4 0 0 1-4-4zM3-1h1.5a1.8 1.8 0 0 1 0 3.6H3',
  bar:'M-4.5-5h9l-4.5 5zM0 0v5M-3 5h6',
  shop:'M-4.5-2h9l-1 7h-7zM-2-2v-1.5a2 2 0 0 1 4 0V-2',
  lounge:'M-5 1v-3a2 2 0 0 1 4 0v1h2v-1a2 2 0 0 1 4 0v3M-5 1h10v3M-5 4v1.5M5 4v1.5',
  service:'M0-1v5M0-4.5v.2',
  security:'M0-5.5l4.5 1.8v3.2c0 2.7-2 4.8-4.5 5.4-2.5-.6-4.5-2.7-4.5-5.4v-3.2z',
  mine:'M-4 0h8M0-4v8'
};

/* ---------- airports ----------
   Map units are metres in a schematic frame per terminal. Each airport lists:
   areas (walkable rects; same b = connected), joins (links between areas, e.g. security or a train),
   gates (sd = side the aircraft parks on: T/D/L/R; bus = bus gate), pois, labels and sources. */
var AIRPORTS={};
function T(id,n,c,b,x,y,loc,h,s){return {id:id,n:n,c:c,b:b,x:x,y:y,loc:loc,h:h||'',s:s};}

/* Heathrow Terminal 5: T5A at the bottom, T5B above it, T5C at the top, joined by the underground transit train. */
AIRPORTS.LHR5=(function(){
  var g=[],i;
  [[1,0,700],[2,0,670],[3,0,640],[4,0,610]].forEach(function(a){g.push({id:'A'+a[0],b:'A',x:a[1],y:a[2],sd:'L'});});
  for(i=5;i<=19;i++) g.push({id:'A'+i,b:'A',x:Math.round(20+(i-5)*25.7),y:560,sd:'T'});
  [[20,400,610],[21,400,640],[22,400,670],[23,400,700]].forEach(function(a){g.push({id:'A'+a[0],b:'A',x:a[1],y:a[2],sd:'R'});});
  for(i=32;i<=48;i++){var even=i%2===0;g.push({id:'B'+i,b:'B',x:even?(i-32)/2*50:25+(i-33)/2*50,y:even?330:280,sd:even?'D':'T'});}
  for(i=52;i<=66;i++){var ev=i%2===0;g.push({id:'C'+i,b:'C',x:ev?60+(i-52)/2*40:80+(i-53)/2*40,y:ev?50:0,sd:ev?'D':'T'});}
  return {key:'LHR5',geo:{lat:51.4723,lon:-0.4880,x:200,y:640,rot:270},code:'LHR',city:'London',name:'London Heathrow',term:'Terminal 5',short:'T5',lat:51.4720,lon:-0.4887,carriers:['BA','IB'],
    start:'secN',gateHint:'Terminal 5 gates run A1–A23, B32–B48 and C52–C66.',gateCall:'Heathrow usually shows it about an hour before departure.',
    sample:{carrier:'BA',num:'890',to:'SOF',gate:'B42',seat:'14A'},
    areas:[{b:'A',name:'T5A',x:0,y:560,w:400,h:160,r:22},{b:'B',name:'T5B',x:-20,y:280,w:440,h:50,r:18},{b:'C',name:'T5C',x:50,y:0,w:300,h:50,r:18}],
    bnames:{A:'T5A main building',B:'T5B, by transit train',C:'T5C, by transit train'},
    joins:[{a:[200,640,'A'],b:[200,305,'B'],c:240,t:1},{a:[200,305,'B'],b:[200,25,'C'],c:120,t:1}],
    transitLines:[[200,25,200,640]],
    secs:[[42,700,96,16],[272,700,96,16]],
    labels:[{t:'DEPARTURES LOUNGE',x:200,y:654,area:1},{t:'Transit train (underground)',x:208,y:420,small:1}],
    bigLabels:[['Terminal 5A',200,748],['Terminal 5B',200,374],['Terminal 5C',200,-62]],
    apron:[[-140,-110,680,900],[-140,790,680,110]],
    taxi:[[-140,165,540,165],[-140,445,540,445],[-80,-80,480,-80],[-110,-110,-110,790],[510,-110,510,790]],
    gates:g,
    sources:[['British Airways: Heathrow T5','https://www.britishairways.com/content/en/us/information/airport-information/london-heathrow-airport/heathrow-t5'],['Upgraded Points: Heathrow terminal guide','https://upgradedpoints.com/travel/airports/london-heathrow-airport-lhr-terminal-guide/'],['Heathrow T5 food guide','https://heathrowairport-info.co.uk/heathrow-food-terminal-5'],['Heathrow Terminal 5 guide','https://heathrowairport-info.co.uk/terminal-5'],['The Points Analyst: Heathrow T5','https://www.thepointsanalyst.com/heathrow-terminal-5/']],
    note:'Gates, places and opening hours come from published guides (checked 7 November 2026). The building shapes and positions are a rough schematic.',
    pois:[
 {id:'secN',n:'North Security',c:'security',b:'A',x:80,y:712,loc:'T5A, north end of the security hall',h:'',s:'ba'},
 {id:'secS',n:'South Security',c:'security',b:'A',x:320,y:712,loc:'T5A, south end; Fast Track is to the left of North Security',h:'Fast Track 06:00–21:00',s:'ba'},
 {id:'plane',n:'Gordon Ramsay Plane Food Market',c:'food',b:'A',x:140,y:612,loc:'Upstairs in the main T5A building',h:'05:00–21:30',s:'hf'},
 {id:'pilots',n:'Pilots Bar & Kitchen',c:'bar',b:'A',x:300,y:592,loc:'Upper level, on the A-gates side',h:'',s:'hf'},
 {id:'giraffe',n:'Giraffe',c:'food',b:'A',x:100,y:646,loc:'Upper level of the main departures lounge',h:'About 05:30–21:30',s:'hf'},
 {id:'waga',n:'wagamama',c:'food',b:'A',x:236,y:590,loc:'Level 2, near the A gates',h:'Breakfast from 05:30',s:'hf'},
 {id:'fortnum',n:'Fortnum & Mason Bar',c:'bar',b:'A',x:330,y:604,loc:'Opposite the Fortnum store, near gate A17',h:'05:30–22:00',s:'hf'},
 {id:'curator',n:'The Curator',c:'bar',b:'A',x:200,y:684,loc:'Main T5A departures lounge',h:'',s:'hf'},
 {id:'crown',n:'The Crown Rivers (Wetherspoon)',c:'bar',b:'A',x:28,y:592,loc:'Near gate A5',h:'04:45–21:00',s:'hf'},
 {id:'fiveguys',n:'Five Guys',c:'food',b:'A',x:160,y:684,loc:'Upper level of the main T5A airside building',h:'05:00–22:00',s:'hf'},
 {id:'itsu',n:'itsu',c:'food',b:'A',x:278,y:596,loc:'By gate A15',h:'',s:'hf'},
 {id:'joe',n:'Joe & The Juice',c:'coffee',b:'A',x:262,y:652,loc:'Airside in the main T5A building',h:'',s:'hf'},
 {id:'pret',n:'Pret A Manger',c:'coffee',b:'A',x:130,y:700,loc:'Airside in the main building',h:'',s:'hf'},
 {id:'sbA',n:'Starbucks',c:'coffee',b:'A',x:282,y:694,loc:'Airside, main T5A building',h:'',s:'hf'},
 {id:'nero',n:'Caffè Nero',c:'coffee',b:'A',x:58,y:652,loc:'Airside, T5A',h:'',s:'hf'},
 {id:'costa',n:'Costa Coffee',c:'coffee',b:'A',x:342,y:660,loc:'Airside, T5A',h:'',s:'hf'},
 {id:'plaza',n:'Plaza Premium Lounge',c:'lounge',b:'A',x:52,y:604,loc:'Near gate A6',h:'04:45–21:30 · paid entry',s:'ug'},
 {id:'aspire',n:'Club Aspire Lounge',c:'lounge',b:'A',x:356,y:608,loc:'Near gate A18',h:'05:00–21:00 · paid entry',s:'ug'},
 {id:'galN',n:'Galleries Club Lounge North',c:'lounge',b:'A',x:30,y:676,loc:'T5A North',h:'05:00–22:30',s:'ba'},
 {id:'galS',n:'Galleries Club Lounge South',c:'lounge',b:'A',x:372,y:676,loc:'T5A South',h:'05:00–22:30',s:'ba'},
 {id:'galF',n:'Galleries First',c:'lounge',b:'A',x:370,y:704,loc:'T5A South',h:'05:00–22:30',s:'ba'},
 {id:'concorde',n:'Concorde Room',c:'lounge',b:'A',x:340,y:706,loc:'T5A South, First passengers only',h:'05:00–22:30',s:'ba'},
 {id:'help',n:'Help point',c:'service',b:'A',x:386,y:616,loc:'Opposite gates A20 and A21',h:'',s:'ba'},
 {id:'pw4',n:'Charging point',c:'service',b:'A',x:16,y:618,loc:'Near gate A4',h:'',s:'ug'},
 {id:'pw9',n:'Charging point',c:'service',b:'A',x:124,y:578,loc:'Near gate A9',h:'',s:'ug'},
 {id:'pw18',n:'Charging point',c:'service',b:'A',x:350,y:580,loc:'Near gate A18',h:'',s:'ug'},
 {id:'atm10',n:'ATM and currency exchange',c:'service',b:'A',x:150,y:578,loc:'Near gate A10',h:'',s:'ug'},
 {id:'atm15',n:'ATM and currency exchange',c:'service',b:'A',x:262,y:578,loc:'Near gate A15',h:'',s:'ug'},
 {id:'play',n:'Children’s play area',c:'service',b:'A',x:16,y:690,loc:'Near gate A2',h:'',s:'ug'},
 {id:'pray',n:'Prayer room',c:'service',b:'A',x:52,y:704,loc:'North end of the departures level',h:'',s:'ug'},
 {id:'sbB',n:'Starbucks',c:'coffee',b:'B',x:150,y:305,loc:'T5B, B gates',h:'',s:'hf'},
 {id:'wexp',n:'Wetherspoon Express',c:'bar',b:'B',x:250,y:305,loc:'T5B',h:'About 05:30 to the last departure',s:'hf'},
 {id:'galB',n:'Galleries Club Lounge T5B',c:'lounge',b:'B',x:100,y:318,loc:'T5B, near gate B36',h:'05:30–22:30',s:'ba'},
 {id:'sbC',n:'Starbucks',c:'coffee',b:'C',x:250,y:25,loc:'T5C, C gates',h:'',s:'hf'}
]};
})();

/* Sofia Terminal 2: landside check-in hall at the bottom, security in the middle, the airside departures level above with the gates along the apron. */
AIRPORTS.SOF2=(function(){
  var g=[];
  g.push({id:'A1',b:'S',x:0,y:250,sd:'L'});
  var bl=['B1','B2','B3','B4','B5','B6','B6A','B7','B8','B9','B11','B12','B13','B14'];
  bl.forEach(function(id,i){var bridge=['B5','B6','B7','B8','B9'].indexOf(id)>=0;g.push({id:id,b:'S',x:Math.round(24+i*24.3),y:190,sd:'T',bus:!bridge});});
  g.push({id:'C1',b:'S',x:380,y:230,sd:'R'});
  g.push({id:'D1',b:'S',x:380,y:275,sd:'R',bus:true});
  return {key:'SOF2',geo:{lat:42.6883,lon:23.4144,x:190,y:300,rot:0},code:'SOF',city:'Sofia',name:'Sofia Airport',term:'Terminal 2',short:'T2',lat:42.6883,lon:23.4144,carriers:null,
    start:'s2sec',gateHint:'Terminal 2 gates are A1, B1–B14 (with B6A), C1 and D1.',gateCall:'Sofia usually shows it on the screens about an hour before departure.',
    sample:{carrier:'BA',num:'891',to:'LHR',gate:'B7',seat:'14A'},
    areas:[{b:'S',name:'Airside',x:0,y:190,w:380,h:110,r:18},{b:'L',name:'Landside',x:30,y:320,w:320,h:90,r:14}],
    bnames:{S:'T2 departures, airside',L:'T2 check-in hall, before security'},
    joins:[{a:[190,314,'L'],b:[190,296,'S'],c:120}],
    secs:[[130,302,120,16]],
    labels:[{t:'DEPARTURES · AIRSIDE',x:190,y:262,area:1},{t:'CHECK-IN · 38 DESKS',x:190,y:380,area:1},{t:'Metro station (east side)',x:350,y:430,small:1}],
    bigLabels:[['Terminal 2',190,455]],
    gates:g,
    sources:[['Sleeping in Airports: Sofia guide','https://www.sleepinginairports.net/guides/sofia-airport-guide.htm'],['Exciting Bulgaria: Sofia Airport','https://excitingbulgaria.com/sofia-airport/'],['Cestee: services at Sofia Airport','https://www.cestee.com/airport/sofia-sof/services'],['VisaVerge: new dining at Terminal 2 (2025)','https://www.visaverge.com/news/sofia-airport-launches-new-dining-outlets-at-terminal-2/'],['Moodie Davitt: Sofia duty free (2026)','https://moodiedavittreport.com/sofia-airport-chief-shares-vision-as-avolta-reveals-duty-free-store-and-italian-dining-concept/'],['FlightQueue: Sofia gates','https://flightqueue.com/sofia-airport-terminal-map'],['Wikipedia: Sofia Airport','https://en.wikipedia.org/wiki/Sofia_Airport']],
    note:'Gate names come from FlightQueue; Wikipedia lists the air bridges as A1, B5–B9 and C1, so the rest are drawn as bus gates. Places come from the guides listed (checked 7 November 2026). The official airport site could not be read, so the floor plan is a rough schematic to check in person.',
    pois:[
      T('s2sec','Security','security','S',190,296,'Between the check-in hall and departures','','sia'),
      T('s2df','Sofia Duty Free','shop','S',190,280,'Walk-through store right after security, about 2,000 m²','','mdr'),
      T('s2sb','Starbucks','coffee','S',110,232,'Dining zone, airside','','vv'),
      T('s2camden','Camden Food Co.','food','S',150,222,'Dining zone, airside','','vv'),
      T('s2air','Air Craft','coffee','S',230,232,'Transit area · sandwiches and coffee','05:00–23:00','ces'),
      T('s2eddy','Eddy’s Bakery & Deli','coffee','S',270,222,'Transit area · bagels and coffee','04:00–23:00','ces'),
      T('s2garden','Air Garden','bar','S',310,240,'Transit zone · snacks and drinks','By flight schedule','ces'),
      T('s2bistro','Bistro','food','S',70,250,'Transit zone','','ces'),
      T('s2relay','RELAY','shop','S',250,272,'Transit zone · newsagent','04:00 to last departure','ces'),
      T('s2preslav','Preslav Lounge','lounge','S',40,280,'Level 0, below passport control · has the only smoking room airside','By flight schedule · €18 for 3 h','eb'),
      T('s2pliska','Pliska Lounge','lounge','S',90,280,'Level +1, right after passport control','08:00–23:00 · €14.40 for 3 h','eb'),
      T('s2vitosha','Vitosha Aspire Lounge','lounge','S',140,262,'Level 1, airside','Pass or membership','sia'),
      T('s2pray','Prayer room','service','S',350,232,'Level 1, opposite gate C1','','sia'),
      T('s2play','Children’s play area','service','S',320,272,'First floor, transit hall','','wtg'),
      T('s2ice','ICE Exchange','service','S',20,226,'Level 1 · currency exchange','','sia'),
      T('s2water','Water refill','service','S',350,268,'Near the restrooms (traveller report)','','sia'),
      T('s2costa','Costa Coffee','coffee','L',90,345,'Public area, before security','05:00–23:00','ces'),
      T('s2pharm','Pharmacy','service','L',300,345,'Public area, before security','08:30–19:30','ces'),
      T('s2post','Post office','service','L',60,390,'Departures, before security','','sia'),
      T('s2wrap','Luggage wrapping','service','L',120,395,'Departures, before security','','sia'),
      T('s2atm','ATMs','service','L',320,395,'Public area · Postbank has no fee','','ces')
    ]};
})();

/* Sofia Terminal 1: the older building used mainly by Wizz Air. Bus gates only. */
AIRPORTS.SOF1=(function(){
  var g=[],i;
  for(i=1;i<=7;i++)g.push({id:String(i),b:'S',x:Math.round(20+(i-1)*33),y:120,sd:'T',bus:true});
  return {key:'SOF1',geo:{lat:42.6952,lon:23.3984,x:120,y:210,rot:0},code:'SOF',city:'Sofia',name:'Sofia Airport',term:'Terminal 1',short:'T1',lat:42.6952,lon:23.3984,carriers:['W6','W4','U2','5W'],
    start:'s1sec',gateHint:'This sketch shows gates 1–7.',gateCall:'Sofia usually shows it on the screens about an hour before departure.',
    sample:{carrier:'W6',num:'4301',to:'LTN',gate:'3',seat:'7C'},
    areas:[{b:'S',name:'Airside',x:0,y:120,w:240,h:90,r:16},{b:'L',name:'Landside',x:20,y:230,w:200,h:70,r:12}],
    bnames:{S:'T1 departures, airside',L:'T1 check-in hall, before security'},
    joins:[{a:[120,224,'L'],b:[120,206,'S'],c:120}],
    secs:[[70,212,100,16]],
    labels:[{t:'DEPARTURES · BUS GATES',x:120,y:178,area:1},{t:'CHECK-IN',x:120,y:280,area:1},{t:'Free shuttle to T2 every 15 min',x:120,y:330,small:1}],
    bigLabels:[['Terminal 1',120,352]],
    gates:g,
    sources:[['Exciting Bulgaria: Sofia Airport','https://excitingbulgaria.com/sofia-airport/'],['Sleeping in Airports: Sofia guide','https://www.sleepinginairports.net/guides/sofia-airport-guide.htm'],['Cestee: services at Sofia Airport','https://www.cestee.com/airport/sofia-sof/services'],['Moodie Davitt: Sofia duty free and Amo (2026)','https://moodiedavittreport.com/sofia-airport-chief-shares-vision-as-avolta-reveals-duty-free-store-and-italian-dining-concept/'],['AirportMaps: Sofia terminals','https://airportmaps.com/SOF'],['LoungeReview: Sofia Lounge','https://loungereview.com/lounges/sofia-lounge-sof/']],
    note:'No public source lists Terminal 1 gate numbers, only “opposite gate 1” for the lounge, so gates 1–7 are placeholders. Terminal 1 has no air bridges. Places come from the guides listed (checked 7 November 2026). The floor plan is a rough schematic to check in person.',
    pois:[
      T('s1sec','Security','security','S',120,206,'Between check-in and departures','','eb'),
      T('s1df','Sofia Duty Free','shop','S',120,192,'Walk-through store after security, about 1,200 m²','','mdr'),
      T('s1amo','Amo','food','S',180,150,'Italian all-day restaurant, opened 2026','','mdr'),
      T('s1onda','Onda','coffee','S',90,150,'Transit zone · bakery and café','04:00 to last departure','ces'),
      T('s1relay','RELAY','shop','S',150,170,'Transit area · newsagent','04:00–23:00','ces'),
      T('s1wine','Bulgarian wine & spirits','shop','S',60,180,'After security','','eb'),
      T('s1souv','Souvenir shop','shop','S',200,182,'After security','','eb'),
      T('s1bar1','Snack bar','bar','S',130,140,'After security · sandwiches and snacks','','eb'),
      T('s1bar2','Snack bar','bar','S',215,150,'After security · sandwiches and snacks','','eb'),
      T('s1lounge','Sofia Lounge','lounge','S',22,150,'Level 2, opposite gate 1, left after passport control','Sources disagree on whether it is still open','sia'),
      T('s1nurse','Nursing room','service','S',40,190,'Airside','','sia'),
      T('s1costa','Costa Coffee','coffee','L',60,255,'Public area, before security','05:00–23:00','ces'),
      T('s1post','Post office','service','L',170,255,'Departures, before security','','sia'),
      T('s1wrap','Luggage wrapping','service','L',190,280,'Departures, before security','','sia'),
      T('s1atm','Postbank ATM','service','L',40,282,'Public area · no fee','','ces')
    ]};
})();

/* Amsterdam Schiphol: one terminal. Departure halls 1–3 (landside) lead through security to Lounges 1–3 and the piers. Only Pier D's first gates are drawn. */
AIRPORTS.AMS=(function(){
  var g=[],i;
  for(i=1;i<=16;i++){var odd=i%2===1,row=Math.floor((i-1)/2);g.push({id:'D'+i,b:'M',x:odd?350:410,y:280-row*30,sd:odd?'L':'R'});}
  var piers=[['B',555,40,150],['C',485,40,170],['E',270,40,190],['F',190,40,170],['G',110,40,170],['H',30,40,120]];
  var areas=[{b:'M',name:'Lounges',x:0,y:300,w:620,h:60,r:14},{b:'M',name:'Pier D',x:350,y:30,w:60,h:280,r:12}];
  piers.forEach(function(p){areas.push({b:'M',name:'Pier '+p[0],x:p[1]-p[2]/2,y:300-p[3],w:p[2],h:p[3]+10,r:12,planes:'LR'});});
  areas.push({b:'L',name:'Departure halls',x:40,y:380,w:540,h:56,r:12});
  return {key:'AMS',geo:{lat:52.3105,lon:4.7633,x:310,y:330,rot:320},code:'AMS',city:'Amsterdam',name:'Amsterdam Schiphol',term:'Lounges 1–3',short:'Schiphol',lat:52.3105,lon:4.7683,carriers:null,
    start:'amsec1',gateHint:'This prototype maps gates D1–D16 only.',gateCall:'Schiphol usually shows it about an hour before departure.',
    sample:{carrier:'KL',num:'1999',to:'SOF',gate:'D7',seat:'21F'},
    areas:areas,
    bnames:{M:'Airside',L:'Departure halls, before security'},
    joins:[{a:[470,374,'L'],b:[470,356,'M'],c:150},{a:[300,374,'L'],b:[300,356,'M'],c:150},{a:[130,374,'L'],b:[130,356,'M'],c:150}],
    secs:[[430,362,80,14],[260,362,80,14],[90,362,80,14]],
    labels:[{t:'LOUNGE 1 · SCHENGEN',x:520,y:334,area:1},{t:'LOUNGE 2',x:300,y:334,area:1},{t:'LOUNGE 3',x:110,y:334,area:1},{t:'Passport control',x:430,y:296,small:1},
      {t:'Pier B',x:555,y:140,small:1},{t:'Pier C',x:485,y:120,small:1},{t:'Pier E',x:270,y:100,small:1},{t:'Pier F',x:190,y:120,small:1},{t:'Pier G',x:110,y:120,small:1},{t:'Pier H/M',x:30,y:170,small:1},
      {t:'HALL 1',x:470,y:420,area:1},{t:'HALL 2',x:300,y:420,area:1},{t:'HALL 3',x:130,y:420,area:1}],
    bigLabels:[['Schiphol',310,470]],
    gates:g,
    sources:[['Sleeping in Airports: Amsterdam guide','https://www.sleepinginairports.net/guides/amsterdam-airport-guide.htm'],['Wikipedia: Amsterdam Airport Schiphol','https://en.wikipedia.org/wiki/Amsterdam_Airport_Schiphol'],['Schiphol: shopping','https://www.schiphol.nl/en/at-schiphol/']],
    note:'Places and hours come from the guides listed (checked 7 November 2026). Sources disagree on whether Piers D and M are Schengen. Only gates D1–D16 are drawn, and the other piers are outlines. Rough schematic.',
    pois:[
      T('amsec1','Security, Hall 1','security','M',470,356,'From Departure Hall 1 (mainly Schengen)','','wiki'),
      T('amsec2','Security, Hall 2','security','M',300,356,'From Departure Hall 2','','wiki'),
      T('amsec3','Security, Hall 3','security','M',130,356,'From Departure Hall 3','','wiki'),
      T('amcrown1','KLM Crown Lounge','lounge','M',430,318,'Lounge 1, Schengen, 2nd floor, opposite Pier D','04:45–22:00 · showers','sia'),
      T('amasp1','Aspire Lounge 26','lounge','M',470,340,'Lounge 1, Schengen, level 3, opposite Pier D','06:00–21:00','sia'),
      T('ampriv','Privium Express Lounge','lounge','M',380,320,'Lounge 1, Schengen, 2nd floor, start of Pier D','05:30–21:00','sia'),
      T('ammed','The Med','food','M',560,320,'Lounge 1','24 hours','sia'),
      T('ampark','Park Café','coffee','M',600,340,'Lounge 1','24 hours','sia'),
      T('amsb1','Starbucks','coffee','M',510,318,'Lounge 1','24 hours','sia'),
      T('amharvest','Harvest Market','food','M',380,180,'Pier D','24 hours','sia'),
      T('amgrab','Grab&Fly','food','M',380,110,'Pier D','24 hours','sia'),
      T('amxspa','XpresSpa','service','M',380,60,'Pier D, towards D1–D57 · sleep pods','07:00–21:00','sia'),
      T('ambread','Amsterdam Bread Company','coffee','M',320,320,'Lounge 2','24 hours','sia'),
      T('amyotel','YOTELAIR','service','M',340,340,'Lounge 2, near Pier D · day rooms','From €55 for 4 h','sia'),
      T('amasp2','Aspire Lounge 41','lounge','M',290,342,'Lounge 2, non-Schengen, 3rd floor, between D and E','06:00–21:00','sia'),
      T('amow','oneworld Lounge','lounge','M',255,320,'Lounge 2, non-Schengen, 3rd floor, between D and E','05:30–22:00 · premium and elite only','sia'),
      T('ammed2','Meditation centre','service','M',240,342,'Lounge 2, near Pier E','','sia'),
      T('amnemo','NEMO Science Museum','service','M',210,318,'Holland Boulevard · small kids exhibit','24 hours','sia'),
      T('amrijks','Rijksmuseum gallery','service','M',230,300,'Holland Boulevard, between Piers E and F (sources disagree if it still runs)','','sia'),
      T('ambaby','Baby Care Lounge','service','M',180,342,'Holland Boulevard, between Lounges 2 and 3','','sia'),
      T('amlib','Airport Library','service','M',160,320,'Between Lounges 2 and 3','','sia'),
      T('amcrown3','KLM Crown Lounge','lounge','M',110,340,'Lounge 3, non-Schengen, 2nd floor, near Pier F','04:45–22:00 · sleep rooms','sia'),
      T('ammerc','Mercure showers','service','M',70,320,'Lounge 3 upper level, opposite the KLM Crown Lounge','About €25','sia'),
      T('amstar','Star Alliance Lounge','lounge','M',30,330,'Lounge 2/3 side, near Pier H, 3rd floor','05:30–21:00','sia'),
      T('ambulg','Bvlgari','shop','M',540,342,'After security','','sch'),
      T('amvs','Victoria’s Secret','shop','M',400,342,'Before and after security','','sch'),
      T('amde','Douwe Egberts Coffee Bar','coffee','L',130,400,'Departure Hall 3, before security','24 hours','sia'),
      T('amprivcl','Privium ClubLounge','lounge','L',390,400,'Between Halls 1 and 2, near check-in row 9','05:30–21:00','sia')
    ]};
})();
var AIRPORT_LIST=['SOF2','SOF1','LHR5','AMS'];
function apFor(t){if(!t)return null;var c=AIRPORT_LIST.map(function(k){return AIRPORTS[k];}).filter(function(a){return a.code===t.from;});
  return c.find(function(a){return a.carriers&&a.carriers.indexOf(t.carrier)>=0;})||c.find(function(a){return !a.carriers;})||null;}

