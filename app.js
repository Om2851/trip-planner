import { cloud } from './cloud.js';

var SHARE=(new URLSearchParams(location.search).get('share')||'').replace(/[^A-Za-z0-9]/g,'').slice(0,40)||null;
var LS='tripPlanner.v1', LSV=SHARE?'tripPlanner.viewShared':'tripPlanner.view';
var shareOwner='', shareGone=false, shareLoaded=false;
if(SHARE)document.documentElement.classList.add('ro');
var S={v:1,trip:{name:'Goa Trip',start:'',end:''},trains:[],stays:[],days:{},notes:'',savedAt:0};
var unsynced=false;
if(!SHARE){try{var L=JSON.parse(localStorage.getItem(LS)||'null');if(L&&L.savedAt>(S.savedAt||0)){S=L;unsynced=true;}}catch(e){}}
S.trains=S.trains||[];S.stays=S.stays||[];S.days=S.days||{};S.trip=S.trip||{name:'Goa Trip'};
var DEFSET={mode:'scooty',rent:400,fuel:2.5,cabKm:25,cabMin:200,busKm:2,busMin:10};S.settings=Object.assign({},DEFSET,S.settings||{});
var user=null, authReady=false, saving=false, timer=null, cloudErr='', pending=false;
var ui={view:'today',day:null};
try{var V=JSON.parse(localStorage.getItem(LSV)||'null');if(V)ui=Object.assign(ui,V);}catch(e){}
if(/^#(today|days|travel|stays|more)$/.test(location.hash))ui.view=location.hash.slice(1);

var PLACES=[
['North Goa','Calangute Beach',15.5439,73.7553],['North Goa','Baga Beach',15.5553,73.7517],['North Goa',"Tito's Lane, Baga",15.5530,73.7530],
['North Goa','Candolim Beach',15.5180,73.7620],['North Goa','Sinquerim Beach',15.4980,73.7680],['North Goa','Fort Aguada',15.4920,73.7735],
['North Goa','Anjuna Beach',15.5733,73.7400],['North Goa','Anjuna Flea Market (Wed)',15.5760,73.7410],['North Goa','Saturday Night Market, Arpora',15.5640,73.7650],
['North Goa','Vagator Beach',15.6000,73.7350],['North Goa','Chapora Fort',15.6060,73.7360],['North Goa','Morjim Beach',15.6290,73.7300],
['North Goa','Ashwem Beach',15.6500,73.7170],['North Goa','Mandrem Beach',15.6610,73.7120],['North Goa','Arambol Beach',15.6870,73.7040],
['North Goa','Sweet Water Lake, Arambol',15.6950,73.7020],['North Goa','Fort Tiracol',15.7180,73.6870],['North Goa','Reis Magos Fort',15.4960,73.8090],
['Panaji & Old Goa','Fontainhas (Latin Quarter)',15.4970,73.8330],['Panaji & Old Goa','Our Lady of Immaculate Conception Church',15.4986,73.8292],
['Panaji & Old Goa','Miramar Beach',15.4800,73.8070],['Panaji & Old Goa','Dona Paula Viewpoint',15.4560,73.8040],
['Panaji & Old Goa','Basilica of Bom Jesus',15.5009,73.9116],['Panaji & Old Goa','Se Cathedral',15.5036,73.9123],['Panaji & Old Goa','Church of St. Cajetan',15.5060,73.9140],
['Panaji & Old Goa','Divar Island',15.5250,73.8900],['Panaji & Old Goa','Salim Ali Bird Sanctuary, Chorao',15.5140,73.8650],
['Central Goa','Mangueshi Temple',15.4440,73.9690],['Central Goa','Shri Shanta Durga Temple',15.3990,73.9960],['Central Goa','Sahakari Spice Farm, Ponda',15.4180,74.0410],
['Central Goa','Tambdi Surla Temple',15.4400,74.2530],['Central Goa','Dudhsagar Falls',15.3144,74.3143],
['South Goa','Bogmalo Beach',15.3690,73.8340],['South Goa','Majorda Beach',15.3100,73.9000],['South Goa','Colva Beach',15.2790,73.9110],
['South Goa','Benaulim Beach',15.2510,73.9200],['South Goa','Margao Market',15.2730,73.9580],['South Goa','Cabo de Rama Fort',15.0890,73.9200],
['South Goa','Cola Beach',15.0650,73.9620],['South Goa','Agonda Beach',15.0440,73.9870],['South Goa','Butterfly Beach',15.0200,74.0050],['South Goa','Palolem Beach',15.0100,74.0230],
['Stations & airports','Madgaon Junction (MAO)',15.2687,73.9714],['Stations & airports','Thivim Station (THVM)',15.6162,73.8723],['Stations & airports','Karmali Station (KRMI)',15.4934,73.9345],
['Stations & airports','Vasco da Gama Station',15.4000,73.8150],['Stations & airports','Dabolim Airport (GOI)',15.3808,73.8314],['Stations & airports','Mopa Airport (GOX)',15.7300,73.8650]
];

function $(s){return document.querySelector(s)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function uid(){return Math.random().toString(36).slice(2,9)}
function pad(n){return(n<10?'0':'')+n}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function pd(s){var p=(s||'').split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function todayIso(){return iso(new Date())}
var WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fd(s,long){if(!s)return'';var d=pd(s);return WD[d.getDay()]+', '+d.getDate()+' '+MO[d.getMonth()]+(long?' '+d.getFullYear():'')}
function ft(t){if(!t)return'';var p=t.split(':'),h=+p[0];return(h%12||12)+':'+p[1]+(h<12?' am':' pm')}
function daysBetween(a,b){return Math.round((pd(b)-pd(a))/864e5)}
function tripDays(){var t=S.trip;if(!t.start||!t.end||t.end<t.start)return[];var out=[],d=pd(t.start),e=pd(t.end);while(d<=e&&out.length<60){out.push(iso(d));d.setDate(d.getDate()+1)}return out}
function day(date){if(!S.days[date])S.days[date]={title:'',startId:'',round:true,places:[]};return S.days[date]}
function rawLL(p){return p&&typeof p.lat==='number'&&typeof p.lng==='number'}
function inGoa(p){return p.lat>14.8&&p.lat<15.9&&p.lng>73.6&&p.lng<74.4}
function hasLL(p){return rawLL(p)&&inGoa(p)}
function parseLL(t){if(!t)return null;try{t=decodeURIComponent(t)}catch(e){}
 var approx=false,m=t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)||t.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/)||t.match(/^\s*\(?\s*(-?\d{1,2}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)\s*\)?\s*$/);
 if(!m){m=t.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);approx=!!m}
 if(!m)return null;var lat=+m[1],lng=+m[2];if(Math.abs(lat)>90||Math.abs(lng)>180)return null;
 if(lat<14.8||lat>15.9||lng<73.6||lng>74.4)approx='far';return{lat:lat,lng:lng,approx:approx}}
function llWarn(ll){if(ll&&ll.approx==='far')toast('⚠️ That location is outside Goa — please double-check it');else if(ll&&ll.approx)toast('⚠️ That link only had the map’s centre, not the exact pin — copy the coordinates instead for accuracy')}
function km(a,b){var R=6371,r=Math.PI/180,dLa=(b.lat-a.lat)*r,dLo=(b.lng-a.lng)*r,x=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLo/2)*Math.sin(dLo/2);return 2*R*Math.asin(Math.sqrt(x))}
var MODES={scooty:{label:'Rental scooty',ic:'🛵',f:1.4,speed:24,gm:'two-wheeler'},cab:{label:'Cab / taxi',ic:'🚕',f:1.4,speed:24,gm:'driving'},bus:{label:'Public transport (bus)',ic:'🚌',f:1.5,speed:15,wait:15,gm:'transit'}};
function dayMode(date){var d=S.days[date]||{};return MODES[d.mode]?d.mode:(MODES[S.settings.mode]?S.settings.mode:'scooty')}
function leg(a,b,mode){var st=km(a,b),M=MODES[mode],c=S.settings;if(st*1.3<1)return{km:st*1.3,min:Math.max(2,Math.round(st*1.3/4.5*60)),cost:0,ic:'🚶',walk:true};
 var r=st*M.f,mn=Math.max(3,Math.round(r/M.speed*60+(M.wait||0))),cost=mode==='scooty'?r*c.fuel:mode==='cab'?Math.max(c.cabMin,r*c.cabKm):Math.max(c.busMin,r*c.busKm);return{km:r,min:mn,cost:Math.round(cost),ic:M.ic}}
function legLink(a,b,mode){return'https://www.google.com/maps/dir/?api=1&origin='+llStr(a)+'&destination='+llStr(b)+'&travelmode='+(mode==='walk'?'walking':MODES[mode].gm)}
function rs(n){return'₹'+Math.round(n).toLocaleString('en-IN')}
function mins(k){return Math.max(2,Math.round(k/24*60))}
function fk(k){return(k<10?k.toFixed(1):Math.round(k))+' km'}
function fm(m){return m<60?m+' min':Math.floor(m/60)+' h '+(m%60?m%60+' min':'')}
function stayFor(date){var s=S.stays.filter(function(x){return x.checkIn&&x.checkOut&&x.checkIn<=date&&date<x.checkOut});if(s.length)return s[0];s=S.stays.filter(function(x){return x.checkOut===date});return s[0]||null}
function startOf(date){var d=S.days[date]||{};if(d.startId){var st=S.stays.filter(function(x){return x.id===d.startId})[0];if(st)return st}return stayFor(date)}
function llStr(p){return p.lat.toFixed(5)+','+p.lng.toFixed(5)}
function placeLink(p){return'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(hasLL(p)?llStr(p):p.name+' Goa')}

/* ---------- route optimisation ---------- */
function tourCost(start,seq,round){var c=0,prev=start;for(var i=0;i<seq.length;i++){if(prev)c+=km(prev,seq[i]);prev=seq[i]}if(round&&start&&seq.length)c+=km(seq[seq.length-1],start);return c}
function bestOrder(start,pts,round){
 var n=pts.length;if(n<2)return pts.slice();
 if(!start){/* no base: try every point as the first stop */var best=null,bc=1/0;for(var i=0;i<n;i++){var rest=pts.slice(0,i).concat(pts.slice(i+1));var o=[pts[i]].concat(bestOrder(pts[i],rest,false));var c=tourCost(null,o,false);if(c<bc){bc=c;best=o}}return best}
 if(n<=8){var bestS=null,bestC=1/0,used=[],cur=[];
  (function dfs(prev,cost){if(cost>=bestC)return;if(cur.length===n){var t=cost+(round?km(prev,start):0);if(t<bestC){bestC=t;bestS=cur.slice()}return}
   for(var i=0;i<n;i++){if(used[i])continue;used[i]=1;cur.push(pts[i]);dfs(pts[i],cost+km(prev,pts[i]));cur.pop();used[i]=0}})(start,0);return bestS}
 var left=pts.slice(),o2=[],p=start;while(left.length){var bi=0,bd=1/0;for(var j=0;j<left.length;j++){var d=km(p,left[j]);if(d<bd){bd=d;bi=j}}p=left.splice(bi,1)[0];o2.push(p)}
 var improved=true,guard=0;while(improved&&guard++<200){improved=false;for(var a=0;a<n-1;a++)for(var b=a+1;b<n;b++){var cand=o2.slice(0,a).concat(o2.slice(a,b+1).reverse(),o2.slice(b+1));if(tourCost(start,cand,round)<tourCost(start,o2,round)-1e-9){o2=cand;improved=true}}}
 return o2}
function optimise(date){var d=day(date),st=startOf(date),base=hasLL(st)?st:null;
 var pts=d.places.filter(hasLL),rest=d.places.filter(function(p){return!hasLL(p)});
 if(pts.length<2){toast('Add at least 2 places with a location first');return}
 var before=tourCost(base,pts,d.round),o=bestOrder(base,pts,d.round),after=tourCost(base,o,d.round);
 d.places=o.concat(rest);d.optimised=true;save();
 toast(after<before-0.05?'Route optimised — saved '+fk(before-after):'Already the shortest order 👌')}
function routeLink(date){var d=day(date),st=startOf(date),pts=d.places.filter(hasLL);if(!pts.length)return'';var gm=MODES[dayMode(date)].gm;if(gm==='transit')gm='driving';
 var origin,dest,way;if(hasLL(st)){origin=st;if(d.round){dest=st;way=pts}else{dest=pts[pts.length-1];way=pts.slice(0,-1)}}else{origin=pts[0];dest=pts[pts.length-1];way=pts.slice(1,-1)}
 if(pts.length===1&&!hasLL(st))return placeLink(pts[0]);
 return'https://www.google.com/maps/dir/?api=1&origin='+llStr(origin)+'&destination='+llStr(dest)+(way.length?'&waypoints='+way.slice(0,9).map(llStr).join('%7C'):'')+'&travelmode='+gm}

/* ---------- saving (localStorage + Firebase) ---------- */
function normalise(o){o.trains=o.trains||[];o.stays=o.stays||[];o.days=o.days||{};o.trip=o.trip||{name:'Goa Trip'};o.settings=Object.assign({},DEFSET,o.settings||{});return o}
function keepView(){try{localStorage.setItem(LSV,JSON.stringify(ui))}catch(e){}}
function save(){if(SHARE){toast('This is a view-only link');render();return}S.savedAt=Date.now();try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}unsynced=true;render();clearTimeout(timer);timer=setTimeout(push,600)}
function push(){if(!user||!cloud.ready){render();return}
 try{cloud.save(user.uid,S).catch(function(e){cloudErr=(e&&e.code)||'error';console.error(e);toast('Cloud save failed ('+cloudErr+') — kept on this device');render()})}catch(e){cloudErr='error';console.error(e)}
 if(S.share&&S.share.on){try{cloud.saveShare(S.share.id,user.uid,user.displayName||'',publicCopy()).catch(function(e){console.error('share',e);toast('Couldn’t update the share link ('+((e&&e.code)||'error')+')')})}catch(e){console.error(e)}}
 unsynced=false;render()}
function onRemote(remote,pend){pending=!!pend;cloudErr='';if(!remote){if(S.savedAt)push();else render();return}remote=normalise(remote);
 if((remote.savedAt||0)>(S.savedAt||0)){S=remote;unsynced=false;try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}render()}
 else if((remote.savedAt||0)<(S.savedAt||0))push();else{unsynced=false;render()}}
function publicCopy(){var c=JSON.parse(JSON.stringify(S)),show=S.share&&S.share.showRefs;delete c.share;c.notes='';
 if(!show){c.trains.forEach(function(t){delete t.pnr;delete t.seat;delete t.note});c.stays.forEach(function(x){delete x.ref;delete x.phone;delete x.note})}return c}
function shareLink(){return location.origin+location.pathname+'?share='+S.share.id}
function newId(){var a='abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',out='',r=new Uint8Array(20);crypto.getRandomValues(r);for(var i=0;i<20;i++)out+=a[r[i]%a.length];return out}
function startShare(){if(!user){toast('Sign in first to create a share link');return}S.share={id:(S.share&&S.share.id)||newId(),on:true,showRefs:!!(S.share&&S.share.showRefs)};save();toast('View-only link created')}
function stopShare(){if(!S.share)return;var id=S.share.id;S.share.on=false;S.share.id=newId();save();if(user&&cloud.ready)cloud.deleteShare(id).then(function(){toast('Link turned off — the old link no longer works')},function(e){toast('Couldn’t turn off the link ('+((e&&e.code)||'error')+')')})}
function initViewer(){if(!cloud.ready){shareGone=true;shareLoaded=true;render();return}
 cloud.watchShare(SHARE,function(d){shareLoaded=true;if(!d){shareGone=true;render();return}shareGone=false;S=normalise(d.state);shareOwner=d.ownerName||'';render()},function(e){shareLoaded=true;shareGone=true;console.error(e);render()})}
function initSync(){if(SHARE)return initViewer();if(!cloud.ready){authReady=true;render();return}
 cloud.onAuth(function(u){user=u;authReady=true;if(unsub){unsub();unsub=null}if(u)unsub=cloud.watch(u.uid,onRemote,function(e){cloudErr=(e&&e.code)||'error';render()});render()})}
var unsub=null;
function signIn(){cloud.signIn().catch(function(e){if(e&&e.code!=='auth/popup-closed-by-user')toast('Sign-in failed: '+((e&&e.code)||e))})}

/* ---------- ui helpers ---------- */
var tt=null;function toast(m){var el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.appendChild(el)}el.textContent=m;el.style.display='block';clearTimeout(tt);tt=setTimeout(function(){el.style.display='none'},2600)}
function closeModal(){var m=$('.modal-bg');if(m)m.remove()}
function modal(html,bind){closeModal();var bg=document.createElement('div');bg.className='modal-bg';bg.innerHTML='<div class="modal">'+html+'</div>';bg.addEventListener('click',function(e){if(e.target===bg)closeModal()});document.body.appendChild(bg);if(bind)bind(bg);var f=bg.querySelector('input,textarea');if(f&&window.innerWidth>640)f.focus()}
function form(title,fields,vals,onSave,onDelete){
 var h='<h3>'+esc(title)+'</h3><form><div class="grid2">'+fields.map(function(f){var v=vals[f.k]==null?'':vals[f.k];
  return'<div class="'+(f.full?'full':'')+'"><label>'+esc(f.label)+'</label>'+(f.type==='textarea'?'<textarea name="'+f.k+'" placeholder="'+esc(f.ph||'')+'">'+esc(v)+'</textarea>':f.type==='select'?'<select name="'+f.k+'">'+f.opts.map(function(o){return'<option value="'+esc(o[0])+'"'+(o[0]===v?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select>':'<input name="'+f.k+'" type="'+(f.type||'text')+'" value="'+esc(v)+'" placeholder="'+esc(f.ph||'')+'">')+(f.help?'<div class="tiny muted" style="margin-top:4px">'+f.help+'</div>':'')+'</div>'}).join('')+
  '</div><div class="row" style="margin-top:16px;justify-content:space-between"><div>'+(onDelete?'<button type="button" class="btn danger" data-del>Delete</button>':'')+'</div><div class="row"><button type="button" class="btn line" data-cancel>Cancel</button><button class="btn sun">Save</button></div></div></form>';
 modal(h,function(bg){var fm=bg.querySelector('form');bg.querySelector('[data-cancel]').onclick=closeModal;
  var del=bg.querySelector('[data-del]');if(del)del.onclick=function(){if(del.dataset.sure){closeModal();onDelete()}else{del.dataset.sure=1;del.textContent='Tap again to delete'}};
  fm.onsubmit=function(e){e.preventDefault();var o={};fields.forEach(function(f){o[f.k]=fm.elements[f.k].value.trim()});if(onSave(o)!==false)closeModal()}})}

/* ---------- editors ---------- */
function editTrip(){form('Trip details',[{k:'name',label:'Trip name',full:1,ph:'Goa Trip'},{k:'start',label:'First day',type:'date'},{k:'end',label:'Last day',type:'date'}],S.trip,function(o){if(o.start&&o.end&&o.end<o.start){toast('Last day is before the first day');return false}S.trip.name=o.name||'Goa Trip';S.trip.start=o.start;S.trip.end=o.end;if(!ui.day||ui.day<o.start||ui.day>o.end)ui.day=o.start;save()})}
function editTrain(t){var isNew=!t;t=t||{};form(isNew?'Add train / travel':'Edit travel',[
 {k:'label',label:'Train / bus / flight',full:1,ph:'12051 Jan Shatabdi'},{k:'from',label:'From',ph:'Mumbai CSMT'},{k:'to',label:'To',ph:'Madgaon'},
 {k:'depDate',label:'Departs',type:'date'},{k:'depTime',label:'Time',type:'time'},{k:'arrDate',label:'Arrives',type:'date'},{k:'arrTime',label:'Time',type:'time'},
 {k:'pnr',label:'PNR / booking no.',ph:'4521…'},{k:'seat',label:'Coach & seat',ph:'B2 · 34 LB'},{k:'note',label:'Notes',type:'textarea',full:1,ph:'Platform, food, who to call…'}],t,
 function(o){if(!o.label&&!o.from){toast('Give it a name or a From station');return false}Object.assign(t,o);if(isNew){t.id=uid();S.trains.push(t)}save()},
 isNew?null:function(){S.trains=S.trains.filter(function(x){return x!==t});save()})}
function editStay(s){var isNew=!s;s=s||{};var v=Object.assign({},s,{loc:s.loc||(hasLL(s)?llStr(s):'')});form(isNew?'Add hostel / stay':'Edit stay',[
 {k:'name',label:'Hostel name',full:1,ph:'The Hosteller, Anjuna'},{k:'checkIn',label:'Check-in',type:'date'},{k:'checkOut',label:'Check-out',type:'date'},
 {k:'address',label:'Address',full:1},{k:'loc',label:'Location (for route planning)',full:1,ph:'Paste a Google Maps link or 15.5733, 73.7400',help:'In Google Maps, long-press the hostel → copy the coordinates shown at the top. Full links work too (short maps.app.goo.gl links don’t).'},
 {k:'ref',label:'Booking ref'},{k:'phone',label:'Phone',type:'tel'},{k:'note',label:'Notes',type:'textarea',full:1,ph:'Check-in time, Wi-Fi, locker code…'}],v,
 function(o){if(!o.name){toast('Hostel name is needed');return false}var ll=parseLL(o.loc);if(o.loc&&!ll){toast('Couldn’t read that location — try copying the coordinates');return false}if(ll&&ll.approx==='far'){toast('📍 That pin is ~'+Math.round(km(ll,{lat:15.45,lng:73.95}))+' km from Goa — probably your current location. Search the place in Google Maps, long-press ITS pin and copy those numbers.');return false}
  Object.assign(s,o);if(ll){s.lat=ll.lat;s.lng=ll.lng}else{delete s.lat;delete s.lng}if(isNew){s.id=uid();S.stays.push(s)}save();llWarn(ll)},
 isNew?null:function(){S.stays=S.stays.filter(function(x){return x!==s});Object.keys(S.days).forEach(function(k){if(S.days[k].startId===s.id)S.days[k].startId=''});save()})}
function editPlace(date,p){var isNew=!p;p=p||{};var v=Object.assign({},p,{loc:hasLL(p)?llStr(p):'',day:date});
 var fields=[{k:'name',label:'Place',full:1,ph:'Thalassa, Siolim'},{k:'loc',label:'Location',full:1,ph:'Google Maps link or 15.60, 73.73',help:'Needed for distances & route optimisation. In Google Maps, long-press the exact spot and copy the coordinates shown.'},
 {k:'time',label:'Time (optional)',type:'time'},{k:'note',label:'Note',ph:'Sunset ~6 pm'}];
 var days=tripDays();if(days.length>1)fields.push({k:'day',label:'Day',type:'select',full:1,opts:days.map(function(dt,i){return[dt,'Day '+(i+1)+' · '+fd(dt)]})});
 form(isNew?'Add a custom place':'Edit place',fields,v,
 function(o){if(!o.name){toast('Name the place');return false}var ll=parseLL(o.loc);if(o.loc&&!ll){toast('Couldn’t read that location');return false}if(ll&&ll.approx==='far'){toast('📍 That pin is ~'+Math.round(km(ll,{lat:15.45,lng:73.95}))+' km from Goa — probably your current location. Search the place in Google Maps, long-press ITS pin and copy those numbers.');return false}
  var to=o.day||date;delete o.day;delete o.loc;Object.assign(p,o);if(ll){p.lat=ll.lat;p.lng=ll.lng}else{delete p.lat;delete p.lng}
  if(isNew){p.id=uid();day(to).places.push(p)}else if(to!==date){var d0=day(date);d0.places=d0.places.filter(function(x){return x!==p});day(to).places.push(p);toast('Moved to '+fd(to))}save();llWarn(ll)},
 isNew?null:function(){var d=day(date);d.places=d.places.filter(function(x){return x!==p});save()})}
function pickPlaces(date){var d=day(date);
 function list(q){q=(q||'').toLowerCase();var area='',h='';PLACES.forEach(function(r,i){if(q&&r[1].toLowerCase().indexOf(q)<0&&r[0].toLowerCase().indexOf(q)<0)return;
  if(r[0]!==area){area=r[0];h+='<div class="area">'+esc(area)+'</div>'}var added=d.places.some(function(p){return p.name===r[1]});
  h+='<div class="pick"><span>'+esc(r[1])+'</span><button class="btn sm '+(added?'line':'ghost')+'" data-i="'+i+'"'+(added?' disabled':'')+'>'+(added?'Added':'+ Add')+'</button></div>'});return h||'<div class="empty">No match — add it as a custom place.</div>'}
 modal('<h3>Add places to '+esc(fd(date))+'</h3><div class="row" style="margin-bottom:6px"><input id="q" placeholder="Search beaches, forts, churches…"></div><button class="btn line sm" id="custom" style="margin:4px 0">＋ Custom place (your own link / coordinates)</button><div id="pl">'+list('')+'</div><div class="tiny muted" style="margin-top:10px">Locations are approximate — good enough for ordering your route.</div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sun" id="done">Done</button></div>',
 function(bg){var q=bg.querySelector('#q'),pl=bg.querySelector('#pl'),changed=false;q.oninput=function(){pl.innerHTML=list(q.value)};
  pl.onclick=function(e){var b=e.target.closest('[data-i]');if(!b)return;var r=PLACES[+b.dataset.i];d.places.push({id:uid(),name:r[1],lat:r[2],lng:r[3]});changed=true;b.disabled=true;b.textContent='Added';b.className='btn sm line';render()};
  bg.querySelector('#custom').onclick=function(){if(changed)save();editPlace(date)};
  bg.querySelector('#done').onclick=function(){closeModal();if(changed)save()};
  bg.addEventListener('click',function(e){if(e.target===bg&&changed)save()})})}
function editDay(date){var d=day(date);var opts=[['','Auto (hostel booked for that night)']].concat(S.stays.map(function(s){return[s.id,s.name+(hasLL(s)?'':' (no location)')]}));
 form(fd(date,true),[{k:'title',label:'Day title',full:1,ph:'North Goa beaches'},{k:'startId',label:'Start from',type:'select',opts:opts,full:1},{k:'mode',label:'Getting around',type:'select',full:1,opts:[['','Trip default ('+MODES[S.settings.mode].label+')']].concat(Object.keys(MODES).map(function(k){return[k,MODES[k].ic+' '+MODES[k].label]}))},{k:'round',label:'End of day',type:'select',opts:[['1','Come back to the hostel'],['0','End at the last place']],full:1}],
 {title:d.title,startId:d.startId||'',mode:d.mode||'',round:d.round===false?'0':'1'},function(o){d.title=o.title;d.startId=o.startId;d.mode=o.mode;d.round=o.round==='1';save()})}
function editCosts(){var c=S.settings;form('Getting around',[{k:'mode',label:'Default way to travel',type:'select',full:1,opts:Object.keys(MODES).map(function(k){return[k,MODES[k].ic+' '+MODES[k].label]})},
 {k:'rent',label:'Scooty rent / day (₹)',type:'number'},{k:'fuel',label:'Scooty petrol / km (₹)',type:'number'},{k:'cabKm',label:'Cab fare / km (₹)',type:'number'},{k:'cabMin',label:'Cab minimum fare (₹)',type:'number'},{k:'busKm',label:'Bus fare / km (₹)',type:'number'},{k:'busMin',label:'Bus minimum fare (₹)',type:'number'}],
 c,function(o){S.settings.mode=o.mode;['rent','fuel','cabKm','cabMin','busKm','busMin'].forEach(function(k){var n=parseFloat(o[k]);S.settings[k]=isNaN(n)?DEFSET[k]:n});save()})}

/* ---------- views ---------- */
var IC={today:'<path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',days:'<path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3zM9 3v15M15 6v15"/>',travel:'<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/>',stays:'<path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6"/>',more:'<path d="M5 5h14v14H5z"/><path d="M8 9h8M8 13h8M8 17h5"/>'};
function nav(){var t=[['today','Today'],['days','Itinerary'],['travel','Trains'],['stays','Hostels'],['more',SHARE?'About':'Notes']];
 return'<nav class="bottom"><div class="wrap">'+t.map(function(x){return'<button data-nav="'+x[0]+'" class="'+(ui.view===x[0]?'on':'')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+IC[x[0]]+'</svg>'+x[1]+'</button>'}).join('')+'</div></nav>'}
function header(){var t=S.trip,sub=t.start?fd(t.start)+' → '+fd(t.end)+' · '+tripDays().length+' days':'Set your trip dates to begin';
 if(SHARE)return'<header class="top"><div class="wrap"><h1>'+esc(shareGone?'Trip not available':(t.name||'Goa Trip'))+'</h1><p>'+esc(shareGone?'':shareLoaded?sub:'Loading…')+'</p><span class="sync"><i class="dot"></i>👀 '+esc(shareOwner?shareOwner.split(' ')[0]+'’s trip':'Shared trip')+' · view-only · updates live</span></div></header>';
 var st=!cloud.ready?['warn','Saved on this device only — add your Firebase config to sync']:!authReady?['busy','Connecting…']:!user?['warn','Not signed in · saved on this device']:cloudErr?['warn','Cloud error: '+cloudErr]:(unsynced||pending)?['busy',navigator.onLine===false?'Offline · saved on this device, syncs when back online':'Syncing…']:['','Synced · '+(user.displayName||user.email||'you')];
 var act=cloud.ready&&authReady&&!user?' · <button data-signin style="text-decoration:underline;font-weight:700">Sign in with Google</button>':'';
 return'<header class="top"><div class="wrap"><h1>'+esc(t.name||'Goa Trip')+'</h1><p>'+esc(sub)+'</p><span class="sync"><i class="dot '+st[0]+'"></i>'+esc(st[1])+act+'</span></div></header>'}
function trainCard(t){return'<div class="card" data-train="'+t.id+'" style="cursor:pointer"><div class="row" style="justify-content:space-between"><b>'+esc(t.label||'Travel')+'</b>'+(t.pnr?'<span class="pill">PNR '+esc(t.pnr)+'</span>':'')+'</div>'+
 '<div class="row" style="margin-top:8px;align-items:stretch;gap:12px"><div style="flex:1"><div class="tiny muted">FROM</div><b>'+esc(t.from||'—')+'</b><div class="small">'+esc(fd(t.depDate))+' '+esc(ft(t.depTime))+'</div></div><div style="align-self:center;color:var(--sun);font-weight:700">→</div><div style="flex:1"><div class="tiny muted">TO</div><b>'+esc(t.to||'—')+'</b><div class="small">'+esc(fd(t.arrDate))+' '+esc(ft(t.arrTime))+'</div></div></div>'+
 (t.seat?'<div class="small" style="margin-top:8px">💺 '+esc(t.seat)+'</div>':'')+(t.note?'<div class="small muted" style="margin-top:6px;white-space:pre-wrap">'+esc(t.note)+'</div>':'')+'</div>'}
function stayCard(s){return'<div class="card" data-stay="'+s.id+'" style="cursor:pointer"><div class="row" style="justify-content:space-between"><h3 style="font-size:18px">'+esc(s.name)+'</h3>'+(s.ref?'<span class="pill">'+esc(s.ref)+'</span>':'')+'</div>'+
 '<div class="small" style="margin-top:6px">🛏 '+(s.checkIn?esc(fd(s.checkIn))+' → '+esc(fd(s.checkOut))+' · '+Math.max(0,daysBetween(s.checkIn,s.checkOut||s.checkIn))+' nights':'<span class="muted">Add dates</span>')+'</div>'+
 (s.address?'<div class="small muted">'+esc(s.address)+'</div>':'')+'<div class="row small" style="margin-top:8px">'+(hasLL(s)?'<a href="'+placeLink(s)+'" target="_blank" rel="noopener" data-stop>📍 '+s.lat.toFixed(4)+', '+s.lng.toFixed(4)+' — check pin ↗</a>':(rawLL(s)?'<span class="pill" style="background:#fbe3e0;color:#b3261e">⚠️ Pin is outside Goa — tap to fix</span>':'<span class="pill sun">No location — tap to add</span>'))+(s.phone?'<span>📞 '+esc(s.phone)+'</span>':'')+'</div>'+(s.note?'<div class="small muted" style="margin-top:6px;white-space:pre-wrap">'+esc(s.note)+'</div>':'')+'</div>'}
function sortedTrains(){return S.trains.slice().sort(function(a,b){return((a.depDate||'9')+(a.depTime||'')).localeCompare((b.depDate||'9')+(b.depTime||''))})}

function mapSvg(base,pts,round){var all=(hasLL(base)?[base]:[]).concat(pts);if(all.length<2)return'';
 var mid=all.reduce(function(s,p){return s+p.lat},0)/all.length,cos=Math.cos(mid*Math.PI/180);
 var xs=all.map(function(p){return p.lng*cos}),ys=all.map(function(p){return-p.lat});var x0=Math.min.apply(0,xs),x1=Math.max.apply(0,xs),y0=Math.min.apply(0,ys),y1=Math.max.apply(0,ys);
 var W=340,H=210,P=22,sc=Math.min((W-2*P)/((x1-x0)||1e-3),(H-2*P)/((y1-y0)||1e-3));var ox=(W-(x1-x0)*sc)/2,oy=(H-(y1-y0)*sc)/2;
 function X(p){return(ox+(p.lng*cos-x0)*sc).toFixed(1)}function Y(p){return(oy+(-p.lat-y0)*sc).toFixed(1)}
 var seq=(hasLL(base)?[base]:[]).concat(pts);if(round&&hasLL(base))seq.push(base);
 var h='<svg class="map" viewBox="0 0 '+W+' '+H+'"><polyline points="'+seq.map(function(p){return X(p)+','+Y(p)}).join(' ')+'" fill="none" stroke="#e2622b" stroke-width="2.5" stroke-dasharray="6 5" stroke-linejoin="round"/>';
 if(hasLL(base))h+='<rect x="'+(X(base)-11)+'" y="'+(Y(base)-11)+'" width="22" height="22" rx="6" fill="#0f5b66"/><text x="'+X(base)+'" y="'+(+Y(base)+4)+'" text-anchor="middle" font-size="12" fill="#fff">⌂</text>';
 pts.forEach(function(p,i){h+='<circle cx="'+X(p)+'" cy="'+Y(p)+'" r="11" fill="#fff" stroke="#e2622b" stroke-width="2.5"/><text x="'+X(p)+'" y="'+(+Y(p)+4)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#14303a">'+(i+1)+'</text>'});
 return h+'</svg>'}

function dayPlan(date,compact){var d=day(date),st=startOf(date),base=hasLL(st)?st:null,pts=d.places.filter(hasLL),mode=dayMode(date);
 var legs=[],prev=base;pts.forEach(function(p){if(prev)legs.push(leg(prev,p,mode));prev=p});if(base&&d.round&&pts.length)legs.push(leg(prev,base,mode));
 var tk=0,tm=0,tc=0;legs.forEach(function(l){tk+=l.km;tm+=l.min;tc+=l.cost});if(mode==='scooty'&&legs.length)tc+=S.settings.rent;
 var h='<div class="card"><div class="row" style="justify-content:space-between"><div><div class="tiny muted">'+esc(fd(date,true))+'</div><h2 style="font-size:22px">'+esc(d.title||'Day '+(tripDays().indexOf(date)+1))+'</h2></div><button class="btn line sm" data-editday="'+date+'">Edit day</button></div>';
 h+='<div class="modes" style="margin-top:10px">'+Object.keys(MODES).map(function(k){return'<button data-mode="'+k+'" class="'+(k===mode?'on':'')+'">'+MODES[k].ic+' '+(k==='bus'?'Bus':k==='cab'?'Cab':'Scooty')+'</button>'}).join('')+'</div>';
 if(d.places.length){h+='<div class="summary" style="margin-top:12px"><div><b>'+d.places.length+'</b><span class="tiny muted">places</span></div>'+(legs.length?'<div><b>~'+fk(tk)+'</b><span class="tiny muted">by road</span></div><div><b>~'+fm(tm)+'</b><span class="tiny muted">travel time</span></div><div><b>~'+rs(tc)+'</b><span class="tiny muted">'+(mode==='scooty'?'rent + petrol':mode==='cab'?'cab fares':'bus fares')+'</span></div>':'')+'</div>';
  if(legs.length)h+='<div class="tiny muted" style="margin-top:6px">Estimates. Tap “exact ↗” on any leg for the real Google Maps route.</div>';
  if(pts.length>=1)h+='<div style="margin-top:12px">'+mapSvg(base,pts,d.round)+'</div>';
  h+='<div class="row" style="margin-top:12px">'+(pts.length>=2?'<button class="btn sun" data-opt="'+date+'">✨ Optimise route</button>':'')+(pts.length&&mode!=='bus'?'<a class="btn ghost" target="_blank" rel="noopener" href="'+routeLink(date)+'">🧭 Full route in Maps</a>':'')+'</div>';
  if(mode==='bus')h+='<div class="hint" style="margin-top:10px">Goa buses mostly run between towns (Mapusa, Panaji, Margao, Calangute), not to every beach. Use “exact ↗” on each leg for bus options; for short hops a cab or walk is often quicker.</div>';}
 h+='</div><div class="card">';
 h+='<div class="place"><div class="num home">⌂</div><div class="body"><div class="name">'+(st?esc(st.name):'No hostel for this day')+'</div><div class="small muted">'+(st?(base?'Start'+(d.round?' & finish':'')+' here':(rawLL(st)?'<span style="color:#b3261e;font-weight:700">⚠️ Its saved pin is outside Goa ('+st.lat.toFixed(3)+', '+st.lng.toFixed(3)+'). Fix it in Hostels → tap the hostel.</span>':'Add this hostel’s location to plan the route')):'Add a stay covering '+esc(fd(date))+' or pick one in “Edit day”')+'</div></div></div>';
 prev=base;d.places.forEach(function(p,i){
  if(prev&&hasLL(p)){var l=leg(prev,p,mode);h+='<div class="leg">↓ '+l.ic+' '+fk(l.km)+' · ~'+fm(l.min)+(l.cost?' · ~'+rs(l.cost):l.walk?' · walk':'')+' · <a target="_blank" rel="noopener" href="'+legLink(prev,p,l.walk?'walk':mode)+'">exact ↗</a></div>'}else h+='<div class="leg">↓</div>';
  h+='<div class="place '+(p.done?'done':'')+'"><div class="num '+(hasLL(p)?'':'nill')+'">'+(i+1)+'</div><div class="body"><div class="name" data-edit="'+i+'" style="cursor:pointer">'+esc(p.name)+' <span class="tiny muted" style="font-weight:400">✎</span></div>'+((p.time||p.note)?'<div class="small muted">'+(p.time?'⏰ '+esc(ft(p.time))+' ':'')+esc(p.note||'')+'</div>':'')+(hasLL(p)?'':'<div class="tiny" style="color:#a8431a">No location — tap Edit to add one</div>')+
  '<div class="acts"><button class="icon '+(p.done?'on':'')+'" data-done="'+i+'">'+(p.done?'✓ Visited':'○ Visited')+'</button><button class="icon" data-up="'+i+'" '+(i===0?'disabled':'')+'>↑</button><button class="icon" data-down="'+i+'" '+(i===d.places.length-1?'disabled':'')+'>↓</button><button class="icon" data-edit="'+i+'">✎ Edit</button><a class="icon" style="text-decoration:none" target="_blank" rel="noopener" href="'+placeLink(p)+'">Map ↗</a></div></div></div>';
  if(hasLL(p))prev=p});
 if(base&&d.round&&prev&&prev!==base){var l2=leg(prev,base,mode);h+='<div class="leg">↓ '+l2.ic+' '+fk(l2.km)+' · ~'+fm(l2.min)+(l2.cost?' · ~'+rs(l2.cost):'')+' · <a target="_blank" rel="noopener" href="'+legLink(prev,base,l2.walk?'walk':mode)+'">exact ↗</a></div><div class="place"><div class="num home">⌂</div><div class="body"><div class="name">Back to '+esc(st.name)+'</div></div></div>'}
 if(!d.places.length)h+='<div class="empty">No places yet for this day.</div>';
 h+='<div class="row" style="margin-top:14px"><button class="btn" data-add="'+date+'">＋ Add places</button></div></div>';
 return'<div data-day="'+date+'">'+h+'</div>'}

function vToday(){var t=todayIso(),days=tripDays(),h='';
 if(!days.length)return'<div class="card"><h2>Welcome 👋</h2><p class="muted">Start by setting your trip dates. Then add your trains, hostels and the places you want to see each day — the app works out the shortest route from your hostel.</p><button class="btn sun" data-trip>Set trip dates</button></div>';
 var next=sortedTrains().filter(function(x){return((x.depDate||'')+'T'+(x.depTime||'23:59'))>=t+'T'+pad(new Date().getHours())+':'+pad(new Date().getMinutes())})[0];
 if(t<days[0]){var n=daysBetween(t,days[0]);h+='<div class="card" style="text-align:center"><div class="big">'+n+'</div><div class="muted">day'+(n===1?'':'s')+' to go</div></div>';}
 else if(t>days[days.length-1])h+='<div class="card"><h2>Hope Goa was amazing 🌅</h2><p class="muted small">Your whole plan is still saved below.</p></div>';
 if(days.indexOf(t)>=0){var st=stayFor(t);if(st)h+='<div class="sec"><h2>Tonight</h2></div>'+stayCard(st);h+='<div class="sec"><h2>Today’s plan</h2></div>'+dayPlan(t,true)}
 else if(t<days[0]){h+='<div class="sec"><h2>Day 1 preview</h2></div>'+dayPlan(days[0],true)}
 if(next)h+='<div class="sec"><h2>Next train</h2></div>'+trainCard(next);
 return h}
function vDays(){var days=tripDays();if(!days.length)return'<div class="card empty">Set trip dates first.<br><br><button class="btn sun" data-trip>Set trip dates</button></div>';
 if(!ui.day||days.indexOf(ui.day)<0)ui.day=days.indexOf(todayIso())>=0?todayIso():days[0];
 var h='<div class="daystrip">'+days.map(function(dt,i){var d=S.days[dt],c=d&&d.places?d.places.length:0;return'<button data-pick="'+dt+'" class="'+(dt===ui.day?'on':'')+'"><b>Day '+(i+1)+'</b><span>'+esc(fd(dt))+(c?' · '+c:'')+'</span></button>'}).join('')+'</div>';
 return h+dayPlan(ui.day,false)+'<div class="hint">Tip: “Optimise route” finds the shortest loop from your hostel. If a place has a fixed time (e.g. a sunset spot), optimise first, then nudge it with ↑ ↓.</div>'}
function vTravel(){var tr=sortedTrains();return'<div class="sec"><h2>Trains & travel</h2><button class="btn sun sm" data-addtrain>＋ Add</button></div>'+(tr.length?tr.map(trainCard).join(''):'<div class="card empty">No trains yet. Add your onward and return journeys.</div>')}
function vStays(){var s=S.stays.slice().sort(function(a,b){return(a.checkIn||'9').localeCompare(b.checkIn||'9')});
 var gaps=tripDays().slice(0,-1).filter(function(dt){return!S.stays.some(function(x){return x.checkIn<=dt&&dt<x.checkOut})});
 return'<div class="sec"><h2>Hostels & stays</h2><button class="btn sun sm" data-addstay>＋ Add</button></div>'+(gaps.length&&S.stays.length?'<div class="hint" style="margin-bottom:12px">No stay booked for the night of '+gaps.map(function(g){return esc(fd(g))}).join(', ')+'.</div>':'')+(s.length?s.map(stayCard).join(''):'<div class="card empty">No stays yet. Add each hostel with its check-in/out dates — each day’s route starts from the hostel you’re in that night.</div>')}
function shareCard(){var h='<div class="sec"><h2>Share my trip</h2></div><div class="card">';
 if(!cloud.ready||!user)return h+'<p class="small muted" style="margin:0">Sign in with Google to create a view-only link for friends & family.</p></div>';
 if(!S.share||!S.share.on)return h+'<p class="small muted" style="margin-top:0">Create a link anyone can open — no sign-in needed. They see your itinerary, trains and hostels live, but can’t edit. Your notes are never shared.</p><button class="btn sun" data-sharestart>🔗 Create view-only link</button></div>';
 var L=shareLink();
 return h+'<div class="small muted">Anyone with this link can view your trip:</div><input readonly value="'+esc(L)+'" onclick="this.select()" style="margin:6px 0 10px;font-size:13px">'+
  '<div class="row"><button class="btn sm" data-sharecopy>Copy link</button><a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text='+encodeURIComponent('My Goa trip plan (live): '+L)+'">Send on WhatsApp</a></div>'+
  '<div class="row" style="justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)"><div class="small"><b>PNRs & booking refs</b><div class="muted">'+(S.share.showRefs?'Visible on the link':'Hidden from the link')+'</div></div><button class="btn sm line" data-sharerefs>'+(S.share.showRefs?'Hide':'Show')+'</button></div>'+
  '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sm danger" data-sharestop>Turn off link</button></div></div>'}
function vMore(){return'<div class="sec"><h2>Notes</h2></div><div class="card"><textarea id="notes" style="min-height:160px" placeholder="Packing list, emergency numbers, scooter rental, budget…">'+esc(S.notes||'')+'</textarea><div class="row" style="margin-top:8px;justify-content:flex-end"><button class="btn sm" data-savenotes>Save notes</button></div></div>'+
 shareCard()+'<div class="sec"><h2>Trip</h2></div><div class="card row" style="justify-content:space-between"><div><b>'+esc(S.trip.name)+'</b><div class="small muted">'+(S.trip.start?esc(fd(S.trip.start,true))+' → '+esc(fd(S.trip.end,true)):'No dates')+'</div></div><button class="btn line sm" data-trip>Edit</button></div>'+
 '<div class="sec"><h2>Getting around</h2></div><div class="card row" style="justify-content:space-between"><div><b>'+MODES[S.settings.mode].ic+' '+MODES[S.settings.mode].label+'</b><div class="small muted">Scooty '+rs(S.settings.rent)+'/day + '+rs(S.settings.fuel)+'/km petrol · Cab '+rs(S.settings.cabKm)+'/km (min '+rs(S.settings.cabMin)+')</div></div><button class="btn line sm" data-costs>Edit</button></div>'+(user?'<div class="sec"><h2>Account</h2></div><div class="card row" style="justify-content:space-between"><div><b>'+esc(user.displayName||'Signed in')+'</b><div class="small muted">'+esc(user.email||'')+' · plan stored in Firebase</div></div><button class="btn line sm" data-signout>Sign out</button></div>':'')+'<div class="sec"><h2>Backup</h2></div><div class="card"><p class="small muted" style="margin-top:0">Copy your whole plan as text (to keep in WhatsApp/notes), or paste a backup to restore it.</p><div class="row"><button class="btn ghost sm" data-copy>Copy backup</button><button class="btn line sm" data-restore>Restore from backup</button></div></div>'}

function vAbout(){return'<div class="sec"><h2>About this link</h2></div><div class="card"><p style="margin-top:0">You’re viewing '+esc(shareOwner||'someone')+'’s trip plan. It updates live whenever they change it, and it’s read-only.</p><p class="small muted">Want your own planner? Open <a href="'+esc(location.origin+location.pathname)+'">'+esc(location.host+location.pathname)+'</a> and sign in with Google.</p></div>'}
function vGone(){return'<div class="card empty"><h2>This link isn’t active</h2><p>The owner may have turned sharing off, or the link is incomplete. Ask them to send it again.</p></div>'}
function render(){var app=$('#app'),sx=window.scrollY;var v={today:vToday,days:vDays,travel:vTravel,stays:vStays,more:SHARE?vAbout:vMore}[ui.view]||vToday;if(SHARE&&(shareGone||!shareLoaded))v=shareGone?vGone:function(){return'<div class="card empty">Loading trip…</div>'};
 var ta=$('#notes'),draft=ta?ta.value:null;
 app.innerHTML=header()+'<main class="wrap">'+v()+'</main>'+nav();if(draft!=null&&$('#notes'))$('#notes').value=draft;window.scrollTo(0,sx)}

document.addEventListener('click',function(e){var b=e.target.closest('button,[data-train],[data-stay],[data-edit],a');if(!b||b.closest('.modal-bg'))return;if(b.tagName==='A')return;var ds=b.dataset;
 if(SHARE&&!(ds.nav||ds.pick))return;
 if(ds.nav){ui.view=ds.nav;keepView();try{history.replaceState(null,'','#'+ds.nav)}catch(x){}render();window.scrollTo(0,0);return}
 if(ds.signin!=null){signIn();return}
 if(ds.signout!=null){cloud.signOut().then(function(){toast('Signed out — the plan stays on this device')});return}
 if(ds.trip!=null)return editTrip();
 if(ds.costs!=null)return editCosts();
 if(ds.sharestart!=null)return startShare();
 if(ds.sharestop!=null){if(b.dataset.sure){stopShare()}else{b.dataset.sure=1;b.textContent='Tap again to turn off'}return}
 if(ds.sharerefs!=null){S.share.showRefs=!S.share.showRefs;save();toast(S.share.showRefs?'PNRs & booking details now visible on the link':'PNRs & booking details hidden');return}
 if(ds.sharecopy!=null){var L2=shareLink();Promise.resolve().then(function(){return navigator.clipboard.writeText(L2)}).then(function(){toast('Link copied')},function(){toast('Select the link above and copy it')});return}
 if(ds.addtrain!=null)return editTrain();
 if(ds.addstay!=null)return editStay();
 if(ds.train)return editTrain(S.trains.filter(function(x){return x.id===ds.train})[0]);
 if(ds.stay)return editStay(S.stays.filter(function(x){return x.id===ds.stay})[0]);
 if(ds.pick){ui.day=ds.pick;keepView();render();return}
 if(ds.editday)return editDay(ds.editday);
 if(ds.opt)return optimise(ds.opt);
 if(ds.add)return pickPlaces(ds.add);
 var holder=b.closest('[data-day]');if(holder){var date=holder.dataset.day,d=day(date);
  if(ds.mode){d.mode=ds.mode;save();return}
  if(ds.done!=null){var p=d.places[+ds.done];p.done=!p.done;save();return}
  if(ds.up!=null){var i=+ds.up;if(i>0){var t=d.places[i];d.places[i]=d.places[i-1];d.places[i-1]=t;save()}return}
  if(ds.down!=null){var j=+ds.down;if(j<d.places.length-1){var t2=d.places[j];d.places[j]=d.places[j+1];d.places[j+1]=t2;save()}return}
  if(ds.edit!=null)return editPlace(date,d.places[+ds.edit])}
 if(ds.savenotes!=null){S.notes=$('#notes').value;save();toast('Notes saved');return}
 if(ds.copy!=null){var txt=JSON.stringify(S);Promise.resolve().then(function(){return navigator.clipboard.writeText(txt)}).then(function(){toast('Backup copied')},function(){modal('<h3>Your backup</h3><p class="small muted">Select all and copy:</p><textarea style="min-height:200px">'+esc(txt)+'</textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-x>Close</button></div>',function(bg){bg.querySelector('[data-x]').onclick=closeModal})});return}
 if(ds.restore!=null){modal('<h3>Restore backup</h3><p class="small muted">Paste a backup copied from this app. It replaces the current plan.</p><textarea id="bk" style="min-height:180px"></textarea><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn line" data-x>Cancel</button><button class="btn sun" data-ok>Restore</button></div>',function(bg){bg.querySelector('[data-x]').onclick=closeModal;bg.querySelector('[data-ok]').onclick=function(){try{var o=JSON.parse(bg.querySelector('#bk').value);if(!o||!o.trip)throw 0;S=normalise(o);closeModal();save();toast('Plan restored')}catch(x){toast('That doesn’t look like a backup from this app')}}});return}
});
render();initSync();
window.addEventListener('online',render);window.addEventListener('offline',render);
