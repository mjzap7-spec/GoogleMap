import { mapStyleUrl } from './mapSource';
// The renderer sends only map state; no account credentials enter this document.
export const mapDocument = String.raw`<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; connect-src https://tiles.openfreemap.org; img-src data: blob: https:; worker-src blob:; child-src blob:;">
<link rel="preconnect" href="https://tiles.openfreemap.org" crossorigin>
<link rel="preconnect" href="https://unpkg.com" crossorigin>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.css">
<style>html,body,#map{margin:0;width:100%;height:100%;background:#101116;overflow:hidden}.maplibregl-popup-content{background:#191b24;color:#eee;border-radius:12px;font:14px sans-serif}.maplibregl-popup-close-button{color:#eee}.person-marker{display:flex;flex-direction:column;align-items:center;gap:3px;font:12px sans-serif}.person-avatar{position:relative;width:38px;height:38px;border:2px solid #bcb5ff;border-radius:50%;background:#252936;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 2px 8px #0009}.person-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.person-label{max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#191b24;color:#eee;padding:3px 7px;border-radius:8px}.maplibregl-ctrl-attrib{font:10px sans-serif}</style>
</head><body><div id="map"></div><script>
function report(type,details){var data=JSON.stringify(Object.assign({type:type},details||{}));if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(data);else window.parent.postMessage(data,'*');}
window.addEventListener('error',function(){report('fatal');});
// Fetch the style while the map engine downloads, rather than waiting for it.
var earlyStyle=typeof fetch==='function'?fetch('${mapStyleUrl}').then(function(response){if(!response.ok)throw new Error('style');return response.json();}).catch(function(){return null;}):null;
</script><script src="https://unpkg.com/maplibre-gl@5.13.0/dist/maplibre-gl.js" onerror="report('fatal')"></script><script>
(function(){try {
var map=new maplibregl.Map({container:'map',style:earlyStyle?null:'${mapStyleUrl}',center:[0,20],zoom:2,minZoom:2,maxZoom:19,attributionControl:{compact:true},fadeDuration:180});
var ready=false,lastId=0,state={language:'en',live:null,reducedMotion:true},targetZoom=null,labels=[],appliedLanguage=null,styleReady=false,liveMarker=null,livePopup=null,liveCentered=false,followGps=true,livePosition='',lastTrailKey='',peopleMarkers=new Map(),lastFocus=-1;
function duration(value){return state.reducedMotion?0:value;}
function language(){if(!styleReady||appliedLanguage===state.language)return;appliedLanguage=state.language;labels.forEach(function(layer){var code=state.language;var expression=code==='local'?['coalesce',['get','name'],['get','name:latin'],'']:['coalesce',['get','name:'+code],['get','name_'+code],['get','name'],['get','name:latin'],''];map.setLayoutProperty(layer,'text-field',expression);});}
function people(){
 var wanted=new Set();(state.users||[]).forEach(function(user){
  if(user.expiresAt<=Date.now())return;wanted.add(user.id);
  var entry=peopleMarkers.get(user.id);
  if(!entry){var root=document.createElement('div');root.className='person-marker';root.tabIndex=0;root.role='button';root.ariaLabel=user.nickname;root.style.cursor='pointer';root.onclick=function(event){event.stopPropagation();report('select-user',{userId:user.id});};root.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();report('select-user',{userId:user.id});}};var avatar=document.createElement('div');avatar.className='person-avatar';var initial=document.createElement('span');avatar.appendChild(initial);var label=document.createElement('div');label.className='person-label';root.appendChild(avatar);root.appendChild(label);entry={marker:new maplibregl.Marker({element:root,anchor:'bottom'}).setLngLat([user.longitude,user.latitude]).addTo(map),label:label,avatar:avatar,initial:initial,url:null,image:null};peopleMarkers.set(user.id,entry);}
  entry.marker.setLngLat([user.longitude,user.latitude]);entry.marker.getElement && (entry.marker.getElement().ariaLabel=user.nickname);entry.label.textContent=user.nickname;entry.initial.textContent=user.nickname.slice(0,1).toUpperCase();
  if(entry.url!==user.avatarUrl){if(entry.image)entry.image.remove();entry.url=user.avatarUrl;entry.image=null;if(user.avatarUrl){var image=document.createElement('img');image.src=user.avatarUrl;image.alt='';image.referrerPolicy='no-referrer';image.onerror=function(){this.style.display='none';};entry.avatar.appendChild(image);entry.image=image;}}
 });
 peopleMarkers.forEach(function(entry,id){if(!wanted.has(id)){entry.marker.remove();peopleMarkers.delete(id);}});
 var focus=state.focus;
 if(focus && wanted.has(focus.id) && focus.revision!==lastFocus){lastFocus=focus.revision;followGps=false;targetZoom=null;map.easeTo({center:[focus.longitude,focus.latitude],zoom:16,duration:ready?duration(350):0});}
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
 language();var live=state.live,trail=state.trail||[];
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
  if(!liveMarker){livePopup=document.createElement('div');liveMarker=new maplibregl.Marker({color:'#57c8ff'}).setLngLat([live.longitude,live.latitude]).setPopup(new maplibregl.Popup({offset:28}).setDOMContent(livePopup)).addTo(map);}
  else liveMarker.setLngLat([live.longitude,live.latitude]);
  livePopup.textContent=state.positionLabel||'Your GPS position';
  var gpsKey=live.longitude+','+live.latitude;
  if(followGps && (!liveCentered || gpsKey!==livePosition)){targetZoom=null;map.easeTo({center:[live.longitude,live.latitude],zoom:liveCentered?map.getZoom():16,duration:ready?duration(350):0});}
  liveCentered=true;livePosition=gpsKey;
 }else{if(liveMarker)liveMarker.remove();liveMarker=null;liveCentered=false;livePosition='';}
 people();

}
function validFix(p){return p && Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180&&Number.isFinite(p.timestamp);}
function receive(event){
 if(event.source && event.source!==window.parent && event.source!==window)return;
 var message;try{message=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch(_){return;}
 if(!message||!Number.isSafeInteger(message.id)||message.id<=lastId)return;
 lastId=message.id;
 if(message.type==='state'){
  if(['en','es','fr','de','zh','ja','local'].indexOf(message.language)<0)return;
  var live=message.live||null,trail=message.trail===undefined?(state.trail||[]):message.trail;
  if(live&&!validFix(live))return;
  if(!Array.isArray(trail)||trail.length>5000)return;
  var size=0;if(!trail.every(function(segment){if(!Array.isArray(segment))return false;size+=segment.length;return size<=5000&&segment.every(validFix);}))return;
  var users=message.users||[],focus=message.focus||null;
  if(!Array.isArray(users)||users.length>500||!users.every(function(user){return user && typeof user.id==='string' && typeof user.nickname==='string' && user.nickname.length<=100 && (user.avatarUrl===null||typeof user.avatarUrl==='string'&&user.avatarUrl.indexOf('https://')===0) && Number.isFinite(user.expiresAt) && validFix({latitude:user.latitude,longitude:user.longitude,timestamp:0});}))return;
  if(focus && (!Number.isSafeInteger(focus.revision)||!users.some(function(user){return user.id===focus.id && user.latitude===focus.latitude && user.longitude===focus.longitude;})))return;
  state={live:live,trail:trail,users:users,focus:focus,positionLabel:typeof message.positionLabel==='string'?message.positionLabel.slice(0,100):'Your GPS position',language:message.language,reducedMotion:message.reducedMotion!==false};render();return;
 }
 if(!ready||message.type!=='command')return;
 if(message.command==='recenter' && state.live){followGps=true;targetZoom=null;map.easeTo({center:[state.live.longitude,state.live.latitude],zoom:16,duration:duration(300)});}
 else if(message.command==='zoom-in'||message.command==='zoom-out'){
  targetZoom=Math.max(2,Math.min(19,(targetZoom===null?map.getZoom():targetZoom)+(message.command==='zoom-in'?1:-1)));
  map.easeTo({zoom:targetZoom,duration:duration(180)});
 }
}
window.addEventListener('message',receive);document.addEventListener('message',receive);
map.on('movestart',function(event){if(event.originalEvent){targetZoom=null;followGps=false;}});
map.on('style.load',function(){styleReady=true;appliedLanguage=null;labels=map.getStyle().layers.filter(function(layer){return layer.type==='symbol' && layer.layout && layer.layout['text-field'] && /name/.test(JSON.stringify(layer.layout['text-field']));}).map(function(layer){return layer.id;});render();});
map.on('load',function(){ready=true;report('ready');});
map.on('error',function(){if(!styleReady)report('fatal');});
report('initialized');
if(earlyStyle)earlyStyle.then(function(style){map.setStyle(style||'${mapStyleUrl}');}).catch(function(){report('fatal');});
window.addEventListener('resize',function(){map.resize();});
} catch(_){report('fatal');}})();
</script></body></html>`;
