import { crowdLayoutSource } from './crowdLayout';
import { mapStyleUrl } from './mapSource';
import { avatarImageUrlSource } from '../../../shared/utils/avatarImageUrl';
// The renderer sends only map state; no account credentials enter this document.
export const mapDocument = String.raw`<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; connect-src https://tiles.openfreemap.org; img-src data: blob: https:; worker-src blob:; child-src blob:;">
<link rel="preconnect" href="https://tiles.openfreemap.org" crossorigin>
<link rel="preconnect" href="https://unpkg.com" crossorigin>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.css">
<style>html,body,#map{margin:0;width:100%;height:100%;background:#101116;overflow:hidden}.maplibregl-popup-content{background:#191b24;color:#eee;border-radius:12px;font:14px sans-serif}.maplibregl-popup-close-button{color:#eee}.person-marker{display:flex;align-items:center;justify-content:center;position:relative;width:44px;height:44px;font:600 12px sans-serif;outline-offset:4px}.person-marker:focus-visible{outline:2px solid #fff;border-radius:14px}@keyframes marker-arrive{from{opacity:0}to{opacity:1}}.person-avatar{position:relative;width:44px;height:44px;border:3px solid #bcb5ff;border-radius:50%;background:#252936;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 0 0 4px #191b2466,0 4px 12px #0009}.person-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.person-label{position:absolute;top:100%;margin-top:5px;max-width:120px;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#191b24;color:#eee;padding:5px 10px;border:1px solid #30333f;border-radius:14px}.maplibregl-ctrl-attrib{font:10px sans-serif}</style>
</head><body><div id="map"></div><script>
function report(type,details){var data=JSON.stringify(Object.assign({type:type},details||{}));if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(data);else window.parent.postMessage(data,'*');}
window.addEventListener('error',function(){report('fatal');});
// Fetch the style while the map engine downloads, rather than waiting for it.
var earlyStyle=typeof fetch==='function'?fetch('${mapStyleUrl}').then(function(response){if(!response.ok)throw new Error('style');return response.json();}).catch(function(){return null;}):null;
</script><script src="https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.js" onerror="report('fatal')"></script><script>
(function(){try {
// Bound framebuffer and tile memory on high-density phones without lowering camera frame rate.
var map=new maplibregl.Map({container:'map',style:earlyStyle?null:'${mapStyleUrl}',center:[0,20],zoom:2,minZoom:2,maxZoom:19,attributionControl:{compact:true},fadeDuration:180,pixelRatio:Math.min(2,window.devicePixelRatio||1),maxTileCacheSize:96});
var ready=false,lastId=0,state={language:'en',live:null,reducedMotion:true},targetZoom=null,labels=[],appliedLanguage=null,styleReady=false,liveMarker=null,livePopup=null,liveCentered=false,followGps=true,livePosition='',lastTrailKey='',peopleMarkers=new Map(),lastFocus=-1,lastSharedTrailKey='',lastTestCount=0;
var hostActive=true;
function isRendering(){return hostActive && document.visibilityState!=='hidden';}
function pauseRendering(){
 if(peopleFrame!=null)cancelAnimationFrame(peopleFrame);
 peopleFrame=null;
 renderedUsers=undefined;
 map.stop();
 peopleMarkers.forEach(function(entry){
  if(entry.frame!=null)cancelAnimationFrame(entry.frame);
  entry.frame=null;
  if(Number.isFinite(entry.toLng) && Number.isFinite(entry.toLat)){
   entry.lng=entry.toLng;entry.lat=entry.toLat;entry.marker.setLngLat([entry.lng,entry.lat]);
  }
  entry.fixTime=null;
  clearTimeout(entry.retryTimer);entry.retryTimer=null;entry.detail=0;
 });
}
function duration(value){return state.reducedMotion?0:value;}
function language(){if(!styleReady||appliedLanguage===state.language)return;appliedLanguage=state.language;labels.forEach(function(layer){var code=state.language;var expression=code==='local'?['coalesce',['get','name'],['get','name:latin'],'']:['coalesce',['get','name:'+code],['get','name_'+code],['get','name'],['get','name:latin'],''];map.setLayoutProperty(layer,'text-field',expression);});}
var layoutCrowd=(${crowdLayoutSource});
var avatarImageUrl=(${avatarImageUrlSource});
function clearAvatar(entry) {
  clearTimeout(entry.retryTimer);
  entry.retryTimer = null;
  if (entry.image) {
    entry.image.onload = null;
    entry.image.onerror = null;
    entry.image.remove();
  }
  entry.image = null;
  entry.url = null;
  entry.failed = false;
}
function loadAvatar(entry, allowRetry) {
  if(!isRendering())return;
  var image = entry.image, url = entry.url;
  var thumbnail = avatarImageUrl(url,96);
  var original = thumbnail !== url ? url : null;
  // Public Cloudinary uploads can also be served by the same provider's shared CDN shard.
  var alternate = /^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\//.test(url)
    ? url.replace('https://res.cloudinary.com/', 'https://res-1.cloudinary.com/')
    : null;
  entry.failed = false;
  image.onload = function() {
    if (entry.image === image) { image.style.visibility = 'visible'; entry.failed = false; }
  };
  image.onerror = function() {
    if (entry.image !== image) return;
    if (!isRendering()) { entry.failed = true; return; }
    // Accounts that disallow unsigned transformations can still display the original photo.
    if (original) {
      var fallback = original;
      original = null;
      image.src = fallback;
      return;
    }
    if (alternate) {
      var next = alternate;
      alternate = null;
      image.src = next;
      return;
    }
    entry.failed = true;
    if (allowRetry) {
      entry.retryTimer = setTimeout(function() {
        entry.retryTimer = null;
        if (isRendering() && entry.image === image && entry.detail > 0) loadAvatar(entry, false);
      }, 3000);
    }
  };
  image.src = thumbnail;
}
function updateAvatar(entry, url, detail) {
  var wasVisible = entry.detail > 0;
  entry.detail = detail;
  if (entry.url !== url) {
    clearAvatar(entry);
    entry.url = url;
  }
  if (!url) return;
  if (!entry.image && detail > 0) {
    entry.image = document.createElement('img');
    entry.image.alt = '';
    entry.image.referrerPolicy = 'no-referrer';
    entry.image.style.visibility = 'hidden';
    entry.avatar.appendChild(entry.image);
    loadAvatar(entry, true);
  } else if (detail > 0 && !wasVisible && entry.failed && entry.retryTimer === null) {
    loadAvatar(entry, true);
  }
  if (entry.image) {
    entry.image.style.transition = state.reducedMotion ? 'none' : 'opacity 140ms ease-out';
    entry.image.style.opacity = String(detail);
  }
}
window.addEventListener('online', function() {
  if(!isRendering())return;
  peopleMarkers.forEach(function(entry) {
    if (entry.failed && entry.detail > 0) {
      clearTimeout(entry.retryTimer);
      entry.retryTimer = null;
      loadAvatar(entry, false);
    }
  });
});
// Animate only between received GPS fixes. Long gaps and large jumps snap to the fix.
function positionPerson(entry, longitude, latitude, trip) {
  var animate = trip && !state.reducedMotion && typeof requestAnimationFrame === 'function';
  if (entry.toLng === longitude && entry.toLat === latitude && (animate || entry.frame == null)) return;
  if (entry.frame != null) cancelAnimationFrame(entry.frame);
  entry.frame = null;
  var previousTime = entry.fixTime, now = Date.now();
  entry.toLng = longitude;
  entry.toLat = latitude;
  entry.fixTime = now;
  var fromLng = entry.lng, fromLat = entry.lat;
  var dx = ((longitude - fromLng + 540) % 360) - 180, dy = latitude - fromLat;
  function place(lng, lat) {
    entry.lng = lng;
    entry.lat = lat;
    entry.marker.setLngLat([lng, lat]);
  }
  if (!animate || previousTime == null || now - previousTime > 10000 ||
      Math.hypot(dx * Math.cos(latitude * Math.PI / 180), dy) > 0.004) {
    place(longitude, latitude);
    return;
  }
  var start = performance.now();
  function frame(time) {
    if(!isRendering()){entry.frame=null;return;}
    var t = Math.min(1, Math.max(0, (time - start) / 450));
    if (t === 1) { entry.frame = null; place(longitude, latitude); return; }
    place(fromLng + dx * t, fromLat + dy * t);
    entry.frame = requestAnimationFrame(frame);
  }
  entry.frame = requestAnimationFrame(frame);
}
var followingTrip = false, focusPosition = '';
var renderedSharedTrail = null;
var renderedUsers, renderedMotion, nextPeopleExpiry = Infinity;
function updateFocus(){
  var focus = state.focus;
  if (!focus || focus.expiresAt <= Date.now()) { followingTrip = false; lastFocus = -1; return; }
  var selected = focus.revision !== lastFocus;
  if (selected) { lastFocus = focus.revision; followGps = false; followingTrip = focus.trip === true; }
  if (!focus.trip) followingTrip = false;
  var position = focus.longitude + ',' + focus.latitude;
  if (!selected && (!followingTrip || position === focusPosition)) return;
  focusPosition = position;
  var camera = {center:[focus.longitude,focus.latitude],duration:ready?duration(selected?350:450):0};
  if (selected) { targetZoom = null; camera.zoom = 16; }
  else if (targetZoom !== null) camera.zoom = targetZoom;
  map.easeTo(camera);
}
function people(){
 if(!isRendering())return;
 var zoom=map.getZoom(),detail=Math.max(0,Math.min(1,(zoom-14)/2)),size=Math.round(10+34*Math.max(0,Math.min(1,(zoom-13)/4)));
 var container=map.getContainer?map.getContainer():null,visible=[];
 var now=Date.now();
 renderedUsers=state.users;renderedMotion=state.reducedMotion;nextPeopleExpiry=Infinity;
 (state.users||[]).forEach(function(user){
  if(user.expiresAt<=now)return;
  nextPeopleExpiry=Math.min(nextPeopleExpiry,user.expiresAt);
  if(Number.isFinite(user.updatedAt) && user.updatedAt+60000>now)nextPeopleExpiry=Math.min(nextPeopleExpiry,user.updatedAt+60000);
  var pixel=map.project?map.project([user.longitude,user.latitude]):null;
  if(pixel && container && (pixel.x < -48 || pixel.y < -48 || pixel.x > container.clientWidth+48 || pixel.y > container.clientHeight+48))return;
  visible.push({user:user,pixel:pixel});
 });
 var byId=new Map(visible.map(function(item){return [item.user.id,item];}));
 var groups=map.project?layoutCrowd(visible.map(function(item){return {id:item.user.id,x:item.pixel.x,y:item.pixel.y};}),zoom<13?64:56,32).map(function(group){return {users:group.ids.map(function(id){return byId.get(id).user;}),pixel:{x:group.x,y:group.y}};}):visible.map(function(item){return {users:[item.user],pixel:null};});
 var labelPositions=[],labelCount=0;
 var wanted=new Set();
 groups.forEach(function(group){
  var user=group.users[0],cluster=group.users.length>1,id=cluster?'cluster:'+group.users.map(function(item){return item.id;}).sort().join('|'):user.id;
  wanted.add(id);var entry=peopleMarkers.get(id);
  if(!entry){
   var root=document.createElement('div');root.className='person-marker';root.tabIndex=0;root.role='button';root.style.cursor='pointer';root.style.animation=state.reducedMotion?'none':'marker-arrive 140ms ease-out';
   var select=function(){if(cluster){report('select-users',{userIds:group.users.map(function(item){return item.id;})});}else report('select-user',{userId:user.id});};
   root.onclick=function(event){event.stopPropagation();select();};root.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}};
   var avatar=document.createElement('div');avatar.className='person-avatar';var initial=document.createElement('span');avatar.appendChild(initial);
   var label=document.createElement('div');label.className='person-label';root.appendChild(avatar);root.appendChild(label);
   entry={root:root,marker:new maplibregl.Marker({element:root,anchor:'center'}).setLngLat([user.longitude,user.latitude]).addTo(map),label:label,avatar:avatar,initial:initial,url:null,image:null};peopleMarkers.set(id,entry);
  }
  entry.root.ariaLabel=cluster?group.users.map(function(item){return item.nickname;}).join(', '):user.nickname;
  var longitude=user.longitude+group.users.reduce(function(sum,item){return sum+((item.longitude-user.longitude+540)%360-180);},0)/group.users.length;longitude=(longitude+540)%360-180;
  var latitude=group.users.reduce(function(sum,item){return sum+item.latitude;},0)/group.users.length;
  if(cluster && group.pixel && map.unproject){var center=map.unproject(group.pixel);longitude=center.lng;latitude=center.lat;}
  positionPerson(entry,cluster?longitude:user.longitude,cluster?latitude:user.latitude,!cluster && user.trip===true);
  var transition=state.reducedMotion?'none':'width 140ms ease-out,height 140ms ease-out,border-radius 140ms ease-out,background-color 140ms ease-out,border-color 140ms ease-out,opacity 140ms ease-out';
  entry.avatar.style.transition=transition;entry.label.style.transition=transition;
  entry.avatar.style.width=(cluster?group.users.length>=100?48:40:size)+'px';entry.avatar.style.height=(cluster?34:size)+'px';
  entry.avatar.style.borderRadius=cluster?'10px':'50%';entry.avatar.style.backgroundColor=cluster?'#39324f':detail<0.1?'#bcb5ff':'#252936';
  entry.avatar.style.borderColor=cluster?'#d0caff':detail<0.1?'#efecff':'#bcb5ff';entry.avatar.style.borderWidth=cluster?'2px':size<20?'2px':'3px';
  var stale=!cluster && Number.isFinite(user.updatedAt) && now-user.updatedAt>=60000;
  entry.avatar.style.opacity=stale?'0.65':'1';
  if(stale)entry.avatar.style.borderColor='#a3a4af';
  entry.initial.style.opacity=cluster?'1':String(detail);
  var labelAllowed=!cluster && zoom>=17 && labelCount<8 && (!group.pixel || !labelPositions.some(function(pixel){return Math.abs(pixel.x-group.pixel.x)<140 && Math.abs(pixel.y-group.pixel.y)<64;}));
  if(labelAllowed){labelCount++;if(group.pixel)labelPositions.push(group.pixel);}
  entry.label.style.opacity=labelAllowed?'1':'0';
  if(entry.label.textContent!==user.nickname)entry.label.textContent=user.nickname;
  var initialText=cluster?String(group.users.length):user.nickname.slice(0,1).toUpperCase();
  if(entry.initial.textContent!==initialText)entry.initial.textContent=initialText;
  updateAvatar(entry,cluster?null:user.avatarUrl,detail);
 });
 peopleMarkers.forEach(function(entry,id){if(!wanted.has(id)){if(entry.frame!=null)cancelAnimationFrame(entry.frame);clearAvatar(entry);entry.marker.remove();peopleMarkers.delete(id);}});
}
// Small local chevron image: no font, image download, or routing service needed.
function directionImage(){
 var size=32,data=new Uint8Array(size*size*4);
 function distance(x,y,ax,ay,bx,by){var dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);}
 for(var y=0;y<size;y++)for(var x=0;x<size;x++){
  var d=Math.min(distance(x,y,9,5,23,16),distance(x,y,23,16,9,27));
  if(d>4)continue;var i=(y*size+x)*4,white=d<2.4;
  data[i]=white?245:16;data[i+1]=white?250:17;data[i+2]=white?255:22;data[i+3]=Math.round(255*Math.min(1,4-d));
 }
 return {width:size,height:size,data:data};
}
function render(){
 if(!isRendering())return;
 language();var live=state.live,trail=state.trail||[];
 if(styleReady && ((state.sharedTrail||[]).length || map.getSource('shared-trip'))){
  if(!map.getSource('shared-trip')){renderedSharedTrail=null;lastSharedTrailKey='';map.addSource('shared-trip',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'shared-trip-line',type:'line',source:'shared-trip',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#BCB5FF','line-width':5,'line-opacity':0.9}});}
  if(renderedSharedTrail!==state.sharedTrail){
   renderedSharedTrail=state.sharedTrail;
   var sharedTrailKey=JSON.stringify(state.sharedTrail||[]);
   if(sharedTrailKey!==lastSharedTrailKey){lastSharedTrailKey=sharedTrailKey;map.getSource('shared-trip').setData({type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:(state.sharedTrail||[]).filter(function(segment){return segment.length>1;}).map(function(segment){return segment.map(function(point){return [point.longitude,point.latitude];});})}});}
  }
 }
 if(styleReady){
  var count=trail.reduce(function(n,segment){return n+segment.length;},0);
  var lastSegment=trail[trail.length-1],lastPoint=lastSegment&&lastSegment[lastSegment.length-1];
  var trailKey=count+':'+(lastPoint?lastPoint.timestamp:'');
  if(!map.getSource('travelled-path')){
   map.addSource('travelled-path',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:[]}}});
   map.addLayer({id:'travelled-path',type:'line',source:'travelled-path',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#57c8ff','line-width':5,'line-opacity':0.9}});
   if(!map.hasImage('travel-direction'))map.addImage('travel-direction',directionImage(),{pixelRatio:2});
   map.addLayer({id:'travelled-path-directions',type:'symbol',source:'travelled-path',layout:{'symbol-placement':'line','symbol-spacing':80,'icon-image':'travel-direction','icon-size':1,'icon-rotation-alignment':'map','icon-pitch-alignment':'map','icon-keep-upright':false,'icon-allow-overlap':true,'icon-ignore-placement':true,'icon-padding':2},paint:{'icon-opacity':0.95}});
   lastTrailKey='';
  }
  if(lastTrailKey!==trailKey){lastTrailKey=trailKey;map.getSource('travelled-path').setData({type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:trail.filter(function(segment){return segment.length>1;}).map(function(segment){return segment.map(function(fix){return [fix.longitude,fix.latitude];});})}});}
 }
 if(live){
  var gpsKey=live.longitude+','+live.latitude;
  if(!liveMarker){livePopup=document.createElement('div');liveMarker=new maplibregl.Marker({color:'#57c8ff'}).setLngLat([live.longitude,live.latitude]).setPopup(new maplibregl.Popup({offset:28}).setDOMContent(livePopup)).addTo(map);}
  else if(gpsKey!==livePosition)liveMarker.setLngLat([live.longitude,live.latitude]);
  var gpsLabel=state.positionLabel||'Your GPS position';
  if(livePopup.textContent!==gpsLabel)livePopup.textContent=gpsLabel;
  if(followGps && (!liveCentered || gpsKey!==livePosition)){map.easeTo({center:[live.longitude,live.latitude],zoom:targetZoom!==null?targetZoom:liveCentered?map.getZoom():16,duration:ready?duration(350):0});}
  liveCentered=true;livePosition=gpsKey;
 }else{if(liveMarker)liveMarker.remove();liveMarker=null;liveCentered=false;livePosition='';}
 // Camera events already update screen-space clusters. GPS or trail-only packets do not.
 if(renderedUsers!==state.users || renderedMotion!==state.reducedMotion || Date.now()>=nextPeopleExpiry)people();
 updateFocus();
 if(state.testUserCount && state.users.length && state.testUserCount!==lastTestCount && map.fitBounds){
  lastTestCount=state.testUserCount;followGps=false;
  var origin=state.live?state.live.longitude:state.users[0].longitude,minLng=Infinity,maxLng=-Infinity,minLat=Infinity,maxLat=-Infinity;
  state.users.forEach(function(user){var lng=origin+((user.longitude-origin+540)%360-180);minLng=Math.min(minLng,lng);maxLng=Math.max(maxLng,lng);minLat=Math.min(minLat,user.latitude);maxLat=Math.max(maxLat,user.latitude);});
  var container=map.getContainer?map.getContainer():null,width=container?container.clientWidth:360,height=container?container.clientHeight:600;
  map.fitBounds([[minLng,minLat],[maxLng,maxLat]],{padding:{top:Math.min(140,height*0.2),bottom:Math.min(100,height*0.18),left:Math.min(32,width*0.08),right:Math.min(32,width*0.08)},maxZoom:16,duration:duration(350)});
 }
}
function validFix(p){return p && Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180&&Number.isFinite(p.timestamp);}
function receive(event){
 if(event.source && event.source!==window.parent && event.source!==window)return;
 var message;try{message=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch(_){return;}
 if(!message||!Number.isSafeInteger(message.id)||message.id<=lastId)return;
 lastId=message.id;
 if(message.type==='visibility' && message.active===false){hostActive=false;pauseRendering();return;}
 if(message.type==='state'){
  if(['en','es','fr','de','zh','ja','local'].indexOf(message.language)<0)return;
  var testUserCount=message.testUserCount||0;
  if([0,10,100,500].indexOf(testUserCount)<0)return;
  var live=message.live||null,trail=message.trail===undefined?(state.trail||[]):message.trail;
  if(live&&!validFix(live))return;
  if(!Array.isArray(trail)||trail.length>5000)return;
  var size=0;if(message.trail!==undefined&&!trail.every(function(segment){if(!Array.isArray(segment))return false;size+=segment.length;return size<=5000&&segment.every(validFix);}))return;
  var sharedTrail=message.sharedTrail===undefined?(state.sharedTrail||[]):message.sharedTrail,sharedCount=0;
  if(message.sharedTrail!==undefined&&(!Array.isArray(sharedTrail)||sharedTrail.length>500||!sharedTrail.every(function(segment){if(!Array.isArray(segment))return false;sharedCount+=segment.length;return sharedCount<=500&&segment.every(validFix);})))return;
  var users=message.users===undefined?(state.users||[]):message.users,focus=message.focus||null;
  if(message.users!==undefined&&(!Array.isArray(users)||users.length>500||!users.every(function(user){return user && typeof user.id==='string' && typeof user.nickname==='string' && user.nickname.length<=100 && (user.avatarUrl===null||typeof user.avatarUrl==='string'&&user.avatarUrl.indexOf('https://')===0) && Number.isFinite(user.expiresAt) && validFix({latitude:user.latitude,longitude:user.longitude,timestamp:0});})))return;
  if(focus && (!Number.isSafeInteger(focus.revision)||!users.some(function(user){return user.id===focus.id && user.latitude===focus.latitude && user.longitude===focus.longitude;})))return;
  if(message.users!==undefined)users=users.slice().sort(function(a,b){return a.id.localeCompare(b.id);});
  if(lastTestCount && !testUserCount){lastTestCount=0;followGps=true;liveCentered=false;}
  state={testUserCount:testUserCount,sharedTrail:sharedTrail,live:live,trail:trail,users:users,focus:focus,positionLabel:typeof message.positionLabel==='string'?message.positionLabel.slice(0,100):'Your GPS position',language:message.language,reducedMotion:message.reducedMotion!==false};
  if(message.active===true && !hostActive){hostActive=true;map.resize();}
  render();return;
 }
 if(message.type!=='command'||!isRendering())return;
 if(message.command==='recenter' && state.live){followingTrip=false;followGps=true;targetZoom=null;map.easeTo({center:[state.live.longitude,state.live.latitude],zoom:16,duration:duration(300)});}
 else if(message.command==='zoom-in'||message.command==='zoom-out'){
  targetZoom=Math.max(2,Math.min(19,(targetZoom===null?map.getZoom():targetZoom)+(message.command==='zoom-in'?1:-1)));
  map.easeTo({zoom:targetZoom,duration:duration(180)});
 }
}
window.addEventListener('message',receive);document.addEventListener('message',receive);
document.addEventListener('visibilitychange',function(){if(!isRendering())pauseRendering();else{map.resize();render();}});
map.on('movestart',function(event){if(event.originalEvent){targetZoom=null;followGps=false;followingTrip=false;}});
map.on('style.load',function(){styleReady=true;appliedLanguage=null;labels=map.getStyle().layers.filter(function(layer){return layer.type==='symbol' && layer.layout && layer.layout['text-field'] && /name/.test(JSON.stringify(layer.layout['text-field']));}).map(function(layer){return layer.id;});render();});
var peopleFrame=null,lastPeopleFrame=-Infinity;
// Cluster layout runs at most 30 times/second while the map itself keeps animating smoothly.
function schedulePeople(){
 if(!isRendering()||peopleFrame!==null)return;
 if(typeof requestAnimationFrame!=='function'){people();return;}
 peopleFrame=requestAnimationFrame(function tick(time){
  peopleFrame=null;
  if(!isRendering())return;
  if(time-lastPeopleFrame<1000/30){peopleFrame=requestAnimationFrame(tick);return;}
  lastPeopleFrame=time;people();
 });
}
function finishPeople(){
 if(!isRendering())return;
 if(peopleFrame!==null)cancelAnimationFrame(peopleFrame);
 peopleFrame=null;people();
}
map.on('move',schedulePeople);map.on('zoom',schedulePeople);map.on('zoomend',finishPeople);map.on('moveend',finishPeople);
map.on('load',function(){ready=true;report('ready');});
map.on('error',function(){if(!styleReady)report('fatal');});
report('initialized');
if(earlyStyle)earlyStyle.then(function(style){map.setStyle(style||'${mapStyleUrl}');}).catch(function(){report('fatal');});
window.addEventListener('resize',function(){if(isRendering())map.resize();});
} catch(_){report('fatal');}})();
</script></body></html>`;
