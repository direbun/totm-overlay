// TOTM v8 - Enemies on scene + bar, drag position, BG zoom, reusable encounters
import { syncHotbarPosition as syncHotbarPositionModule, getHotbarDropSlot as getHotbarDropSlotModule, createProjectFUItemHotbarMacro as createProjectFUItemHotbarMacroModule, handleTotmHotbarDrop as handleTotmHotbarDropModule, bindTotmHotbarDropZone as bindTotmHotbarDropZoneModule, renderTotmHotbar as renderTotmHotbarModule, bindTotmHotbarUi as bindTotmHotbarUiModule } from "./modules/hotbar.mjs";
import { renderPlayerCards as renderPlayerCardsModule, bindPlayerPanelEvents as bindPlayerPanelEventsModule } from "./modules/player-panel.mjs";
import { buildStageSceneImages as buildStageSceneImagesModule, renderEnemyBar as renderEnemyBarModule, bindEnemyStageEvents as bindEnemyStageEventsModule } from "./modules/enemy-stage.mjs";
import { renderTopbar as renderTopbarModule, bindSceneAdminEvents as bindSceneAdminEventsModule } from "./modules/scene-admin.mjs";
const MODULE_ID="totm-overlay",FLAG_TOTM="isTOTM",FLAG_DATA="totmData",FLAG_TARGETS="userTargets",FLAG_PROXY="proxyToken",FLAG_PLAYER_PROXY="playerProxyToken",FLAG_USER_AFK="afkActors";
const loc=(k,fallback="")=>{const key=`TOTM.${k}`,value=game.i18n.localize(key);return value===key?(fallback||k):value;},isGM=()=>game.user.isGM;
const esc=value=>foundry.utils.escapeHTML(String(value??""));
const attr=esc;
const cssUrl=value=>`url("${String(value??"").replace(/\\/g,"/").replace(/"/g,"%22").replace(/[\r\n\f]/g,"")}")`;
const getF=(s,k)=>s?.getFlag(MODULE_ID,k),setF=async(s,k,v)=>s?.setFlag(MODULE_ID,k,v),unsetF=async(s,k)=>s?.unsetFlag(MODULE_ID,k);
const MINIMAP_PIN_COLORS={party:"#42d96b",enemy:"#e84c4f",objective:"#e6c84f",point:"#58a6ff",danger:"#ff9a3c",mystery:"#b783ff"};
const defaultMinimapData=()=>({image:"",pins:[]});
const defData=()=>({background:"",bgPosX:50,bgPosY:50,bgZoom:100,bgStretch:false,featuredArt:"",featuredCaption:"",narration:"",style:"classic",mediaJournal:"",actors:[],backgrounds:[],npcs:[],boardActors:[],boardActorsVisible:true,props:[],propsByBackground:{},questPins:[],questPinsByBackground:{},enemies:[],encounters:[],combatActive:false,shared:false,preEncounterView:null,gmPin:{visible:false,image:"",size:64,posX:50,posY:50},minimap:defaultMinimapData()});
const MEDIA_ROLE_META={
  unsorted:{label:"Unsorted",icon:"fas fa-inbox"},
  background:{label:"Backgrounds",icon:"fas fa-images"},
  npc:{label:"NPCs",icon:"fas fa-user-tag"},
  prop:{label:"Props",icon:"fas fa-cube"},
  featured:{label:"Featured",icon:"fas fa-star"}
};
const SCENE_DATA_CACHE=new Map();
const SCENE_DATA_EPOCH=new Map();
const cloneData=data=>JSON.parse(JSON.stringify(data??{}));
const clampPercent=(value,fallback=50)=>Number.isFinite(+value)?Math.max(0,Math.min(100,+value)):fallback;
const normalizeMinimapColor=value=>/^#[0-9a-f]{3,8}$/i.test(String(value||"").trim())?String(value).trim():MINIMAP_PIN_COLORS.point;
function normalizeMinimapData(value){
  const source=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  const pins=Array.isArray(source.pins)?source.pins:[];
  return {
    image:String(source.image||"").trim(),
    pins:pins.map((pin,i)=>({
      id:String(pin?.id||foundry.utils.randomID()),
      label:String(pin?.label||pin?.type||`Pin ${i+1}`).trim(),
      type:String(pin?.type||"point").trim(),
      color:normalizeMinimapColor(pin?.color||MINIMAP_PIN_COLORS[pin?.type]),
      x:clampPercent(pin?.x,50),
      y:clampPercent(pin?.y,50),
      visible:pin?.visible!==false
    }))
  };
}
const normalizeSceneData=data=>{const next=Object.assign(defData(),cloneData(data));next.minimap=normalizeMinimapData(next.minimap);return next;};
function attachSceneDataEpoch(scene,data){
  if(!scene?.id||!data||typeof data!=="object")return data;
  try{Object.defineProperty(data,"__totmEpoch",{value:SCENE_DATA_EPOCH.get(scene.id)||0,enumerable:false,configurable:true});}catch{}
  return data;
}
function bumpSceneDataEpoch(scene){
  if(!scene?.id)return 0;
  const next=(SCENE_DATA_EPOCH.get(scene.id)||0)+1;
  SCENE_DATA_EPOCH.set(scene.id,next);
  return next;
}
function preserveFreshStageState(scene,incoming){
  if(!scene?.id||!incoming||typeof incoming!=="object")return incoming;
  const incomingEpoch=Number.isFinite(+incoming.__totmEpoch)?+incoming.__totmEpoch:null;
  const currentEpoch=SCENE_DATA_EPOCH.get(scene.id)||0;
  if(incomingEpoch==null||incomingEpoch>=currentEpoch)return incoming;
  const current=normalizeSceneData(getF(scene,FLAG_DATA)||{});
  ["actors","shared","featuredArt","featuredCaption","npcs","props","propsByBackground","questPins","questPinsByBackground","boardActors","boardActorsVisible","enemies","combatActive","preEncounterView","gmPin","minimap","mediaJournal"].forEach(key=>{
    incoming[key]=cloneData(current[key]);
  });
  return incoming;
}
const getData=s=>{
  if(!s)return defData();
  const cached=s.id?SCENE_DATA_CACHE.get(s.id):null;
  return attachSceneDataEpoch(s,normalizeSceneData(getF(s,FLAG_DATA)??cached??{}));
};
const STAGE_ONLY_DATA_KEYS=new Set(["background","bgPosX","bgPosY","bgZoom","bgStretch","bgFadeAt","featuredArt","featuredCaption","narration","npcs","props","propsByBackground","questPins","questPinsByBackground","boardActors","boardActorsVisible","gmPin","backgrounds","mediaJournal"]);
const ACTOR_STAGE_ONLY_KEYS=new Set(["pinVisible","pinImg","pinSize","pinX","pinY"]);
function stripActorStageOnlyFields(actor){
  const next=cloneData(actor||{});
  ACTOR_STAGE_ONLY_KEYS.forEach(key=>delete next[key]);
  return next;
}
function stripStageOnlyData(data){
  const next=normalizeSceneData(data);
  STAGE_ONLY_DATA_KEYS.forEach(key=>delete next[key]);
  next.actors=Array.isArray(next.actors)?next.actors.map(stripActorStageOnlyFields):[];
  return next;
}
function isStageOnlyDataChange(previous,next){
  if(!previous||!next)return false;
  try{return JSON.stringify(stripStageOnlyData(previous))===JSON.stringify(stripStageOnlyData(next));}
  catch{return false;}
}
const saveData=async(s,d)=>{
  const normalized=normalizeSceneData(preserveFreshStageState(s,d));
  const nextEpoch=bumpSceneDataEpoch(s);
  if(s?.id)SCENE_DATA_CACHE.set(s.id,cloneData(normalized));
  attachSceneDataEpoch(s,normalized);
  const saved=cloneData(normalized);
  const result=await setF(s,FLAG_DATA,saved);
  if(s?.id)SCENE_DATA_EPOCH.set(s.id,nextEpoch);
  return result;
};
const emit=()=>game.socket.emit(`module.${MODULE_ID}`,{action:"refresh"});
const emitStage=()=>game.socket.emit(`module.${MODULE_ID}`,{action:"stageRefresh"});
const emitAfkToggle=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"afkToggle",sceneId,payload});
const emitPinMove=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"pinMove",sceneId,payload});
const emitPinPersist=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"pinPersist",sceneId,payload});
const emitPinToggle=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"pinToggle",sceneId,payload});
const emitPinConfig=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"pinConfig",sceneId,payload});
let REFRESH_QUEUED=false;
let REFRESH_SCENE_ID=null;
let STAGE_REFRESH_QUEUED=false;
let STAGE_REFRESH_SCENE_ID=null;
let TOTM_GLOBAL_CLICK_BOUND=false;
const TOTM_IMAGE_PRELOADS=new Set();
const BOARD_RENDER_WARNED_SCENES=new Set();
const BG_FADE_RENDERED=new Map();
function preloadTotmImage(src){
  src=String(src||"").trim();
  if(!src||TOTM_IMAGE_PRELOADS.has(src))return;
  TOTM_IMAGE_PRELOADS.add(src);
  const img=new Image();
  img.src=src;
}
function shouldRenderBgFade(scene,d){
  const stamp=Number(d?.bgFadeAt||0);
  if(!scene?.id||!stamp||Date.now()-stamp>=BG_FADE_MS+150)return false;
  const key=`${String(d.background||"")}@${stamp}`;
  if(BG_FADE_RENDERED.get(scene.id)===key)return false;
  BG_FADE_RENDERED.set(scene.id,key);
  return true;
}
function scheduleRefresh(scene){
  if(!scene)return;
  if(LOCAL_PIN_DRAG_COUNT>0){
    PENDING_PIN_REFRESH_SCENE_ID=scene.id;
    return;
  }
  REFRESH_SCENE_ID=scene.id;
  if(REFRESH_QUEUED)return;
  REFRESH_QUEUED=true;
  const raf=globalThis.requestAnimationFrame||globalThis.setTimeout;
  raf(()=>{
    REFRESH_QUEUED=false;
    const s=game.scenes.get(REFRESH_SCENE_ID);
    REFRESH_SCENE_ID=null;
    if(s&&isTOTM(s)&&s.id===game.scenes.viewed?.id)(refreshOverlayAreas(s)||refreshUI(s));
  });
}
function requestSceneRefresh(scene){
  scheduleRefresh(scene);
}
function scheduleStageRefresh(scene){
  if(!scene)return;
  STAGE_REFRESH_SCENE_ID=scene.id;
  if(STAGE_REFRESH_QUEUED)return;
  STAGE_REFRESH_QUEUED=true;
  const raf=globalThis.requestAnimationFrame||globalThis.setTimeout;
  raf(()=>{
    STAGE_REFRESH_QUEUED=false;
    const s=game.scenes.get(STAGE_REFRESH_SCENE_ID);
    STAGE_REFRESH_SCENE_ID=null;
    if(!s||!isTOTM(s)||s.id!==game.scenes.viewed?.id)return;
    if(!refreshStageArea(s))refreshUI(s);
  });
}
function requestStageRefresh(scene){
  scheduleStageRefresh(scene);
}
function flushDeferredPinRefresh(){
  if(LOCAL_PIN_DRAG_COUNT>0||!PENDING_PIN_REFRESH_SCENE_ID)return;
  const scene=game.scenes.get(PENDING_PIN_REFRESH_SCENE_ID);
  PENDING_PIN_REFRESH_SCENE_ID=null;
  if(scene&&isTOTM(scene)&&scene.id===game.scenes.viewed?.id)scheduleStageRefresh(scene);
}
function bindTotmGlobalClickHandler(){
  if(TOTM_GLOBAL_CLICK_BOUND)return;
  TOTM_GLOBAL_CLICK_BOUND=true;
  document.addEventListener("click",event=>{
    const el=document.getElementById("totm-ui");
    if(!el||!document.body.classList.contains("totm-active"))return;
    const target=event.target instanceof Element?event.target:null;
    document.querySelectorAll(".totm-cond-dropdown").forEach(x=>x.remove());
    if(!target?.closest(".totm-bg-dropdown")&&!target?.closest(".totm-tb-btn")){
      el.querySelectorAll(".totm-bg-dropdown").forEach(x=>{x.style.display="none";});
    }
  });
}
const onSock=p=>{
  const s=game.scenes.viewed;
  if(p?.action==="refresh"){if(s&&isTOTM(s))requestSceneRefresh(s);return;}
  if(p?.action==="stageRefresh"){if(s&&isTOTM(s))requestStageRefresh(s);return;}
  if(p?.action==="pinMove"&&s&&isTOTM(s)&&s.id===p.sceneId){
    const pinEl=document.querySelector(p.payload?.owner==="gm"?`#totm-ui .totm-map-pin[data-pin-owner="gm"]`:`#totm-ui .totm-map-pin[data-pin-owner="actor"][data-actor-id="${p.payload?.actorId}"]`);
    if(pinEl){
      pinEl.style.left=`${p.payload.x}%`;
      pinEl.style.top=`${p.payload.y}%`;
    }
    return;
  }
  if((p?.action==="pinPersist"||p?.action==="pinToggle"||p?.action==="pinConfig")&&game.user.isGM){
    const scene=game.scenes.get(p.sceneId);
    if(scene&&isTOTM(scene))handlePinSceneUpdate(scene,p);
  }
  if(p?.action==="afkToggle"&&game.user.isGM){
    const scene=game.scenes.get(p.sceneId);
    if(scene&&isTOTM(scene))handleAfkSceneUpdate(scene,p);
  }
};
const isTOTM=s=>!!getF(s,FLAG_TOTM);
const rPath=(o,p)=>{if(!p||!o)return;return p.split(".").reduce((a,k)=>a?.[k],o);};

const DEF_CONDS=[{id:"slow",label:"Slow",icon:"fas fa-shoe-prints",color:"totm-cond-slow"},{id:"dazed",label:"Dazed",icon:"fas fa-dizzy",color:"totm-cond-dazed"},{id:"weak",label:"Weak",icon:"fas fa-heart-broken",color:"totm-cond-weak"},{id:"shaken",label:"Shaken",icon:"fas fa-wind",color:"totm-cond-shaken"}];
const PRESETS={dnd5e:{l:"D&D 5e",hp:"system.attributes.hp.value",hpM:"system.attributes.hp.max"},pf2e:{l:"PF2e",hp:"system.attributes.hp.value",hpM:"system.attributes.hp.max"},custom:{l:"Custom",hp:"",hpM:""}}; 
const COLORS=[{v:"res-hp",l:"Green",i:"fas fa-heart"},{v:"res-1",l:"Blue",i:"fas fa-tint"},{v:"res-2",l:"Purple",i:"fas fa-gem"},{v:"res-3",l:"Gold",i:"fas fa-bolt"}];
const DAMAGE_TYPES=["physical","air","bolt","dark","earth","fire","ice","light","poison","untyped"];
const UI_THEMES=[{id:"classic",label:"Classic",icon:"fas fa-mask"},{id:"persona",label:"Persona",icon:"fas fa-star"},{id:"final-fantasy",label:"Final Fantasy",icon:"fas fa-crystal-ball"},{id:"digimon",label:"Digimon",icon:"fas fa-bolt"},{id:"helluva",label:"Helluva",icon:"fas fa-fire"}];
const LOCAL_TARGETS=new Map();
const ENEMY_FADE_MS=700;
const SCENE_IMAGE_SWAP_MS=350;
const BG_FADE_MS=1600;
const MIN_STAGE_ENTITY_SCALE=1;
const MAX_STAGE_ENTITY_SCALE=2000;
let CLOCKS_OPEN=false;
let MINIMAP_OPEN=false;
let MINIMAP_EDITING=false;
let MINIMAP_POPPED=false;
let MINIMAP_SELECTED_PIN_ID="";
let MINIMAP_POPUP=null;
const MINIMAP_VIEW_STATE={left:360,top:74,size:320};
let LOCAL_PIN_DRAG_COUNT=0;
let PENDING_PIN_REFRESH_SCENE_ID=null;
const HAS_FORM_APPLICATION=typeof globalThis.FormApplication==="function";
const getThemeMeta=id=>UI_THEMES.find(t=>t.id===id)||UI_THEMES[0];
const nextThemeId=id=>UI_THEMES[(Math.max(0,UI_THEMES.findIndex(t=>t.id===id))+1)%UI_THEMES.length].id;
const questPinSvg=(label,bg="#1d3557",fg="#fff")=>`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="42" fill="${bg}" stroke="rgba(255,255,255,.85)" stroke-width="6"/><text x="48" y="60" text-anchor="middle" font-size="52" font-family="Arial, sans-serif" font-weight="700" fill="${fg}">${label}</text></svg>`)}`;
const getQuestPinImage=type=>type==="question"?questPinSvg("?","#8d5cf6"):type==="complete"?questPinSvg("v","#2f9e44"):questPinSvg("!","#d97706");
const getUserTargetColor=()=>game.user?.color?.css||game.user?.color?.toString?.()||String(game.user?.color||"#ff6a00");
const getColorForUser=u=>u?.color?.css||u?.color?.toString?.()||String(u?.color||"#ff6a00");
function getActorPinUser(actorId){const actor=game.actors.get(actorId);if(!actor)return null;const owners=(game.users?.contents||[]).filter(u=>u.active&&actor.testUserPermission?.(u,"OWNER")&&!u.isGM);return owners[0]||game.users?.contents?.find?.(u=>actor.testUserPermission?.(u,"OWNER"))||null;}
function getActorPinColor(actorId){return getColorForUser(getActorPinUser(actorId));}
function getGmPinColor(){return getColorForUser(game.users?.activeGM||game.users?.find?.(u=>u.isGM));}
const getUserAfkMap=(u=game.user)=>{
  if(!u)return {};
  const raw=u?.getFlag?.(MODULE_ID,FLAG_USER_AFK);
  if(raw&&typeof raw==="object"&&!Array.isArray(raw))return foundry.utils.deepClone(raw);
  const scopeFlags=foundry.utils.getProperty(u,`flags.${MODULE_ID}`)||{};
  const nested=scopeFlags?.[FLAG_USER_AFK];
  if(nested&&typeof nested==="object"&&!Array.isArray(nested))return foundry.utils.deepClone(nested);
  return {};
};
const getActorOwnerUsers=actorId=>{const actor=game.actors.get(actorId);if(!actor)return[];return (game.users?.contents||[]).filter(u=>!u.isGM&&actor.testUserPermission?.(u,"OWNER"));};
const isActorAfkByUser=actorId=>getActorOwnerUsers(actorId).some(u=>getUserAfkMap(u)?.[actorId]);
async function setUserAfk(actorId,active,u=game.user){
  if(!u||!actorId)return;
  const map=getUserAfkMap(u);
  if(active)map[actorId]=true;
  else delete map[actorId];
  await u.setFlag(MODULE_ID,FLAG_USER_AFK,map);
  await u.unsetFlag(MODULE_ID,`${FLAG_USER_AFK}.${actorId}`).catch(()=>{});
}
function getActorStatus(entry){if(!entry)return"";const status=entry.status||"";return status==="targeted"?"":status;}
async function handleAfkSceneUpdate(scene,message){
  const actorId=message?.payload?.actorId;
  if(!actorId)return;
  const d=getData(scene);
  const actor=d.actors?.find?.(a=>a.id===actorId);
  if(!actor)return;
  actor.status=actor.status==="afk"?"":"afk";
  await saveData(scene,d);
  emit();
  if(scene.id===game.scenes.viewed?.id)refreshChangedAreas(scene,d);
}
async function toggleActorAfkStatus(scene,d,actorId){
  if(!scene||!actorId)return;
  if(isGM()){
    const actor=d.actors?.find?.(a=>a.id===actorId);
    if(!actor)return;
    actor.status=actor.status==="afk"?"":"afk";
    await saveData(scene,d);
    emit();
    refreshChangedAreas(scene,d);
    return;
  }
  emitAfkToggle(scene.id,{actorId});
}
const hasClockModule=()=>!!(game.modules.get("global-progress-clocks")?.active&&window.clockDatabase);
const defaultAnimSettings=()=>Object.fromEntries([...DAMAGE_TYPES,"defeat"].map(k=>[k,{path:"",duration:1200}]));
const getAnimSettings=()=>foundry.utils.mergeObject(defaultAnimSettings(),game.settings.get(MODULE_ID,"damageAnimations")||{},{inplace:false,overwrite:true});

function regSettings(){
  game.settings.register(MODULE_ID,"systemPreset",{name:"System Preset",scope:"world",config:true,type:String,default:"custom",choices:Object.fromEntries(Object.entries(PRESETS).map(([k,v])=>[k,v.l]))});
  game.settings.register(MODULE_ID,"subtitlePath",{name:"Subtitle Path",scope:"world",config:true,type:String,default:""});
  game.settings.register(MODULE_ID,"portraitSource",{name:"Portrait Source",scope:"world",config:true,type:String,default:"actor",choices:{actor:"Actor Art",token:"Token Image"}});
  game.settings.register(MODULE_ID,"uiTheme",{name:"UI Theme",scope:"world",config:true,type:String,default:"classic",choices:Object.fromEntries(UI_THEMES.map(t=>[t.id,t.label]))});
  game.settings.register(MODULE_ID,"conditions",{name:"Conditions JSON",scope:"world",config:true,type:String,default:JSON.stringify(DEF_CONDS)});
  game.settings.register(MODULE_ID,"playersCanAfk",{name:"Players Can AFK",scope:"world",config:true,type:Boolean,default:true});
  game.settings.register(MODULE_ID,"damageAnimations",{name:"Damage Animation Config",scope:"world",config:false,type:Object,default:defaultAnimSettings()});
  game.settings.register(MODULE_ID,"performanceMode",{name:loc("PerformanceMode","Performance Mode"),hint:loc("PerformanceModeHint","Reduces blur, glow, shadows, and animations for smoother play."),scope:"client",config:true,type:Boolean,default:false,onChange:()=>{const s=game.scenes.viewed;if(s&&isTOTM(s))scheduleRefresh(s);}});
  game.settings.register(MODULE_ID,"backgroundLibrarySize",{name:"Background Library Size",scope:"client",config:false,type:Object,default:{}});
  game.settings.register(MODULE_ID,"npcLibrarySize",{name:"NPC Library Size",scope:"client",config:false,type:Object,default:{}});
  game.settings.register(MODULE_ID,"encounterLibrarySize",{name:"Encounter Library Size",scope:"client",config:false,type:Object,default:{}});
  if(HAS_FORM_APPLICATION)game.settings.registerMenu(MODULE_ID,"damageAnimationMenu",{name:"Damage Animations",label:"Configure",hint:"Set JB2A or other video overlays for Fabula damage types and defeat.",icon:"fas fa-burst",type:TOTMDamageAnimSettings,restricted:true});
}
const getConds=()=>{try{return JSON.parse(game.settings.get(MODULE_ID,"conditions"));}catch{return DEF_CONDS;}};

// Resources
function discRes(id){const a=game.actors.get(id);if(!a)return[];const f=[];(function sc(o,px){if(!o||typeof o!=="object")return;for(const[k,v]of Object.entries(o)){const p=px?`${px}.${k}`:k;if(v&&typeof v==="object"&&!Array.isArray(v)){if("value"in v&&"max"in v&&typeof v.max==="number"&&v.max>0)f.push({label:p.split(".").filter(s=>!["system","attributes","resources"].includes(s)).join(" > ")||p,path:`${p}.value`,maxPath:`${p}.max`,value:+v.value,max:+v.max});sc(v,p);}}})(a.system,"system");return f;}
function getEncounterActor(e,scene=game.scenes.viewed){const td=scene&&e?.tokenId?scene.tokens.get(e.tokenId):null;return td?.actor||game.actors.get(e?.id)||null;}
function getAutoRes(actor,{enemy=false}={}){if(!actor?.system?.resources)return[];const res=[];const add=(label,icon,key,color)=>{const data=actor.system.resources?.[key],value=+data?.value,max=+data?.max;if(!Number.isFinite(value)||!Number.isFinite(max)||max<=0)return;res.push({value,max,label,icon,color});};add("HP","fas fa-heart","hp",enemy?"res-enemy-hp":"res-hp");add("MP","fas fa-droplet","mp",enemy?"res-enemy-mp":"res-mp");if(!enemy)add("IP","fas fa-briefcase","ip","res-ip");return res;}
function getRes(e,scene=game.scenes.viewed,{enemy=false,auto=true}={}){const a=getEncounterActor(e,scene);if(!a)return[];const manual=(e.resources||[]).map(r=>{if(!r.path||!r.maxPath)return null;const v=rPath(a,r.path),m=rPath(a,r.maxPath);if(v==null||m==null||m<=0)return null;return{value:+v,max:+m,label:r.label,icon:r.icon||"fas fa-circle",color:r.color||"res-hp"};}).filter(Boolean);if(auto){const labels=new Set(manual.map(r=>r.label));getAutoRes(a,{enemy}).forEach(r=>{if(!labels.has(r.label))manual.push(r);});}return manual;}
function makeRenderContext(scene,d){
  const actorCache=new Map();
  const resourceCache=new Map();
  const actorById=id=>{
    if(!id)return null;
    if(!actorCache.has(id))actorCache.set(id,game.actors.get(id)||null);
    return actorCache.get(id);
  };
  const cachedRes=(entry,opts={})=>{
    const key=`${opts.enemy?"enemy":"player"}:${opts.auto===false?"manual":"auto"}:${entry?.instanceId||entry?.id||""}`;
    if(!resourceCache.has(key))resourceCache.set(key,getRes(entry,scene,opts));
    return resourceCache.get(key);
  };
  return {actorById,cachedRes,d};
}
function getFabulaPoints(actor){const value=+actor?.system?.resources?.fp?.value;return Number.isFinite(value)?value:null;}
function getClockEntries(){if(!hasClockModule())return[];const db=window.clockDatabase,clockColors=game.settings.get("global-progress-clocks","clockColors"),defaultColor=game.settings.get("global-progress-clocks","defaultColor"),backgroundColor=game.settings.get("global-progress-clocks","defaultBackgroundColor"),entries=Object.values(game.settings.get("global-progress-clocks","activeClocks")||{});return entries.map(data=>({id:data.id,name:data.name||"New Clock",type:data.type||"clock",value:Math.clamp(data.value??0,0,data.max??0),max:data.max??4,private:!!data.private,visible:!data.private||game.user.isGM,editable:db.canUserEdit(game.user),color:clockColors.find(c=>c.id===data.colorId)?.color??defaultColor,backgroundColor,ratio:(data.max??0)>0?Math.max(0,Math.min(1,(data.value??0)/(data.max??1))):0,slashes:Array.from({length:data.max||0},(_,i)=>i<(data.value??0))})).filter(c=>c.visible);}
async function stepClock(clockId,delta){if(!hasClockModule())return;const db=window.clockDatabase;if(!db.canUserEdit?.(game.user))return;const clock=db.get(clockId);if(!clock)return;await db.update({id:clock.id,value:Math.clamp((clock.value??0)+delta,0,clock.max??0)});}
async function deleteClock(clockId){if(!hasClockModule())return;const db=window.clockDatabase;if(!db.canUserEdit(game.user))return;db.delete(clockId);}
const TOTMFormApplicationBase=HAS_FORM_APPLICATION?globalThis.FormApplication:class{};
class TOTMDamageAnimSettings extends TOTMFormApplicationBase{render(){openDamageAnimConfig();return this;}}
function damageAnimRows(){const cfg=getAnimSettings(),types=globalThis.CONFIG?.FU?.damageTypes||Object.fromEntries(DAMAGE_TYPES.map(k=>[k,k]));return[...DAMAGE_TYPES,"defeat"].map(key=>({key,label:key==="defeat"?"Defeat":game.i18n.localize(types[key]||key),path:cfg[key]?.path||"",duration:cfg[key]?.duration??1200}));}
function buildDamageAnimRowsHtml(rows){return rows.map(r=>`<div class="totm-dmgfx-row" style="display:grid;grid-template-columns:140px 1fr 110px;gap:8px;align-items:center;padding:8px;border:1px solid rgba(0,0,0,.15);border-radius:8px;background:rgba(0,0,0,.04);"><div class="totm-dmgfx-label" style="font-weight:700;">${foundry.utils.escapeHTML(String(r.label||r.key))}</div><div class="totm-dmgfx-path" style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;"><input type="text" name="${r.key}.path" value="${foundry.utils.escapeHTML(String(r.path||""))}" placeholder="modules/JB2A_DnD5e/..."/><button type="button" class="totm-dmgfx-btn" data-pick="${r.key}">Browse</button><button type="button" class="totm-dmgfx-btn" data-clear="${r.key}">Clear</button></div><div class="totm-dmgfx-duration" style="display:flex;align-items:center;gap:6px;"><input type="number" name="${r.key}.duration" value="${r.duration}" min="100" step="100"/><span>ms</span></div></div>`).join("");}
function buildDamageAnimDialogContent(rows){return `<form class="totm-dmgfx-form"><p class="notes">Set a JB2A or other video path and playback duration for each Fabula damage type. This keeps the config in module settings while combat rendering is kept separate.</p><div class="totm-dmgfx-grid" style="display:flex;flex-direction:column;gap:8px;max-height:65vh;overflow:auto;padding-right:4px;">${buildDamageAnimRowsHtml(rows)}</div></form>`;}
async function saveDamageAnimFromHtml(html){const next=defaultAnimSettings();for(const key of Object.keys(next)){next[key]={path:String(html.find(`[name="${key}.path"]`).val()||"").trim(),duration:Math.max(100,Number(html.find(`[name="${key}.duration"]`).val())||1200)};}await game.settings.set(MODULE_ID,"damageAnimations",next);}
function bindDamageAnimDialog(html){html.find("[data-pick]").on("click",ev=>{const key=ev.currentTarget.dataset.pick;new FilePicker({type:"video",callback:path=>html.find(`[name="${key}.path"]`).val(path)}).browse();});html.find("[data-clear]").on("click",ev=>{const key=ev.currentTarget.dataset.clear;html.find(`[name="${key}.path"]`).val("");});}
function openDamageAnimConfig(){const rows=damageAnimRows();new Dialog({title:"TOTM Damage Animations",content:buildDamageAnimDialogContent(rows),buttons:{save:{icon:'<i class="fas fa-save"></i>',label:"Save",callback:async html=>{await saveDamageAnimFromHtml(html);}}},default:"save",render:html=>{bindDamageAnimDialog(html);}}).render(true);}
function openClockCreateDialog(){if(!hasClockModule())return;const db=window.clockDatabase;if(!db.canUserEdit(game.user)){ui.notifications.warn("You do not have permission to create clocks.");return;}new Dialog({title:"Add Clock",content:`<form><div class="form-group"><label>Name</label><input name="name" placeholder="Danger Clock"/></div><div class="form-group"><label>Type</label><select name="type"><option value="clock">Clock</option><option value="tracker">Tracker</option><option value="points">Points</option></select></div><div class="form-group"><label>Max</label><input type="number" name="max" min="1" max="99" step="1" value="6"/></div><div class="form-group"><label><input type="checkbox" name="private"/> Private</label></div></form>`,buttons:{add:{icon:'<i class="fas fa-plus"></i>',label:"Add",callback:async h=>{const type=h.find("[name=type]").val(),maxRaw=+h.find("[name=max]").val(),max=Math.max(1,Math.min(type==="points"?99:type==="tracker"?12:128,Number.isFinite(maxRaw)?maxRaw:6));db.addClock({name:h.find("[name=name]").val().trim()||"New Clock",type,max,private:h.find("[name=private]").is(":checked")});CLOCKS_OPEN=true;const s=game.scenes.viewed;if(s&&isTOTM(s))refreshClockUi(s)||scheduleRefresh(s);}}},default:"add"}).render(true);}
function getImg(a){const src=game.settings.get(MODULE_ID,"portraitSource"),ac=game.actors.get(a.id);if(!ac)return a.img||"icons/svg/mystery-man.svg";return src==="token"?(ac.prototypeToken?.texture?.src||ac.img||"icons/svg/mystery-man.svg"):(ac.img||"icons/svg/mystery-man.svg");}
function makeEntry(actor,idx=0){const p=PRESETS[game.settings.get(MODULE_ID,"systemPreset")];const res=[];if(p?.hp)res.push({label:"HP",icon:"fas fa-heart",path:p.hp,maxPath:p.hpM,color:"res-hp"});return{id:actor.id,name:actor.name,img:actor.prototypeToken?.texture?.src||actor.img||"icons/svg/mystery-man.svg",artImg:actor.img||"icons/svg/mystery-man.svg",visible:true,highlighted:false,bgOffsetX:50,bgOffsetY:20,bgScale:150,bgAutoFit:false,combatImg:"",combatOffsetX:50,combatOffsetY:20,combatScale:150,combatAutoFit:false,status:"",conditions:[],resources:res,pinVisible:false,pinImg:actor.img||actor.prototypeToken?.texture?.src||"icons/svg/mystery-man.svg",pinSize:64,pinX:50,pinY:50};}
function getStageActorDefaultImage(actorOrId){
  const actor=typeof actorOrId==="string"?game.actors.get(actorOrId):actorOrId;
  if(!actor)return"icons/svg/mystery-man.svg";
  return actor.prototypeToken?.texture?.src||actor.img||"icons/svg/mystery-man.svg";
}
function makeStageActorEntry(actor,overrides={}){
  const linked=actor?makeEntry(actor):null;
  return foundry.utils.mergeObject({
    id:foundry.utils.randomID(),
    kind:"board-actor",
    actorId:actor?.id||"",
    name:actor?.name||"Character",
    image:getStageActorDefaultImage(actor),
    combatImage:linked?.combatImg||"",
    posX:50,
    posY:58,
    scale:100,
    combatPosX:null,
    combatPosY:null,
    combatScale:null
  },overrides,{inplace:false,overwrite:true});
}
function getStageActorLayout(entry,{inCombat=false}={}){
  if(inCombat){
    return {
      posX:Number.isFinite(+entry?.combatPosX)?+entry.combatPosX:(Number.isFinite(+entry?.posX)?+entry.posX:50),
      posY:Number.isFinite(+entry?.combatPosY)?+entry.combatPosY:(Number.isFinite(+entry?.posY)?+entry.posY:58),
      scale:Number.isFinite(+entry?.combatScale)?+entry.combatScale:(Number.isFinite(+entry?.scale)?+entry.scale:100)
    };
  }
  return {
    posX:Number.isFinite(+entry?.posX)?+entry.posX:50,
    posY:Number.isFinite(+entry?.posY)?+entry.posY:58,
    scale:Number.isFinite(+entry?.scale)?+entry.scale:100
  };
}
function getStageActorImage(entry,d,{inCombat=false}={}){
  const actor=game.actors.get(entry?.actorId);
  const linked=d?.actors?.find?.(a=>a.id===entry?.actorId);
  if(inCombat){
    return entry?.combatImage||linked?.combatImg||entry?.image||getStageActorDefaultImage(actor);
  }
  return entry?.image||linked?.artImg||linked?.img||getStageActorDefaultImage(actor);
}
const clampStageValue=(value,min,max,fallback)=>Number.isFinite(+value)?Math.max(min,Math.min(max,+value)):fallback;
function cacheSceneData(scene,d){
  if(scene?.id)SCENE_DATA_CACHE.set(scene.id,cloneData(normalizeSceneData(d)));
}
function normalizeBoardActorEntry(entry,actor){
  if(!entry||!actor)return null;
  entry.id ||= foundry.utils.randomID();
  entry.kind="board-actor";
  entry.actorId ||= actor.id;
  entry.actorId=actor.id;
  entry.name ||= actor.name||"Character";
  entry.image ||= getStageActorDefaultImage(actor);
  entry.posX=clampStageValue(entry.posX,0,100,50);
  entry.posY=clampStageValue(entry.posY,0,100,58);
  entry.scale=clampStageValue(entry.scale,MIN_STAGE_ENTITY_SCALE,MAX_STAGE_ENTITY_SCALE,100);
  if(entry.combatPosX===undefined)entry.combatPosX=null;
  else if(entry.combatPosX!==null)entry.combatPosX=Number.isFinite(+entry.combatPosX)?clampStageValue(entry.combatPosX,0,100,50):null;
  if(entry.combatPosY===undefined)entry.combatPosY=null;
  else if(entry.combatPosY!==null)entry.combatPosY=Number.isFinite(+entry.combatPosY)?clampStageValue(entry.combatPosY,0,100,58):null;
  if(entry.combatScale===undefined)entry.combatScale=null;
  else if(entry.combatScale!==null)entry.combatScale=Number.isFinite(+entry.combatScale)?clampStageValue(entry.combatScale,MIN_STAGE_ENTITY_SCALE,MAX_STAGE_ENTITY_SCALE,100):null;
  return entry;
}
function normalizeBoardActorSavedEntry(entry){
  if(!entry||typeof entry!=="object")return null;
  entry.id ||= foundry.utils.randomID();
  entry.kind="board-actor";
  entry.name ||= "Character";
  entry.image ||= "icons/svg/mystery-man.svg";
  entry.posX=clampStageValue(entry.posX,0,100,50);
  entry.posY=clampStageValue(entry.posY,0,100,58);
  entry.scale=clampStageValue(entry.scale,MIN_STAGE_ENTITY_SCALE,MAX_STAGE_ENTITY_SCALE,100);
  if(entry.combatPosX===undefined)entry.combatPosX=null;
  else if(entry.combatPosX!==null)entry.combatPosX=Number.isFinite(+entry.combatPosX)?clampStageValue(entry.combatPosX,0,100,50):null;
  if(entry.combatPosY===undefined)entry.combatPosY=null;
  else if(entry.combatPosY!==null)entry.combatPosY=Number.isFinite(+entry.combatPosY)?clampStageValue(entry.combatPosY,0,100,58):null;
  if(entry.combatScale===undefined)entry.combatScale=null;
  else if(entry.combatScale!==null)entry.combatScale=Number.isFinite(+entry.combatScale)?clampStageValue(entry.combatScale,MIN_STAGE_ENTITY_SCALE,MAX_STAGE_ENTITY_SCALE,100):null;
  return entry;
}
function repairBoardActors(d){
  if(!d)return {changed:false,removed:0,repaired:0};
  if(!Array.isArray(d.boardActors)){
    d.boardActors=[];
    return {changed:true,removed:0,repaired:0};
  }
  let changed=false,removed=0,repaired=0;
  const seen=new Set();
  d.boardActors=d.boardActors.filter(entry=>{
    const actor=game.actors.get(entry?.actorId);
    if(!actor){
      if(!isGM()&&entry&&typeof entry==="object"){
        const key=entry.actorId||entry.id;
        if(key&&seen.has(key)){
          removed++;
          changed=true;
          return false;
        }
        if(key)seen.add(key);
        const before=JSON.stringify(entry);
        normalizeBoardActorSavedEntry(entry);
        if(before!==JSON.stringify(entry)){
          repaired++;
          changed=true;
        }
        return true;
      }
      removed++;
      changed=true;
      return false;
    }
    if(seen.has(actor.id)){
      removed++;
      changed=true;
      return false;
    }
    seen.add(actor.id);
    const before=JSON.stringify(entry);
    normalizeBoardActorEntry(entry,actor);
    if(before!==JSON.stringify(entry)){
      repaired++;
      changed=true;
    }
    return true;
  });
  return {changed,removed,repaired};
}
function repairBoardActorsData(d,{forceVisible=false}={}){
  const result=repairBoardActors(d);
  if(d&&forceVisible&&d.boardActorsVisible===false){
    d.boardActorsVisible=true;
    result.changed=true;
  }
  return result.changed;
}
function hasSceneEntityAltImage(entity){
  return !!String(entity?.altImage||"").trim();
}
function getSceneEntityImage(entity){
  if(!entity)return"icons/svg/mystery-man.svg";
  const base=String(entity.image||"").trim()||"icons/svg/mystery-man.svg";
  const alt=String(entity.altImage||"").trim();
  return entity.useAltImage&&alt?alt:base;
}
function getSceneEntityLayout(entity){
  const useAltLayout=!!(entity?.useAltImage&&entity?.altAllowReposition);
  return {
    posX:useAltLayout&&Number.isFinite(+entity?.altPosX)?+entity.altPosX:(Number.isFinite(+entity?.posX)?+entity.posX:50),
    posY:useAltLayout&&Number.isFinite(+entity?.altPosY)?+entity.altPosY:(Number.isFinite(+entity?.posY)?+entity.posY:50),
    scale:entity?.useAltImage&&Number.isFinite(+entity?.altScale)?+entity.altScale:(Number.isFinite(+entity?.scale)?+entity.scale:100)
  };
}
function getSceneEntityLayoutTarget(entity){
  return entity?.useAltImage&&entity?.altAllowReposition?"alt":"base";
}
function setSceneEntityLayout(entity,{posX,posY,scale}={}){
  if(!entity)return;
  if(getSceneEntityLayoutTarget(entity)==="alt"){
    if(Number.isFinite(+posX))entity.altPosX=+posX;
    if(Number.isFinite(+posY))entity.altPosY=+posY;
    if(Number.isFinite(+scale))entity.altScale=+scale;
    return;
  }
  if(Number.isFinite(+posX))entity.posX=+posX;
  if(Number.isFinite(+posY))entity.posY=+posY;
  if(Number.isFinite(+scale))entity.scale=+scale;
}
async function getImageMaxDimension(src){
  const path=String(src||"").trim();
  if(!path)return 0;
  return await new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(Math.max(img.naturalWidth||0,img.naturalHeight||0));
    img.onerror=()=>resolve(0);
    img.src=path;
  });
}
async function syncSceneEntityAltLayout(entity,{image,allowReposition=false}={}){
  if(!entity)return;
  const activeLayout=getSceneEntityLayout(entity);
  entity.altAllowReposition=!!allowReposition;
  entity.altPosX=activeLayout.posX;
  entity.altPosY=activeLayout.posY;
  if(entity.altAllowReposition){
    entity.altScale=activeLayout.scale;
    return;
  }
  const currentImage=getSceneEntityImage(entity);
  const [currentSize,nextSize]=await Promise.all([getImageMaxDimension(currentImage),getImageMaxDimension(image)]);
  if(currentSize>0&&nextSize>0){
    entity.altScale=Math.max(MIN_STAGE_ENTITY_SCALE,Math.min(MAX_STAGE_ENTITY_SCALE,activeLayout.scale*(currentSize/nextSize)));
    return;
  }
  entity.altScale=activeLayout.scale;
}
function markSceneEntityImageSwap(entity){
  if(entity)entity.imageSwapAt=Date.now();
}
function toggleSceneEntityImage(entity){
  if(!hasSceneEntityAltImage(entity))return false;
  entity.useAltImage=!entity.useAltImage;
  markSceneEntityImageSwap(entity);
  return true;
}
async function commitBoardActorPlacement(scene,entryId,actorId,proxy,{combat=false}={}){
  const d=getData(scene);
  if(!Array.isArray(d.boardActors))d.boardActors=[];
  let entry=d.boardActors.find(e=>e?.id===entryId);
  if(!entry&&actorId)entry=d.boardActors.find(e=>e?.actorId===actorId);
  const actor=game.actors.get(actorId||entry?.actorId);
  if(!entry||!actor){
    ui.notifications.error("Could not commit board character placement.");
    console.error("TOTM commitBoardActorPlacement failed", {entryId,actorId,proxy,d});
    return;
  }
  normalizeBoardActorEntry(entry,actor);
  d.boardActorsVisible=true;
  if(combat){
    entry.combatPosX=clampStageValue(proxy?.posX,0,100,entry.combatPosX??entry.posX??50);
    entry.combatPosY=clampStageValue(proxy?.posY,0,100,entry.combatPosY??entry.posY??58);
    entry.combatScale=clampStageValue(proxy?.scale,MIN_STAGE_ENTITY_SCALE,MAX_STAGE_ENTITY_SCALE,entry.combatScale??entry.scale??100);
  }else{
    entry.posX=clampStageValue(proxy?.posX,0,100,entry.posX??50);
    entry.posY=clampStageValue(proxy?.posY,0,100,entry.posY??58);
    entry.scale=clampStageValue(proxy?.scale,MIN_STAGE_ENTITY_SCALE,MAX_STAGE_ENTITY_SCALE,entry.scale??100);
  }
  repairBoardActorsData(d,{forceVisible:true});
  cacheSceneData(scene,d);
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
}
function openStageActorLayoutPos(scene,d,entry,{combat=false}={}){
  const live=getData(scene);
  repairBoardActorsData(live,{forceVisible:true});
  const entryId=entry?.id||"";
  const actorId=entry?.actorId||"";
  const liveEntry=live.boardActors?.find(e=>e?.id===entryId)||live.boardActors?.find(e=>e?.actorId===actorId);
  const actor=game.actors.get(liveEntry?.actorId||actorId);
  if(!liveEntry||!actor){
    ui.notifications.error("Could not open board character placement controls.");
    return;
  }
  normalizeBoardActorEntry(liveEntry,actor);
  const layout=getStageActorLayout(liveEntry,{inCombat:combat});
  const proxy={
    kind:"board-actor",
    id:liveEntry.id,
    actorId:liveEntry.actorId,
    name:`${liveEntry.name}${combat?" (Combat)":" (Scene)"}`,
    image:getStageActorImage(liveEntry,live,{inCombat:combat}),
    posX:layout.posX,
    posY:layout.posY,
    scale:layout.scale
  };
  openDragPos(proxy,scene,live,()=>commitBoardActorPlacement(scene,liveEntry.id,liveEntry.actorId,proxy,{combat}));
}
function getBoardActorFromElement(scene,el){
  const d=getData(scene);
  if(!Array.isArray(d.boardActors))return null;

  const boardActorId=el?.dataset?.boardActorId;
  const actorId=el?.dataset?.actorId;
  const baidx=Number(el?.dataset?.baidx);

  let entry=null;
  let index=-1;

  if(boardActorId){
    index=d.boardActors.findIndex(e=>e?.id===boardActorId);
    entry=d.boardActors[index];
  }

  if(!entry&&actorId){
    index=d.boardActors.findIndex(e=>e?.actorId===actorId);
    entry=d.boardActors[index];
  }

  if(!entry&&Number.isInteger(baidx)&&d.boardActors[baidx]){
    index=baidx;
    entry=d.boardActors[index];
  }

  const actor=game.actors.get(entry?.actorId||actorId);

  if(!entry||!actor)return null;

  normalizeBoardActorEntry(entry,actor);

  return {d,entry,index,actor};
}
const makeEnemyInstanceId=()=>foundry.utils.randomID();
const enemyTargetId=e=>e?.instanceId||e?.id;
function stripDescriptionHtml(value){
  const raw=String(value??"").trim();
  if(!raw)return"";
  if(typeof document!=="undefined"){
    const node=document.createElement("div");
    node.innerHTML=raw;
    return String(node.textContent||node.innerText||"").replace(/\s+/g," ").trim();
  }
  return raw.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}
function cleanDescriptionValue(value){
  if(value==null)return"";
  if(typeof value==="string")return stripDescriptionHtml(value);
  if(typeof value?.value==="string")return stripDescriptionHtml(value.value);
  if(typeof value?.public==="string")return stripDescriptionHtml(value.public);
  if(typeof value?.full==="string")return stripDescriptionHtml(value.full);
  return"";
}
function getActorDescription(actor){
  const paths=["system.description","system.description.value","system.details.description","system.details.description.value","system.details.biography.value","system.biography","system.biography.value","system.notes","system.notes.value"];
  for(const path of paths){
    const text=cleanDescriptionValue(foundry.utils.getProperty(actor,path));
    if(text)return text;
  }
  return"";
}
function makeEnemyEntry(actor,overrides={}){const entry=makeEntry(actor);const made=foundry.utils.mergeObject({instanceId:makeEnemyInstanceId(),id:actor.id,name:actor.name,image:actor.prototypeToken?.texture?.src||actor.img||"icons/svg/mystery-man.svg",description:getActorDescription(actor),reveal:{name:false,image:false,description:false},posX:30+Math.random()*40,posY:55+Math.random()*20,scale:100,tokenId:null,resources:entry.resources,phaseEnabled:false,nextFormId:"",nextFormName:"",nextFormImage:"",nextPosX:null,nextPosY:null,nextScale:null,phaseUsed:false,transitionState:"",transitionAt:0,pendingPhasePrompt:false},overrides,{inplace:false,overwrite:true});return normalizeEnemyEntry(made);}
function normalizeEnemyEntry(enemy){if(!enemy)return enemy;if(!enemy.instanceId)enemy.instanceId=makeEnemyInstanceId();if(enemy.transitionState==null)enemy.transitionState="";if(enemy.transitionAt==null)enemy.transitionAt=0;if(enemy.pendingPhasePrompt==null)enemy.pendingPhasePrompt=false;if(enemy.phaseUsed==null)enemy.phaseUsed=false;if(enemy.description==null){const actor=globalThis.game?.actors?.get?.(enemy.id);enemy.description=actor?getActorDescription(actor):"";}if(!enemy.reveal||typeof enemy.reveal!=="object"||Array.isArray(enemy.reveal))enemy.reveal={};["name","image","description"].forEach(key=>{enemy.reveal[key]=enemy.reveal[key]==null?!!enemy[`${key}Revealed`]:!!enemy.reveal[key];});return enemy;}
const playerProxyFlags=actorId=>({[MODULE_ID]:{[FLAG_PLAYER_PROXY]:true,actorId}});
function getPlayerTokenDoc(scene,actorId){if(!scene||!actorId)return null;return scene.tokens.find(t=>t.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)&&t.actor?.id===actorId)||null;}
async function ensurePlayerTokenDoc(scene,actorId,index=0){let td=getPlayerTokenDoc(scene,actorId);if(td)return td;if(!isGM())return null;const actor=game.actors.get(actorId);if(!actor)return null;const base=actor.prototypeToken?.toObject?.()||{};const data=foundry.utils.mergeObject(base,{actorId:actor.id,actorLink:true,hidden:false,alpha:0,name:`TOTM ${actor.name}`,x:index*100,y:80,flags:playerProxyFlags(actor.id)},{inplace:false,overwrite:true,insertKeys:true,insertValues:true});const [created]=await scene.createEmbeddedDocuments("Token",[data]);return created||null;}
async function ensurePlayerTokenDocs(scene,d){if(!scene||!isGM()||!(d.actors||[]).length)return false;let changed=false;for(let i=0;i<d.actors.length;i++){const a=d.actors[i];const td=await ensurePlayerTokenDoc(scene,a.id,i);if(td)changed=true;}return changed;}
function getActorTokenDocs(actorId,scene=game.scenes.viewed){if(!scene||!actorId)return[];return scene.tokens.filter(t=>t.actor?.id===actorId&&(!t.getFlag(MODULE_ID,FLAG_PROXY)||t.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)));}
function getActorTokenPlaceables(actorId,scene=game.scenes.viewed){const layer=canvas?.tokens;if(!layer||!scene||scene.id!==game.scenes.viewed?.id)return[];return layer.placeables.filter(t=>t.actor?.id===actorId&&(!t.document?.getFlag(MODULE_ID,FLAG_PROXY)||t.document?.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)));}
const isPlayerProxyDoc=t=>!!t?.getFlag?.(MODULE_ID,FLAG_PLAYER_PROXY);
const isPlayerProxyPlaceable=t=>!!t?.document?.getFlag?.(MODULE_ID,FLAG_PLAYER_PROXY);
function pickActorTargetDoc(docs=[]){return docs.find(isPlayerProxyDoc)||docs.find(t=>!t.getFlag(MODULE_ID,FLAG_PROXY))||docs[0]||null;}
function pickActorTargetPlaceable(tokens=[]){return tokens.find(isPlayerProxyPlaceable)||tokens.find(t=>!t.document?.getFlag(MODULE_ID,FLAG_PROXY))||tokens[0]||null;}
function getUserTargetTokenIds(){return Array.from(game.user.targets||[]).map(t=>t.id).filter(Boolean);}
function isActorTargetTokenId(tokenId,scene=game.scenes.viewed){const doc=scene?.tokens?.get?.(tokenId);return !!doc&&(!doc.getFlag(MODULE_ID,FLAG_PROXY)||doc.getFlag(MODULE_ID,FLAG_PLAYER_PROXY));}
function isActorLocallyTargeted(actorId,scene=game.scenes.viewed){const tokens=getActorTokenPlaceables(actorId,scene);return tokens.some(t=>game.user.targets.has(t)||t.controlled);}
function isActorTargeted(actorId,scene=game.scenes.viewed){const tokens=getActorTokenPlaceables(actorId,scene);return tokens.some(t=>game.user.targets.has(t)||t.controlled||(t.targeted?.size??0)>0);}
function getActorTargetUsers(actorId,scene=game.scenes.viewed){return getTargetUsersFromTokens(getActorTokenPlaceables(actorId,scene));}
function getUserControlledActorId(d=getData(game.scenes.viewed),user=game.user){
  const actors=(d?.actors||[]).filter(a=>a.visible!==false);
  const characterId=user?.character?.id;
  if(characterId&&actors.some(a=>a.id===characterId)&&game.actors.get(characterId)?.isOwner)return characterId;
  return actors.find(a=>game.actors.get(a.id)?.isOwner)?.id||"";
}
function ensureUserPlayerProxyControlled(scene=game.scenes.viewed,d=getData(scene),{releaseOthers=false}={}){
  if(isGM()||!scene||scene.id!==game.scenes.viewed?.id||!isTOTM(scene))return false;
  const layer=canvas?.tokens;
  if(!layer)return false;
  const actorId=getUserControlledActorId(d);
  if(!actorId)return false;
  const token=pickActorTargetPlaceable(getActorTokenPlaceables(actorId,scene));
  if(!token||token.controlled||!token.actor?.isOwner)return !!token?.controlled;
  token.control({releaseOthers});
  return true;
}
async function syncActorTargets(actorId,{exclusive=true}={},scene=game.scenes.viewed){let actorDocs=getActorTokenDocs(actorId,scene),actorTokens=getActorTokenPlaceables(actorId,scene),layer=canvas?.tokens;if(!actorDocs.length&&isGM()){await ensurePlayerTokenDoc(scene,actorId,(d=>d?.actors?.findIndex?.(a=>a.id===actorId))(getData(scene)));actorDocs=getActorTokenDocs(actorId,scene);actorTokens=getActorTokenPlaceables(actorId,scene);}const targetDoc=pickActorTargetDoc(actorDocs);if(!targetDoc)return false;const actorDocIds=actorDocs.map(t=>t.id);const actorTokenIds=[...new Set([...(exclusive?[]:getUserTargetTokenIds().filter(id=>!actorDocIds.includes(id))),targetDoc.id])];const targetToken=layer?.placeables?.find?.(t=>t.id===targetDoc.id)||pickActorTargetPlaceable(actorTokens);if(typeof game.user.updateTokenTargets==="function")game.user.updateTokenTargets(actorTokenIds);if(!layer)return true;const allSceneActorTokens=layer.placeables.filter(t=>!t.document?.getFlag(MODULE_ID,FLAG_PROXY)||t.document?.getFlag(MODULE_ID,FLAG_PLAYER_PROXY));if(exclusive){allSceneActorTokens.forEach(t=>{if(!actorTokenIds.includes(t.id)&&game.user.targets.has(t))t.setTarget(false,{user:game.user,releaseOthers:false,groupSelection:true});if(t.controlled&&!actorTokenIds.includes(t.id))t.release();});}actorTokens.forEach(t=>{if(t.id!==targetDoc.id&&(game.user.targets.has(t)||t.controlled)){if(game.user.targets.has(t))t.setTarget(false,{user:game.user,releaseOthers:false,groupSelection:true});if(t.controlled)t.release();}});if(targetToken){targetToken.setTarget(true,{user:game.user,releaseOthers:exclusive,groupSelection:false});if(!targetToken.controlled)targetToken.control({releaseOthers:exclusive});}return true;}
async function clearSingleActorTarget(actorId,scene=game.scenes.viewed){const actorDocs=getActorTokenDocs(actorId,scene),actorDocIds=actorDocs.map(t=>t.id);if(!actorDocIds.length)return false;const nextIds=getUserTargetTokenIds().filter(id=>!actorDocIds.includes(id));if(typeof game.user.updateTokenTargets==="function")game.user.updateTokenTargets(nextIds);const layer=canvas?.tokens;if(layer)layer.placeables.filter(t=>actorDocIds.includes(t.id)).forEach(t=>{if(game.user.targets.has(t))t.setTarget(false,{user:game.user,releaseOthers:false,groupSelection:true});if(t.controlled)t.release();});ensureUserPlayerProxyControlled(scene);if(!updateTargetHighlights(scene))scheduleRefresh(scene);return true;}
async function clearActorTargets(scene=game.scenes.viewed){const layer=canvas?.tokens;if(typeof game.user.updateTokenTargets==="function")game.user.updateTokenTargets(getUserTargetTokenIds().filter(id=>!isActorTargetTokenId(id,scene)));if(!layer)return true;layer.placeables.filter(t=>!t.document?.getFlag(MODULE_ID,FLAG_PROXY)||t.document?.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)).forEach(t=>{if(game.user.targets.has(t))t.setTarget(false,{user:game.user,releaseOthers:false,groupSelection:true});if(t.controlled)t.release();});ensureUserPlayerProxyControlled(scene);if(!updateTargetHighlights(scene))scheduleRefresh(scene);return true;}
async function togglePlayerTarget(actorId,scene=game.scenes.viewed,{exclusive=false}={}){if(isActorLocallyTargeted(actorId,scene))return clearSingleActorTarget(actorId,scene);const ok=await syncActorTargets(actorId,{exclusive},scene);ensureUserPlayerProxyControlled(scene);if(ok&&!updateTargetHighlights(scene))scheduleRefresh(scene);return ok;}
const bgCfg=(src={})=>({bgPosX:Number.isFinite(+src.bgPosX)?+src.bgPosX:50,bgPosY:Number.isFinite(+src.bgPosY)?+src.bgPosY:50,bgZoom:Number.isFinite(+src.bgZoom)?+src.bgZoom:100,bgStretch:!!src.bgStretch});
function safeDecodeURIComponent(value){
  try{return decodeURIComponent(String(value||""));}catch{return String(value||"");}
}
function titleCaseGeneratedName(value){
  return String(value||"").replace(/\b([a-z])/g,match=>match.toUpperCase());
}
function isImagePath(value){
  const text=String(value||"").trim();
  return !!text&&/\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(text.split("?")[0]);
}
function cleanBackgroundNameFromPath(path){
  let base=String(path||"").split("/").pop()||"Background";
  base=base.replace(/\.[a-z0-9]+$/i,"");
  base=safeDecodeURIComponent(base);
  base=base.replace(/[_-]+/g," ");
  base=base.replace(/\b[a-f0-9]{8,}\b/gi,"");
  base=base.replace(/\s+/g," ").trim();
  return titleCaseGeneratedName(base)||"Background";
}
function displayBackgroundName(bg){
  const raw=String(bg?.name||"").trim();
  if(!raw)return cleanBackgroundNameFromPath(bg?.image);
  if(/%[0-9a-f]{2}/i.test(raw)||(!raw.includes(" ")&&raw.includes("_")))return cleanBackgroundNameFromPath(raw);
  return safeDecodeURIComponent(raw).replace(/\s+/g," ").trim()||cleanBackgroundNameFromPath(bg?.image);
}
function makeBgFromPath(path,source={}){
  path=String(path||"").trim();
  const fileName=cleanBackgroundNameFromPath(path);
  return {
    id:source.id||foundry.utils.randomID(),
    name:String(source.name||fileName).trim()||fileName,
    image:path,
    category:String(source.category||"Uncategorized").trim()||"Uncategorized",
    tags:normalizeTagString(source.tags||""),
    narration:String(source.narration||""),
    bgPosX:Number.isFinite(+source.bgPosX)?+source.bgPosX:50,
    bgPosY:Number.isFinite(+source.bgPosY)?+source.bgPosY:50,
    bgZoom:Number.isFinite(+source.bgZoom)?+source.bgZoom:100,
    bgStretch:!!source.bgStretch
  };
}
function normalizeBackgroundEntry(bg){
  const image=String(bg?.image||bg?.background||"").trim();
  const made=makeBgFromPath(image,bg||{});
  return foundry.utils.mergeObject(bg||{},made,{inplace:false,overwrite:true});
}
const setSceneBg=(d,src={},opts={})=>{const cfg=bgCfg(src);d.background=src.image??src.background??d.background??"";d.bgPosX=cfg.bgPosX;d.bgPosY=cfg.bgPosY;d.bgZoom=cfg.bgZoom;d.bgStretch=cfg.bgStretch;if("narration" in src)d.narration=src.narration||"";if(opts.animate!==false)d.bgFadeAt=Date.now();};
const getBgSizeCss=(zoom,stretch=false)=>{const z=Number.isFinite(+zoom)?+zoom:100;return stretch?(z<=100?"100% 100%":`${z}% auto`):`${z}%`;};
const getTargetMap=()=>Object.fromEntries(LOCAL_TARGETS);
const getTargets=(scene,u=game.user)=>{if(!scene)return[];if(u===game.user){const targeted=Array.from(game.user.targets).filter(t=>t.document?.getFlag(MODULE_ID,FLAG_PROXY)).map(t=>t.document?.getFlag(MODULE_ID,"enemyInstanceId")||t.actor?.id).filter(Boolean);const controlled=(canvas?.tokens?.controlled||[]).filter(t=>t.document?.getFlag(MODULE_ID,FLAG_PROXY)).map(t=>t.document?.getFlag(MODULE_ID,"enemyInstanceId")||t.actor?.id).filter(Boolean);const live=[...new Set([...targeted,...controlled])];if(live.length)return live;}return LOCAL_TARGETS.get(scene.id)||[];};
const proxyFlags=enemy=>({[MODULE_ID]:{[FLAG_PROXY]:true,enemyActorId:enemy.id,enemyInstanceId:enemyTargetId(enemy)}});
const getEnemyByTargetId=(d,targetId)=>{
  const enemies=(d.enemies||[]).map(normalizeEnemyEntry);
  const direct=enemies.find(e=>enemyTargetId(e)===targetId);
  if(direct)return direct;
  const hasInstanceIds=enemies.some(e=>!!e.instanceId);
  return hasInstanceIds?null:enemies.find(e=>e.id===targetId)||null;
};
function getEnemyTokenDoc(scene,enemy){
  if(!scene||!enemy)return null;
  normalizeEnemyEntry(enemy);
  const direct=enemy.tokenId?scene.tokens.get(enemy.tokenId):null;
  if(direct)return direct;
  const targetId=enemyTargetId(enemy);
  if(enemy.instanceId)return scene.tokens.find(t=>t.getFlag(MODULE_ID,FLAG_PROXY)&&t.getFlag(MODULE_ID,"enemyInstanceId")===targetId)||null;
  return scene.tokens.find(t=>t.getFlag(MODULE_ID,FLAG_PROXY)&&t.getFlag(MODULE_ID,"enemyActorId")===enemy.id)||null;
}
function getTargeterData(u){return{id:u?.id||u?.name||"",name:u?.name||"Targeting",color:u?.color?.css||u?.color?.toString?.()||String(u?.color||"#ff6a00"),img:u?.character?.img||u?.avatar||u?.character?.prototypeToken?.texture?.src||"icons/svg/mystery-man.svg"};}
function getTargetUsersFromTokens(tokens=[]){const users=[],seen=new Set();tokens.forEach(token=>{Array.from(token?.targeted||[]).forEach(u=>{const id=u?.id||u?.name;if(!id||seen.has(id))return;seen.add(id);users.push(getTargeterData(u));});});return users;}
function getEnemyTargetUsers(enemy,scene=game.scenes.viewed){const td=getEnemyTokenDoc(scene,enemy),token=td?canvas?.tokens?.get(td.id):null;return getTargetUsersFromTokens(token?[token]:[]);}
async function ensureEnemyTokenDoc(scene,d,enemy,index=0){normalizeEnemyEntry(enemy);let td=getEnemyTokenDoc(scene,enemy);if(td){if(enemy.tokenId!==td.id)enemy.tokenId=td.id;if(isGM()&&(td.hidden||td.alpha!==0||td.name!==`TOTM ${enemy.name}`||td.getFlag(MODULE_ID,"enemyInstanceId")!==enemyTargetId(enemy)))await td.update({hidden:false,alpha:0,name:`TOTM ${enemy.name}`,flags:proxyFlags(enemy)});return td;}if(!isGM())return null;const actor=game.actors.get(enemy.id);if(!actor)return null;const base=actor.prototypeToken?.toObject?.()||{};const data=foundry.utils.mergeObject(base,{actorId:actor.id,actorLink:false,hidden:false,alpha:0,name:`TOTM ${enemy.name}`,x:index*100,y:0,flags:proxyFlags(enemy)},{inplace:false,overwrite:true,insertKeys:true,insertValues:true});const [created]=await scene.createEmbeddedDocuments("Token",[data]);if(created)enemy.tokenId=created.id;return created||null;}
async function ensureEnemyTokenDocs(scene,d){if(!scene||!isGM()||!(d.enemies||[]).length)return false;let changed=false;for(let i=0;i<d.enemies.length;i++){const enemy=d.enemies[i],before=enemy.tokenId;const td=await ensureEnemyTokenDoc(scene,d,enemy,i);if(td&&enemy.tokenId!==before)changed=true;}return changed;}
async function syncFoundryTargets(scene,d,ids,u=game.user,{exclusive=true}={}){const tokenIds=[];for(let i=0;i<(ids||[]).length;i++){const enemy=getEnemyByTargetId(d,ids[i]);if(!enemy)continue;const td=getEnemyTokenDoc(scene,enemy)||(isGM()?await ensureEnemyTokenDoc(scene,d,enemy,i):null);if(td?.id)tokenIds.push(td.id);}if(u===game.user){const layer=canvas?.tokens;layer?.placeables?.filter(t=>t.document?.getFlag(MODULE_ID,FLAG_PROXY)).forEach(t=>{if(!tokenIds.includes(t.id)&&game.user.targets.has(t))t.setTarget(false,{user:game.user,releaseOthers:false,groupSelection:true});});tokenIds.forEach((id,i)=>{const token=layer?.get(id);if(token)token.setTarget(true,{user:game.user,releaseOthers:exclusive&&i===0,groupSelection:i<tokenIds.length-1});});}else if(typeof u.updateTokenTargets==="function")u.updateTokenTargets(tokenIds);return tokenIds;}
function syncFoundryControls(tokenIds=[]){const layer=canvas?.tokens;if(!layer)return;if(!isGM()){ensureUserPlayerProxyControlled();return;}layer.controlled.filter(t=>t.document?.getFlag(MODULE_ID,FLAG_PROXY)).forEach(t=>{if(!tokenIds.includes(t.id))t.release();});tokenIds.forEach((id,i)=>{const token=layer.get(id);if(token&&!token.controlled)token.control({releaseOthers:i===0});});}
function syncLiveTargetOverlay(card,show){const overlays=Array.from(card.querySelectorAll(".totm-status-overlay.status-targeted"));let overlay=overlays.find(node=>node.dataset.liveTarget==="1")||overlays[0];if(!show){overlays.forEach(node=>node.remove());return;}if(!overlay){overlay=document.createElement("div");overlay.className="totm-status-overlay status-targeted";overlay.innerHTML='<span class="totm-status-label">TARGETED</span>';card.prepend(overlay);}overlay.dataset.liveTarget="1";overlays.filter(node=>node!==overlay).forEach(node=>node.remove());}
function renderPlayerTargeters(targeters=[]){return targeters.map(t=>`<span class="totm-player-targeter" title="${attr(t.name)}" style="${attr(`--targeter-color:${t.color};background-image:${cssUrl(t.img)}`)}"></span>`).join("");}
function syncPlayerTargeters(card,targeters=[]){let targeterWrap=card.querySelector("[data-player-targeters]");if(!targeterWrap&&targeters.length){targeterWrap=document.createElement("div");targeterWrap.className="totm-player-targeters";targeterWrap.dataset.playerTargeters="1";(card.querySelector(".totm-player-portrait-frame")||card).append(targeterWrap);}if(targeterWrap)targeterWrap.innerHTML=renderPlayerTargeters(targeters);}
function updateTargetHighlights(scene,d=getData(scene)){
  const el=document.getElementById("totm-ui");
  if(!el||!scene||!isTOTM(scene))return false;
  el.style.setProperty("--totm-target-color",getUserTargetColor());
  const enemyTargets=new Set(getTargets(scene));
  el.querySelectorAll(".totm-scene-enemy[data-target-id], .totm-enemy-card[data-target-id]").forEach(node=>{
    const active=enemyTargets.has(node.dataset.targetId);
    node.classList.toggle("enemy-targeted",active);
    node.querySelector("[data-eact='target']")?.classList.toggle("active-target",active);
  });
  el.querySelectorAll(".totm-actor-card[data-actor-id]").forEach(card=>{
    const targeters=getActorTargetUsers(card.dataset.actorId,scene);
    const active=targeters.length>0||isActorTargeted(card.dataset.actorId,scene);
    const entry=(d?.actors||[]).find(a=>a.id===card.dataset.actorId);
    const status=getActorStatus(entry);
    card.classList.toggle("externally-targeted",active);
    card.querySelector("[data-act='target']")?.classList.toggle("active-target",active);
    syncPlayerTargeters(card,targeters);
    syncLiveTargetOverlay(card,active&&!status);
  });
  refreshPlayerPanelRenderKey(scene,d);
  return true;
}
async function setTargets(scene,ids,u=game.user,d=getData(scene),opts={}){const unique=ids?.length?[...new Set(ids)]:[];if(unique.length)LOCAL_TARGETS.set(scene.id,unique);else LOCAL_TARGETS.delete(scene.id);const tokenIds=await syncFoundryTargets(scene,d,unique,u,opts);if(u===game.user)syncFoundryControls(tokenIds);if(!updateTargetHighlights(scene,d))scheduleRefresh(scene);}
function targetableEnemies(d){return(d.enemies||[]).map(normalizeEnemyEntry).filter(e=>{const res=getRes(e);const hp=res.find(r=>r.label==="HP")?.value??1;return hp>0&&e.transitionState!=="out";});}
function typingInField(e){const t=e.target;return !!(t&&((t.tagName==="INPUT")||(t.tagName==="TEXTAREA")||(t.tagName==="SELECT")||t.isContentEditable));}
async function toggleEnemyTarget(scene,d,enemyId,{exclusive=true}={}){const cur=getTargets(scene),next=exclusive?(cur[0]===enemyId?[]:[enemyId]):(cur.includes(enemyId)?cur.filter(id=>id!==enemyId):[...cur,enemyId]);await setTargets(scene,next,game.user,d,{exclusive});}
async function targetNextEnemy(scene,d,{exclusive=true}={}){const enemies=targetableEnemies(d);if(!enemies.length){ui.notifications.warn("No enemies available to target.");return;}const curTargets=getTargets(scene),cur=curTargets[0],idx=enemies.findIndex(e=>enemyTargetId(e)===cur);let next;if(exclusive)next=enemies[(idx+1)%enemies.length];else{const targeted=new Set(curTargets),ordered=enemies.slice(Math.max(0,idx+1)).concat(enemies.slice(0,Math.max(0,idx+1)));next=ordered.find(e=>!targeted.has(enemyTargetId(e)));if(!next){ui.notifications.info("All enemies are already targeted.");return;}}await setTargets(scene,next?(exclusive?[enemyTargetId(next)]:[...curTargets,enemyTargetId(next)]):[],game.user,d,{exclusive});}
async function targetRandomEnemy(scene,d){const enemies=targetableEnemies(d);if(!enemies.length){ui.notifications.warn("No enemies available to target.");return;}const next=enemies[Math.floor(Math.random()*enemies.length)];await setTargets(scene,next?[enemyTargetId(next)]:[],game.user,d);}
async function targetRandomPlayer(scene,d){const players=(d.actors||[]).filter(a=>a.visible!==false);if(!players.length){ui.notifications.warn("No players available to target.");return;}const available=players.filter(a=>!isActorLocallyTargeted(a.id,scene));if(!available.length){ui.notifications.info("All visible players are already targeted.");return;}const next=available[Math.floor(Math.random()*available.length)];if(!await syncActorTargets(next.id,{exclusive:false},scene))ui.notifications.warn("No scene token found for that player.");if(!updateTargetHighlights(scene,d))scheduleRefresh(scene);}
async function targetNextPlayer(scene,d,{exclusive=false}={}){const players=(d.actors||[]).filter(a=>a.visible!==false);if(!players.length){ui.notifications.warn("No players available to target.");return;}const available=players.filter(a=>!isActorLocallyTargeted(a.id,scene));if(!available.length){ui.notifications.info("All visible players are already targeted.");return;}const current=players.findIndex(a=>isActorLocallyTargeted(a.id,scene));const start=current>=0?current+1:0;const next=players.slice(start).concat(players.slice(0,start)).find(a=>!isActorLocallyTargeted(a.id,scene))||available[0];if(!await syncActorTargets(next.id,{exclusive},scene))ui.notifications.warn("No scene token found for that player.");if(!updateTargetHighlights(scene,d))scheduleRefresh(scene);}
async function clearAttackTargets(scene,d=getData(scene)){
  await setTargets(scene,[],game.user,d);
  await clearActorTargets(scene);
}
async function targetRandomAttackPlayer(scene,d=getData(scene)){
  await setTargets(scene,[],game.user,d);
  await targetRandomPlayer(scene,d);
}
async function targetRandomAttackEnemy(scene,d=getData(scene)){
  await clearActorTargets(scene);
  await targetRandomEnemy(scene,d);
}
async function chooseAttackPlayerTarget(scene,d,actorId){
  await setTargets(scene,[],game.user,d);
  if(!await togglePlayerTarget(actorId,scene))ui.notifications.warn("No scene token found for that player.");
  if(!updateTargetHighlights(scene,d))scheduleRefresh(scene);
}
async function chooseAttackEnemyTarget(scene,d,targetId){
  await clearActorTargets(scene);
  await setTargets(scene,targetId?[targetId]:[],game.user,d);
}
function openAttackTargetChooser(scene,d=getData(scene),{scope="players"}={}){
  const players=(d.actors||[]).filter(a=>a.visible!==false);
  const enemies=targetableEnemies(d);
  const choices=scope==="enemies"
    ? enemies.map(enemy=>({kind:"enemy",id:enemyTargetId(enemy),label:enemy.name||"Enemy"}))
    : players.map(actor=>({kind:"player",id:actor.id,label:actor.name||"Player"}));
  if(!choices.length){
    ui.notifications.warn(scope==="enemies"?"No enemies available to target.":"No players available to target.");
    return;
  }
  new Dialog({
    title:scope==="enemies"?"Choose Enemy Target":"Choose Player Target",
    content:`<div class="totm-target-chooser">${choices.map(choice=>`<button type="button" class="totm-target-choice" data-kind="${attr(choice.kind)}" data-target-id="${attr(choice.id)}">${esc(choice.label)}</button>`).join("")}</div>`,
    buttons:{close:{icon:'<i class="fas fa-times"></i>',label:"Cancel"}},
    default:"close",
    render:html=>{
      html.find("[data-target-id]").on("click",async ev=>{
        const btn=ev.currentTarget;
        const live=getData(scene);
        if(btn.dataset.kind==="enemy")await chooseAttackEnemyTarget(scene,live,btn.dataset.targetId);
        else await chooseAttackPlayerTarget(scene,live,btn.dataset.targetId);
        html.closest(".app")?.find?.(".header-button.close")?.trigger?.("click");
      });
    }
  }).render(true);
}
async function pruneEnemyTokenDocs(scene,d){if(!scene||!isGM())return;const keep=new Set((d.enemies||[]).map(e=>e.tokenId).filter(Boolean));const stale=scene.tokens.filter(t=>t.getFlag(MODULE_ID,FLAG_PROXY)&&!keep.has(t.id)).map(t=>t.id);if(stale.length)await scene.deleteEmbeddedDocuments("Token",stale);}
async function prunePlayerTokenDocs(scene,d){if(!scene||!isGM())return;const keep=new Set((d.actors||[]).map(a=>a.id));const stale=scene.tokens.filter(t=>t.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)&&!keep.has(t.actor?.id)).map(t=>t.id);if(stale.length)await scene.deleteEmbeddedDocuments("Token",stale);}
async function clearEncounterState(scene,d){
  if(isGM()&&(d.combatActive||(d.enemies||[]).length)){
    const ok=await confirmDestructive({title:"Clear Encounter State?",content:"This clears the active encounter and removes TOTM enemy proxies.",yes:"Clear"});
    if(!ok)return;
  }
  d.combatActive=false;
  d.enemies=[];
  if(d.preEncounterView){
    setSceneBg(d,d.preEncounterView,{animate:true});
    d.narration=d.preEncounterView.narration||"";
    if("featuredArt" in d.preEncounterView)d.featuredArt=d.preEncounterView.featuredArt||"";
    if("featuredCaption" in d.preEncounterView)d.featuredCaption=d.preEncounterView.featuredCaption||"";
    d.preEncounterView=null;
  }
  await setTargets(scene,[],game.user,d);
  await pruneEnemyTokenDocs(scene,d);
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
}
async function clearCurrentBackgroundProps(scene,d){
  const ok=await confirmDestructive({title:"Wipe Props?",content:"Remove props from the current background. Does not remove player/board character icons.",yes:"Wipe Props"});
  if(!ok)return;
  const key=String(d.background||"");
  if(!key){
    d.props=[];
    d.propsByBackground={};
  }else{
    if(!d.propsByBackground || typeof d.propsByBackground!=="object" || Array.isArray(d.propsByBackground)) d.propsByBackground={};
    d.propsByBackground[key]=[];
    d.props=[];
  }
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
  ui.notifications.warn("Cleared all props on the current background.");
}
async function clearBoardActors(scene=game.scenes.viewed,{notify=true}={}){
  if(!game.user.isGM||!scene||!isTOTM(scene))return;
  const d=getData(scene);
  d.boardActors=[];
  d.boardActorsVisible=true;
  cacheSceneData(scene,d);
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
  if(notify)ui.notifications.warn("Cleared TOTM board character placements.");
}
async function repairBoardActorsForScene(scene=game.scenes.viewed,{notify=true}={}){
  if(!game.user.isGM||!scene||!isTOTM(scene))return;
  const d=getData(scene);
  repairBoardActorsData(d,{forceVisible:true});
  d.boardActorsVisible=true;
  cacheSceneData(scene,d);
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
  if(notify)ui.notifications.info("Repaired/revealed TOTM board character placements.");
}
async function revealBoardActors(scene=game.scenes.viewed,{notify=true}={}){
  if(!game.user.isGM||!scene||!isTOTM(scene))return;
  const d=getData(scene);
  repairBoardActorsData(d,{forceVisible:true});
  d.boardActorsVisible=true;
  cacheSceneData(scene,d);
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
  if(notify)ui.notifications.info("Revealed/repaired TOTM board characters.");
}
function debugBoardActors(scene=game.scenes.viewed){
  if(!game.user.isGM||!scene)return null;
  const d=getData(scene);
  const dom=[...document.querySelectorAll("#totm-board-actor-layer .totm-stage-actor")];
  const report={
    scene:scene?.name,
    boardActorsVisible:d.boardActorsVisible,
    boardActors:d.boardActors,
    domCount:dom.length,
    dom:dom.map(el=>{
      const rect=el.getBoundingClientRect();
      const style=getComputedStyle(el);
      return {
        actorId:el.dataset.actorId,
        boardActorId:el.dataset.boardActorId,
        rect:rect.toJSON?.()||{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
        display:style.display,
        visibility:style.visibility,
        opacity:style.opacity,
        zIndex:style.zIndex,
        img:el.querySelector("img")?.src
      };
    })
  };
  console.warn("TOTM board actor debug", report);
  ui.notifications.info(`Board actors: ${d.boardActors?.length||0}, DOM: ${dom.length}`);
  return report;
}
function reorderStageActorEntries(d,fromIndex,toIndex){
  if(!Array.isArray(d.boardActors))d.boardActors=[];
  if(fromIndex===toIndex)return null;
  const maxIndex=d.boardActors.length-1;
  if(fromIndex<0||fromIndex>maxIndex||toIndex<0||toIndex>maxIndex)return null;
  const [entry]=d.boardActors.splice(fromIndex,1);
  if(!entry)return null;
  d.boardActors.splice(toIndex,0,entry);
  return entry;
}
async function moveStageActor(scene,d,idx,delta){
  d=getData(scene);
  repairBoardActorsData(d);
  const targetIdx=Math.max(0,Math.min((d.boardActors?.length||1)-1,idx+delta));
  if(targetIdx===idx)return;
  reorderStageActorEntries(d,idx,targetIdx);
  cacheSceneData(scene,d);
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
}
async function moveStageActorToEdge(scene,d,idx,edge="front"){
  d=getData(scene);
  repairBoardActorsData(d);
  if(!Array.isArray(d.boardActors)||!d.boardActors[idx])return;
  const targetIdx=edge==="back"?0:d.boardActors.length-1;
  if(targetIdx===idx)return;
  reorderStageActorEntries(d,idx,targetIdx);
  cacheSceneData(scene,d);
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
}
async function removeStageActor(scene,d,entryId){
  d=getData(scene);
  repairBoardActorsData(d);
  if(!entryId||!Array.isArray(d.boardActors))return;
  const idx=d.boardActors.findIndex(entry=>entry?.id===entryId);
  if(idx<0)return;
  const ok=await confirmDestructive({title:"Remove Board Character?",content:`${d.boardActors[idx]?.name||"Character"} will be removed from the stage.`,yes:"Remove"});
  if(!ok)return;
  d.boardActors.splice(idx,1);
  cacheSceneData(scene,d);
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
}
async function addStageActor(scene,d,actor,opts={}){
  if(!actor||actor.type!=="character")return null;
  d=getData(scene);
  if(!Array.isArray(d.boardActors))d.boardActors=[];
  repairBoardActorsData(d,{forceVisible:true});
  d.boardActorsVisible=true;
  const existing=d.boardActors.find(entry=>entry?.actorId===actor.id);
  if(existing){
    normalizeBoardActorEntry(existing,actor);
    if(Number.isFinite(opts.posX))existing.posX=clampStageValue(opts.posX,0,100,existing.posX??50);
    if(Number.isFinite(opts.posY))existing.posY=clampStageValue(opts.posY,0,100,existing.posY??58);
    if(Number.isFinite(opts.scale))existing.scale=clampStageValue(opts.scale,MIN_STAGE_ENTITY_SCALE,MAX_STAGE_ENTITY_SCALE,existing.scale??100);
    repairBoardActorsData(d,{forceVisible:true});
    cacheSceneData(scene,d);
    await saveData(scene,d);
    emit();
    refreshChangedAreas(scene,d);
    ui.notifications.info(`${actor.name} is already on the board. Opening placement controls.`);
    setTimeout(()=>{
      const fresh=getData(scene);
      const freshEntry=fresh.boardActors?.find(e=>e.actorId===actor.id);
      if(freshEntry)openStageActorLayoutPos(scene,fresh,freshEntry,{combat:false});
    },50);
    return existing;
  }
  const entry=makeStageActorEntry(actor,{posX:Number.isFinite(+opts.posX)?clampStageValue(opts.posX,0,100,50):50,posY:Number.isFinite(+opts.posY)?clampStageValue(opts.posY,0,100,58):58,scale:Number.isFinite(+opts.scale)?clampStageValue(opts.scale,MIN_STAGE_ENTITY_SCALE,MAX_STAGE_ENTITY_SCALE,100):100});
  normalizeBoardActorEntry(entry,actor);
  ui.notifications.info(`Position ${actor.name}. Players will see it after you click Done.`);
  openDragPos(entry,scene,d,async()=>{
    const fresh=getData(scene);
    if(!Array.isArray(fresh.boardActors))fresh.boardActors=[];
    const duplicate=fresh.boardActors.find(e=>e?.actorId===actor.id);
    if(duplicate){
      normalizeBoardActorEntry(duplicate,actor);
      duplicate.posX=entry.posX;
      duplicate.posY=entry.posY;
      duplicate.scale=entry.scale;
    }else{
      fresh.boardActors.push(foundry.utils.deepClone(entry));
    }
    fresh.boardActorsVisible=true;
    repairBoardActorsData(fresh,{forceVisible:true});
    cacheSceneData(scene,fresh);
    await saveData(scene,fresh);
    emit();
    refreshChangedAreas(scene,fresh);
  },()=>ui.notifications.info(`Cancelled ${actor.name} placement.`));
  return entry;
}
function promptQuestPinName(defaultName="Quest"){
  return new Promise(resolve=>{
    new Dialog({
      title:"New Quest Pin",
      content:`<form><div class="form-group"><label>Name</label><input name="questName" value="${foundry.utils.escapeHTML(String(defaultName||"Quest"))}" autofocus/></div></form>`,
      buttons:{
        save:{icon:'<i class="fas fa-check"></i>',label:"Place Pin",callback:html=>resolve(String(html.find("[name=questName]").val()||defaultName||"Quest").trim()||defaultName||"Quest")},
        cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel",callback:()=>resolve(null)}
      },
      default:"save",
      close:()=>resolve(null)
    }).render(true);
  });
}
function notifyQuestPinDebug(bucket){
  if(!game.user?.isGM)return;
  const summary=(bucket||[]).map((p,i)=>`${i+1}:${p?.name||p?.label||"Quest"}@${Math.round(Number(p?.posX??50))},${Math.round(Number(p?.posY??50))}`).join(" | ");
  ui.notifications.info(`Quest debug [${bucket?.length||0}] ${summary||"empty"}`);
}
async function addQuestPin(scene,d){
  await closeActiveDragOverlay({save:true});
  const liveData=getData(scene);
  const key=String(liveData.background||"");
  if(!Array.isArray(liveData.questPins)) liveData.questPins=[];
  if(!liveData.questPinsByBackground || typeof liveData.questPinsByBackground!=="object" || Array.isArray(liveData.questPinsByBackground)) liveData.questPinsByBackground={};
  const getQuestBucket=()=>liveData.questPins.filter(p=>String(p?.backgroundKey||"")===key);
  const writeQuestBucket=bucket=>{
    const normalized=(bucket||[]).map(p=>foundry.utils.deepClone({...p,backgroundKey:key}));
    liveData.questPins=liveData.questPins.filter(p=>String(p?.backgroundKey||"")!==key);
    liveData.questPins.push(...normalized);
    liveData.questPinsByBackground[key]=normalized.map(p=>foundry.utils.deepClone(p));
    return normalized;
  };
  const bucket=getQuestBucket();
  const pinCount=bucket.length;
  const questName=await promptQuestPinName(`Quest ${pinCount+1}`);
  if(!questName)return;
  const offsetStep=6;
  const offsetCycle=4;
  const offsetIndex=pinCount%offsetCycle;
  const pin={id:foundry.utils.randomID(),kind:"quest",name:questName,type:"quest",label:"Quest",posX:Math.max(8,Math.min(92,50+(offsetIndex*offsetStep))),posY:Math.max(8,Math.min(92,50+(offsetIndex*offsetStep))),scale:100,backgroundKey:key,image:getQuestPinImage("quest")};
  setTimeout(()=>{
    openDragPos(pin,scene,liveData,async()=>{
    const nextBucket=getQuestBucket();
    nextBucket.push(foundry.utils.deepClone(pin));
    const savedBucket=writeQuestBucket(nextBucket);
    await saveData(scene,liveData);
    notifyQuestPinDebug(savedBucket);
    emit();
    refreshChangedAreas(scene,liveData);
  });
  },30);
}

function getEnemyHp(enemy,scene=game.scenes.viewed){return getRes(enemy,scene,{enemy:true,auto:true}).find(r=>r.label==="HP")?.value??null;}
async function removeEnemyInstance(scene,d,targetId){const idx=(d.enemies||[]).findIndex(e=>enemyTargetId(normalizeEnemyEntry(e))===targetId);if(idx<0)return;d.enemies.splice(idx,1);await setTargets(scene,getTargets(scene).filter(id=>id!==targetId),game.user,d);await pruneEnemyTokenDocs(scene,d);await saveData(scene,d);emit();refreshChangedAreas(scene,d);}
async function fadeOutEnemy(scene,d,enemy){normalizeEnemyEntry(enemy);if(enemy.transitionState==="out"||enemy.pendingPhasePrompt)return;enemy.transitionState="out";enemy.transitionAt=Date.now();enemy.pendingPhasePrompt=false;await saveData(scene,d);emit();refreshChangedAreas(scene,d);const targetId=enemyTargetId(enemy);setTimeout(async()=>{const live=getData(scene);await removeEnemyInstance(scene,live,targetId);},ENEMY_FADE_MS);}
async function transitionEnemyPhase(scene,d,enemy){normalizeEnemyEntry(enemy);if(enemy.transitionState==="phase-out")return;enemy.transitionState="phase-out";enemy.transitionAt=Date.now();enemy.pendingPhasePrompt=false;await saveData(scene,d);emit();refreshChangedAreas(scene,d);const targetId=enemyTargetId(enemy);setTimeout(async()=>{const live=getData(scene);const current=getEnemyByTargetId(live,targetId);if(!current)return;const nextActor=game.actors.get(current.nextFormId);if(!nextActor){await fadeOutEnemy(scene,live,current);return;}const nextEntry=makeEnemyEntry(nextActor,{instanceId:current.instanceId,posX:current.nextPosX??current.posX,posY:current.nextPosY??current.posY,scale:current.nextScale??current.scale,phaseEnabled:false,phaseUsed:true,transitionState:"phase-in",transitionAt:Date.now(),pendingPhasePrompt:false});Object.assign(current,nextEntry);current.tokenId=null;await pruneEnemyTokenDocs(scene,live);await ensureEnemyTokenDocs(scene,live);await saveData(scene,live);emit();refreshChangedAreas(scene,live);},ENEMY_FADE_MS);}
async function promptEnemyPhase(scene,d,enemy){
  normalizeEnemyEntry(enemy);
  if(enemy.pendingPhasePrompt)return;
  enemy.pendingPhasePrompt=true;
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
  const doPhase=await new Promise(resolve=>{
    new Dialog({
      title:"Villain Form Change",
      content:`<p><strong>${enemy.name}</strong> hit 0 HP.</p><p>Change to the next form instead of removing this enemy?</p>`,
      buttons:{
        yes:{icon:'<i class="fas fa-check"></i>',label:"Yes",callback:()=>resolve(true)},
        no:{icon:'<i class="fas fa-times"></i>',label:"No",callback:()=>resolve(false)}
      },
      default:"yes",
      close:()=>resolve(false)
    }).render(true);
  });
  const live=getData(scene);
  const current=getEnemyByTargetId(live,enemyTargetId(enemy));
  if(!current)return;
  current.pendingPhasePrompt=false;
  if(doPhase)await transitionEnemyPhase(scene,live,current);
  else await fadeOutEnemy(scene,live,current);
}
async function checkEncounterEnemyStates(scene,d){if(!isGM()||!scene||!isTOTM(scene)||!d.combatActive)return;for(const enemy of d.enemies||[]){normalizeEnemyEntry(enemy);const hp=getEnemyHp(enemy,scene);if(hp==null||hp>0)continue;if(enemy.transitionState==="out"||enemy.transitionState==="phase-out"||enemy.pendingPhasePrompt)continue;if(enemy.phaseEnabled&&enemy.nextFormId&&!enemy.phaseUsed){await promptEnemyPhase(scene,d,enemy);return;}await fadeOutEnemy(scene,d,enemy);return;}}

// Sidebar
let sRO=null,sMO=null;
function ensureSidebarExpanded(){
  if(!document.body.classList.contains("totm-active"))return;
  const sb=document.getElementById("sidebar");
  try{
    if((ui.sidebar?.collapsed||sb?.classList?.contains("collapsed"))&&typeof ui.sidebar?.expand==="function")ui.sidebar.expand();
  }catch{}
  const toggle=sb?.querySelector(".collapse, #sidebar-collapse, [data-action='collapse']");
  if(toggle){
    toggle.setAttribute("aria-disabled","true");
    toggle.setAttribute("title","Sidebar locked open while TOTM is active");
    toggle.classList.add("totm-sidebar-lock");
  }
}
function fitSB(){const el=document.getElementById("totm-ui");if(!el)return;const sb=document.getElementById("sidebar");if(sb){const g=window.innerWidth-sb.getBoundingClientRect().left;if(g>10){el.style.right=g+"px";return;}}el.style.right="305px";}
function syncHotbarPosition(){return syncHotbarPositionModule();}
function getHotbarDropSlot(clientX){return getHotbarDropSlotModule(clientX);}
async function createProjectFUItemHotbarMacro(data,slot){return createProjectFUItemHotbarMacroModule(data,slot);}
async function handleTotmHotbarDrop(ev){return handleTotmHotbarDropModule(ev);}
function bindTotmHotbarDropZone(node){return bindTotmHotbarDropZoneModule(node);}
function renderTotmHotbar(){return renderTotmHotbarModule();}
function bindTotmHotbarUi(root,opts){return bindTotmHotbarUiModule(root,opts);}
function canControlActorPin(actorId){const actor=game.actors.get(actorId);return !!(isGM()||actor?.isOwner);}
function canControlGmPin(){return isGM();}
function getPinImage(entry){return entry?.pinImg||entry?.img||entry?.image||"icons/svg/mystery-man.svg";}
async function saveAndRefresh(scene,d){await saveData(scene,d);emit();refreshChangedAreas(scene,d);}
async function saveAndRefreshStage(scene,d){
  await saveData(scene,d);
  emitStage();
  if(!refreshStageArea(scene,d))refreshUI(scene);
}
function syncActorPinButton(actorId,visible){
  document.querySelectorAll("#totm-ui .totm-actor-card[data-actor-id]").forEach(card=>{
    if(card.dataset.actorId!==actorId)return;
    card.querySelector("[data-act='pin']")?.classList.toggle("active-pin",!!visible);
  });
}
function syncGmPinButton(visible){
  document.querySelector("#totm-ui #tb-gm-pin")?.classList.toggle("is-active-gm-pin",!!visible);
}
async function toggleBoardActorsVisibility(scene,d=getData(scene)){
  if(!scene)return;
  const live=getData(scene);
  repairBoardActorsData(live);
  live.boardActorsVisible=live.boardActorsVisible===false;
  if(live.boardActorsVisible)repairBoardActorsData(live,{forceVisible:true});
  await saveAndRefresh(scene,live);
}
async function setCombatActive(scene,d=getData(scene),active=true){
  if(!scene)return;
  d.combatActive=!!active;
  await saveAndRefresh(scene,d);
}
async function applyPinSceneUpdate(scene,payload,{mode="persist"}={}){
  const live=getData(scene);
  if(mode==="persist")mergeLivePinPositionsIntoData(live);
  if(payload.owner==="gm"){
    if(!live.gmPin)live.gmPin={visible:false,image:"",size:64,posX:50,posY:50};
    if(mode==="toggle")live.gmPin.visible=!!payload.visible;
    if(Number.isFinite(payload.x))live.gmPin.posX=payload.x;
    if(Number.isFinite(payload.y))live.gmPin.posY=payload.y;
    if(payload.image!==undefined)live.gmPin.image=payload.image;
    if(Number.isFinite(payload.size))live.gmPin.size=payload.size;
  }else{
    const actor=live.actors?.find?.(a=>a.id===payload.actorId);
    if(!actor)return;
    if(mode==="toggle")actor.pinVisible=!!payload.visible;
    if(Number.isFinite(payload.x))actor.pinX=payload.x;
    if(Number.isFinite(payload.y))actor.pinY=payload.y;
    if(payload.image!==undefined)actor.pinImg=payload.image;
    if(Number.isFinite(payload.size))actor.pinSize=payload.size;
  }
  await saveData(scene,live);
  emitStage();
  if(payload.owner==="gm")syncGmPinButton(live.gmPin?.visible);
  else syncActorPinButton(payload.actorId,live.actors?.find?.(a=>a.id===payload.actorId)?.pinVisible);
  if(scene.id===game.scenes.viewed?.id)requestStageRefresh(scene);
}
async function handlePinSceneUpdate(scene,message){
  if(message.action==="pinPersist")return applyPinSceneUpdate(scene,message.payload,{mode:"persist"});
  if(message.action==="pinToggle")return applyPinSceneUpdate(scene,message.payload,{mode:"toggle"});
  if(message.action==="pinConfig")return applyPinSceneUpdate(scene,message.payload,{mode:"config"});
}
function mergeLivePinPositionsIntoData(d){
  const pins=document.querySelectorAll("#totm-ui .totm-map-pin[data-pin-owner]");
  pins.forEach(pin=>{
    const left=parseFloat(pin.style.left);
    const top=parseFloat(pin.style.top);
    if(!Number.isFinite(left)||!Number.isFinite(top))return;
    if(pin.dataset.pinOwner==="gm"){
      if(!d.gmPin)d.gmPin={visible:false,image:"",size:64,posX:50,posY:50};
      d.gmPin.posX=left;
      d.gmPin.posY=top;
    }else{
      const actor=d.actors?.find?.(a=>a.id===pin.dataset.actorId);
      if(!actor)return;
      actor.pinX=left;
      actor.pinY=top;
    }
  });
}
async function persistPinPosition(scene,{owner,actorId,x,y}){
  if(!isGM()){
    emitPinPersist(scene.id,{owner,actorId,x,y});
    return;
  }
  await applyPinSceneUpdate(scene,{owner,actorId,x,y},{mode:"persist"});
}
function getLiveActorPinEntry(scene,d,idx){
  const actorId=d?.actors?.[idx]?.id;
  const live=getData(scene);
  const actor=live.actors?.find?.(a=>a.id===actorId);
  return actor?{live,actor}:null;
}
async function toggleActorPin(scene,d,idx){
  const found=getLiveActorPinEntry(scene,d,idx);
  if(!found||!canControlActorPin(found.actor.id))return;
  const {live,actor}=found;
  actor.pinVisible=!actor.pinVisible;
  if(actor.pinVisible){
    if(!Number.isFinite(+actor.pinX))actor.pinX=50;
    if(!Number.isFinite(+actor.pinY))actor.pinY=50;
    if(!Number.isFinite(+actor.pinSize))actor.pinSize=64;
  }
  syncActorPinButton(actor.id,actor.pinVisible);
  if(!isGM()){
    emitPinToggle(scene.id,{owner:"actor",actorId:actor.id,visible:actor.pinVisible,x:actor.pinX,y:actor.pinY,size:actor.pinSize});
    if(!refreshStageArea(scene,live))refreshUI(scene);
    return;
  }
  await saveAndRefreshStage(scene,live);
}
async function toggleGmPin(scene,d){
  if(!canControlGmPin())return;
  const live=getData(scene);
  if(!live.gmPin)live.gmPin={visible:false,image:"",size:64,posX:50,posY:50};
  live.gmPin.visible=!live.gmPin.visible;
  if(live.gmPin.visible){
    if(!Number.isFinite(+live.gmPin.posX))live.gmPin.posX=50;
    if(!Number.isFinite(+live.gmPin.posY))live.gmPin.posY=50;
    if(!Number.isFinite(+live.gmPin.size))live.gmPin.size=64;
  }
  syncGmPinButton(live.gmPin.visible);
  await saveAndRefreshStage(scene,live);
}
function openActorPinCfg(scene,d,idx){
  const found=getLiveActorPinEntry(scene,d,idx);
  if(!found||!canControlActorPin(found.actor.id))return;
  const {live,actor}=found;
  const startImg=actor.pinImg||actor.img||"";
  new Dialog({title:`Pin Settings - ${esc(actor.name)}`,content:`<form><div class="form-group"><label>Pin Image</label><div style="display:flex;gap:6px;"><input name="img" value="${attr(startImg)}" style="flex:1;"/><button type="button" id="pin-browse"><i class="fas fa-file-image"></i></button></div></div><div class="form-group"><label>Pin Size</label><input type="range" name="size" min="24" max="140" step="2" value="${actor.pinSize??64}"/></div><div class="totm-pin-preview" style="display:flex;justify-content:center;align-items:center;padding:8px;"><div style="${attr(`width:${actor.pinSize??64}px;height:${actor.pinSize??64}px;border-radius:999px;border:2px solid rgba(255,255,255,.7);background:#0b1020 center/cover no-repeat;background-image:${cssUrl(startImg)};`)}"></div></div></form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async h=>{const latest=getLiveActorPinEntry(scene,d,idx)||{live,actor};latest.actor.pinImg=String(h.find("[name=img]").val()||"").trim()||latest.actor.img;latest.actor.pinSize=Number(h.find("[name=size]").val()||64);if(!isGM()){emitPinConfig(scene.id,{owner:"actor",actorId:latest.actor.id,image:latest.actor.pinImg,size:latest.actor.pinSize});if(!refreshStageArea(scene,latest.live))requestStageRefresh(scene);return;}await saveAndRefreshStage(scene,latest.live);}}},default:"save",render:h=>{const update=()=>{const img=String(h.find("[name=img]").val()||"").trim()||actor.img;const size=Number(h.find("[name=size]").val()||64);const pv=h[0].querySelector(".totm-pin-preview > div");if(pv){pv.style.width=`${size}px`;pv.style.height=`${size}px`;pv.style.backgroundImage=cssUrl(img);}};h.find("#pin-browse").on("click",()=>new FilePicker({type:"image",callback:p=>{h.find("[name=img]").val(p);update();}}).browse());h.find("[name=img],[name=size]").on("input change",update);}}).render(true);
}
function openGmPinCfg(scene,d){
  if(!canControlGmPin())return;
  const live=getData(scene);
  if(!live.gmPin)live.gmPin={visible:false,image:"",size:64,posX:50,posY:50};
  const startImg=live.gmPin.image||game.user.avatar||game.user.character?.img||"";
  new Dialog({title:"GM Pin Settings",content:`<form><div class="form-group"><label>Pin Image</label><div style="display:flex;gap:6px;"><input name="img" value="${attr(startImg)}" style="flex:1;"/><button type="button" id="pin-browse"><i class="fas fa-file-image"></i></button></div></div><div class="form-group"><label>Pin Size</label><input type="range" name="size" min="24" max="140" step="2" value="${live.gmPin.size??64}"/></div><div class="totm-pin-preview" style="display:flex;justify-content:center;align-items:center;padding:8px;"><div style="${attr(`width:${live.gmPin.size??64}px;height:${live.gmPin.size??64}px;border-radius:999px;border:2px solid rgba(255,255,255,.7);background:#0b1020 center/cover no-repeat;background-image:${cssUrl(startImg)};`)}"></div></div></form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async h=>{const latest=getData(scene);if(!latest.gmPin)latest.gmPin={visible:false,image:"",size:64,posX:50,posY:50};latest.gmPin.image=String(h.find("[name=img]").val()||"").trim()||game.user.avatar||game.user.character?.img||"";latest.gmPin.size=Number(h.find("[name=size]").val()||64);await saveAndRefreshStage(scene,latest);}}},default:"save",render:h=>{const update=()=>{const img=String(h.find("[name=img]").val()||"").trim()||game.user.avatar||game.user.character?.img||"";const size=Number(h.find("[name=size]").val()||64);const pv=h[0].querySelector(".totm-pin-preview > div");if(pv){pv.style.width=`${size}px`;pv.style.height=`${size}px`;pv.style.backgroundImage=cssUrl(img);}};h.find("#pin-browse").on("click",()=>new FilePicker({type:"image",callback:p=>{h.find("[name=img]").val(p);update();}}).browse());h.find("[name=img],[name=size]").on("input change",update);}}).render(true);
}
function bindStagePins(scene,d,el){
  const stage=el.querySelector("#totm-stage");
  if(!stage)return;
  const pushLiveMove=foundry.utils.throttle((payload)=>emitPinMove(scene.id,payload),40);
  stage.querySelectorAll(".totm-map-pin[data-pin-owner]").forEach(pin=>{
    const ownerType=pin.dataset.pinOwner;
    const actorId=pin.dataset.actorId||"";
    const canDrag=ownerType==="gm"?canControlGmPin():canControlActorPin(actorId);
    if(!canDrag)return;
    let dragging=false,startX=0,startY=0,startPosX=0,startPosY=0,target=null;
    const onMove=e=>{
      if(!dragging||!target)return;
      const rect=stage.getBoundingClientRect();
      const dx=((e.clientX-startX)/Math.max(rect.width,1))*100;
      const dy=((e.clientY-startY)/Math.max(rect.height,1))*100;
      const nx=Math.max(0,Math.min(100,startPosX+dx));
      const ny=Math.max(0,Math.min(100,startPosY+dy));
      if(ownerType==="gm"){target.posX=nx;target.posY=ny;}
      else {target.pinX=nx;target.pinY=ny;}
      pin.style.left=`${nx}%`;pin.style.top=`${ny}%`;
      pushLiveMove(ownerType==="gm"?{owner:"gm",x:nx,y:ny}:{owner:"actor",actorId,x:nx,y:ny});
    };
    const onUp=()=>{
      if(!dragging)return;
      dragging=false;
      LOCAL_PIN_DRAG_COUNT=Math.max(0,LOCAL_PIN_DRAG_COUNT-1);
      pin.classList.remove("is-dragging");
      document.removeEventListener("mousemove",onMove);
      document.removeEventListener("mouseup",onUp);
      const payload=ownerType==="gm"
        ? {owner:"gm",x:target?.posX??50,y:target?.posY??50}
        : {owner:"actor",actorId,x:target?.pinX??50,y:target?.pinY??50};
      persistPinPosition(scene,payload);
      flushDeferredPinRefresh();
    };
    pin.addEventListener("mousedown",e=>{
      if(e.button!==0)return;
      dragging=true;
      LOCAL_PIN_DRAG_COUNT+=1;
      startX=e.clientX;startY=e.clientY;
      target=ownerType==="gm"?d.gmPin:d.actors.find(a=>a.id===actorId);
      if(!target)return;
      startPosX=ownerType==="gm"?(target.posX??50):(target.pinX??50);
      startPosY=ownerType==="gm"?(target.posY??50):(target.pinY??50);
      pin.classList.add("is-dragging");
      document.addEventListener("mousemove",onMove);
      document.addEventListener("mouseup",onUp);
      e.preventDefault();
    });
  });
}
function startSB(){stopSB();const sb=document.getElementById("sidebar");if(!sb)return;ensureSidebarExpanded();sRO=new ResizeObserver(()=>{ensureSidebarExpanded();fitSB();syncHotbarPosition();});sRO.observe(sb);if(sb.parentElement)sRO.observe(sb.parentElement);sMO=new MutationObserver(()=>{requestAnimationFrame(()=>{ensureSidebarExpanded();fitSB();syncHotbarPosition();});setTimeout(()=>{ensureSidebarExpanded();fitSB();syncHotbarPosition();},350);});sMO.observe(sb,{attributes:true,attributeFilter:["class","style"]});}
function stopSB(){if(sRO){sRO.disconnect();sRO=null;}if(sMO){sMO.disconnect();sMO=null;}}
function injectUI(){if(document.getElementById("totm-ui"))return;document.body.appendChild(Object.assign(document.createElement("div"),{id:"totm-ui"}));}
function activate(s){document.body.classList.add("totm-active");injectUI();ensureSidebarExpanded();refreshUI(s);fitSB();syncHotbarPosition();startSB();setTimeout(()=>{ensureSidebarExpanded();fitSB();syncHotbarPosition();},50);setTimeout(()=>{ensureSidebarExpanded();fitSB();syncHotbarPosition();},200);}
function deactivate(){document.body.classList.remove("totm-active");const el=document.getElementById("totm-ui");if(el){el.classList.remove("totm-has-rendered");el.innerHTML="";}stopSB();syncHotbarPosition();}
function hasUsefulTotmData(d){
  const propCount=Object.values(d.propsByBackground||{}).reduce((n,b)=>n+(Array.isArray(b)?b.length:0),Array.isArray(d.props)?d.props.length:0);
  const questCount=Object.values(d.questPinsByBackground||{}).reduce((n,b)=>n+(Array.isArray(b)?b.length:0),Array.isArray(d.questPins)?d.questPins.length:0);
  return !!(d.background||d.featuredArt||d.narration||d.mediaJournal||(d.actors||[]).length||(d.backgrounds||[]).length||(d.npcs||[]).length||(d.boardActors||[]).length||(d.enemies||[]).length||(d.encounters||[]).length||propCount||questCount);
}
function renderGmOnboarding(){
  return `<div class="totm-onboarding" id="totm-onboarding"><div class="totm-onboarding-panel">
    <h2>${esc(loc("SetupTheaterScene","Set up your Theater scene"))}</h2>
    <div class="totm-onboarding-actions">
      <button type="button" data-onboard-act="add-scene-actors"><span>1</span>${esc(loc("OnboardAddPlayers","Add player cards"))}</button>
      <button type="button" data-onboard-act="open-bg"><span>2</span>${esc(loc("OnboardPickBackground","Pick or add a background"))}</button>
      <button type="button" data-onboard-act="open-npc"><span>3</span>${esc(loc("OnboardAddNpcs","Add NPCs, props, or actors"))}</button>
      <button type="button" data-onboard-act="open-enc"><span>4</span>${esc(loc("OnboardEncounter","Create or start an encounter"))}</button>
      <button type="button" data-onboard-act="share"><span>5</span>${esc(loc("OnboardShare","Share with players"))}</button>
    </div>
  </div></div>`;
}

function renderBoardActors(scene,d){
  if(!Array.isArray(d.boardActors)||!d.boardActors.length)return "";
  if(d.boardActorsVisible===false)return "";
  repairBoardActors(d);
  return (d.boardActors||[]).map((entry,i)=>{
    const actor=game.actors.get(entry?.actorId);
    if(actor)normalizeBoardActorEntry(entry,actor);
    else normalizeBoardActorSavedEntry(entry);
    const img=getStageActorImage(entry,d,{inCombat:!!d.combatActive})||getStageActorDefaultImage(actor);
    const layout=getStageActorLayout(entry,{inCombat:!!d.combatActive});
    const posX=clampStageValue(layout.posX,0,100,50);
    const posY=clampStageValue(layout.posY,0,100,58);
    const scale=clampStageValue(layout.scale,MIN_STAGE_ENTITY_SCALE,MAX_STAGE_ENTITY_SCALE,100)/100;
    const name=entry.name||actor?.name||"Character";
    return `<div class="totm-scene-img totm-stage-actor totm-board-actor" data-baidx="${i}" data-board-actor-id="${attr(entry.id||"")}" data-actor-id="${attr(entry.actorId||"")}" title="${attr("Right-click to configure / double-click to open sheet")}" style="${attr(`left:${posX}%;top:${posY}%;transform:translate(-50%, -50%) scale(${scale});`)}"><img src="${attr(img)}" alt="${attr(name)}"/></div>`;
  }).join("");
}

function renderStagePieces(scene,d){
  const sceneImgs=buildStageSceneImagesModule({d,scene,deps:{getPinImage,canControlActorPin,getActorPinColor,getGmPinColor,canControlGmPin,getTargets,normalizeEnemyEntry,getEncounterActor,ENEMY_FADE_MS,enemyTargetId,getQuestPinImage,getSceneEntityImage,getSceneEntityLayout,SCENE_IMAGE_SWAP_MS,isGM}});
  const bgStyleRaw=d.background?`background-image:${cssUrl(d.background)};background-position:${d.bgPosX??50}% ${d.bgPosY??50}%;background-size:${getBgSizeCss(d.bgZoom,d.bgStretch)};background-repeat:no-repeat`:"";
  const bgKey=[d.background||"",d.bgPosX??50,d.bgPosY??50,d.bgZoom??100,!!d.bgStretch].join("|");
  return {
    sceneHtml:sceneImgs.join(""),
    boardHtml:renderBoardActors(scene,d),
    bgStyle:attr(bgStyleRaw),
    bgStyleRaw,
    bgKey,
    bgClass:shouldRenderBgFade(scene,d)?"totm-bg-fade":"",
    artHtml:renderArt(d),
    showOnboarding:isGM()&&!hasUsefulTotmData(d)
  };
}

function refreshStageArea(scene,d=getData(scene)){
  const el=document.getElementById("totm-ui");
  const layout=el?.querySelector(".totm-layout");
  const stageWrap=el?.querySelector("#totm-stage-wrap");
  if(!el||!layout||!stageWrap)return false;
  if(!isGM()&&!d.shared){
    refreshUI(scene);
    return true;
  }
  const pieces=renderStagePieces(scene,d);
  const bg=stageWrap.querySelector("#totm-bg-layer");
  const stage=stageWrap.querySelector("#totm-stage");
  const board=stageWrap.querySelector("#totm-board-actor-layer");
  const art=stageWrap.querySelector("#totm-art-display");
  if(!bg||!stage||!board||!art)return false;
  if(bg.dataset.totmBgKey&&bg.dataset.totmBgKey!==pieces.bgKey)bg.style.cssText=pieces.bgStyleRaw;
  bg.dataset.totmBgKey=pieces.bgKey;
  if(bg.className!==pieces.bgClass)bg.className=pieces.bgClass;
  if(stage.innerHTML!==pieces.sceneHtml)stage.innerHTML=pieces.sceneHtml;
  if(board.innerHTML!==pieces.boardHtml)board.innerHTML=pieces.boardHtml;
  if(art.innerHTML!==pieces.artHtml)art.innerHTML=pieces.artHtml;
  const existingOnboarding=stageWrap.querySelector("#totm-onboarding");
  if(pieces.showOnboarding&&!existingOnboarding){
    stageWrap.insertAdjacentHTML("beforeend",renderGmOnboarding());
    bindOnboardingEvents(el,scene,d);
  }else if(!pieces.showOnboarding&&existingOnboarding){
    existingOnboarding.remove();
  }
  const main=el.querySelector("#totm-main");
  const existingNarration=main?.querySelector("#totm-narration");
  if(d.narration){
    const narrationInner=`<div class="totm-narration-inner"><div class="totm-narration-text">${esc(d.narration)}</div></div>`;
    if(existingNarration)existingNarration.innerHTML=narrationInner;
    else main?.insertAdjacentHTML("beforeend",`<div id="totm-narration">${narrationInner}</div>`);
  }else existingNarration?.remove();
  bindStagePins(scene,d,el);
  requestAnimationFrame(()=>warnIfBoardActorsFailedToRender(scene));
  return true;
}

function warnIfBoardActorsFailedToRender(scene){
  if(!game.user?.isGM||!scene||!isTOTM(scene))return;
  const d=getData(scene);
  const savedCount=Array.isArray(d.boardActors)?d.boardActors.length:0;
  const renderedCount=document.querySelectorAll("#totm-board-actor-layer .totm-stage-actor").length;
  const key=scene.id||scene.name||"current";
  if(savedCount>0&&d.boardActorsVisible!==false&&renderedCount===0){
    if(BOARD_RENDER_WARNED_SCENES.has(key))return;
    BOARD_RENDER_WARNED_SCENES.add(key);
    console.error("TOTM board actors saved but not rendered", {
      savedCount,
      renderedCount,
      boardActors:d.boardActors,
      stageWrap:!!document.querySelector("#totm-stage-wrap"),
      boardLayer:!!document.querySelector("#totm-board-actor-layer")
    });
    return;
  }
  BOARD_RENDER_WARNED_SCENES.delete(key);
}

async function addVisibleSceneActors(scene,d){
  if(!scene||!isGM())return;
  const existing=new Set((d.actors||[]).map(a=>a.id));
  const actorIds=[...new Set((scene.tokens||[]).filter(t=>!t.hidden&&t.actor?.type==="character").map(t=>t.actor.id))];
  const added=[];
  for(const actorId of actorIds){
    if(existing.has(actorId))continue;
    const actor=game.actors.get(actorId);
    if(!actor)continue;
    d.actors.push(makeEntry(actor,d.actors.length));
    existing.add(actorId);
    added.push(actor.name);
  }
  if(!added.length){ui.notifications.info("No new visible scene actors to add.");return;}
  await saveData(scene,d);
  emit();
  scheduleRefresh(scene);
  ui.notifications.info(`Added ${added.length} player card${added.length===1?"":"s"}.`);
}

function bindOnboardingEvents(el,scene,d){
  const panel=el.querySelector("#totm-onboarding");
  if(!panel)return;
  panel.addEventListener("click",async event=>{
    const act=event.target.closest("[data-onboard-act]")?.dataset.onboardAct;
    if(!act)return;
    if(act==="add-scene-actors")await addVisibleSceneActors(scene,d);
    else if(act==="open-bg")openBgMgr(scene,d);
    else if(act==="open-npc")openNpcPicker(scene,d);
    else if(act==="open-enc")openEncPicker(scene,d);
    else if(act==="share"){d.shared=true;await saveData(scene,d);emit();scheduleRefresh(scene);}
  });
}

function openGmHelpDialog(){
  const rows=[
    ["Left click enemy","Target that enemy"],
    ["Double click enemy","Open its sheet"],
    ["Right click enemy","Move/configure it; swaps alternate image first if one is set"],
    ["Right click NPC/prop","Move it or swap an alternate image"],
    ["Shift-click NPC/prop","Delete with confirmation"],
    ["Shift/Alt-click board actors","Move forward/back in the stage order"],
    ["T","Target the hovered actor or enemy, or cycle targets"],
    ["V","Show/hide board characters"],
    ["Use Now","Apply a saved background image, framing, stretch, and narration"],
    ["Save Current Framing","Copy the live background framing back into a saved background"],
    ["Add Scene BG","Add the current Foundry scene background to the library"]
  ];
  new Dialog({
    title:loc("GMHelp","GM Help"),
    content:`<div class="totm-help"><h2>${esc(loc("GMHelp","GM Help"))}</h2>${rows.map(([k,v])=>`<div class="totm-help-row"><strong>${esc(k)}</strong><span>${esc(v)}</span></div>`).join("")}</div>`,
    buttons:{close:{icon:'<i class="fas fa-check"></i>',label:"Close"}},
    default:"close"
  }).render(true);
}

function hashString(value){
  let hash=2166136261;
  const text=String(value??"");
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(36);
}

function renderPlayerPanelHeaderHtml(){
  return `<h3>${esc(loc("Players","Players"))}</h3>${isGM()?`<div class="totm-header-btns"><button class="totm-btn-sm" id="totm-random-player" title="Add Random Player Target"><i class="fas fa-dice"></i></button><button class="totm-btn-sm" id="totm-clear-player-targets" title="Clear Player Targets"><i class="fas fa-ban"></i></button><button class="totm-btn-sm" id="totm-add-actor"><i class="fas fa-plus"></i></button></div>`:""}`;
}

function getPlayerPanelRenderKey(playerHeaderHtml,playerCardsHtml){
  return hashString(`${playerHeaderHtml}\n${playerCardsHtml}`);
}

function renderPlayerPanelParts(scene,d,ctx=makeRenderContext(scene,d)){
  const cardsHtml=renderCards(d,ctx);
  const headerHtml=renderPlayerPanelHeaderHtml();
  const renderKey=getPlayerPanelRenderKey(headerHtml,cardsHtml);
  return {
    cardsHtml,
    headerHtml,
    renderKey,
    html:`<div id="totm-actor-panel" data-totm-player-render-key="${attr(renderKey)}">
          <div class="totm-panel-header">${headerHtml}</div>
          <div id="totm-actor-list">${cardsHtml}</div>
        </div>`
  };
}

function refreshPlayerPanelRenderKey(scene,d=getData(scene)){
  const panel=document.querySelector("#totm-ui #totm-actor-panel");
  if(!panel||!scene||!isTOTM(scene))return;
  panel.dataset.totmPlayerRenderKey=renderPlayerPanelParts(scene,d).renderKey;
}

function replaceTotmUiHtml(el,html,{playerRenderKey=""}={}){
  const oldPanel=el.querySelector("#totm-actor-panel");
  const oldList=oldPanel?.querySelector("#totm-actor-list");
  const preservePlayers=!!(oldPanel&&oldList&&oldPanel.dataset.totmPlayerRenderKey===playerRenderKey);
  if(!preservePlayers){
    el.innerHTML=html;
    return false;
  }
  const scrollTop=oldList.scrollTop;
  const wrap=document.createElement("div");
  wrap.innerHTML=html.trim();
  const nextPanel=wrap.querySelector("#totm-actor-panel");
  if(!nextPanel){
    el.innerHTML=html;
    return false;
  }
  nextPanel.replaceWith(oldPanel);
  el.replaceChildren(...Array.from(wrap.childNodes));
  oldList.scrollTop=scrollTop;
  return true;
}

// RENDER
function refreshUI(scene){
  const el=document.getElementById("totm-ui");if(!el)return;
  const hadLayout=!!el.querySelector(".totm-layout");
  const d=getData(scene);
  const repairedBoardActors=repairBoardActorsData(d);
  if(repairedBoardActors&&isGM())void saveData(scene,d);
  const ctx=makeRenderContext(scene,d);
  const theme=getThemeMeta(game.settings.get(MODULE_ID,"uiTheme")||d.style||"classic");
  el.dataset.style=theme.id;
  el.classList.toggle("totm-performance-mode",!!game.settings.get(MODULE_ID,"performanceMode"));
  el.style.setProperty("--totm-target-color",getUserTargetColor());
  if(hadLayout)el.classList.add("totm-soft-refresh");
  if(!isGM()&&!d.shared){el.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--totm-text-faint);font-size:14px;">The GM is preparing...</div>`;if(hadLayout)requestAnimationFrame(()=>el.classList.remove("totm-soft-refresh"));return;}

  const sceneImgs=buildStageSceneImagesModule({d,scene,deps:{getPinImage,canControlActorPin,getActorPinColor,getGmPinColor,canControlGmPin,getTargets,normalizeEnemyEntry,getEncounterActor,ENEMY_FADE_MS,enemyTargetId,getQuestPinImage,getSceneEntityImage,getSceneEntityLayout,SCENE_IMAGE_SWAP_MS,isGM}});
  const boardActorHtml=renderBoardActors(scene,d);

  // Background with position/zoom
  const bgStyle=d.background?attr(`background-image:${cssUrl(d.background)};background-position:${d.bgPosX??50}% ${d.bgPosY??50}%;background-size:${getBgSizeCss(d.bgZoom,d.bgStretch)};background-repeat:no-repeat`):"";
  const bgKey=[d.background||"",d.bgPosX??50,d.bgPosY??50,d.bgZoom??100,!!d.bgStretch].join("|");
  const bgFadeClass=shouldRenderBgFade(scene,d)?"totm-bg-fade":"";
  const showOnboarding=isGM()&&!hasUsefulTotmData(d);
  const playerPanel=renderPlayerPanelParts(scene,d,ctx);

  const html=`<div class="totm-layout">
      <div class="totm-main-row">
        ${playerPanel.html}
        <div id="totm-main">
          ${renderTopbar(d,scene)}
          ${renderClockDock()}
          ${renderMinimapDock(d)}
          <div id="totm-stage-wrap"><div id="totm-bg-layer" class="${bgFadeClass}" data-totm-bg-key="${attr(bgKey)}" style="${bgStyle}"></div><div id="totm-stage">${sceneImgs.join("")}</div><div id="totm-board-actor-layer">${boardActorHtml}</div><div id="totm-art-area"><div id="totm-art-display">${renderArt(d)}</div></div>${showOnboarding?renderGmOnboarding():""}</div>
          ${d.narration?`<div id="totm-narration"><div class="totm-narration-inner"><div class="totm-narration-text">${esc(d.narration)}</div></div></div>`:""}
        </div>
      </div>
      <div id="totm-hotbar-slot">${renderTotmHotbar()}</div>
      ${renderEnemyBar(d,ctx)}
    </div>`;
  replaceTotmUiHtml(el,html,{playerRenderKey:playerPanel.renderKey});
  el.classList.add("totm-has-rendered");
  bindEvents(scene,d);bindStagePins(scene,d,el);if(!hadLayout){fitSB();syncHotbarPosition();}
  if(hadLayout)requestAnimationFrame(()=>el.classList.remove("totm-soft-refresh"));
  requestAnimationFrame(()=>warnIfBoardActorsFailedToRender(scene));
  requestAnimationFrame(()=>ensureUserPlayerProxyControlled(scene,d));
}

function renderCards(d,ctx=makeRenderContext(game.scenes.viewed,d)){return renderPlayerCardsModule({d,scene:game.scenes.viewed,deps:{isGM,getConds,MODULE_ID,getActorStatus,isActorTargeted,getActorTargetUsers,getRes:(entry,_scene,opts)=>ctx.cachedRes(entry,opts),getImg,getFabulaPoints,rPath,renderBars,canControlActorPin,esc,attr,cssUrl,actorById:ctx.actorById}});}

function renderBars(res,{kind="default"}={}){if(!res.length)return"";const slim=kind==="enemy";return`<div class="totm-resource-bars ${slim?"enemy-bars":"player-bars"}">${res.map(r=>{const p=Math.max(0,Math.min(100,(r.value/r.max)*100)),l=r.color==="res-hp"?(p<=25?"crit":p<=50?"low":""):"";return`<div class="totm-resource-row ${slim?"is-thin":""}"><span class="totm-resource-icon ${r.color}-label ${slim?"thin-icon":""}">${slim?"":`<i class="${r.icon}"></i>`}</span><span class="totm-resource-lbl ${slim?"thin-lbl":""}">${slim?"":r.label}</span><div class="totm-resource-bar ${slim?"thin-bar":""}"><div class="totm-resource-fill ${r.color} ${l}" style="width:${p}%"></div></div><span class="totm-resource-value ${slim?"thin-value":""}">${slim?"":`${r.value}/${r.max}`}</span></div>`;}).join("")}</div>`;}

function renderArt(d){if(d.featuredArt)return`<img src="${attr(d.featuredArt)}"/>${d.featuredCaption?`<div class="totm-caption">${esc(d.featuredCaption)}</div>`:""}`;return"";}

function renderEnemyBar(d,ctx=makeRenderContext(game.scenes.viewed,d)){return renderEnemyBarModule({d,scene:game.scenes.viewed,deps:{getTargets,normalizeEnemyEntry,getEncounterActor,getRes:(entry,_scene,opts)=>ctx.cachedRes(entry,opts),enemyTargetId,getEnemyTargetUsers,ENEMY_FADE_MS,isGM,renderBars,esc,attr,cssUrl}});}
function renderClockDock(){
  if(!hasClockModule())return"";
  const clocks=getClockEntries(),canEdit=window.clockDatabase?.canUserEdit?.(game.user);
  const controls=clock=>clock.editable?`<button class="totm-clock-delete" data-clock-act="delete" data-clock-id="${attr(clock.id)}" title="${attr(loc("Delete","Delete"))}"><i class="fas fa-trash"></i></button>`:"";
  const clockName=clock=>`${clock.private?`<i class="fas fa-eye-slash"></i> `:""}${esc(clock.name)}`;
  const clockStyle=clock=>attr(`--clock-color:${clock.color};--clock-bg:${clock.backgroundColor};${clock.type==="clock"?`--clock-pct:${Math.round(clock.ratio*100)}%;`:""}`);
  return `<div id="totm-clock-dock" class="${CLOCKS_OPEN?"is-open":"is-closed"}"><div class="totm-clock-dock-head"><div class="totm-clock-title"><i class="fas fa-clock"></i> ${esc(loc("Clocks","Clocks"))}</div><div class="totm-clock-dock-actions">${canEdit?`<button class="totm-btn-sm" id="totm-clock-add" title="${attr(loc("AddClock","Add Clock"))}"><i class="fas fa-plus"></i></button>`:""}<div class="totm-clock-count">${clocks.length}</div></div></div>${clocks.length?`<div class="totm-clock-list">${clocks.map(clock=>clock.type==="tracker"?`<div class="totm-clock-entry ${clock.editable?"editable":""}" data-clock-id="${attr(clock.id)}" data-clock-type="${attr(clock.type)}" style="${clockStyle(clock)}"><div class="totm-clock-main"><div class="totm-clock-meta"><span class="totm-clock-name">${clockName(clock)}</span><span class="totm-clock-value">${clock.value}/${clock.max}</span></div><div class="totm-clock-tracker">${clock.slashes.map(f=>`<span class="totm-clock-slash ${f?"filled":""}"></span>`).join("")}</div></div>${controls(clock)}</div>`:clock.type==="points"?`<div class="totm-clock-entry points ${clock.editable?"editable":""}" data-clock-id="${attr(clock.id)}" data-clock-type="${attr(clock.type)}" style="${clockStyle(clock)}"><div class="totm-clock-main"><div class="totm-clock-meta"><span class="totm-clock-name">${clockName(clock)}</span><span class="totm-clock-points">${clock.value}</span></div></div>${controls(clock)}</div>`:`<div class="totm-clock-entry ${clock.editable?"editable":""}" data-clock-id="${attr(clock.id)}" data-clock-type="${attr(clock.type)}" style="${clockStyle(clock)}"><div class="totm-clock-main"><div class="totm-clock-ring"><div class="totm-clock-ring-inner">${clock.value}/${clock.max}</div></div><div class="totm-clock-meta"><span class="totm-clock-name">${clockName(clock)}</span></div></div>${controls(clock)}</div>`).join("")}</div>`:`<div class="totm-clock-empty">${esc(loc("NoClocks","No clocks yet."))}</div>`}</div>`;
}

function bindClockDockEvents(root,scene){
  root.querySelector("#totm-clock-add")?.addEventListener("click",e=>{e.stopPropagation();openClockCreateDialog();});
  root.querySelectorAll("[data-clock-act='delete']").forEach(btn=>btn.addEventListener("click",async e=>{e.stopPropagation();await deleteClock(e.currentTarget.dataset.clockId);refreshClockUi(scene)||scheduleRefresh(scene);}));
  root.querySelector("#totm-clock-dock")?.addEventListener("click",async e=>{const entry=e.target.closest("[data-clock-id]");if(!entry||e.target.closest("[data-clock-act]"))return;await stepClock(entry.dataset.clockId,1);refreshClockUi(scene)||scheduleRefresh(scene);});
  root.querySelector("#totm-clock-dock")?.addEventListener("contextmenu",async e=>{const entry=e.target.closest("[data-clock-id]");if(!entry)return;e.preventDefault();await stepClock(entry.dataset.clockId,-1);refreshClockUi(scene)||scheduleRefresh(scene);});
}

function refreshClockDockOnly(scene=game.scenes.viewed){
  const old=document.querySelector("#totm-ui #totm-clock-dock");
  if(!old||!scene||!isTOTM(scene)||!hasClockModule())return false;
  const wrap=document.createElement("div");
  wrap.innerHTML=renderClockDock();
  const next=wrap.firstElementChild;
  if(!next)return false;
  old.replaceWith(next);
  bindClockDockEvents(document.getElementById("totm-ui"),scene);
  return true;
}

function minimapData(d){
  if(!d.minimap)d.minimap=defaultMinimapData();
  d.minimap=normalizeMinimapData(d.minimap);
  return d.minimap;
}
function minimapStateStyle(){
  const maxSize=Math.max(220,Math.min(window.innerWidth-36,window.innerHeight-96));
  MINIMAP_VIEW_STATE.size=Math.max(220,Math.min(maxSize,MINIMAP_VIEW_STATE.size||320));
  MINIMAP_VIEW_STATE.left=Math.max(8,Math.min(window.innerWidth-MINIMAP_VIEW_STATE.size-16,MINIMAP_VIEW_STATE.left||360));
  MINIMAP_VIEW_STATE.top=Math.max(8,Math.min(window.innerHeight-MINIMAP_VIEW_STATE.size-56,MINIMAP_VIEW_STATE.top||74));
  return attr(`left:${MINIMAP_VIEW_STATE.left}px;top:${MINIMAP_VIEW_STATE.top}px;--totm-minimap-size:${MINIMAP_VIEW_STATE.size}px;`);
}
function renderMinimapMap(d,{editable=false,popup=false}={}){
  const map=minimapData(d),image=map.image;
  const pins=map.pins.filter(pin=>pin.visible!==false);
  const empty=isGM()?"Set a minimap image in controls.":"The GM has not set a minimap.";
  return `<div class="totm-minimap-map ${image?"has-image":"is-empty"} ${editable?"is-editable":""}" style="${image?attr(`background-image:${cssUrl(image)}`):""}" data-minimap-map>${image?"":`<div class="totm-minimap-empty"><i class="fas fa-map"></i><span>${esc(empty)}</span></div>`}${pins.map(pin=>`<button type="button" class="totm-minimap-pin ${editable?"is-editable":""} ${editable&&pin.id===MINIMAP_SELECTED_PIN_ID?"is-selected":""}" data-minimap-pin="${attr(pin.id)}" title="${attr(pin.label||"Pin")}" aria-label="${attr(pin.label||"Pin")}" style="${attr(`--pin-color:${pin.color};left:${pin.x}%;top:${pin.y}%;`)}"><span>${esc((pin.label||"").slice(0,1).toUpperCase())}</span></button>`).join("")}${popup?"":`<div class="totm-minimap-resize" data-minimap-action="resize" title="Resize"></div>`}</div>`;
}
function renderMinimapDock(d){
  if(!MINIMAP_OPEN||MINIMAP_POPPED)return"";
  const editing=isGM()&&MINIMAP_EDITING;
  const map=minimapData(d);
  const controls=editing?`<div class="totm-minimap-controls">
      <button type="button" data-minimap-action="set-image"><i class="fas fa-image"></i><span>Image</span></button>
      <button type="button" data-minimap-action="use-stage"><i class="fas fa-clone"></i><span>Stage</span></button>
      <button type="button" data-minimap-action="clear-image"><i class="fas fa-ban"></i><span>Clear</span></button>
      <button type="button" data-minimap-action="add-pin" data-pin-type="party" data-pin-label="Party" data-pin-color="${attr(MINIMAP_PIN_COLORS.party)}"><span class="totm-minimap-swatch" style="${attr(`--pin-color:${MINIMAP_PIN_COLORS.party}`)}"></span><span>Party</span></button>
      <button type="button" data-minimap-action="add-pin" data-pin-type="enemy" data-pin-label="Enemy" data-pin-color="${attr(MINIMAP_PIN_COLORS.enemy)}"><span class="totm-minimap-swatch" style="${attr(`--pin-color:${MINIMAP_PIN_COLORS.enemy}`)}"></span><span>Enemy</span></button>
      <button type="button" data-minimap-action="add-pin" data-pin-type="objective" data-pin-label="Goal" data-pin-color="${attr(MINIMAP_PIN_COLORS.objective)}"><span class="totm-minimap-swatch" style="${attr(`--pin-color:${MINIMAP_PIN_COLORS.objective}`)}"></span><span>Goal</span></button>
      <button type="button" data-minimap-action="add-pin" data-pin-type="point" data-pin-label="Point" data-pin-color="${attr(MINIMAP_PIN_COLORS.point)}"><span class="totm-minimap-swatch" style="${attr(`--pin-color:${MINIMAP_PIN_COLORS.point}`)}"></span><span>Point</span></button>
      <button type="button" class="is-danger" data-minimap-action="clear-pins"><i class="fas fa-trash"></i><span>Pins</span></button>
    </div>`:"";
  return `<section id="totm-minimap-dock" class="${editing?"is-editing":""}" style="${minimapStateStyle()}" data-minimap-pins="${map.pins.length}">
    <div class="totm-minimap-head">
      <div class="totm-minimap-title"><i class="fas fa-map"></i><span>Minimap</span></div>
      <div class="totm-minimap-actions">${isGM()?`<button type="button" data-minimap-action="edit" class="${editing?"is-active":""}" title="Minimap Controls"><i class="fas fa-map-location-dot"></i></button>`:""}<button type="button" data-minimap-action="popout" title="Pop Out"><i class="fas fa-up-right-from-square"></i></button><button type="button" data-minimap-action="close" title="Close"><i class="fas fa-times"></i></button></div>
    </div>
    ${controls}
    <div class="totm-minimap-body">${renderMinimapMap(d,{editable:editing})}</div>
  </section>`;
}
function minimapPopupBody(scene,d){
  return `<div class="totm-minimap-popup"><div class="totm-minimap-popup-head"><i class="fas fa-map"></i><span>${esc(scene?.name||"TOTM")} Minimap</span></div><div class="totm-minimap-popup-body">${renderMinimapMap(d,{popup:true})}</div></div>`;
}
function minimapPopupDocument(scene,d){
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(scene?.name||"TOTM")} Minimap</title><style>
    :root{color-scheme:dark}body{margin:0;background:#07070c;color:#e8e4dc;font-family:Signika,Arial,sans-serif;overflow:hidden}.totm-minimap-popup{height:100vh;display:flex;flex-direction:column}.totm-minimap-popup-head{height:36px;display:flex;align-items:center;gap:8px;padding:0 12px;background:rgba(10,10,18,.96);border-bottom:1px solid rgba(201,168,76,.22);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#c9a84c}.totm-minimap-popup-body{flex:1;min-height:0;padding:10px}.totm-minimap-map{position:relative;width:100%;height:100%;overflow:hidden;border:1px solid rgba(201,168,76,.22);border-radius:8px;background:#101018 center/100% 100% no-repeat;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}.totm-minimap-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:rgba(232,228,220,.55);font-size:12px}.totm-minimap-pin{position:absolute;transform:translate(-50%,-50%);width:22px;height:22px;border:2px solid rgba(255,255,255,.92);border-radius:999px;background:var(--pin-color,#58a6ff);box-shadow:0 0 0 2px rgba(0,0,0,.65),0 0 14px color-mix(in srgb,var(--pin-color,#58a6ff) 50%, transparent);display:flex;align-items:center;justify-content:center;color:#111;font-size:10px;font-weight:900;pointer-events:none}.totm-minimap-pin span{line-height:1}.totm-minimap-resize{display:none}
  </style></head><body>${minimapPopupBody(scene,d)}</body></html>`;
}
function refreshMinimapPopout(scene=game.scenes.viewed,d=getData(scene)){
  if(!MINIMAP_POPPED)return false;
  if(!MINIMAP_POPUP||MINIMAP_POPUP.closed){MINIMAP_POPPED=false;MINIMAP_POPUP=null;return false;}
  try{
    MINIMAP_POPUP.document.body.innerHTML=minimapPopupBody(scene,d);
    return true;
  }catch{return false;}
}
function openMinimapPopout(scene=game.scenes.viewed,d=getData(scene)){
  const popup=window.open("","totm-minimap","width=520,height=560,resizable=yes,scrollbars=no");
  if(!popup){ui.notifications.warn("Your browser blocked the minimap popout.");return false;}
  MINIMAP_POPUP=popup;
  MINIMAP_POPPED=true;
  MINIMAP_OPEN=true;
  MINIMAP_EDITING=false;
  popup.document.open();
  popup.document.write(minimapPopupDocument(scene,d));
  popup.document.close();
  popup.focus();
  popup.addEventListener?.("beforeunload",()=>{MINIMAP_POPPED=false;MINIMAP_POPUP=null;});
  refreshMinimapDockOnly(scene,d);
  return true;
}
function closeMinimapPopout(){
  if(MINIMAP_POPUP&&!MINIMAP_POPUP.closed)MINIMAP_POPUP.close();
  MINIMAP_POPUP=null;
  MINIMAP_POPPED=false;
}
function toggleMinimap(scene=game.scenes.viewed,d=getData(scene)){
  if(MINIMAP_OPEN){
    closeMinimapPopout();
    MINIMAP_OPEN=false;
    MINIMAP_EDITING=false;
  }else{
    MINIMAP_OPEN=true;
    MINIMAP_EDITING=false;
    MINIMAP_POPPED=false;
  }
  refreshMinimapDockOnly(scene,d)||refreshChangedAreas(scene,d);
}
function openMinimapControls(scene=game.scenes.viewed,d=getData(scene)){
  if(!isGM())return;
  const close=MINIMAP_OPEN&&MINIMAP_EDITING&&!MINIMAP_POPPED;
  closeMinimapPopout();
  MINIMAP_OPEN=!close;
  MINIMAP_EDITING=!close;
  refreshMinimapDockOnly(scene,d)||refreshChangedAreas(scene,d);
}
async function saveMinimapAndRefresh(scene,d){
  d.minimap=normalizeMinimapData(d.minimap);
  await saveData(scene,d);
  emit();
  refreshChangedAreas(scene,d);
}
function bindMinimapDockEvents(root,scene,d){
  const dock=root?.querySelector?.("#totm-minimap-dock");
  if(!dock)return;
  const applyState=()=>{dock.style.left=`${MINIMAP_VIEW_STATE.left}px`;dock.style.top=`${MINIMAP_VIEW_STATE.top}px`;dock.style.setProperty("--totm-minimap-size",`${MINIMAP_VIEW_STATE.size}px`);};
  dock.addEventListener("click",async event=>{
    const btn=event.target.closest("[data-minimap-action]");
    if(!btn)return;
    const action=btn.dataset.minimapAction;
    if(action==="resize")return;
    event.preventDefault();
    event.stopPropagation();
    if(action==="close"){MINIMAP_OPEN=false;MINIMAP_EDITING=false;refreshMinimapDockOnly(scene,d);return;}
    if(action==="edit"&&isGM()){MINIMAP_EDITING=!MINIMAP_EDITING;MINIMAP_OPEN=true;refreshMinimapDockOnly(scene,getData(scene));return;}
    if(action==="popout"){openMinimapPopout(scene,getData(scene));return;}
    if(!isGM())return;
    const live=getData(scene),map=minimapData(live);
    if(action==="set-image"){
      new FilePicker({type:"image",callback:async path=>{const latest=getData(scene);minimapData(latest).image=path;await saveMinimapAndRefresh(scene,latest);}}).browse();
    }else if(action==="use-stage"){
      if(!live.background){ui.notifications.warn("This TOTM scene has no stage background set.");return;}
      map.image=live.background;
      await saveMinimapAndRefresh(scene,live);
    }else if(action==="clear-image"){
      map.image="";
      await saveMinimapAndRefresh(scene,live);
    }else if(action==="add-pin"){
      const pin={id:foundry.utils.randomID(),type:btn.dataset.pinType||"point",label:btn.dataset.pinLabel||"Pin",color:btn.dataset.pinColor||MINIMAP_PIN_COLORS.point,x:50,y:50,visible:true};
      map.pins.push(pin);
      MINIMAP_SELECTED_PIN_ID=pin.id;
      await saveMinimapAndRefresh(scene,live);
    }else if(action==="clear-pins"){
      const ok=confirmDestructive?await confirmDestructive({title:"Clear Minimap Pins?",content:"All minimap pins on this scene will be removed.",yes:"Clear Pins"}):true;
      if(!ok)return;
      map.pins=[];
      await saveMinimapAndRefresh(scene,live);
    }
  });
  const head=dock.querySelector(".totm-minimap-head");
  head?.addEventListener("pointerdown",event=>{
    if(event.target.closest("button"))return;
    const startX=event.clientX,startY=event.clientY,startLeft=MINIMAP_VIEW_STATE.left,startTop=MINIMAP_VIEW_STATE.top;
    const onMove=e=>{MINIMAP_VIEW_STATE.left=startLeft+(e.clientX-startX);MINIMAP_VIEW_STATE.top=startTop+(e.clientY-startY);minimapStateStyle();applyState();};
    const onUp=()=>{document.removeEventListener("pointermove",onMove);document.removeEventListener("pointerup",onUp);};
    event.preventDefault();
    document.addEventListener("pointermove",onMove);
    document.addEventListener("pointerup",onUp,{once:true});
  });
  dock.querySelector("[data-minimap-action='resize']")?.addEventListener("pointerdown",event=>{
    const startX=event.clientX,startY=event.clientY,startSize=MINIMAP_VIEW_STATE.size;
    const onMove=e=>{const delta=Math.max(e.clientX-startX,e.clientY-startY);MINIMAP_VIEW_STATE.size=startSize+delta;minimapStateStyle();applyState();};
    const onUp=()=>{document.removeEventListener("pointermove",onMove);document.removeEventListener("pointerup",onUp);};
    event.preventDefault();
    event.stopPropagation();
    document.addEventListener("pointermove",onMove);
    document.addEventListener("pointerup",onUp,{once:true});
  });
  if(!isGM()||!MINIMAP_EDITING)return;
  dock.querySelector("[data-minimap-map]")?.addEventListener("click",async event=>{
    if(event.target.closest("[data-minimap-pin]")||event.target.closest("[data-minimap-action]"))return;
    if(!MINIMAP_SELECTED_PIN_ID)return;
    const live=getData(scene),map=minimapData(live),pin=map.pins.find(p=>p.id===MINIMAP_SELECTED_PIN_ID);
    if(!pin)return;
    const rect=event.currentTarget.getBoundingClientRect();
    pin.x=clampPercent(((event.clientX-rect.left)/Math.max(rect.width,1))*100,50);
    pin.y=clampPercent(((event.clientY-rect.top)/Math.max(rect.height,1))*100,50);
    MINIMAP_SELECTED_PIN_ID="";
    await saveMinimapAndRefresh(scene,live);
  });
  dock.querySelectorAll(".totm-minimap-pin[data-minimap-pin]").forEach(pinEl=>{
    pinEl.addEventListener("click",event=>{
      event.preventDefault();
      event.stopPropagation();
      const pinId=pinEl.dataset.minimapPin||"";
      const selected=MINIMAP_SELECTED_PIN_ID===pinId;
      MINIMAP_SELECTED_PIN_ID=selected?"":pinId;
      dock.querySelectorAll(".totm-minimap-pin.is-selected").forEach(node=>node.classList.remove("is-selected"));
      if(!selected)pinEl.classList.add("is-selected");
    });
    pinEl.addEventListener("contextmenu",async event=>{
      event.preventDefault();
      const live=getData(scene),map=minimapData(live),idx=map.pins.findIndex(pin=>pin.id===pinEl.dataset.minimapPin);
      if(idx<0)return;
      if(map.pins[idx]?.id===MINIMAP_SELECTED_PIN_ID)MINIMAP_SELECTED_PIN_ID="";
      map.pins.splice(idx,1);
      await saveMinimapAndRefresh(scene,live);
    });
  });
}
function refreshMinimapDockOnly(scene=game.scenes.viewed,d=getData(scene)){
  refreshMinimapPopout(scene,d);
  const el=document.getElementById("totm-ui");
  if(!el||!scene||!isTOTM(scene))return false;
  const old=el.querySelector("#totm-minimap-dock");
  const html=renderMinimapDock(d);
  if(!html){old?.remove();return true;}
  const wrap=document.createElement("div");
  wrap.innerHTML=html.trim();
  const next=wrap.firstElementChild;
  if(!next)return false;
  if(old)old.replaceWith(next);
  else (el.querySelector("#totm-main")||el).appendChild(next);
  bindMinimapDockEvents(el,scene,d);
  return true;
}

function renderTopbar(d,scene){return renderTopbarModule({d,scene,deps:{hasClockModule,getClockEntries,moduleVersion:game.modules.get(MODULE_ID)?.version||"",isGM,playerTopbarItems:["tb-clocks","tb-minimap"],getMediaJournalCount}});}

function backupFileSlug(value){
  return String(value||"scene").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"scene";
}

function downloadJsonFile(filename,payload){
  const json=JSON.stringify(payload,null,2);
  if(typeof saveDataToFile==="function"){
    saveDataToFile(json,"text/json",filename);
    return;
  }
  const blob=new Blob([json],{type:"text/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function getSceneDocumentSnapshot(scene){
  try{return cloneData(scene?.toObject?.()||{});}
  catch{return null;}
}

function buildSceneBackupPayload(scene,d=getData(scene)){
  const moduleVersion=game.modules.get(MODULE_ID)?.version||"";
  const data=normalizeSceneData(d);
  return {
    schema:"totm-overlay.scene-backup.v1",
    module:MODULE_ID,
    moduleVersion,
    exportedAt:new Date().toISOString(),
    world:{id:game.world?.id||"",title:game.world?.title||""},
    scene:{
      id:scene?.id||"",
      uuid:scene?.uuid||"",
      name:scene?.name||"",
      background:scene?.background?.src||"",
      active:!!scene?.active,
      navigation:!!scene?.navigation
    },
    flags:{[MODULE_ID]:{[FLAG_TOTM]:true,[FLAG_DATA]:cloneData(data)}},
    data:cloneData(data),
    sceneDocument:getSceneDocumentSnapshot(scene)
  };
}

function exportSceneBackup(scene,d=getData(scene)){
  if(!scene||!isTOTM(scene)){ui.notifications.warn("No active TOTM scene to export.");return;}
  const payload=buildSceneBackupPayload(scene,d);
  const stamp=new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
  downloadJsonFile(`totm-${backupFileSlug(scene.name)}-${stamp}.json`,payload);
  ui.notifications.info("TOTM scene backup exported.");
}

function getDataFromSceneBackup(payload){
  if(!payload||typeof payload!=="object")return null;
  const flagData=payload.flags?.[MODULE_ID]?.[FLAG_DATA];
  const data=payload.data||flagData||(Array.isArray(payload.actors)||Array.isArray(payload.backgrounds)?payload:null);
  return data&&typeof data==="object"?normalizeSceneData(data):null;
}

async function importSceneBackup(scene,payload){
  if(!scene||!isGM())return;
  const data=getDataFromSceneBackup(payload);
  if(!data){ui.notifications.error("That file does not look like a TOTM scene backup.");return;}
  const backupScene=payload.scene||{};
  const sameScene=backupScene.uuid===scene.uuid||backupScene.id===scene.id;
  const sourceName=backupScene.name||"Unknown scene";
  const warning=sameScene
    ? `This will restore TOTM prep for ${esc(scene.name)}.`
    : `This backup came from "${esc(sourceName)}". It will be restored onto the current scene, "${esc(scene.name)}".`;
  const ok=await confirmDestructive({title:"Restore TOTM Scene Backup?",content:`${warning} Current TOTM prep on this scene will be replaced.`,yes:"Restore"});
  if(!ok)return;
  await setF(scene,FLAG_TOTM,true);
  if(isGM()){
    await ensurePlayerTokenDocs(scene,data);
    await ensureEnemyTokenDocs(scene,data);
    await prunePlayerTokenDocs(scene,data);
    await pruneEnemyTokenDocs(scene,data);
  }
  await saveData(scene,data);
  emit();
  refreshChangedAreas(scene,data);
  ui.notifications.info("TOTM scene backup restored.");
}

function openSceneBackupDialog(scene,d=getData(scene)){
  if(!scene||!isGM())return;
  new Dialog({
    title:"TOTM Scene Backup",
    content:`<form>
      <p class="notes">Export downloads this scene's TOTM prep as JSON. Import restores a backup onto the currently viewed scene, using scene id/uuid metadata instead of scene name.</p>
      <div class="form-group"><label>Backup File</label><input type="file" name="backup" accept=".json,application/json"/></div>
    </form>`,
    buttons:{
      export:{icon:'<i class="fas fa-download"></i>',label:"Export",callback:()=>exportSceneBackup(scene,getData(scene))},
      import:{icon:'<i class="fas fa-upload"></i>',label:"Import",callback:async html=>{
        const file=html[0]?.querySelector?.("[name=backup]")?.files?.[0];
        if(!file){ui.notifications.warn("Choose a backup JSON file first.");return false;}
        let payload;
        try{payload=JSON.parse(await file.text());}
        catch{ui.notifications.error("Could not read that backup JSON file.");return false;}
        await importSceneBackup(scene,payload);
      }},
      close:{icon:'<i class="fas fa-times"></i>',label:"Close"}
    },
    default:"export"
  }).render(true);
}

function getWorldJournals(){
  return game.journal?.contents||[];
}

function getMediaJournal(ref){
  const key=String(ref||"").trim();
  if(!key)return null;
  return game.journal?.get?.(key)||getWorldJournals().find(j=>j.uuid===key||j.id===key)||null;
}

function getJournalPages(journal){
  if(!journal)return [];
  if(Array.isArray(journal.pages?.contents))return journal.pages.contents;
  if(journal.pages?.contents)return Array.from(journal.pages.contents);
  if(journal.pages)return Array.from(journal.pages);
  return [];
}

function normalizeMediaRole(role){
  const value=String(role||"unsorted").trim().toLowerCase();
  return MEDIA_ROLE_META[value]?value:"unsorted";
}

function getMediaPageImage(page){
  const image=String(page?.src||page?.image?.src||page?.img||page?.texture?.src||page?.system?.src||page?.getFlag?.(MODULE_ID,"mediaImage")||"").trim();
  return isImagePath(image)?image:"";
}

function getMediaPageRole(page){
  return normalizeMediaRole(page?.getFlag?.(MODULE_ID,"mediaRole"));
}

function getMediaEntries(journal){
  return getJournalPages(journal).map(page=>{
    const image=getMediaPageImage(page);
    if(!image)return null;
    const name=String(page.name||page.getFlag?.(MODULE_ID,"mediaName")||cleanBackgroundNameFromPath(image)).trim()||cleanBackgroundNameFromPath(image);
    const role=getMediaPageRole(page);
    return {page,id:page.id,name,image,role,searchText:[name,image,role,journal?.name].filter(Boolean).join(" ").toLowerCase()};
  }).filter(Boolean);
}

function getMediaJournalCount(d){
  return getMediaEntries(getMediaJournal(d?.mediaJournal)).length;
}

function mediaDropFromPath(path,name=""){
  path=String(path||"").trim();
  if(!isImagePath(path))return null;
  return {image:path,name:String(name||cleanBackgroundNameFromPath(path)).trim()||cleanBackgroundNameFromPath(path)};
}

function mediaDropFromObject(data){
  if(!data||typeof data!=="object")return null;
  const image=String(data.img||data.image||data.src||data.path||data.file||data.texture?.src||data.system?.src||"").trim();
  if(!isImagePath(image))return null;
  return mediaDropFromPath(image,String(data.name||data.label||""));
}

async function resolveMediaDropFromDocument(data){
  if(!data?.uuid)return null;
  let doc=null;
  try{doc=await fromUuid(data.uuid);}catch{doc=null;}
  if(!doc)return null;
  const pageImage=getMediaPageImage(doc);
  if(pageImage)return mediaDropFromPath(pageImage,doc.name||data.name||data.label||"");
  return mediaDropFromObject({
    name:doc.name||data.name||data.label,
    img:doc.img,
    image:doc.image?.src,
    src:doc.src,
    texture:doc.texture,
    system:doc.system
  });
}

async function mediaDropsFromValue(value){
  if(!value)return [];
  if(Array.isArray(value)){
    const batches=await Promise.all(value.map(item=>mediaDropsFromValue(item)));
    return batches.flat();
  }
  if(typeof value==="object"){
    const fromObject=mediaDropFromObject(value);
    if(fromObject)return [fromObject];
    const fromDoc=await resolveMediaDropFromDocument(value);
    return fromDoc?[fromDoc]:[];
  }
  const text=String(value||"").trim();
  if(!text)return [];
  try{
    const parsed=JSON.parse(text);
    return await mediaDropsFromValue(parsed);
  }catch{}
  const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith("#"));
  const drops=[];
  for(const line of lines){
    let parsed=null;
    try{parsed=JSON.parse(line);}catch{parsed=null;}
    if(parsed)drops.push(...await mediaDropsFromValue(parsed));
    else{
      const direct=mediaDropFromPath(line);
      if(direct)drops.push(direct);
    }
  }
  return drops;
}

function uniqueMediaDrops(drops){
  const seen=new Set();
  return (drops||[]).filter(drop=>{
    const key=String(drop?.image||"").trim();
    if(!key||seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

async function extractMediaDropsFromTransfer(transfer){
  if(!transfer)return [];
  const drops=[];
  const rawPlain=String(transfer.getData?.("text/plain")||"").trim();
  if(rawPlain)drops.push(...await mediaDropsFromValue(rawPlain));
  const uriList=String(transfer.getData?.("text/uri-list")||"").trim();
  if(uriList)drops.push(...await mediaDropsFromValue(uriList));
  const downloadUrl=String(transfer.getData?.("DownloadURL")||"").trim();
  if(downloadUrl){
    const parts=downloadUrl.split(":");
    drops.push(...await mediaDropsFromValue(parts.slice(2).join(":")));
  }
  Array.from(transfer.files||[]).forEach(file=>{
    const image=String(file?.path||file?.name||"").trim();
    const drop=mediaDropFromPath(image,file?.name||"");
    if(drop)drops.push(drop);
  });
  return uniqueMediaDrops(drops);
}

function mediaPageData(drop,role="unsorted"){
  const image=String(drop?.image||"").trim();
  const name=String(drop?.name||cleanBackgroundNameFromPath(image)).trim()||cleanBackgroundNameFromPath(image);
  return {
    name,
    type:"image",
    src:image,
    image:{caption:""},
    flags:{[MODULE_ID]:{mediaRole:normalizeMediaRole(role),mediaImage:image,mediaName:name,mediaCreatedAt:Date.now()}}
  };
}

async function createMediaJournal(scene,d,{forceNew=false}={}){
  if(!isGM())return null;
  if(!forceNew){
    const existing=getMediaJournal(d?.mediaJournal);
    if(existing)return existing;
  }
  const journal=await JournalEntry.create({
    name:`${scene?.name||"TOTM"} Media`,
    flags:{[MODULE_ID]:{mediaJournal:true,sceneId:scene?.id||"",sceneUuid:scene?.uuid||""}}
  });
  const live=getData(scene);
  live.mediaJournal=journal.id;
  await saveData(scene,live);
  emit();
  refreshTopbarOnly(scene,live);
  ui.notifications.info(`Linked ${journal.name} as the TOTM media journal.`);
  return journal;
}

async function setLinkedMediaJournal(scene,journalId){
  const live=getData(scene);
  live.mediaJournal=String(journalId||"");
  await saveData(scene,live);
  emit();
  refreshTopbarOnly(scene,live);
  return getMediaJournal(live.mediaJournal);
}

async function setMediaPageRole(page,role){
  if(!page)return;
  const next=normalizeMediaRole(role);
  if(page.getFlag?.(MODULE_ID,"mediaRole")===next)return;
  await page.setFlag(MODULE_ID,"mediaRole",next);
}

async function createMediaPagesFromDrops(journal,drops,role="unsorted"){
  if(!journal)return {created:0,updated:0};
  const entries=getMediaEntries(journal);
  const byImage=new Map(entries.map(entry=>[entry.image,entry]));
  const createData=[];
  let updated=0;
  for(const drop of uniqueMediaDrops(drops)){
    const existing=byImage.get(drop.image);
    if(existing){
      if(role!=="unsorted"&&existing.role!==role){
        await setMediaPageRole(existing.page,role);
        updated++;
      }
      continue;
    }
    createData.push(mediaPageData(drop,role));
  }
  if(createData.length)await journal.createEmbeddedDocuments("JournalEntryPage",createData);
  return {created:createData.length,updated};
}

function commitMediaSceneProp(targetData,prop){
  if(!targetData||!prop)return [];
  const key=String(prop.backgroundKey||targetData.background||"");
  const saved=foundry.utils.deepClone({...prop,backgroundKey:key});
  if(!targetData.propsByBackground||typeof targetData.propsByBackground!=="object"||Array.isArray(targetData.propsByBackground))targetData.propsByBackground={};
  const bucket=Array.isArray(targetData.propsByBackground[key])?targetData.propsByBackground[key]:[];
  const idx=bucket.findIndex(item=>item?.id===saved.id);
  if(idx>=0)bucket[idx]=saved;
  else bucket.push(saved);
  targetData.propsByBackground[key]=bucket;
  if(String(targetData.background||"")===key)targetData.props=bucket.map(item=>foundry.utils.deepClone(item));
  return bucket;
}

async function addMediaBackgroundToScene(scene,entry,{useNow=false,category=""}={}){
  if(!entry?.image)return;
  const live=getData(scene);
  const backgrounds=normalizeBackgrounds(live);
  const bgCategory=String(category||"Journal").trim()||"Journal";
  let bg=backgrounds.find(item=>String(item.image)===String(entry.image));
  if(!bg){
    bg=makeBgFromPath(entry.image,{name:entry.name,category:bgCategory});
    backgrounds.push(bg);
  }else{
    bg.category=bgCategory;
  }
  live.backgrounds=backgrounds;
  if(useNow)setSceneBg(live,bg);
  await saveData(scene,live);
  if(useNow){emitStage();refreshChangedAreas(scene,live);}
  else{emit();refreshTopbarOnly(scene,live);}
  ui.notifications.info(useNow?`Using ${entry.name} as the background.`:`Added ${entry.name} to the background library.`);
}

async function addMediaNpcToScene(scene,entry,{place=false}={}){
  if(!entry?.image)return;
  const live=getData(scene);
  if(!Array.isArray(live.npcs))live.npcs=[];
  let npc=live.npcs.find(item=>String(item.image)===String(entry.image));
  if(!npc){
    npc={name:entry.name||cleanBackgroundNameFromPath(entry.image),image:entry.image,posX:50,posY:50,scale:100,visible:false,category:"Journal",tags:""};
    live.npcs.push(npc);
  }
  const saveNpc=async(refresh=true)=>{
    await saveData(scene,live);
    emit();
    if(refresh)refreshChangedAreas(scene,live);
  };
  if(place&&openDragPos){
    ui.notifications.info(`Position ${npc.name}. Players will see it after you click Done.`);
    openDragPos(npc,scene,live,async()=>{
      npc.visible=true;
      await saveNpc(true);
    },async()=>{
      if(!npc.visible){
        const idx=live.npcs.indexOf(npc);
        if(idx>=0)live.npcs.splice(idx,1);
        await saveNpc(true);
      }
      ui.notifications.info(`Cancelled ${npc.name} placement.`);
    });
    return;
  }
  await saveNpc(false);
  ui.notifications.info(`Added ${npc.name} to the NPC roster.`);
}

async function addMediaPropToScene(scene,entry){
  if(!entry?.image)return;
  const live=getData(scene);
  const prop={id:foundry.utils.randomID(),kind:"prop",name:entry.name||cleanBackgroundNameFromPath(entry.image),image:entry.image,backgroundKey:String(live.background||""),posX:50,posY:50,scale:100};
  const commit=async()=>{
    const latest=getData(scene);
    commitMediaSceneProp(latest,prop);
    await saveData(scene,latest);
    emit();
    refreshChangedAreas(scene,latest);
  };
  if(openDragPos){
    ui.notifications.info(`Position ${prop.name}. Players will see it after you click Done.`);
    openDragPos(prop,scene,live,commit,()=>ui.notifications.info(`Cancelled ${prop.name} placement.`));
    return;
  }
  await commit();
}

async function setMediaFeaturedArt(scene,entry){
  if(!entry?.image)return;
  const live=getData(scene);
  live.featuredArt=entry.image;
  live.featuredCaption=entry.name||cleanBackgroundNameFromPath(entry.image);
  await saveData(scene,live);
  emit();
  refreshChangedAreas(scene,live);
  ui.notifications.info(`Featured ${live.featuredCaption}.`);
}

function getBackgroundCategories(d){
  return Array.from(new Set(normalizeBackgrounds(d).map(bg=>String(bg.category||"Uncategorized").trim()||"Uncategorized"))).sort((a,b)=>a.localeCompare(b));
}

function mediaJournalCategoryName(journal){
  return String(journal?.name||"Journal").replace(/\s+media$/i,"").trim()||"Journal";
}

function renderMediaImportCategoryOptions(d,journal,selected=""){
  const journalCategory=mediaJournalCategoryName(journal);
  const categories=[journalCategory,...getBackgroundCategories(d).filter(cat=>cat!==journalCategory)];
  const active=String(selected||journalCategory).trim()||journalCategory;
  return categories.map(cat=>`<option value="${attr(cat)}" ${cat===active?"selected":""}>${esc(cat)}</option>`).join("");
}

function renderMediaSyncSourceOptions(d,selected="current"){
  const active=String(selected||"current");
  const cats=getBackgroundCategories(d);
  return [
    `<option value="current" ${active==="current"?"selected":""}>${esc(loc("CurrentBackground","Current Background"))}</option>`,
    `<option value="all" ${active==="all"?"selected":""}>${esc(loc("AllBackgrounds","All Backgrounds"))}</option>`,
    ...cats.map(cat=>{
      const value=`cat:${encodeURIComponent(cat)}`;
      return `<option value="${attr(value)}" ${active===value?"selected":""}>${esc(cat)}</option>`;
    })
  ].join("");
}

function backgroundMatchesMediaSyncSource(bg,d,source="current"){
  const value=String(source||"current");
  if(value==="all")return true;
  if(value.startsWith("cat:")){
    const cat=safeDecodeURIComponent(value.slice(4));
    return String(bg?.category||"Uncategorized").trim()===cat;
  }
  return String(bg?.image||"")===String(d.background||"");
}

function gatherSceneMediaItems(d,{backgroundSource="current"}={}){
  const items=[];
  const add=(image,name,role)=>{
    image=String(image||"").trim();
    if(!isImagePath(image))return;
    items.push({image,name:String(name||cleanBackgroundNameFromPath(image)).trim()||cleanBackgroundNameFromPath(image),role:normalizeMediaRole(role)});
  };
  const backgrounds=normalizeBackgrounds(d).filter(bg=>backgroundMatchesMediaSyncSource(bg,d,backgroundSource));
  backgrounds.forEach(bg=>add(bg.image,displayBackgroundName(bg),"background"));
  if(backgroundSource==="current"&&d.background&&!backgrounds.some(bg=>String(bg.image)===String(d.background)))add(d.background,cleanBackgroundNameFromPath(d.background),"background");
  (d.npcs||[]).forEach(npc=>add(npc.image,npc.name,"npc"));
  if(d.featuredArt)add(d.featuredArt,d.featuredCaption||cleanBackgroundNameFromPath(d.featuredArt),"featured");
  const propBuckets=[...(Array.isArray(d.props)?[d.props]:[]),...Object.values(d.propsByBackground||{}).filter(Array.isArray)];
  propBuckets.flat().forEach(prop=>add(prop.image,prop.name,"prop"));
  const seen=new Set();
  return items.filter(item=>{
    if(seen.has(item.image))return false;
    seen.add(item.image);
    return true;
  });
}

async function syncSceneToMediaJournal(scene,d,journal,{backgroundSource="current"}={}){
  journal=journal||await createMediaJournal(scene,d);
  if(!journal)return;
  const items=gatherSceneMediaItems(getData(scene),{backgroundSource});
  const result=await createMediaPagesFromDrops(journal,items,"unsorted");
  const entries=getMediaEntries(journal);
  for(const item of items){
    const entry=entries.find(e=>e.image===item.image);
    if(entry&&entry.role==="unsorted"&&item.role!=="unsorted")await setMediaPageRole(entry.page,item.role);
  }
  ui.notifications.info(`Synced ${items.length} scene images to ${journal.name}.`);
  return result;
}

async function importMediaJournalToScene(scene,journal,{category=""}={}){
  if(!journal)return;
  const live=getData(scene);
  const entries=getMediaEntries(journal);
  const backgrounds=normalizeBackgrounds(live);
  if(!Array.isArray(live.npcs))live.npcs=[];
  const bgCategory=String(category||mediaJournalCategoryName(journal)).trim()||mediaJournalCategoryName(journal);
  let bgCount=0,bgUpdated=0,npcCount=0,featuredCount=0;
  for(const entry of entries){
    if(entry.role==="background"){
      const existing=backgrounds.find(bg=>String(bg.image)===String(entry.image));
      if(!existing){
        backgrounds.push(makeBgFromPath(entry.image,{name:entry.name,category:bgCategory}));
        bgCount++;
      }else if(existing.category!==bgCategory){
        existing.category=bgCategory;
        bgUpdated++;
      }
    }else if(entry.role==="npc"){
      if(!live.npcs.some(npc=>String(npc.image)===String(entry.image))){
        live.npcs.push({name:entry.name,image:entry.image,posX:50,posY:50,scale:100,visible:false,category:"Journal",tags:""});
        npcCount++;
      }
    }else if(entry.role==="featured"&&!live.featuredArt){
      live.featuredArt=entry.image;
      live.featuredCaption=entry.name;
      featuredCount++;
    }
  }
  live.backgrounds=backgrounds;
  await saveData(scene,live);
  emit();
  refreshChangedAreas(scene,live);
  ui.notifications.info(`Imported ${bgCount} backgrounds${bgUpdated?`, recategorized ${bgUpdated}`:""}, ${npcCount} NPCs, and ${featuredCount} featured image from ${journal.name}.`);
}

function renderJournalOptions(selectedId=""){
  const selected=String(selectedId||"");
  return [`<option value="">- ${esc(loc("ChooseJournal","Choose Journal"))} -</option>`,...getWorldJournals().map(j=>`<option value="${attr(j.id)}" ${j.id===selected?"selected":""}>${esc(j.name)}</option>`)].join("");
}

function openMediaJournalManager(scene,d=getData(scene)){
  if(!scene||!isGM())return;
  let selectedJournalId=String(d.mediaJournal||"");
  let activeRole="all";
  let searchTerm="";
  let importCategory="";
  let syncSource="current";
  const roleTabs=["all",...Object.keys(MEDIA_ROLE_META)];
  const initialJournal=getMediaJournal(selectedJournalId);
  importCategory=mediaJournalCategoryName(initialJournal);
  const content=`<div class="totm-media-journal">
    <div class="totm-media-toolbar">
      <label class="totm-media-journal-select"><i class="fas fa-book"></i><select name="mediaJournal">${renderJournalOptions(selectedJournalId)}</select></label>
      <button type="button" data-media-toolbar="link"><i class="fas fa-link"></i> ${esc(loc("Link","Link"))}</button>
      <button type="button" data-media-toolbar="new"><i class="fas fa-plus"></i> ${esc(loc("NewJournal","New Journal"))}</button>
      <button type="button" data-media-toolbar="sync"><i class="fas fa-upload"></i> ${esc(loc("SyncScene","Sync Scene"))}</button>
      <button type="button" data-media-toolbar="import"><i class="fas fa-download"></i> ${esc(loc("ImportAll","Import All"))}</button>
    </div>
    <div class="totm-media-subbar">
      <label class="totm-media-search"><i class="fas fa-search"></i><input type="search" name="mediaSearch" placeholder="${attr(loc("SearchImages","Search images..."))}"/></label>
      <label class="totm-media-drop-role"><span>${esc(loc("DropAs","Drop as"))}</span><select name="dropRole">${Object.entries(MEDIA_ROLE_META).map(([role,meta])=>`<option value="${attr(role)}">${esc(meta.label)}</option>`).join("")}</select></label>
      <label class="totm-media-sync-source"><span>${esc(loc("SyncFrom","Sync from"))}</span><select name="syncSource">${renderMediaSyncSourceOptions(d,syncSource)}</select></label>
      <label class="totm-media-import-category"><span>${esc(loc("ImportCategory","Import category"))}</span><select name="importCategory">${renderMediaImportCategoryOptions(d,initialJournal,importCategory)}</select></label>
    </div>
    <div class="totm-media-tabs">${roleTabs.map((role,idx)=>`<button type="button" class="${idx===0?"is-active":""}" data-media-tab="${attr(role)}">${role==="all"?esc(loc("All","All")):`<i class="${attr(MEDIA_ROLE_META[role].icon)}"></i> ${esc(MEDIA_ROLE_META[role].label)}`}</button>`).join("")}</div>
    <div class="totm-media-drop" data-media-drop><i class="fas fa-cloud-arrow-up"></i><span>${esc(loc("DropImagesIntoJournal","Drop images here"))}</span></div>
    <div class="totm-media-grid" data-media-grid></div>
  </div>`;
  const dlg=makeDialogPopoutCompatible(new Dialog({
    title:loc("MediaJournal","Media Journal"),
    content,
    buttons:{close:{icon:'<i class="fas fa-times"></i>',label:"Close"}},
    default:"close",
    resizable:true,
    render:html=>{
      const root=html[0],app=root.closest(".app");
      if(app){
        app.classList.add("totm-media-journal-dialog","totm-picker-dialog");
        applyDialogSize(app,"mediaJournalSize",{width:1040,height:760,minWidth:720,minHeight:520});
      }
      const journalSelect=root.querySelector("[name=mediaJournal]");
      const search=root.querySelector("[name=mediaSearch]");
      const dropRole=root.querySelector("[name=dropRole]");
      const syncSourceSelect=root.querySelector("[name=syncSource]");
      const importCategorySelect=root.querySelector("[name=importCategory]");
      const grid=root.querySelector("[data-media-grid]");
      const dropZone=root.querySelector("[data-media-drop]");
      const getJournal=()=>getMediaJournal(selectedJournalId);
      const refreshJournalSelect=()=>{journalSelect.innerHTML=renderJournalOptions(selectedJournalId);};
      const refreshCategoryControls=()=>{
        const journal=getJournal();
        const latest=getData(scene);
        syncSourceSelect.innerHTML=renderMediaSyncSourceOptions(latest,syncSource);
        importCategorySelect.innerHTML=renderMediaImportCategoryOptions(latest,journal,importCategory||mediaJournalCategoryName(journal));
      };
      const selectedImportCategory=()=>String(importCategorySelect.value||mediaJournalCategoryName(getJournal())).trim()||mediaJournalCategoryName(getJournal());
      const getShownEntries=()=>{
        const entries=getMediaEntries(getJournal());
        return entries.filter(entry=>{
          if(activeRole!=="all"&&entry.role!==activeRole)return false;
          if(!searchTerm)return true;
          return entry.searchText.includes(searchTerm);
        });
      };
      const render=()=>{
        const journal=getJournal();
        root.classList.toggle("has-journal",!!journal);
        root.querySelectorAll("[data-media-tab]").forEach(btn=>btn.classList.toggle("is-active",(btn.dataset.mediaTab||"all")===activeRole));
        if(!journal){
          grid.innerHTML=`<div class="totm-media-empty">${esc(loc("NoMediaJournalLinked","Link or create a journal to begin."))}</div>`;
          return;
        }
        const entries=getShownEntries();
        grid.innerHTML=entries.length?entries.map(entry=>{
          const roleMeta=MEDIA_ROLE_META[entry.role]||MEDIA_ROLE_META.unsorted;
          return `<article class="totm-media-card" data-page-id="${attr(entry.id)}">
            <button type="button" class="totm-media-thumb" data-media-act="${entry.role==="background"?"use-bg":"feature"}" style="${attr(`background-image:${cssUrl(entry.image)}`)}"></button>
            <div class="totm-media-card-body">
              <div class="totm-media-title" title="${attr(entry.name)}">${esc(entry.name)}</div>
              <div class="totm-media-role"><i class="${attr(roleMeta.icon)}"></i> ${esc(roleMeta.label)}</div>
            </div>
            <div class="totm-media-role-row">
              ${Object.entries(MEDIA_ROLE_META).map(([role,meta])=>`<button type="button" class="${entry.role===role?"is-active":""}" data-media-role="${attr(role)}" title="${attr(meta.label)}"><i class="${attr(meta.icon)}"></i></button>`).join("")}
            </div>
            <div class="totm-media-actions">
              <button type="button" data-media-act="use-bg" title="${attr(loc("UseBG","Use BG"))}"><i class="fas fa-play"></i><span>${esc(loc("UseBG","Use BG"))}</span></button>
              <button type="button" data-media-act="add-bg" title="${attr(loc("AddBG","Add BG"))}"><i class="fas fa-images"></i><span>${esc(loc("AddBG","Add BG"))}</span></button>
              <button type="button" data-media-act="place-npc" title="${attr(loc("PlaceNPC","Place NPC"))}"><i class="fas fa-user-tag"></i><span>${esc(loc("PlaceNPC","Place NPC"))}</span></button>
              <button type="button" data-media-act="place-prop" title="${attr(loc("PlaceProp","Place Prop"))}"><i class="fas fa-cube"></i><span>${esc(loc("PlaceProp","Place Prop"))}</span></button>
              <button type="button" data-media-act="feature" title="${attr(loc("Feature","Feature"))}"><i class="fas fa-star"></i><span>${esc(loc("Feature","Feature"))}</span></button>
            </div>
          </article>`;
        }).join(""):`<div class="totm-media-empty">${esc(loc("NoJournalImages","No journal images match."))}</div>`;
      };
      const getEntryFromEvent=event=>{
        const card=event.target.closest("[data-page-id]");
        if(!card)return null;
        return getMediaEntries(getJournal()).find(entry=>entry.id===card.dataset.pageId)||null;
      };
      root.querySelector("[data-media-toolbar='link']")?.addEventListener("click",async()=>{
        selectedJournalId=String(journalSelect.value||"");
        await setLinkedMediaJournal(scene,selectedJournalId);
        importCategory=mediaJournalCategoryName(getJournal());
        refreshCategoryControls();
        render();
      });
      root.querySelector("[data-media-toolbar='new']")?.addEventListener("click",async()=>{
        const journal=await createMediaJournal(scene,getData(scene),{forceNew:true});
        selectedJournalId=journal?.id||"";
        importCategory=mediaJournalCategoryName(journal);
        refreshJournalSelect();
        refreshCategoryControls();
        render();
      });
      root.querySelector("[data-media-toolbar='sync']")?.addEventListener("click",async()=>{
        const journal=getJournal()||await createMediaJournal(scene,getData(scene));
        selectedJournalId=journal?.id||selectedJournalId;
        refreshJournalSelect();
        await syncSceneToMediaJournal(scene,getData(scene),journal,{backgroundSource:syncSourceSelect.value||syncSource});
        render();
      });
      root.querySelector("[data-media-toolbar='import']")?.addEventListener("click",async()=>{
        const journal=getJournal();
        if(!journal){ui.notifications.warn("Link a journal first.");return;}
        await importMediaJournalToScene(scene,journal,{category:selectedImportCategory()});
        refreshCategoryControls();
        render();
      });
      journalSelect.addEventListener("change",()=>{
        selectedJournalId=String(journalSelect.value||"");
        importCategory=mediaJournalCategoryName(getJournal());
        refreshCategoryControls();
        render();
      });
      syncSourceSelect.addEventListener("change",()=>{syncSource=String(syncSourceSelect.value||"current");});
      importCategorySelect.addEventListener("change",()=>{importCategory=String(importCategorySelect.value||"");});
      search.addEventListener("input",()=>{searchTerm=String(search.value||"").trim().toLowerCase();render();});
      root.querySelectorAll("[data-media-tab]").forEach(btn=>btn.addEventListener("click",()=>{
        activeRole=btn.dataset.mediaTab||"all";
        render();
      }));
      dropZone.addEventListener("dragover",event=>{event.preventDefault();dropZone.classList.add("is-drag-over");});
      dropZone.addEventListener("dragleave",()=>dropZone.classList.remove("is-drag-over"));
      dropZone.addEventListener("drop",async event=>{
        event.preventDefault();
        dropZone.classList.remove("is-drag-over");
        const drops=await extractMediaDropsFromTransfer(event.dataTransfer);
        if(!drops.length){ui.notifications.warn("No image paths found in that drop.");return;}
        const journal=getJournal()||await createMediaJournal(scene,getData(scene));
        selectedJournalId=journal?.id||selectedJournalId;
        refreshJournalSelect();
        const role=normalizeMediaRole(dropRole.value||activeRole);
        const result=await createMediaPagesFromDrops(journal,drops,role);
        ui.notifications.info(`Added ${result.created} image pages${result.updated?` and updated ${result.updated}`:""} in ${journal.name}.`);
        refreshTopbarOnly(scene,getData(scene));
        render();
      });
      grid.addEventListener("click",async event=>{
        const roleBtn=event.target.closest("[data-media-role]");
        const entry=getEntryFromEvent(event);
        if(!entry)return;
        if(roleBtn){
          await setMediaPageRole(entry.page,roleBtn.dataset.mediaRole);
          render();
          refreshTopbarOnly(scene,getData(scene));
          return;
        }
        const act=event.target.closest("[data-media-act]")?.dataset.mediaAct;
        if(act==="use-bg")await addMediaBackgroundToScene(scene,entry,{useNow:true,category:selectedImportCategory()});
        else if(act==="add-bg")await addMediaBackgroundToScene(scene,entry,{useNow:false,category:selectedImportCategory()});
        else if(act==="place-npc")await addMediaNpcToScene(scene,entry,{place:true});
        else if(act==="place-prop")await addMediaPropToScene(scene,entry);
        else if(act==="feature")await setMediaFeaturedArt(scene,entry);
      });
      render();
    },
    close:()=>{const app=document.querySelector(".totm-media-journal-dialog");if(app)void saveDialogSize("mediaJournalSize",app);}
  }));
  dlg.render(true);
}

function syncTotmRootState(scene,d=getData(scene)){
  const el=document.getElementById("totm-ui");
  if(!el)return null;
  const theme=getThemeMeta(game.settings.get(MODULE_ID,"uiTheme")||d.style||"classic");
  el.dataset.style=theme.id;
  el.classList.toggle("totm-performance-mode",!!game.settings.get(MODULE_ID,"performanceMode"));
  el.style.setProperty("--totm-target-color",getUserTargetColor());
  return el;
}

function bindPlayerPanel(el,scene,d){
  bindPlayerPanelEventsModule({el,scene,d,deps:{isGM,saveData,emit,getData,refreshUI:refreshChangedAreas,scheduleRefresh,updateTargetHighlights,targetRandomPlayer,clearActorTargets,pickActor,togglePlayerTarget,toggleActorPin,openActorPinCfg,openActorCfg,togCondDD,makeEntry,toggleActorAfkStatus,confirmDestructive}});
}

function refreshPlayerPanelOnly(scene=game.scenes.viewed,d=getData(scene)){
  const el=document.getElementById("totm-ui");
  const old=el?.querySelector("#totm-actor-panel");
  if(!el||!old||!scene||!isTOTM(scene))return false;
  const next=renderPlayerPanelParts(scene,d);
  if(old.dataset.totmPlayerRenderKey===next.renderKey)return true;
  const scrollTop=old.querySelector("#totm-actor-list")?.scrollTop||0;
  const wrap=document.createElement("div");
  wrap.innerHTML=next.html.trim();
  const panel=wrap.firstElementChild;
  if(!panel)return false;
  old.replaceWith(panel);
  const list=panel.querySelector("#totm-actor-list");
  if(list)list.scrollTop=scrollTop;
  bindPlayerPanel(el,scene,d);
  return true;
}

function bindSceneAdminToolbar(el,scene,d){
  bindSceneAdminEventsModule({el,scene,d,deps:{openMasterLibraryPicker,openMediaJournalManager,openBgPicker,openNpcPicker,openEncPicker,CLOCKS_OPEN_ref:()=>CLOCKS_OPEN,setCLOCKS_OPEN:v=>{CLOCKS_OPEN=v;},getData,refreshUI:refreshChangedAreas,scheduleRefresh,refreshClockUi,openBgCfg,clearCurrentBackgroundProps,addQuestPin,toggleGmPin,openGmPinCfg,clearEncounterState,saveData,emit,toggleBoardActorsVisibility,openBoardActorMgr,setCombatActive,openSceneBackupDialog,openGmHelpDialog,toggleMinimap,openMinimapControls,isGM}});
}

function refreshTopbarOnly(scene=game.scenes.viewed,d=getData(scene)){
  const el=document.getElementById("totm-ui");
  const old=el?.querySelector("#totm-topbar");
  if(!el||!old||!scene||!isTOTM(scene))return false;
  const wrap=document.createElement("div");
  const html=renderTopbar(d,scene);
  if(!html){old.remove();return true;}
  wrap.innerHTML=html;
  const next=wrap.firstElementChild;
  if(!next)return false;
  old.replaceWith(next);
  bindSceneAdminToolbar(el,scene,d);
  return true;
}

function refreshHotbarOnly(scene=game.scenes.viewed){
  const el=document.getElementById("totm-ui");
  const slot=el?.querySelector("#totm-hotbar-slot");
  if(!el||!slot||!scene||!isTOTM(scene))return false;
  const html=renderTotmHotbar();
  if(slot.innerHTML!==html)slot.innerHTML=html;
  bindTotmHotbarDropZone(slot);
  bindTotmHotbarUi(el,{refresh:()=>{const s=game.scenes.viewed;if(s&&isTOTM(s))refreshHotbarOnly(s)||scheduleRefresh(s);}});
  return true;
}

function refreshEnemyBarOnly(scene=game.scenes.viewed,d=getData(scene)){
  const el=document.getElementById("totm-ui");
  const layout=el?.querySelector(".totm-layout");
  if(!el||!layout||!scene||!isTOTM(scene))return false;
  const ctx=makeRenderContext(scene,d);
  const html=renderEnemyBar(d,ctx);
  const renderKey=hashString(html);
  const old=el.querySelector("#totm-enemy-wrap");
  if(!html){
    old?.remove();
    return true;
  }
  if(!old)return false;
  if(old.dataset.totmEnemyRenderKey===renderKey)return true;
  const wrap=document.createElement("div");
  wrap.innerHTML=html.trim();
  const next=wrap.firstElementChild;
  const oldTools=old.querySelector("#totm-enemy-tools"),oldBar=old.querySelector("#totm-enemy-bar");
  const nextTools=next?.querySelector("#totm-enemy-tools"),nextBar=next?.querySelector("#totm-enemy-bar");
  if(!next||!oldTools||!oldBar||!nextTools||!nextBar)return false;
  oldTools.innerHTML=nextTools.innerHTML;
  oldBar.innerHTML=nextBar.innerHTML;
  old.dataset.totmEnemyRenderKey=renderKey;
  return true;
}

function refreshClockUi(scene=game.scenes.viewed,d=getData(scene)){
  if(!scene||!isTOTM(scene))return false;
  let refreshed=false;
  refreshed=refreshTopbarOnly(scene,d)||refreshed;
  refreshed=refreshClockDockOnly(scene)||refreshed;
  return refreshed;
}

function refreshOverlayAreas(scene=game.scenes.viewed,d=getData(scene)){
  const el=syncTotmRootState(scene,d);
  if(!el?.querySelector(".totm-layout")||!scene||!isTOTM(scene))return false;
  if(!isGM()&&!d.shared)return false;
  refreshPlayerPanelOnly(scene,d);
  refreshStageArea(scene,d);
  if(!refreshEnemyBarOnly(scene,d))return false;
  refreshTopbarOnly(scene,d);
  refreshClockDockOnly(scene);
  refreshMinimapDockOnly(scene,d);
  refreshHotbarOnly(scene);
  updateTargetHighlights(scene,d);
  requestAnimationFrame(()=>warnIfBoardActorsFailedToRender(scene));
  requestAnimationFrame(()=>ensureUserPlayerProxyControlled(scene,d));
  return true;
}

function refreshChangedAreas(scene=game.scenes.viewed,d=getData(scene)){
  if(!refreshOverlayAreas(scene,d))refreshUI(scene);
  return true;
}

// -- EVENTS --
function bindEvents(scene,d){
  const el=document.getElementById("totm-ui");if(!el)return;
  const hotbarSlot=el.querySelector("#totm-hotbar-slot");
  bindTotmHotbarDropZone(hotbarSlot);
    bindTotmHotbarUi(el,{refresh:()=>{const s=game.scenes.viewed;if(s&&isTOTM(s))refreshHotbarOnly(s)||scheduleRefresh(s);}});
    bindSceneAdminToolbar(el,scene,d);
    bindClockDockEvents(el,scene);
    bindMinimapDockEvents(el,scene,d);
  bindPlayerPanel(el,scene,d);
  bindEnemyStageEventsModule({el,scene,d,deps:{isGM,setTargets,getTargets,targetRandomEnemy,targetNextEnemy,targetRandomAttackPlayer,targetRandomAttackEnemy,openAttackTargetChooser,clearAttackTargets,toggleEnemyTarget,getEncounterActor,pruneEnemyTokenDocs,saveData,getData,emit,refreshUI:refreshChangedAreas,scheduleRefresh,updateTargetHighlights,makeEnemyEntry,normalizeEnemyEntry,ensureEnemyTokenDocs,openDragPos,getQuestPinImage,addStageActor,openStageActorCfg,openStageActorLayoutPos,getBoardActorFromElement,removeStageActor,moveStageActor,moveStageActorToEdge,getSceneEntityImage,getSceneEntityLayout,toggleSceneEntityImage,SCENE_IMAGE_SWAP_MS,hasSceneEntityAltImage,confirmDestructive,esc,attr,cssUrl}});
  bindOnboardingEvents(el,scene,d);
}

function togCondDD(card,scene,d,idx){document.querySelectorAll(".totm-cond-dropdown").forEach(x=>x.remove());const conds=getConds(),ac=d.actors[idx].conditions||[];const bar=card.querySelector(".totm-actor-status-bar");if(!bar)return;const dd=document.createElement("div");dd.className="totm-cond-dropdown";dd.addEventListener("click",e=>e.stopPropagation());dd.innerHTML=conds.map(c=>`<button data-cid="${c.id}" class="${ac.includes(c.id)?"has-condition":""}"><i class="${c.icon}"></i> ${c.label}</button>`).join("");dd.addEventListener("click",async e=>{const b=e.target.closest("[data-cid]");if(!b)return;if(!d.actors[idx].conditions)d.actors[idx].conditions=[];const arr=d.actors[idx].conditions,ei=arr.indexOf(b.dataset.cid);if(ei>=0)arr.splice(ei,1);else arr.push(b.dataset.cid);await saveData(scene,d);emit();refreshChangedAreas(scene,d);});bar.appendChild(dd);}

// -- BG CONFIG (position/zoom) --
function openBgCfg(scene,d){
  new Dialog({title:"Background Position",content:`<form>
    <div class="form-group"><label>Horizontal</label><div style="display:flex;gap:6px;align-items:center;"><span style="font-size:10px;">L</span><input type="range" name="x" min="0" max="100" value="${d.bgPosX??50}" style="flex:1;"/><span style="font-size:10px;">R</span></div></div>
    <div class="form-group"><label>Vertical</label><div style="display:flex;gap:6px;align-items:center;"><span style="font-size:10px;">Top</span><input type="range" name="y" min="0" max="100" value="${d.bgPosY??50}" style="flex:1;"/><span style="font-size:10px;">Bot</span></div></div>
    <div class="form-group"><label>Zoom</label><div style="display:flex;gap:6px;align-items:center;"><span style="font-size:10px;">Fit</span><input type="range" name="z" min="100" max="300" value="${d.bgZoom??100}" step="5" style="flex:1;"/><span style="font-size:10px;">Close</span></div></div>
    <div class="form-group"><label><input type="checkbox" name="stretch" ${d.bgStretch?"checked":""}/> Stretch to fill at lower zoom</label></div>
  </form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async h=>{
    d.bgPosX=+h.find("[name=x]").val();
    d.bgPosY=+h.find("[name=y]").val();
    d.bgZoom=+h.find("[name=z]").val();
    d.bgStretch=h.find("[name=stretch]").is(":checked");
    const savedBg=(d.backgrounds||[]).find(bg=>(bg.image||bg.background)===d.background);
    if(savedBg){
      savedBg.bgPosX=d.bgPosX;
      savedBg.bgPosY=d.bgPosY;
      savedBg.bgZoom=d.bgZoom;
      savedBg.bgStretch=d.bgStretch;
    }
    await saveData(scene,d);emitStage();if(!refreshStageArea(scene,d))refreshUI(scene);
  }}},default:"save",render:h=>{
    const bg=document.getElementById("totm-bg-layer");
    const updatePreview=()=>{
      if(!bg)return;
      bg.style.backgroundPosition=`${h.find("[name=x]").val()}% ${h.find("[name=y]").val()}%`;
      bg.style.backgroundSize=getBgSizeCss(h.find("[name=z]").val(),h.find("[name=stretch]").is(":checked"));
      bg.style.backgroundRepeat="no-repeat";
    };
    if(bg)h.find("input[type=range],input[type=checkbox]").on("input change",updatePreview);
  }}).render(true);
}

// -- DROPDOWNS --
function renderBgDD(c,scene,d){normalizeBackgrounds(d);const bgs=(d.backgrounds||[]).map((b,i)=>({...b,_idx:i}));if(!bgs.length){c.innerHTML=`<div style="padding:10px;text-align:center;color:#888;font-size:11px;">No backgrounds.</div>`;return;}const gr={};bgs.forEach(b=>{const cat=b.category||"-";if(!gr[cat])gr[cat]=[];gr[cat].push(b);});c.innerHTML=Object.entries(gr).sort(([a],[b])=>a.localeCompare(b)).map(([cat,items])=>`<div class="totm-bg-category"><div class="totm-bg-cat-label">${esc(cat)}</div>${items.map(b=>`<button class="totm-bg-item ${d.background===b.image?"active":""}" data-bi="${b._idx}"><span class="totm-bg-thumb" style="${attr(`background-image:${cssUrl(b.image)}`)}"></span><span class="totm-bg-name">${esc(b.name)}</span></button>`).join("")}</div>`).join("");c.querySelectorAll(".totm-bg-item").forEach(b=>b.addEventListener("click",async()=>{const bg=d.backgrounds?.[+b.dataset.bi];if(!bg)return;setSceneBg(d,bg);await saveData(scene,d);emitStage();requestStageRefresh(scene);}));}

function renderNpcDD(c,scene,d){const npcs=d.npcs||[];if(!npcs.length){c.innerHTML=`<div style="padding:10px;text-align:center;color:#888;font-size:11px;">No NPCs.</div>`;return;}c.innerHTML=npcs.map((n,i)=>`<button class="totm-bg-item ${n.visible?"active":""}" data-i="${i}"><span class="totm-bg-thumb" style="${attr(`background-image:${cssUrl(n.image)}`)}"></span><span class="totm-bg-name">${esc(n.name)}</span><i class="fas fa-${n.visible?"eye":"eye-slash"}" style="color:${n.visible?"var(--totm-gold)":"#666"};font-size:10px;"></i></button>`).join("");c.querySelectorAll("[data-i]").forEach(b=>b.addEventListener("click",async()=>{d.npcs[+b.dataset.i].visible=!d.npcs[+b.dataset.i].visible;await saveData(scene,d);emit();scheduleRefresh(scene);}));}

function renderEncDD(c,scene,d){const encs=d.encounters||[];if(!encs.length){c.innerHTML=`<div style="padding:10px;text-align:center;color:#888;font-size:11px;">No encounters set up.</div>`;return;}c.innerHTML=encs.map((enc,i)=>`<button class="totm-bg-item" data-ei="${i}"><i class="fas fa-dragon" style="color:var(--totm-danger);"></i><span class="totm-bg-name">${esc(enc.name)} <span style="color:#888;font-size:9px;">(${enc.enemies.length})</span></span></button>`).join("");c.querySelectorAll("[data-ei]").forEach(b=>b.addEventListener("click",async()=>{const enc=encs[+b.dataset.ei];if(!enc)return;if(!d.preEncounterView)d.preEncounterView={background:d.background,bgPosX:d.bgPosX,bgPosY:d.bgPosY,bgZoom:d.bgZoom,bgStretch:d.bgStretch,narration:d.narration,featuredArt:d.featuredArt||"",featuredCaption:d.featuredCaption||""};if(enc.background)setSceneBg(d,enc,{animate:true});d.combatActive=true;d.enemies=enc.enemies.map(e=>{const a=game.actors.get(e.id);if(!a)return null;const base=makeEnemyEntry(a,{instanceId:e.instanceId||makeEnemyInstanceId(),image:e.image||a.prototypeToken?.texture?.src||a.img||"icons/svg/mystery-man.svg",description:e.description??getActorDescription(a),reveal:cloneData(e.reveal||{}),posX:e.posX??50,posY:e.posY??70,scale:e.scale??100,tokenId:e.tokenId??null,phaseEnabled:!!e.phaseEnabled,nextFormId:e.nextFormId||"",nextFormName:e.nextFormName||"",nextFormImage:e.nextFormImage||"",nextPosX:e.nextPosX??null,nextPosY:e.nextPosY??null,nextScale:e.nextScale??null,phaseUsed:false,transitionState:"",transitionAt:0,pendingPhasePrompt:false});return base;}).filter(Boolean);await ensureEnemyTokenDocs(scene,d);await pruneEnemyTokenDocs(scene,d);await setTargets(scene,[],game.user,d);await saveData(scene,d);emit();scheduleRefresh(scene);ui.notifications.info(`Encounter: ${enc.name}`);}));}

function activateEncounter(scene,d,enc){
  if(!enc)return;
  if(!d.preEncounterView)d.preEncounterView={background:d.background,bgPosX:d.bgPosX,bgPosY:d.bgPosY,bgZoom:d.bgZoom,bgStretch:d.bgStretch,narration:d.narration,featuredArt:d.featuredArt||"",featuredCaption:d.featuredCaption||""};
  if(enc.background){setSceneBg(d,enc,{animate:true});d.narration=enc.narration||"";}
  d.combatActive=true;
  d.enemies=enc.enemies.map(e=>{
    const a=game.actors.get(e.id);
    if(!a)return null;
    return makeEnemyEntry(a,{instanceId:e.instanceId||makeEnemyInstanceId(),image:e.image||a.prototypeToken?.texture?.src||a.img||"icons/svg/mystery-man.svg",description:e.description??getActorDescription(a),reveal:cloneData(e.reveal||{}),posX:e.posX??50,posY:e.posY??70,scale:e.scale??100,tokenId:e.tokenId??null,phaseEnabled:!!e.phaseEnabled,nextFormId:e.nextFormId||"",nextFormName:e.nextFormName||"",nextFormImage:e.nextFormImage||"",nextPosX:e.nextPosX??null,nextPosY:e.nextPosY??null,nextScale:e.nextScale??null,phaseUsed:false,transitionState:"",transitionAt:0,pendingPhasePrompt:false});
  }).filter(Boolean);
  return ensureEnemyTokenDocs(scene,d)
    .then(()=>pruneEnemyTokenDocs(scene,d))
    .then(()=>setTargets(scene,[],game.user,d))
    .then(()=>saveData(scene,d))
    .then(()=>{emit();refreshChangedAreas(scene,d);ui.notifications.info(`Encounter: ${enc.name}`);});
}

function getPickerTabs(items,getTabs){
  const tabsMap=new Map();
  tabsMap.set("all",{id:"all",label:"All"});
  (items||[]).forEach(item=>{
    const rawTabs=(typeof getTabs==="function"?getTabs(item):[])||[];
    const list=(Array.isArray(rawTabs)?rawTabs:[rawTabs]).map(v=>String(v||"").trim()).filter(Boolean);
    if(!list.length)list.push("Untagged");
    list.forEach(label=>{
      const id=label.toLowerCase();
      if(!tabsMap.has(id))tabsMap.set(id,{id,label});
    });
  });
  return Array.from(tabsMap.values());
}

function itemMatchesTab(item,tabId,getTabs){
  if(tabId==="all")return true;
  const rawTabs=(typeof getTabs==="function"?getTabs(item):[])||[];
  const list=(Array.isArray(rawTabs)?rawTabs:[rawTabs]).map(v=>String(v||"").trim()).filter(Boolean);
  const effective=list.length?list:["Untagged"];
  return effective.some(label=>label.toLowerCase()===tabId);
}

function canUsePopoutModule(){
  return !!(game.modules.get("popout")?.active&&typeof PopoutModule!=="undefined"&&PopoutModule?.popoutApp);
}

function makeDialogPopoutCompatible(app){
  if(!app)return app;
  try{app.options.popOut=true;}catch{}
  try{app._disable_popout_module=false;}catch{}
  return app;
}

function popoutCompatibleApp(app){
  if(!canUsePopoutModule()||!app)return;
  try{PopoutModule.popoutApp(app);}
  catch(err){
    console.warn(`${MODULE_ID} | PopOut compatibility failed`,err);
    ui.notifications.warn("Could not pop out that TOTM window.");
  }
}

async function confirmDestructive({title="Are you sure?",content="This cannot be undone.",yes="Delete"}={}){
  if(typeof Dialog?.confirm!=="function")return true;
  return !!await Dialog.confirm({
    title:esc(title),
    content:`<p>${esc(content)}</p>`,
    yes:()=>true,
    no:()=>false,
    defaultYes:false,
    buttons:{yes:{icon:'<i class="fas fa-check"></i>',label:esc(yes)},no:{icon:'<i class="fas fa-times"></i>',label:"Cancel"}}
  });
}

function getSavedDialogSize(settingKey,defaults={}){
  try{
    const saved=game.settings.get(MODULE_ID,settingKey)||{};
    return {
      width:Number.isFinite(+saved.width)?+saved.width:defaults.width,
      height:Number.isFinite(+saved.height)?+saved.height:defaults.height
    };
  }catch{return defaults;}
}

async function saveDialogSize(settingKey,app){
  if(!settingKey||!app)return;
  const width=app.offsetWidth,height=app.offsetHeight;
  if(!Number.isFinite(width)||!Number.isFinite(height))return;
  await game.settings.set(MODULE_ID,settingKey,{width,height});
}

function applyDialogSize(app,settingKey,{width=960,height=720,minWidth=680,minHeight=520}={}){
  if(!app)return;
  const saved=getSavedDialogSize(settingKey,{width,height});
  const maxWidth=Math.max(320,window.innerWidth-48);
  const maxHeight=Math.max(320,window.innerHeight-48);
  const minAppliedWidth=Math.min(minWidth,maxWidth);
  const minAppliedHeight=Math.min(minHeight,maxHeight);
  const nextWidth=Math.max(minAppliedWidth,Math.min(Number(saved.width||width)||width,maxWidth));
  const nextHeight=Math.max(minAppliedHeight,Math.min(Number(saved.height||height)||height,maxHeight));
  app.style.width=`${nextWidth}px`;
  app.style.maxWidth="calc(100vw - 48px)";
  app.style.height=`${nextHeight}px`;
  app.style.maxHeight="calc(100vh - 48px)";
  app.style.minWidth=`${minAppliedWidth}px`;
  app.style.minHeight=`${minAppliedHeight}px`;
}

function openLibraryPicker({title,placeholder="Search...",items=[],renderRow,onPick,emptyText="Nothing here yet.",getTabs=()=>[],headerActions=[],sizeSetting=""}){
  const rows=items.map((item,index)=>({item,index,search:String(item.searchText||"").toLowerCase()}));
  const tabs=getPickerTabs(items,getTabs);
  const pickerActions=[...(canUsePopoutModule()?[{label:"Pop Out",icon:"fas fa-up-right-from-square",closeOnClick:false,onClick:(_html,app)=>popoutCompatibleApp(app)}]:[]),...headerActions];
  const content=`<div class="totm-picker"><div class="totm-picker-head"><input type="text" class="totm-picker-search" placeholder="${placeholder}"/>${pickerActions.length?`<div class="totm-picker-actions">${pickerActions.map((action,idx)=>`<button type="button" class="totm-picker-action" data-picker-action="${idx}"><i class="${action.icon}"></i> ${action.label}</button>`).join("")}</div>`:""}</div><div class="totm-picker-tabs">${tabs.map((tab,idx)=>`<button type="button" class="totm-picker-tab ${idx===0?"is-active":""}" data-picker-tab="${tab.id}">${tab.label}</button>`).join("")}</div><div class="totm-picker-list">${rows.length?rows.map(({item,index})=>`<button type="button" class="totm-picker-row" data-picker-index="${index}">${renderRow(item,index)}</button>`).join(""):`<div class="totm-picker-empty">${emptyText}</div>`}</div></div>`;
  const dlg=makeDialogPopoutCompatible(new Dialog({
    title,
    content,
    buttons:{close:{icon:'<i class="fas fa-times"></i>',label:"Close"}},
    default:"close",
    width: 860,
    height: 720,
    resizable: true,
    render:html=>{
      const root=html[0];
      const app=root.closest(".app");
      if(app){
        app.classList.add("totm-picker-dialog");
        applyDialogSize(app,sizeSetting,{width:960,height:760,minWidth:680,minHeight:520});
        if(!app.querySelector(".totm-picker-resize")){
          const handle=document.createElement("div");
          handle.className="totm-picker-resize";
          handle.title="Resize";
          app.appendChild(handle);
          const doc=app.ownerDocument||document;
          const view=doc.defaultView||window;
          const body=doc.body||document.body;
          let resizing=false,startX=0,startY=0,startW=0,startH=0;
          const onMove=ev=>{
            if(!resizing)return;
            const width=Math.max(680,Math.min(view.innerWidth*0.95,startW+(ev.clientX-startX)));
            const height=Math.max(520,Math.min(view.innerHeight*0.9,startH+(ev.clientY-startY)));
            app.style.width=`${width}px`;
            app.style.height=`${height}px`;
            app.style.maxWidth="95vw";
          };
          const onUp=()=>{
            resizing=false;
            body.classList.remove("totm-picker-resizing");
            view.removeEventListener("pointermove",onMove);
            view.removeEventListener("pointerup",onUp);
            if(sizeSetting)void saveDialogSize(sizeSetting,app);
          };
          handle.addEventListener("pointerdown",ev=>{
            resizing=true;
            startX=ev.clientX;
            startY=ev.clientY;
            startW=app.offsetWidth;
            startH=app.offsetHeight;
            ev.preventDefault();
            ev.stopPropagation();
            body.classList.add("totm-picker-resizing");
            try{handle.setPointerCapture?.(ev.pointerId);}catch{}
            view.addEventListener("pointermove",onMove);
            view.addEventListener("pointerup",onUp,{once:true});
          });
        }
      }
      const search=root.querySelector(".totm-picker-search");
      const list=root.querySelector(".totm-picker-list");
      root.querySelectorAll("[data-picker-action]").forEach(btn=>btn.addEventListener("click",async()=>{
        const action=pickerActions[Number(btn.dataset.pickerAction)];
        if(!action?.onClick)return;
        await action.onClick(html,dlg);
        if(action.closeOnClick!==false)app?.querySelector?.(".header-button.close")?.click?.();
      }));
      let activeTab="all";
      const filter=()=>{
        const term=String(search?.value||"").trim().toLowerCase();
        list?.querySelectorAll?.("[data-picker-index]")?.forEach(row=>{
          const idx=Number(row.dataset.pickerIndex);
          const item=rows[idx]?.item;
          const visible=(!term||rows[idx]?.search?.includes(term))&&itemMatchesTab(item,activeTab,getTabs);
          row.style.display=visible?"":"none";
        });
      };
      search?.addEventListener("input",filter);
      root.querySelectorAll("[data-picker-tab]").forEach(btn=>btn.addEventListener("click",()=>{
        activeTab=btn.dataset.pickerTab||"all";
        root.querySelectorAll("[data-picker-tab]").forEach(x=>x.classList.toggle("is-active",x===btn));
        filter();
      }));
      list?.querySelectorAll?.("[data-picker-index]")?.forEach(row=>row.addEventListener("click",async()=>{
        const idx=Number(row.dataset.pickerIndex);
        const picked=rows[idx]?.item;
        if(!picked)return;
        await onPick?.(picked,idx);
        app?.querySelector?.(".header-button.close")?.click?.();
      }));
      filter();
      setTimeout(()=>search?.focus(),0);
    }
  }));
  dlg.render(true);
}

function openBgPicker(scene,d,options={}){
  return openBackgroundLibrary(scene,d,options);
}

function openNpcPicker(scene,d){
  (d.npcs||[]).forEach(npc=>preloadTotmImage(npc.image));
  const items=(d.npcs||[]).map((npc,index)=>({
    ...npc,
    _idx:index,
    searchText:[npc.name,npc.category,npc.tags,npc.visible?"visible":"hidden"].filter(Boolean).join(" ")
  }));
  openLibraryPicker({
    title:"NPC Roster",
    placeholder:"Search NPCs...",
    sizeSetting:"npcLibrarySize",
    items,
    emptyText:"No NPCs saved yet.",
    getTabs:npc=>[npc.category,...(Array.isArray(npc.tags)?npc.tags:String(npc.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
    headerActions:[{label:"Manage",icon:"fas fa-users-cog",onClick:()=>openNpcMgr(scene,d)}],
    renderRow:npc=>`<span class="totm-picker-card-media totm-picker-thumb" style="${attr(`background-image:${cssUrl(npc.image)}`)}"><span class="totm-picker-state">${npc.visible?"Shown":"Hidden"}</span></span><span class="totm-picker-main"><span class="totm-picker-title">${esc(npc.name)}</span><span class="totm-picker-meta">${esc(npc.category||"Untagged")}</span></span>`,
    onPick:async npc=>{
      const liveData=getData(scene);
      const live=liveData.npcs?.[npc._idx];
      if(!live)return;
      live.visible=!live.visible;
      await saveData(scene,liveData);
      emit();
      refreshChangedAreas(scene,liveData);
    }
  });
}

function openEncPicker(scene,d){
  (d.encounters||[]).forEach(enc=>{preloadTotmImage(enc.background);(enc.enemies||[]).forEach(enemy=>preloadTotmImage(enemy.image));});
  const items=(d.encounters||[]).map((enc,index)=>({
    ...enc,
    _idx:index,
    searchText:[enc.name,enc.category,enc.tags,enc.narration,`${enc.enemies?.length||0} enemies`].filter(Boolean).join(" ")
  }));
  openLibraryPicker({
    title:"Start Encounter",
    placeholder:"Search encounters...",
    sizeSetting:"encounterLibrarySize",
    items,
    emptyText:"No encounters saved yet.",
    getTabs:enc=>[enc.category,...(Array.isArray(enc.tags)?enc.tags:String(enc.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
    headerActions:[{label:"Manage",icon:"fas fa-skull-crossbones",onClick:()=>openEncMgr(scene,d)}],
    renderRow:enc=>`<span class="totm-picker-card-media totm-picker-icon danger"><i class="fas fa-dragon"></i><span class="totm-picker-state">${enc.enemies?.length||0}</span></span><span class="totm-picker-main"><span class="totm-picker-title">${esc(enc.name)}</span><span class="totm-picker-meta">${esc(enc.category||"Untagged")}${enc.background?" - custom background":""}</span></span>`,
    onPick:async enc=>{await activateEncounter(scene,getData(scene),enc);}
  });
}

function openMasterLibraryPicker(scene,d,initialSection="backgrounds",opts={}){
  const autoPopout=!!opts.autoPopout;
  const defs={
    backgrounds:{
      label:"Backgrounds",
      items:(d.backgrounds||[]).map((bg,index)=>({...bg,_idx:index,searchText:[bg.name,bg.category,bg.tags,bg.narration].filter(Boolean).join(" ")})),
      getTabs:bg=>[bg.category,...(Array.isArray(bg.tags)?bg.tags:String(bg.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
      renderRow:bg=>`<span class="totm-picker-card-media totm-picker-thumb" style="${attr(`background-image:${cssUrl(bg.image)}`)}">${d.background===bg.image?`<span class="totm-picker-state">${esc(loc("Current","Current"))}</span>`:""}</span><span class="totm-picker-main"><span class="totm-picker-title">${esc(bg.name)}</span><span class="totm-picker-meta">${esc(bg.category||"Uncategorized")}</span></span>`,
      pick:async bg=>{const live=getData(scene);setSceneBg(live,bg);live.narration=bg.narration||"";await saveData(scene,live);emitStage();if(!refreshStageArea(scene,live))refreshUI(scene);},
      manage:()=>openBgMgr(scene,d),
      placeholder:"Search backgrounds..."
    },
    npcs:{
      label:"NPCs",
      items:(d.npcs||[]).map((npc,index)=>({...npc,_idx:index,searchText:[npc.name,npc.category,npc.tags,npc.visible?"visible":"hidden"].filter(Boolean).join(" ")})),
      getTabs:npc=>[npc.category,...(Array.isArray(npc.tags)?npc.tags:String(npc.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
      renderRow:npc=>`<span class="totm-picker-card-media totm-picker-thumb" style="${attr(`background-image:${cssUrl(npc.image)}`)}"><span class="totm-picker-state">${npc.visible?"Shown":"Hidden"}</span></span><span class="totm-picker-main"><span class="totm-picker-title">${esc(npc.name)}</span><span class="totm-picker-meta">${esc(npc.category||"Untagged")}</span></span>`,
      pick:async npc=>{const liveData=getData(scene);const live=liveData.npcs?.[npc._idx];if(!live)return;live.visible=!live.visible;await saveData(scene,liveData);emit();refreshChangedAreas(scene,liveData);},
      manage:()=>openNpcMgr(scene,d),
      placeholder:"Search NPCs..."
    },
    encounters:{
      label:"Encounters",
      items:(d.encounters||[]).map((enc,index)=>({...enc,_idx:index,searchText:[enc.name,enc.category,enc.tags,enc.narration,`${enc.enemies?.length||0} enemies`].filter(Boolean).join(" ")})),
      getTabs:enc=>[enc.category,...(Array.isArray(enc.tags)?enc.tags:String(enc.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
      renderRow:enc=>`<span class="totm-picker-card-media totm-picker-icon danger"><i class="fas fa-dragon"></i><span class="totm-picker-state">${enc.enemies?.length||0}</span></span><span class="totm-picker-main"><span class="totm-picker-title">${esc(enc.name)}</span><span class="totm-picker-meta">${esc(enc.category||"Untagged")}${enc.background?" - custom background":""}</span></span>`,
      pick:async enc=>{await activateEncounter(scene,getData(scene),enc);},
      manage:()=>openEncMgr(scene,d),
      placeholder:"Search encounters..."
    }
  };
  const sections=["backgrounds","npcs","encounters"];
  const content=`<div class="totm-master-picker">${canUsePopoutModule()?`<div class="totm-picker-head totm-master-head"><div></div><div class="totm-picker-actions"><button type="button" class="totm-picker-action" data-master-popout="1"><i class="fas fa-up-right-from-square"></i> Pop Out</button></div></div>`:""}<div class="totm-master-tabs">${sections.map(id=>`<button type="button" class="totm-master-tab ${id===initialSection?"is-active":""}" data-master-section="${id}">${defs[id].label}</button>`).join("")}</div><div class="totm-master-body"></div></div>`;
  const dlg=makeDialogPopoutCompatible(new Dialog({
    title:"TOTM Library",
    content,
    buttons:{close:{icon:'<i class="fas fa-times"></i>',label:"Close"}},
    default:"close",
    width:980,
    height:760,
    render:html=>{
      const root=html[0];
      const app=root.closest(".app");
      if(app){
        app.classList.add("totm-picker-dialog");
        app.style.width="1080px";
        app.style.maxWidth="95vw";
        app.style.height="780px";
        app.style.minWidth="760px";
        app.style.minHeight="560px";
        if(!app.querySelector(".totm-picker-resize")){
          const handle=document.createElement("div");
          handle.className="totm-picker-resize";
          handle.title="Resize";
          app.appendChild(handle);
          const doc=app.ownerDocument||document;
          const view=doc.defaultView||window;
          const bodyDoc=doc.body||document.body;
          let resizing=false,startX=0,startY=0,startW=0,startH=0;
          const onMove=ev=>{
            if(!resizing)return;
            const width=Math.max(760,Math.min(view.innerWidth*0.95,startW+(ev.clientX-startX)));
            const height=Math.max(560,Math.min(view.innerHeight*0.9,startH+(ev.clientY-startY)));
            app.style.width=`${width}px`;
            app.style.height=`${height}px`;
            app.style.maxWidth="95vw";
          };
          const onUp=()=>{
            resizing=false;
            bodyDoc.classList.remove("totm-picker-resizing");
            view.removeEventListener("pointermove",onMove);
            view.removeEventListener("pointerup",onUp);
          };
          handle.addEventListener("pointerdown",ev=>{
            resizing=true;
            startX=ev.clientX;
            startY=ev.clientY;
            startW=app.offsetWidth;
            startH=app.offsetHeight;
            ev.preventDefault();
            ev.stopPropagation();
            bodyDoc.classList.add("totm-picker-resizing");
            try{handle.setPointerCapture?.(ev.pointerId);}catch{}
            view.addEventListener("pointermove",onMove);
            view.addEventListener("pointerup",onUp,{once:true});
          });
        }
      }
      root.querySelector("[data-master-popout]")?.addEventListener("click",ev=>{
        ev.preventDefault();
        ev.stopPropagation();
        openMasterLibraryPicker(scene,getData(scene),activeSection,{autoPopout:true});
      });
      let activeSection=initialSection;
      const body=root.querySelector(".totm-master-body");
      const renderSection=()=>{
        const def=defs[activeSection];
        const rows=def.items.map((item,index)=>({item,index,search:String(item.searchText||"").toLowerCase()}));
        const tabs=getPickerTabs(def.items,def.getTabs);
        body.innerHTML=`<div class="totm-picker"><div class="totm-picker-head"><input type="text" class="totm-picker-search" placeholder="${def.placeholder}"/><div class="totm-picker-actions"><button type="button" class="totm-picker-action" data-master-manage><i class="fas fa-folder-open"></i> Manage</button></div></div><div class="totm-picker-tabs">${tabs.map((tab,idx)=>`<button type="button" class="totm-picker-tab ${idx===0?"is-active":""}" data-picker-tab="${tab.id}">${tab.label}</button>`).join("")}</div><div class="totm-picker-list">${rows.length?rows.map(({item,index})=>`<button type="button" class="totm-picker-row" data-picker-index="${index}">${def.renderRow(item,index)}</button>`).join(""):`<div class="totm-picker-empty">No ${def.label.toLowerCase()} saved yet.</div>`}</div></div>`;
        let activeTab="all";
        const search=body.querySelector(".totm-picker-search");
        const list=body.querySelector(".totm-picker-list");
        const filter=()=>{
          const term=String(search?.value||"").trim().toLowerCase();
          list?.querySelectorAll?.("[data-picker-index]")?.forEach(row=>{
            const idx=Number(row.dataset.pickerIndex);
            const item=rows[idx]?.item;
            row.style.display=((!term||rows[idx]?.search?.includes(term))&&itemMatchesTab(item,activeTab,def.getTabs))?"":"none";
          });
        };
        body.querySelector("[data-master-manage]")?.addEventListener("click",()=>{app?.querySelector?.(".header-button.close")?.click?.();def.manage();});
        body.querySelectorAll("[data-picker-tab]").forEach(btn=>btn.addEventListener("click",()=>{activeTab=btn.dataset.pickerTab||"all";body.querySelectorAll("[data-picker-tab]").forEach(x=>x.classList.toggle("is-active",x===btn));filter();}));
        body.querySelectorAll("[data-picker-index]").forEach(row=>row.addEventListener("click",async()=>{const picked=rows[Number(row.dataset.pickerIndex)]?.item;if(!picked)return;await def.pick(picked);app?.querySelector?.(".header-button.close")?.click?.();}));
        search?.addEventListener("input",filter);
        filter();
      };
      root.querySelectorAll("[data-master-section]").forEach(btn=>btn.addEventListener("click",()=>{activeSection=btn.dataset.masterSection||"backgrounds";root.querySelectorAll("[data-master-section]").forEach(x=>x.classList.toggle("is-active",x===btn));renderSection();}));
      renderSection();
    }
  }));
  dlg.render(true);
  if(autoPopout&&canUsePopoutModule())setTimeout(()=>popoutCompatibleApp(dlg),0);
  return dlg;
}

// -- MANAGERS --
const normalizeTagString=value=>Array.isArray(value)?value.join(", "):String(value||"").split(",").map(t=>t.trim()).filter(Boolean).join(", ");

function normalizeBackgrounds(d){
  if(!Array.isArray(d.backgrounds))d.backgrounds=[];
  d.backgrounds=d.backgrounds.map(bg=>normalizeBackgroundEntry(bg)).filter(bg=>bg.image);
  return d.backgrounds;
}

async function renameBackground(scene,d,bg,newName){
  const name=String(newName||"").trim();
  if(!bg||!name)return false;
  bg.name=name;
  normalizeBackgrounds(d);
  await saveData(scene,d);
  emit();
  scheduleRefresh(scene);
  return true;
}

function isLikelyGeneratedBackgroundName(bg){
  const name=String(bg?.name||"").trim();
  if(!name)return true;
  if(/%[0-9a-f]{2}/i.test(name))return true;
  if(/[\\/]/.test(name))return true;
  if(/\b[a-f0-9]{8,}\b/i.test(name))return true;
  if(!name.includes(" ")&&/[_-]/.test(name))return true;
  const base=String(bg?.image||"").split("/").pop()?.replace(/\.[a-z0-9]+$/i,"")||"";
  const decoded=safeDecodeURIComponent(base).trim();
  return !!base&&(name===base||name===decoded);
}

let BACKGROUND_LIBRARY_APP=null;
let BACKGROUND_LIBRARY_SCENE_ID=null;

function isBackgroundLibraryOpen(){
  const app=BACKGROUND_LIBRARY_APP;
  if(!app)return false;
  const el=app.element?.[0]||document.querySelector(".totm-bg-library-dialog");
  return !!(app.rendered||el?.isConnected);
}

function focusBackgroundLibraryApp(){
  const app=BACKGROUND_LIBRARY_APP;
  if(!isBackgroundLibraryOpen())return false;
  try{app.bringToTop?.();}catch{}
  const el=app.element?.[0]||document.querySelector(".totm-bg-library-dialog");
  if(el){
    el.classList.add("totm-bg-library-focus");
    setTimeout(()=>el.classList.remove("totm-bg-library-focus"),350);
  }
  return true;
}

function openBgMgrLegacy(scene,d){
  normalizeBackgrounds(d).forEach(bg=>preloadTotmImage(bg.image));
  let selectedId=d.backgrounds.find(bg=>String(bg.image)===String(d.background))?.id||d.backgrounds[0]?.id||"";
  let searchTerm="";
  const content=`<div class="totm-bg-library" data-selected="${attr(selectedId)}">
    <div class="totm-bg-library-toolbar">
      <label class="totm-bg-library-search"><i class="fas fa-search"></i><input type="search" name="bgSearch" placeholder="${attr(loc("SearchBackgrounds","Search backgrounds..."))}"/></label>
      <button type="button" data-bg-toolbar="add-image"><i class="fas fa-file-image"></i> ${esc(loc("AddImage","Add Image"))}</button>
      <button type="button" data-bg-toolbar="add-scene"><i class="fas fa-image"></i> ${esc(loc("AddSceneBG","Add Scene BG"))}</button>
    </div>
    <div class="totm-bg-library-main">
      <div class="totm-bg-library-grid" data-bg-grid></div>
      <div class="totm-bg-library-details" data-bg-details></div>
    </div>
  </div>`;
  const dlg=new Dialog({
    title:loc("BackgroundLibrary","Background Library"),
    content,
    buttons:{done:{icon:'<i class="fas fa-check"></i>',label:"Done"}},
    default:"done",
    render:html=>{
      const root=html[0];
      const app=root.closest(".app");
      if(app){
        app.classList.add("totm-bg-library-dialog","totm-picker-dialog");
        applyDialogSize(app,"backgroundLibrarySize",{width:1040,height:760,minWidth:760,minHeight:560});
        if(!app.querySelector(".totm-picker-resize")){
          const handle=document.createElement("div");
          handle.className="totm-picker-resize";
          handle.title="Resize";
          app.appendChild(handle);
          const view=app.ownerDocument?.defaultView||window,body=app.ownerDocument?.body||document.body;
          let resizing=false,startX=0,startY=0,startW=0,startH=0;
          const onMove=ev=>{
            if(!resizing)return;
            app.style.width=`${Math.max(760,Math.min(view.innerWidth*0.95,startW+(ev.clientX-startX)))}px`;
            app.style.height=`${Math.max(560,Math.min(view.innerHeight*0.9,startH+(ev.clientY-startY)))}px`;
          };
          const onUp=()=>{resizing=false;body.classList.remove("totm-picker-resizing");view.removeEventListener("pointermove",onMove);view.removeEventListener("pointerup",onUp);void saveDialogSize("backgroundLibrarySize",app);};
          handle.addEventListener("pointerdown",ev=>{resizing=true;startX=ev.clientX;startY=ev.clientY;startW=app.offsetWidth;startH=app.offsetHeight;ev.preventDefault();ev.stopPropagation();body.classList.add("totm-picker-resizing");view.addEventListener("pointermove",onMove);view.addEventListener("pointerup",onUp,{once:true});});
        }
      }
      const grid=root.querySelector("[data-bg-grid]");
      const details=root.querySelector("[data-bg-details]");
      const search=root.querySelector("[name=bgSearch]");
      const findIndexById=id=>d.backgrounds.findIndex(bg=>bg.id===id);
      const selectedBg=()=>d.backgrounds[findIndexById(selectedId)]||null;
      const bgMatches=bg=>{
        if(!searchTerm)return true;
        return [bg.name,bg.category,bg.tags,bg.narration,bg.image].some(value=>String(value||"").toLowerCase().includes(searchTerm));
      };
      const bgThumbStyle=bg=>attr(`background-image:${cssUrl(bg.image)};background-position:${bg.bgPosX??50}% ${bg.bgPosY??50}%;background-size:${getBgSizeCss(bg.bgZoom??100,bg.bgStretch)};background-repeat:no-repeat`);
      const renderGrid=()=>{
        normalizeBackgrounds(d);
        d.backgrounds.forEach(bg=>preloadTotmImage(bg.image));
        const items=d.backgrounds.map((bg,index)=>({...bg,_idx:index})).filter(bgMatches);
        if(!items.length){
          grid.innerHTML=`<div class="totm-bg-library-empty">${esc(d.backgrounds.length?loc("NoBackgroundSearchResults","No backgrounds match your search."):loc("NoBackgroundsYet","No backgrounds yet."))}</div>`;
          return;
        }
        grid.innerHTML=items.map(bg=>{
          const isCurrent=String(d.background||"")===String(bg.image||"");
          const tags=normalizeTagString(bg.tags);
          return `<article class="totm-bg-card ${isCurrent?"is-current":""} ${selectedId===bg.id?"is-selected":""}" data-bg-id="${attr(bg.id)}">
            <button type="button" class="totm-bg-card-thumb" data-bg-act="select" style="${bgThumbStyle(bg)}">${isCurrent?`<span>${esc(loc("Current","Current"))}</span>`:""}</button>
            <div class="totm-bg-card-body">
              <div class="totm-bg-card-title">${esc(bg.name)}</div>
              <div class="totm-bg-card-meta">${esc(bg.category||"Uncategorized")}${tags?` - ${esc(tags)}`:""}</div>
              <div class="totm-bg-card-frame">X ${Math.round(bg.bgPosX??50)} / Y ${Math.round(bg.bgPosY??50)} / ${Math.round(bg.bgZoom??100)}%${bg.bgStretch?` - ${esc(loc("Stretch","stretch"))}`:""}</div>
            </div>
            <div class="totm-bg-card-actions">
              <button type="button" data-bg-act="use"><i class="fas fa-play"></i> ${esc(loc("UseNow","Use Now"))}</button>
              <button type="button" data-bg-act="select"><i class="fas fa-pen"></i> ${esc(loc("Edit","Edit"))}</button>
              <button type="button" data-bg-act="save-framing"><i class="fas fa-crop-simple"></i> ${esc(loc("SaveCurrentFraming","Save Current Framing"))}</button>
              <button type="button" class="is-danger" data-bg-act="delete"><i class="fas fa-trash"></i> ${esc(loc("Delete","Delete"))}</button>
            </div>
          </article>`;
        }).join("");
      };
      const updatePreview=()=>{
        const bg=selectedBg();
        const preview=details.querySelector(".totm-bg-detail-preview");
        if(!bg||!preview)return;
        preview.style.backgroundImage=cssUrl(bg.image);
        preview.style.backgroundPosition=`${details.querySelector("[name=bgPosX]")?.value||50}% ${details.querySelector("[name=bgPosY]")?.value||50}%`;
        preview.style.backgroundSize=getBgSizeCss(details.querySelector("[name=bgZoom]")?.value||100,details.querySelector("[name=bgStretch]")?.checked);
        preview.style.backgroundRepeat="no-repeat";
      };
      const renderDetails=()=>{
        const bg=selectedBg();
        root.querySelector(".totm-bg-library")?.setAttribute("data-selected",selectedId||"");
        if(!bg){
          details.innerHTML=`<div class="totm-bg-detail-empty">${esc(loc("NoBackgroundSelected","Select a background to edit it."))}</div>`;
          return;
        }
        details.innerHTML=`<form class="totm-bg-detail-form">
          <div class="totm-bg-detail-preview" style="${bgThumbStyle(bg)}"></div>
          <div class="form-group"><label>${esc(loc("Name","Name"))}</label><input name="name" value="${attr(bg.name)}"/></div>
          <div class="form-group"><label>${esc(loc("Category","Category"))}</label><input name="category" value="${attr(bg.category||"Uncategorized")}"/></div>
          <div class="form-group"><label>${esc(loc("Tags","Tags"))}</label><input name="tags" value="${attr(normalizeTagString(bg.tags))}" placeholder="town, night, danger"/></div>
          <div class="form-group"><label>${esc(loc("Narration","Narration"))}</label><textarea name="narration" rows="4">${esc(bg.narration||"")}</textarea></div>
          <div class="totm-bg-detail-ranges">
            <label>${esc(loc("HorizontalPosition","Horizontal position"))}<input type="range" name="bgPosX" min="0" max="100" value="${attr(bg.bgPosX??50)}"/></label>
            <label>${esc(loc("VerticalPosition","Vertical position"))}<input type="range" name="bgPosY" min="0" max="100" value="${attr(bg.bgPosY??50)}"/></label>
            <label>${esc(loc("Zoom","Zoom"))}<input type="range" name="bgZoom" min="100" max="300" step="5" value="${attr(bg.bgZoom??100)}"/></label>
            <label class="totm-bg-detail-check"><input type="checkbox" name="bgStretch" ${bg.bgStretch?"checked":""}/> ${esc(loc("StretchToFill","Stretch to fill"))}</label>
          </div>
          <div class="totm-bg-detail-actions">
            <button type="button" data-bg-detail="save"><i class="fas fa-save"></i> ${esc(loc("Save","Save"))}</button>
            <button type="button" data-bg-detail="use"><i class="fas fa-play"></i> ${esc(loc("UseNow","Use Now"))}</button>
            <button type="button" data-bg-detail="save-framing"><i class="fas fa-crop-simple"></i> ${esc(loc("SaveCurrentFraming","Save Current Framing"))}</button>
          </div>
        </form>`;
        details.querySelectorAll("[name=bgPosX],[name=bgPosY],[name=bgZoom],[name=bgStretch]").forEach(input=>input.addEventListener("input",updatePreview));
        details.querySelectorAll("[name=bgPosX],[name=bgPosY],[name=bgZoom],[name=bgStretch]").forEach(input=>input.addEventListener("change",updatePreview));
        updatePreview();
      };
      const rerender=()=>{renderGrid();renderDetails();};
      const saveLibrary=async({refresh=false}={})=>{
        normalizeBackgrounds(d);
        await saveData(scene,d);
        if(refresh){
          emitStage();
          requestStageRefresh(scene);
        }
      };
      const selectBg=id=>{
        selectedId=id||"";
        renderGrid();
        renderDetails();
      };
      const useBg=async bg=>{
        if(!bg)return;
        setSceneBg(d,bg);
        await saveLibrary({refresh:true});
        selectBg(bg.id);
      };
      const saveCurrentFraming=async bg=>{
        if(!bg)return;
        const live=getData(scene),cfg=bgCfg(live);
        Object.assign(bg,cfg);
        const liveBgs=normalizeBackgrounds(live);
        const liveBg=liveBgs.find(item=>item.id===bg.id||String(item.image)===String(bg.image));
        if(liveBg)Object.assign(liveBg,cfg);
        live.backgrounds=liveBgs;
        Object.assign(d,live);
        await saveData(scene,live);
        emit();
        ui.notifications.info(loc("FramingSaved","Current framing saved."));
        rerender();
      };
      const saveDetails=async()=>{
        const bg=selectedBg();
        if(!bg)return;
        bg.name=String(details.querySelector("[name=name]")?.value||bg.name||"Background").trim()||"Background";
        bg.category=String(details.querySelector("[name=category]")?.value||"Uncategorized").trim()||"Uncategorized";
        bg.tags=normalizeTagString(details.querySelector("[name=tags]")?.value||"");
        bg.narration=String(details.querySelector("[name=narration]")?.value||"").trim();
        bg.bgPosX=Number(details.querySelector("[name=bgPosX]")?.value||50);
        bg.bgPosY=Number(details.querySelector("[name=bgPosY]")?.value||50);
        bg.bgZoom=Number(details.querySelector("[name=bgZoom]")?.value||100);
        bg.bgStretch=!!details.querySelector("[name=bgStretch]")?.checked;
        if(String(d.background||"")===String(bg.image||""))setSceneBg(d,bg,{animate:false});
        await saveLibrary({refresh:String(d.background||"")===String(bg.image||"")});
        ui.notifications.info(loc("BackgroundSaved","Background saved."));
        rerender();
      };
      const deleteBg=async bg=>{
        if(!bg)return;
        const isCurrent=String(d.background||"")===String(bg.image||"");
        const ok=await confirmDestructive({title:loc("DeleteBackground","Delete Background?"),content:`${bg.name||"Background"} will be removed from this scene library.${isCurrent?` ${loc("CurrentBackgroundWarning","This is the current background.")}`:""}`,yes:loc("Delete","Delete")});
        if(!ok)return;
        const idx=findIndexById(bg.id);
        if(idx>=0)d.backgrounds.splice(idx,1);
        if(isCurrent){d.background="";d.narration="";d.bgFadeAt=Date.now();}
        selectedId=d.backgrounds[Math.max(0,Math.min(idx,d.backgrounds.length-1))]?.id||"";
        await saveLibrary({refresh:isCurrent});
        rerender();
      };
      const addBgFromPath=async(path,source={},applyNow=true)=>{
        path=String(path||"").trim();
        if(!path)return null;
        const bg=makeBgFromPath(path,source);
        d.backgrounds.push(bg);
        selectedId=bg.id;
        preloadTotmImage(bg.image);
        if(applyNow)setSceneBg(d,bg);
        await saveLibrary({refresh:applyNow});
        rerender();
        return bg;
      };
      root.querySelector("[data-bg-toolbar='add-image']")?.addEventListener("click",()=>new FilePicker({type:"image",callback:path=>{void addBgFromPath(path,{},true);}}).browse());
      root.querySelector("[data-bg-toolbar='add-scene']")?.addEventListener("click",async()=>{
        const path=String(scene.background?.src||"").trim();
        if(!path){ui.notifications.warn(loc("NoSceneBackground","This Foundry scene does not have a background image."));return;}
        const existing=d.backgrounds.find(bg=>String(bg.image)===path);
        if(existing){ui.notifications.info(loc("SceneBackgroundExists","That scene background is already in the library."));selectBg(existing.id);return;}
        const live=getData(scene);
        await addBgFromPath(path,{name:scene.name||"Scene",category:"Scene",...bgCfg(live),narration:live.narration||""},true);
      });
      grid.addEventListener("click",async event=>{
        const card=event.target.closest(".totm-bg-card");
        if(!card)return;
        const bg=d.backgrounds.find(item=>item.id===card.dataset.bgId);
        const act=event.target.closest("[data-bg-act]")?.dataset.bgAct||"select";
        if(act==="use")await useBg(bg);
        else if(act==="save-framing")await saveCurrentFraming(bg);
        else if(act==="delete")await deleteBg(bg);
        else selectBg(bg?.id);
      });
      details.addEventListener("click",async event=>{
        const act=event.target.closest("[data-bg-detail]")?.dataset.bgDetail;
        const bg=selectedBg();
        if(act==="save")await saveDetails();
        else if(act==="use"){await saveDetails();await useBg(selectedBg()||bg);}
        else if(act==="save-framing")await saveCurrentFraming(bg);
      });
      search?.addEventListener("input",()=>{searchTerm=String(search.value||"").trim().toLowerCase();renderGrid();});
      root.addEventListener("dragover",event=>{event.preventDefault();root.classList.add("totm-drag-over");});
      root.addEventListener("dragleave",()=>root.classList.remove("totm-drag-over"));
      root.addEventListener("drop",event=>{
        event.preventDefault();
        root.classList.remove("totm-drag-over");
        const raw=String(event.dataTransfer?.getData("text/plain")||event.dataTransfer?.getData("text/uri-list")||"").trim();
        let path=raw;
        try{const parsed=JSON.parse(raw);path=parsed.img||parsed.image||parsed.src||parsed.path||raw;}catch{}
        if(path)void addBgFromPath(path,{},true);
      });
      rerender();
      setTimeout(()=>search?.focus(),0);
    },
    close:()=>{const app=document.querySelector(".totm-bg-library-dialog");if(app)void saveDialogSize("backgroundLibrarySize",app);}
  });
  dlg.render(true);
  return dlg;
}

function openBackgroundLibrary(scene,d,options={}){
  if(isBackgroundLibraryOpen()){
    if(BACKGROUND_LIBRARY_SCENE_ID===scene?.id){
      if(options.autoPopout)popoutCompatibleApp(BACKGROUND_LIBRARY_APP);
      focusBackgroundLibraryApp();
      return BACKGROUND_LIBRARY_APP;
    }
    try{BACKGROUND_LIBRARY_APP.close();}catch{}
  }
  normalizeBackgrounds(d).forEach(bg=>preloadTotmImage(bg.image));
  let term="",activeCat="all",selectedId=d.backgrounds.find(bg=>String(bg.image)===String(d.background))?.id||"";
  let categoryDocClick=null;
  let categoryDoc=null;
  const content=`<div class="totm-bg-window totm-bg-library-window">
    <div class="totm-bg-header">
      <div class="totm-bg-toolbar">
        <label class="totm-bg-search"><i class="fas fa-search"></i><input type="search" name="bgSearch" placeholder="${attr(loc("SearchBackgrounds","Search backgrounds..."))}"/></label>
        <div class="totm-bg-filter" data-bg-filter>
          <button type="button" class="totm-bg-filter-btn" data-bg-filter-toggle>
            <i class="fas fa-folder-open"></i>
            <span data-bg-filter-label>${esc(loc("Categories","Categories"))}: All</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="totm-bg-filter-menu" data-bg-filter-menu hidden></div>
        </div>
        <div class="totm-bg-actions">
          <button type="button" class="totm-bg-action primary" data-bg-toolbar="add-image" title="${attr(loc("AddImage","Add Image"))}"><i class="fas fa-plus"></i><span>${esc(loc("AddImage","Add Image"))}</span></button>
          <button type="button" class="totm-bg-action" data-bg-toolbar="add-scene" title="${attr(loc("AddSceneBG","Add Scene BG"))}"><i class="fas fa-image"></i><span>${esc(loc("AddSceneBG","Add Scene BG"))}</span></button>
          <button type="button" class="totm-bg-action subtle" data-bg-toolbar="clean-names" title="${attr(loc("CleanNames","Clean generated names"))}"><i class="fas fa-magic"></i><span>${esc(loc("CleanNames","Clean Names"))}</span></button>
          ${canUsePopoutModule()?`<button type="button" class="totm-bg-action icon-only" data-bg-toolbar="popout" title="${attr(loc("PopOut","Pop Out"))}" aria-label="${attr(loc("PopOut","Pop Out"))}"><i class="fas fa-up-right-from-square"></i></button>`:""}
        </div>
      </div>
    </div>
    <div class="totm-bg-grid totm-bg-library-grid" data-bg-grid></div>
  </div>`;
  const dlg=makeDialogPopoutCompatible(new Dialog({
    title:loc("BackgroundLibrary","Background Library"),
    content,
    buttons:{},
    resizable:true,
    render:html=>{
      const root=html[0],app=root.closest(".app");
      if(app){
        app.classList.add("totm-bg-library-dialog");
        applyDialogSize(app,"backgroundLibrarySize",{width:1100,height:760,minWidth:720,minHeight:520});
        if(!app.querySelector(".totm-picker-resize")){
          const handle=document.createElement("div");
          handle.className="totm-picker-resize";
          handle.title="Resize";
          app.appendChild(handle);
          const doc=app.ownerDocument||document;
          const view=doc.defaultView||window;
          const body=doc.body||document.body;
          let resizing=false,startX=0,startY=0,startW=0,startH=0;
          const onMove=ev=>{
            if(!resizing)return;
            const width=Math.max(720,Math.min(view.innerWidth-48,startW+(ev.clientX-startX)));
            const height=Math.max(520,Math.min(view.innerHeight-48,startH+(ev.clientY-startY)));
            app.style.width=`${width}px`;
            app.style.height=`${height}px`;
          };
          const onUp=()=>{
            resizing=false;
            body.classList.remove("totm-picker-resizing");
            view.removeEventListener("pointermove",onMove);
            view.removeEventListener("pointerup",onUp);
            void saveDialogSize("backgroundLibrarySize",app);
          };
          handle.addEventListener("pointerdown",ev=>{
            resizing=true;
            startX=ev.clientX;
            startY=ev.clientY;
            startW=app.offsetWidth;
            startH=app.offsetHeight;
            ev.preventDefault();
            ev.stopPropagation();
            body.classList.add("totm-picker-resizing");
            try{handle.setPointerCapture?.(ev.pointerId);}catch{}
            view.addEventListener("pointermove",onMove);
            view.addEventListener("pointerup",onUp,{once:true});
          });
        }
      }
      const grid=root.querySelector("[data-bg-grid]");
      const search=root.querySelector("[name=bgSearch]");
      const filter=root.querySelector("[data-bg-filter]");
      const filterBtn=root.querySelector("[data-bg-filter-toggle]");
      const filterLabel=root.querySelector("[data-bg-filter-label]");
      const filterMenu=root.querySelector("[data-bg-filter-menu]");
      const currentPath=()=>String(d.background||"");
      const getItems=()=>normalizeBackgrounds(d).map((bg,index)=>({bg,index,displayName:displayBackgroundName(bg)}));
      const categoryName=bg=>String(bg?.category||"").trim()||"Uncategorized";
      const categoryKey=value=>String(value||"").trim().toLowerCase();
      const getCategories=items=>["all",...Array.from(new Set(items.map(item=>categoryName(item.bg)))).sort((a,b)=>a.localeCompare(b))];
      const categoryDisplay=cat=>cat==="all"?"All":cat;
      const setCategoryMenuOpen=open=>{
        if(!filterMenu||!filterBtn)return;
        filterMenu.hidden=!open;
        filterBtn.classList.toggle("is-open",!!open);
      };
      const bgById=id=>normalizeBackgrounds(d).find(bg=>bg.id===id);
      const matches=item=>{
        const bg=item.bg;
        if(activeCat!=="all"&&categoryKey(categoryName(bg))!==categoryKey(activeCat))return false;
        if(!term)return true;
        return [bg.name,item.displayName,bg.category,bg.tags,bg.narration].some(value=>String(value||"").toLowerCase().includes(term));
      };
      const thumbStyle=bg=>attr(`background-image:${cssUrl(bg.image)};background-position:center;background-size:cover;background-repeat:no-repeat`);
      const render=()=>{
        const items=getItems();
        const categories=getCategories(items);
        if(!categories.some(cat=>categoryKey(cat)===categoryKey(activeCat)))activeCat="all";
        const activeCategory=categories.find(cat=>categoryKey(cat)===categoryKey(activeCat))||"all";
        if(filterLabel)filterLabel.textContent=`${loc("Categories","Categories")}: ${categoryDisplay(activeCategory)}`;
        if(filterMenu){
          filterMenu.innerHTML=categories.map(cat=>{
            const active=categoryKey(cat)===categoryKey(activeCat);
            return `<button type="button" class="${active?"is-active":""}" data-bg-cat="${attr(cat)}"><span>${esc(categoryDisplay(cat))}</span>${active?`<i class="fas fa-check"></i>`:""}</button>`;
          }).join("");
        }
        const shown=items.filter(matches);
        grid.innerHTML=shown.length?shown.map(({bg,displayName})=>{
          const current=currentPath()===String(bg.image||"");
          const frame=`X ${Math.round(bg.bgPosX??50)} / Y ${Math.round(bg.bgPosY??50)} / ${Math.round(bg.bgZoom??100)}%${bg.bgStretch?" / stretch":""}`;
          return `<article class="totm-bg-card totm-bg-library-card ${current?"is-current":""} ${selectedId===bg.id?"is-selected":""}" data-bg-id="${attr(bg.id)}" title="${attr(displayName)}">
            <button type="button" class="totm-bg-card-thumb" data-bg-act="use" style="${thumbStyle(bg)}">${current?`<span>${esc(loc("Current","Current"))}</span>`:""}</button>
            <div class="totm-bg-card-body">
              <div class="totm-bg-card-title" data-bg-title title="${attr(displayName)}"><span class="totm-bg-card-title-text">${esc(displayName)}</span><button type="button" class="totm-bg-title-rename" data-bg-act="rename" title="${attr(loc("Rename","Rename"))}"><i class="fas fa-pen"></i></button></div>
              <div class="totm-bg-card-meta">${esc(bg.category||"Uncategorized")}</div>
              <div class="totm-bg-card-frame">${esc(frame)}</div>
              <label class="totm-bg-fill-toggle" title="${attr(loc("FillToScene","Fill to Scene"))}" data-bg-act="toggle-fill">
                <input type="checkbox" ${bg.bgStretch?"checked":""} aria-label="${attr(loc("FillToScene","Fill to Scene"))}"/>
                <span>${esc(loc("Fill","Fill"))}</span>
              </label>
            </div>
            <div class="totm-bg-card-actions">
              <button type="button" data-bg-act="use" title="${attr(loc("UseNow","Use Now"))}"><i class="fas fa-play"></i><span>${esc(loc("UseNow","Use Now"))}</span></button>
              <button type="button" data-bg-act="edit" title="${attr(loc("Edit","Edit"))}"><i class="fas fa-sliders-h"></i><span>${esc(loc("Edit","Edit"))}</span></button>
              <button type="button" data-bg-act="save-framing" title="${attr(loc("SaveFramingTitle","Save current stage framing to this background"))}"><i class="fas fa-crop-simple"></i><span>${esc(loc("SaveFraming","Save Framing"))}</span></button>
              <button type="button" data-bg-act="rename-file" title="${attr(loc("RenameFromFile","Rename from File"))}"><i class="fas fa-file-alt"></i><span>${esc(loc("RenameFromFile","Rename from File"))}</span></button>
              <button type="button" class="is-danger" data-bg-act="delete" title="${attr(loc("Delete","Delete"))}"><i class="fas fa-trash"></i><span>${esc(loc("Delete","Delete"))}</span></button>
            </div>
          </article>`;
        }).join(""):`<div class="totm-bg-empty">${esc(items.length?loc("NoBackgroundSearchResults","No backgrounds match your search."):loc("NoBackgroundsYet","No backgrounds yet."))}</div>`;
      };
      const findCard=bg=>Array.from(grid.querySelectorAll("[data-bg-id]")).find(card=>card.dataset.bgId===bg?.id);
      const focusCard=bg=>setTimeout(()=>findCard(bg)?.scrollIntoView({block:"nearest"}),0);
      const startInlineRename=(card,bg)=>{
        if(!card||!bg)return;
        selectedId=bg.id;
        const title=card.querySelector("[data-bg-title]");
        if(!title)return;
        const oldName=String(bg.name||displayBackgroundName(bg)||"Background").trim()||"Background";
        title.innerHTML=`<input type="text" class="totm-bg-rename-input" value="${attr(oldName)}" aria-label="${attr(loc("Rename","Rename"))}"/>`;
        const input=title.querySelector("input");
        let cancelled=false,saved=false;
        const finish=async()=>{
          if(cancelled||saved)return;
          saved=true;
          const next=String(input.value||"").trim()||oldName||"Background";
          await renameBackground(scene,d,bg,next);
          render();
          focusCard(bg);
        };
        input.addEventListener("click",event=>event.stopPropagation());
        input.addEventListener("dblclick",event=>event.stopPropagation());
        input.addEventListener("keydown",event=>{
          event.stopPropagation();
          if(event.key==="Escape"){
            cancelled=true;
            render();
            focusCard(bg);
            return;
          }
          if(event.key==="Enter"){
            event.preventDefault();
            input.blur();
          }
        });
        input.addEventListener("blur",()=>{void finish();});
        setTimeout(()=>{input.focus();input.select();},0);
      };
      const revealBg=(bg,{rename=false}={})=>{
        if(!bg)return;
        selectedId=bg.id;
        term="";
        activeCat="all";
        if(search)search.value="";
        render();
        setTimeout(()=>{
          const card=findCard(bg);
          card?.scrollIntoView({block:"nearest"});
          if(rename)startInlineRename(card,bg);
        },0);
      };
      const saveLibrary=async({refresh=false}={})=>{
        normalizeBackgrounds(d);
        await saveData(scene,d);
        if(refresh){
          emitStage();
          requestStageRefresh(scene);
        }
      };
      const applyBg=async bg=>{
        if(!bg)return;
        selectedId=bg.id;
        setSceneBg(d,bg);
        await saveLibrary({refresh:true});
        render();
      };
      const setBackgroundFill=async(bg,checked)=>{
        if(!bg)return;
        selectedId=bg.id;
        bg.bgStretch=!!checked;
        const isCurrent=currentPath()===String(bg.image||"");
        if(isCurrent)d.bgStretch=!!checked;
        await saveLibrary({refresh:isCurrent});
        render();
        focusCard(bg);
      };
      const saveFraming=async bg=>{
        if(!bg)return;
        const live=getData(scene),cfg=bgCfg(live);
        Object.assign(bg,cfg);
        const liveBg=normalizeBackgrounds(live).find(item=>item.id===bg.id||String(item.image)===String(bg.image));
        if(liveBg)Object.assign(liveBg,cfg);
        live.backgrounds=normalizeBackgrounds(live);
        Object.assign(d,live);
        await saveData(scene,live);
        emit();
        ui.notifications.info(loc("FramingSaved","Current framing saved."));
        render();
      };
      const deleteBg=async bg=>{
        if(!bg)return;
        const isCurrent=currentPath()===String(bg.image||"");
        const ok=await confirmDestructive({title:loc("DeleteBackground","Delete Background?"),content:`${displayBackgroundName(bg)} will be removed from this scene library.${isCurrent?` ${loc("CurrentBackgroundWarning","This is the current background.")}`:""}`,yes:loc("Delete","Delete")});
        if(!ok)return;
        const idx=d.backgrounds.findIndex(item=>item.id===bg.id);
        if(idx>=0)d.backgrounds.splice(idx,1);
        if(isCurrent){d.background="";d.narration="";d.bgFadeAt=Date.now();}
        selectedId=d.backgrounds[Math.max(0,Math.min(idx,d.backgrounds.length-1))]?.id||"";
        await saveLibrary({refresh:isCurrent});
        render();
      };
      const editBg=bg=>{
        if(!bg)return;
        openBgEditDialog(scene,d,bg,async()=>{await saveLibrary({refresh:currentPath()===String(bg.image||"")});render();});
      };
      const renameFromFile=async bg=>{
        if(!bg)return;
        await renameBackground(scene,d,bg,cleanBackgroundNameFromPath(bg.image));
        render();
        focusCard(bg);
      };
      const cleanGeneratedNames=async()=>{
        let changed=0;
        normalizeBackgrounds(d).forEach(bg=>{
          const next=cleanBackgroundNameFromPath(bg.image);
          if(isLikelyGeneratedBackgroundName(bg)&&next&&next!==bg.name){bg.name=next;changed++;}
        });
        if(!changed){ui.notifications.info(loc("NoBackgroundNamesCleaned","No generated background names needed cleaning."));return;}
        await saveLibrary({refresh:true});
        ui.notifications.info(`${changed} ${loc("BackgroundNamesCleaned","background names cleaned.")}`);
        render();
      };
      const addBgFromPath=async(path,source={},opts={})=>{
        path=String(path||"").trim();
        if(!path)return null;
        const bg=makeBgFromPath(path,source);
        d.backgrounds.push(bg);
        selectedId=bg.id;
        preloadTotmImage(bg.image);
        setSceneBg(d,bg);
        await saveLibrary({refresh:true});
        revealBg(bg,{rename:!!opts.rename});
        return bg;
      };
      root.querySelector(".totm-bg-header")?.addEventListener("click",event=>{
        if(!event.target.closest("[data-bg-filter]"))setCategoryMenuOpen(false);
        event.stopPropagation();
      });
      filterBtn?.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
        setCategoryMenuOpen(filterMenu?.hidden);
      });
      filterMenu?.addEventListener("click",event=>{
        const btn=event.target.closest("[data-bg-cat]");
        if(!btn)return;
        event.preventDefault();
        event.stopPropagation();
        activeCat=btn.dataset.bgCat||"all";
        setCategoryMenuOpen(false);
        render();
      });
      categoryDocClick=event=>{
        if(!filter?.contains(event.target))setCategoryMenuOpen(false);
      };
      categoryDoc=root.ownerDocument||document;
      categoryDoc.addEventListener("click",categoryDocClick);
      root.querySelector("[data-bg-toolbar='add-image']")?.addEventListener("click",event=>{event.stopPropagation();new FilePicker({type:"image",callback:path=>{void addBgFromPath(path,{}, {rename:true});}}).browse();});
      root.querySelector("[data-bg-toolbar='add-scene']")?.addEventListener("click",async()=>{
        const path=String(scene.background?.src||"").trim();
        if(!path){ui.notifications.warn(loc("NoSceneBackground","This Foundry scene does not have a background image."));return;}
        const existing=d.backgrounds.find(bg=>String(bg.image)===path);
        if(existing){ui.notifications.info(loc("SceneBackgroundExists","That scene background is already in the library."));revealBg(existing);return;}
        const live=getData(scene);
        await addBgFromPath(path,{name:scene.name||cleanBackgroundNameFromPath(path),category:"Scene",...bgCfg(live),narration:live.narration||""});
      });
      root.querySelector("[data-bg-toolbar='clean-names']")?.addEventListener("click",event=>{event.stopPropagation();void cleanGeneratedNames();});
      root.querySelector("[data-bg-toolbar='popout']")?.addEventListener("click",event=>{event.stopPropagation();popoutCompatibleApp(dlg);});
      search.addEventListener("click",event=>event.stopPropagation());
      search.addEventListener("input",()=>{term=String(search.value||"").trim().toLowerCase();render();});
      grid.addEventListener("change",event=>{
        const input=event.target.closest(".totm-bg-fill-toggle input");
        if(!input)return;
        event.stopPropagation();
        const card=input.closest("[data-bg-id]");
        void setBackgroundFill(bgById(card?.dataset.bgId),input.checked);
      });
      grid.addEventListener("dblclick",event=>{
        const card=event.target.closest("[data-bg-id]");
        if(!card||!event.target.closest(".totm-bg-card-title,.totm-bg-card-title-text"))return;
        event.preventDefault();
        event.stopPropagation();
        startInlineRename(card,bgById(card.dataset.bgId));
      });
      grid.addEventListener("click",async event=>{
        const card=event.target.closest("[data-bg-id]");
        if(!card)return;
        const bg=bgById(card.dataset.bgId);
        const control=event.target.closest("[data-bg-act]");
        const act=control?.dataset.bgAct||"use";
        if(control){
          event.stopPropagation();
          if(act!=="toggle-fill")event.preventDefault();
        }
        selectedId=bg?.id||"";
        if(act==="use")await applyBg(bg);
        else if(act==="toggle-fill")return;
        else if(act==="rename")startInlineRename(card,bg);
        else if(act==="edit")editBg(bg);
        else if(act==="save-framing")await saveFraming(bg);
        else if(act==="rename-file")await renameFromFile(bg);
        else if(act==="delete")await deleteBg(bg);
        else await applyBg(bg);
      });
      render();
      setTimeout(()=>search.focus(),0);
    },
    close:()=>{
      const app=document.querySelector(".totm-bg-library-dialog");
      if(app)void saveDialogSize("backgroundLibrarySize",app);
      if(categoryDocClick)(categoryDoc||document).removeEventListener("click",categoryDocClick);
      categoryDocClick=null;
      categoryDoc=null;
      if(BACKGROUND_LIBRARY_APP===dlg){BACKGROUND_LIBRARY_APP=null;BACKGROUND_LIBRARY_SCENE_ID=null;}
    }
  }));
  BACKGROUND_LIBRARY_APP=dlg;
  BACKGROUND_LIBRARY_SCENE_ID=scene?.id||null;
  dlg.render(true);
  if(options.autoPopout&&canUsePopoutModule())setTimeout(()=>popoutCompatibleApp(dlg),0);
  return dlg;
}

function openBgMgr(scene,d,options={}){
  return openBackgroundLibrary(scene,d,options);
}

function openBgEditDialog(scene,d,bg,onSaved){
  const updatePreview=(root)=>{
    const preview=root.querySelector(".totm-bg-editor-preview");
    if(!preview)return;
    preview.style.backgroundImage=cssUrl(bg.image);
    preview.style.backgroundPosition=`${root.querySelector("[name=bgPosX]")?.value||50}% ${root.querySelector("[name=bgPosY]")?.value||50}%`;
    preview.style.backgroundSize=getBgSizeCss(root.querySelector("[name=bgZoom]")?.value||100,root.querySelector("[name=bgStretch]")?.checked);
    preview.style.backgroundRepeat="no-repeat";
  };
  const content=`<form class="totm-bg-editor-modal">
    <div class="totm-bg-editor-preview" style="${attr(`background-image:${cssUrl(bg.image)};background-position:${bg.bgPosX??50}% ${bg.bgPosY??50}%;background-size:${getBgSizeCss(bg.bgZoom??100,bg.bgStretch)};background-repeat:no-repeat`)}"></div>
    <div class="form-group"><label>${esc(loc("Name","Name"))}</label><input name="name" value="${attr(displayBackgroundName(bg))}"/></div>
    <div class="form-group"><label>${esc(loc("Category","Category"))}</label><input name="category" value="${attr(bg.category||"Uncategorized")}"/></div>
    <div class="form-group"><label>${esc(loc("Tags","Tags"))}</label><input name="tags" value="${attr(normalizeTagString(bg.tags))}" placeholder="town, night, danger"/></div>
    <div class="form-group"><label>${esc(loc("Narration","Narration"))}</label><textarea name="narration" rows="3">${esc(bg.narration||"")}</textarea></div>
    <details class="totm-bg-editor-framing" open><summary>${esc(loc("Framing","Framing"))}</summary>
      <label>${esc(loc("HorizontalPosition","Horizontal position"))}<input type="range" name="bgPosX" min="0" max="100" value="${attr(bg.bgPosX??50)}"/></label>
      <label>${esc(loc("VerticalPosition","Vertical position"))}<input type="range" name="bgPosY" min="0" max="100" value="${attr(bg.bgPosY??50)}"/></label>
      <label>${esc(loc("Zoom","Zoom"))}<input type="range" name="bgZoom" min="100" max="300" step="5" value="${attr(bg.bgZoom??100)}"/></label>
      <label class="totm-bg-editor-check"><input type="checkbox" name="bgStretch" ${bg.bgStretch?"checked":""}/> ${esc(loc("StretchToFill","Stretch to fill"))}</label>
    </details>
  </form>`;
  new Dialog({
    title:`${loc("Edit","Edit")}: ${displayBackgroundName(bg)}`,
    content,
    buttons:{
      save:{icon:'<i class="fas fa-save"></i>',label:loc("Save","Save"),callback:async html=>{
        bg.name=String(html.find("[name=name]").val()||displayBackgroundName(bg)||"Background").trim()||"Background";
        bg.category=String(html.find("[name=category]").val()||"Uncategorized").trim()||"Uncategorized";
        bg.tags=normalizeTagString(html.find("[name=tags]").val());
        bg.narration=String(html.find("[name=narration]").val()||"").trim();
        bg.bgPosX=Number(html.find("[name=bgPosX]").val()||50);
        bg.bgPosY=Number(html.find("[name=bgPosY]").val()||50);
        bg.bgZoom=Number(html.find("[name=bgZoom]").val()||100);
        bg.bgStretch=html.find("[name=bgStretch]").is(":checked");
        if(String(d.background||"")===String(bg.image||""))setSceneBg(d,bg,{animate:false});
        await onSaved?.();
        ui.notifications.info(loc("BackgroundSaved","Background saved."));
      }},
      cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel"}
    },
    default:"save",
    render:html=>{
      const app=html[0].closest(".app");
      if(app)applyDialogSize(app,"",{width:560,height:680,minWidth:420,minHeight:500});
      const root=html[0];
      root.querySelectorAll("[name=bgPosX],[name=bgPosY],[name=bgZoom],[name=bgStretch]").forEach(input=>input.addEventListener("input",()=>updatePreview(root)));
      root.querySelectorAll("[name=bgPosX],[name=bgPosY],[name=bgZoom],[name=bgStretch]").forEach(input=>input.addEventListener("change",()=>updatePreview(root)));
      updatePreview(root);
    }
  }).render(true);
}

function openBoardActorMgr(scene,d=getData(scene)){
  if(!isGM()||!scene||!isTOTM(scene))return;
  repairBoardActorsData(d);
  const content=`<div class="totm-board-mgr">
    <div class="totm-board-mgr-toolbar">
      <button type="button" data-board-act="reveal"><i class="fas fa-eye"></i> Reveal All</button>
      <button type="button" data-board-act="repair"><i class="fas fa-wrench"></i> Repair</button>
      <button type="button" class="is-danger" data-board-act="clear"><i class="fas fa-trash"></i> Clear All Board Characters</button>
    </div>
    <div class="totm-board-mgr-list" data-board-list></div>
  </div>`;
  new Dialog({
    title:"Board Characters",
    content,
    buttons:{close:{icon:'<i class="fas fa-times"></i>',label:"Close"}},
    default:"close",
    render:html=>{
      const root=html[0],list=root.querySelector("[data-board-list]");
      const saveBoard=async({notify="",refresh=true}={})=>{
        d=getData(scene);
        repairBoardActorsData(d,{forceVisible:true});
        cacheSceneData(scene,d);
        await saveData(scene,d);
        emit();
        if(refresh)refreshChangedAreas(scene,d);
        if(notify)ui.notifications.info(notify);
      };
      const render=()=>{
        d=getData(scene);
        repairBoardActorsData(d);
        const rows=d.boardActors||[];
        list.innerHTML=rows.length?rows.map((entry,idx)=>{
          const actor=game.actors.get(entry.actorId);
          const layout=getStageActorLayout(entry,{inCombat:false});
          const img=getStageActorImage(entry,d,{inCombat:false});
          return `<div class="totm-board-mgr-row" data-board-idx="${idx}" data-board-id="${attr(entry.id)}">
            <img src="${attr(img)}" alt="${attr(entry.name||actor?.name||"Character")}"/>
            <div class="totm-board-mgr-main">
              <div class="totm-board-mgr-name">${esc(entry.name||actor?.name||"Character")}</div>
              <div class="totm-board-mgr-meta">X ${Math.round(layout.posX)} / Y ${Math.round(layout.posY)} / ${Math.round(layout.scale)}%</div>
            </div>
            <div class="totm-board-mgr-actions">
              <button type="button" data-board-act="move"><i class="fas fa-arrows-up-down-left-right"></i> Move</button>
              <button type="button" data-board-act="front"><i class="fas fa-layer-group"></i> Bring To Front</button>
              <button type="button" data-board-act="repair-one"><i class="fas fa-wrench"></i> Repair</button>
              <button type="button" class="is-danger" data-board-act="remove"><i class="fas fa-trash"></i> Remove</button>
            </div>
          </div>`;
        }).join(""):`<div class="totm-board-mgr-empty">No board characters placed.</div>`;
      };
      root.addEventListener("click",async event=>{
        const act=event.target.closest("[data-board-act]")?.dataset.boardAct;
        if(!act)return;
        event.preventDefault();
        event.stopPropagation();
        const row=event.target.closest("[data-board-idx]");
        const idx=row?Number(row.dataset.boardIdx):-1;
        const entry=idx>=0?d.boardActors?.[idx]:null;
        if(act==="reveal"){
          d.boardActorsVisible=true;
          await saveBoard({notify:"Revealed TOTM board character placements."});
          render();
        }else if(act==="repair"){
          await repairBoardActorsForScene(scene,{notify:true});
          d=getData(scene);
          render();
        }else if(act==="clear"){
          const ok=await confirmDestructive({title:"Clear All Board Characters?",content:"This clears all TOTM board character placements. Player cards and props are not removed.",yes:"Clear"});
          if(!ok)return;
          await clearBoardActors(scene,{notify:true});
          d=getData(scene);
          render();
        }else if(act==="move"&&entry){
          d.boardActorsVisible=true;
          await saveBoard({refresh:true});
          openStageActorLayoutPos(scene,d,entry,{combat:false});
          render();
        }else if(act==="front"&&entry){
          await moveStageActorToEdge(scene,d,idx,"front");
          d=getData(scene);
          render();
        }else if(act==="repair-one"&&entry){
          repairBoardActorsData(d,{forceVisible:true});
          await saveBoard({notify:"Repaired TOTM board character placement."});
          render();
        }else if(act==="remove"&&entry){
          await removeStageActor(scene,d,entry.id);
          d=getData(scene);
          render();
        }
      });
      render();
    }
  }).render(true);
}

function openNpcMgr(scene,d){if(!d.npcs)d.npcs=[];new Dialog({title:"NPC Setup",content:`<div style="max-height:400px;overflow-y:auto;"><div id="ml"></div></div><hr style="border-color:#444;margin:8px 0;"><button type="button" id="ma" style="width:100%;padding:6px;cursor:pointer;"><i class="fas fa-plus"></i> Add NPC</button>`,buttons:{done:{icon:'<i class="fas fa-check"></i>',label:"Done",callback:async()=>{await saveData(scene,d);emit();scheduleRefresh(scene);}}},default:"done",render:h=>{function openNpcDetails(existing,p,onSave){const name=existing?.name||p.split("/").pop().replace(/\.\w+$/,"");new Dialog({title:"NPC Details",content:`<form><div class="form-group"><label>Name</label><input name="n" value="${attr(name)}"/></div><div class="form-group"><label>Category</label><input name="c" value="${attr(existing?.category||"")}" placeholder="Shopkeeper"/></div><div class="form-group"><label>Tags</label><input name="tags" value="${attr(normalizeTagString(existing?.tags))}" placeholder="town, healer, ally"/></div><div class="form-group"><label><input type="checkbox" name="visible" ${existing?.visible?"checked":""}/> Visible on stage</label></div></form>`,buttons:{ok:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:h2=>onSave({...existing,name:h2.find("[name=n]").val().trim()||name,image:p,category:h2.find("[name=c]").val().trim(),tags:normalizeTagString(h2.find("[name=tags]").val()),visible:h2.find("[name=visible]").is(":checked")})}},default:"ok"}).render(true);}
    const removeNpcByRef=npc=>{const idx=d.npcs.indexOf(npc);if(idx>=0)d.npcs.splice(idx,1);};
    function r(){h.find("#ml").html(d.npcs.map((n,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:4px;margin-bottom:3px;"><div style="${attr(`width:40px;height:40px;border-radius:4px;background:${cssUrl(n.image)} center/cover;flex-shrink:0;`)}"></div><div style="flex:1;"><div style="font-size:11px;font-weight:600;">${esc(n.name)}</div><div style="font-size:9px;color:#888;">${esc(n.category||"Untagged")}${n.tags?` - ${esc(normalizeTagString(n.tags))}`:""}</div></div><button type="button" data-meta="${i}" style="background:none;border:none;color:#aaa;cursor:pointer;"><i class="fas fa-pen"></i></button><button type="button" data-pos="${i}" style="background:none;border:none;color:#aaa;cursor:pointer;"><i class="fas fa-arrows-alt"></i></button><button type="button" data-d="${i}" style="background:none;border:none;color:#a05050;cursor:pointer;"><i class="fas fa-trash"></i></button></div>`).join("")||'<div style="padding:12px;text-align:center;color:#888;">No NPCs</div>');h.find("[data-d]").on("click",async function(){const i=+this.dataset.d;const ok=await confirmDestructive({title:"Delete NPC?",content:`${d.npcs[i]?.name||"NPC"} will be removed.`,yes:"Delete"});if(!ok)return;d.npcs.splice(i,1);await saveData(scene,d);emit();scheduleRefresh(scene);r();});h.find("[data-pos]").on("click",function(){const npc=d.npcs[+this.dataset.pos];if(!npc)return;openDragPos(npc,scene,d,async()=>{await saveData(scene,d);emit();scheduleRefresh(scene);r();},async()=>{const ok=await confirmDestructive({title:"Delete NPC?",content:`${npc.name||"NPC"} will be removed.`,yes:"Delete"});if(!ok)return;removeNpcByRef(npc);await saveData(scene,d);emit();scheduleRefresh(scene);r();});});h.find("[data-meta]").on("click",function(){const i=+this.dataset.meta;const npc=d.npcs[i];openNpcDetails(npc,npc.image,async upd=>{d.npcs[i]={...npc,...upd};await saveData(scene,d);emit();scheduleRefresh(scene);r();});});}
    r();h.find("#ma").on("click",()=>{new FilePicker({type:"image",callback:p=>{const baseName=p.split("/").pop().replace(/\.\w+$/,"");const npc={name:baseName,image:p,posX:50,posY:50,scale:100,visible:false,category:"",tags:""};openNpcDetails(npc,p,upd=>{d.npcs.push(upd);r();setTimeout(()=>openDragPos(upd,scene,d,async()=>{upd.visible=true;await saveData(scene,d);emit();refreshChangedAreas(scene,d);r();},async()=>{removeNpcByRef(upd);await saveData(scene,d);emit();refreshChangedAreas(scene,d);r();}),300);});}}).browse();});}}).render(true);}
function openStageActorCfg(scene,d,idx){
  repairBoardActorsData(d,{forceVisible:true});
  const entry=d.boardActors?.[idx];
  if(!entry)return;
  const actor=game.actors.get(entry.actorId);
  const defaultImg=getStageActorDefaultImage(actor);
  const playerEntry=d.actors?.find?.(a=>a.id===entry.actorId);
  const fallbackCombat=playerEntry?.combatImg||"";
  const sceneLayout=getStageActorLayout(entry,{inCombat:false});
  const combatLayout=getStageActorLayout(entry,{inCombat:true});
  new Dialog({
    title:`Board Character - ${entry.name||actor?.name||"Character"}`,
    content:`<form>
      <div class="form-group"><label>Name</label><input name="name" value="${foundry.utils.escapeHTML(String(entry.name||actor?.name||"Character"))}"/></div>
      <div class="form-group"><label>Default Image</label><div style="display:flex;gap:6px;align-items:center;"><input type="text" name="image" value="${foundry.utils.escapeHTML(String(entry.image||""))}" placeholder="${foundry.utils.escapeHTML(defaultImg)}" style="flex:1;"/><button type="button" name="browseImage"><i class="fas fa-folder-open"></i></button><button type="button" name="clearImage"><i class="fas fa-eraser"></i></button></div></div>
      <div class="form-group"><label>Combat Image</label><div style="display:flex;gap:6px;align-items:center;"><input type="text" name="combatImage" value="${foundry.utils.escapeHTML(String(entry.combatImage||""))}" placeholder="${foundry.utils.escapeHTML(fallbackCombat||"Uses player combat portrait if set")}" style="flex:1;"/><button type="button" name="browseCombat"><i class="fas fa-folder-open"></i></button><button type="button" name="clearCombat"><i class="fas fa-eraser"></i></button></div></div>
      <p style="margin:4px 0 0;color:#888;font-size:11px;">Combat image swaps in automatically whenever an encounter is active on this TOTM scene.</p>
      <div class="form-group"><label>Scene Layout</label><div style="font-size:11px;color:#aaa;">X ${Math.round(sceneLayout.posX)} / Y ${Math.round(sceneLayout.posY)} / Zoom ${Math.round(sceneLayout.scale)}%</div></div>
      <div class="form-group"><label>Combat Layout</label><div style="font-size:11px;color:#aaa;">X ${Math.round(combatLayout.posX)} / Y ${Math.round(combatLayout.posY)} / Zoom ${Math.round(combatLayout.scale)}%</div></div>
      <div class="form-group"><label>Layer Order</label><div style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" name="sendBack"><i class="fas fa-backward-step"></i> To Back</button><button type="button" name="backward"><i class="fas fa-chevron-left"></i> Back</button><button type="button" name="forward">Front <i class="fas fa-chevron-right"></i></button><button type="button" name="bringFront">To Front <i class="fas fa-forward-step"></i></button></div></div>
      <div class="form-group"><label>Placement</label><div style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" name="reposition"><i class="fas fa-arrows-up-down-left-right"></i> Move Scene</button><button type="button" name="repositionCombat"><i class="fas fa-shield-halved"></i> Move Combat</button><button type="button" name="remove" style="color:var(--totm-danger);border-color:var(--totm-danger);"><i class="fas fa-trash"></i> Remove</button></div></div>
    </form>`,
    buttons:{
      save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async html=>{
        entry.name=String(html.find("[name=name]").val()||actor?.name||entry.name||"Character").trim()||"Character";
        entry.image=String(html.find("[name=image]").val()||"").trim()||defaultImg;
        entry.combatImage=String(html.find("[name=combatImage]").val()||"").trim();
        await saveData(scene,d);
        emit();
        refreshChangedAreas(scene,d);
      }}
    },
    default:"save",
    render:html=>{
      const browse=(field)=>new FilePicker({type:"image",callback:path=>html.find(`[name=${field}]`).val(path)}).browse();
      html.find("[name=browseImage]").on("click",()=>browse("image"));
      html.find("[name=browseCombat]").on("click",()=>browse("combatImage"));
      html.find("[name=clearImage]").on("click",()=>html.find("[name=image]").val(""));
      html.find("[name=clearCombat]").on("click",()=>html.find("[name=combatImage]").val(""));
      html.find("[name=reposition]").on("click",()=>{
        html.closest(".app")?.find?.(".header-button.close")?.trigger?.("click");
        openStageActorLayoutPos(scene,d,entry,{combat:false});
      });
      html.find("[name=repositionCombat]").on("click",()=>{
        html.closest(".app")?.find?.(".header-button.close")?.trigger?.("click");
        openStageActorLayoutPos(scene,d,entry,{combat:true});
      });
      html.find("[name=remove]").on("click",async()=>{
        html.closest(".app")?.find?.(".header-button.close")?.trigger?.("click");
        await removeStageActor(scene,d,entry.id);
      });
      html.find("[name=forward]").on("click",async()=>{await moveStageActor(scene,d,idx,1);html.closest(".app")?.find?.(".header-button.close")?.trigger?.("click");});
      html.find("[name=backward]").on("click",async()=>{await moveStageActor(scene,d,idx,-1);html.closest(".app")?.find?.(".header-button.close")?.trigger?.("click");});
      html.find("[name=bringFront]").on("click",async()=>{await moveStageActorToEdge(scene,d,idx,"front");html.closest(".app")?.find?.(".header-button.close")?.trigger?.("click");});
      html.find("[name=sendBack]").on("click",async()=>{await moveStageActorToEdge(scene,d,idx,"back");html.closest(".app")?.find?.(".header-button.close")?.trigger?.("click");});
    }
  }).render(true);
}

// -- DRAG POSITION EDITOR --
let activeDragOverlayCleanup=null,activeDragOverlayCommit=null;
async function closeActiveDragOverlay({save=false}={}){
  if(save&&typeof activeDragOverlayCommit==="function"){await activeDragOverlayCommit();return;}
  if(typeof activeDragOverlayCleanup==="function")activeDragOverlayCleanup();
}
function openDragPos(entity,scene,d,onDone,onDelete){
  const main=document.getElementById("totm-stage-wrap")||document.getElementById("totm-stage");if(!main)return false;
  const hiddenSourceEls=[];
  if(entity?.id)main.querySelectorAll(`.totm-scene-prop[data-prop-id="${entity.id}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
  if(entity?.kind==="board-actor"&&entity?.id)main.querySelectorAll(`.totm-stage-actor[data-board-actor-id="${entity.id}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
  if(entity?.kind==="quest"&&entity?.id)main.querySelectorAll(`.totm-scene-quest[data-quest-id="${entity.id}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
  if(!entity?.kind&&!entity?.instanceId&&entity?.image)main.querySelectorAll(`.totm-scene-npc`).forEach(node=>{const idx=+node.dataset.nidx;const npc=d.npcs?.[idx];if(npc===entity){node.classList.add("is-being-positioned");hiddenSourceEls.push(node);}});
  const targetId=enemyTargetId(entity);
  if(targetId)main.querySelectorAll(`.totm-scene-enemy[data-target-id="${targetId}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
  const dragKind=entity?.kind==="prop"?"prop":(entity?.kind==="board-actor"?"board-actor":(entity?.kind==="quest"?"quest":(entity?.instanceId?"enemy":"npc")));
  const canSetAltImage=dragKind!=="quest"&&dragKind!=="board-actor";
  const ghost=document.createElement("div");ghost.className=`totm-drag-entity is-${dragKind}`;ghost.tabIndex=0;
  const getDragLayout=()=>canSetAltImage?getSceneEntityLayout(entity):{posX:entity.posX??50,posY:entity.posY??50,scale:entity.scale??100};
  const getDragImage=()=>canSetAltImage?getSceneEntityImage(entity):(entity.image||getStageActorImage(entity,d,{inCombat:!!d.combatActive}));
  const hasAlt=()=>canSetAltImage&&hasSceneEntityAltImage(entity);
  ghost.innerHTML=`<div class="totm-drag-visual"><img src="${getDragImage()}"/>
    <div class="totm-drag-controls">
      ${canSetAltImage?`<button type="button" class="totm-drag-tool totm-drag-swap ${hasAlt()?"is-configured":""}" title="Swap image" ${hasAlt()?"":"disabled"}><i class="fas fa-repeat"></i></button>
      <button type="button" class="totm-drag-tool totm-drag-alt-image ${hasAlt()?"is-configured":""}" title="${hasAlt()?"Change alternate image":"Set alternate image"}"><i class="fas fa-paint-brush"></i></button>`:""}
      ${typeof onDelete==="function"?`<button type="button" class="totm-drag-tool totm-drag-delete" title="Delete"><i class="fas fa-trash"></i></button>`:""}
    </div>
  </div>`;
  const setGhostScale=scale=>{
    const visualScale=Math.max(MIN_STAGE_ENTITY_SCALE,Math.min(MAX_STAGE_ENTITY_SCALE,Number(scale)||100))/100;
    ghost.style.setProperty("--totm-drag-scale",`${visualScale}`);
    ghost.style.setProperty("--totm-drag-control-scale",`${1/visualScale}`);
  };
  ghost.style.left=`${getDragLayout().posX}%`;ghost.style.top=`${getDragLayout().posY}%`;ghost.style.transform=`translate(-50%,-50%)`;setGhostScale(getDragLayout().scale);
  main.appendChild(ghost);
  const dragImgEl=ghost.querySelector(".totm-drag-visual img");
  const swapBtn=ghost.querySelector(".totm-drag-swap");
  const altBtn=ghost.querySelector(".totm-drag-alt-image");
  const refreshGhostArt=()=>{
    if(dragImgEl)dragImgEl.src=getDragImage();
    if(swapBtn){
      swapBtn.classList.toggle("is-configured",hasAlt());
      swapBtn.disabled=!hasAlt();
    }
    if(altBtn){
      altBtn.classList.toggle("is-configured",hasAlt());
      altBtn.title=hasAlt()?"Change alternate image":"Set alternate image";
    }
  };
  if(canSetAltImage&&swapBtn&&altBtn){
    swapBtn.addEventListener("click",e=>{
      e.preventDefault();
      e.stopPropagation();
      if(!toggleSceneEntityImage(entity))return;
      refreshGhostArt();
    });
    altBtn.addEventListener("click",e=>{
      e.preventDefault();
      e.stopPropagation();
      new FilePicker({type:"image",callback:path=>{
        const nextImage=String(path||"").trim();
        if(!nextImage)return;
        new Dialog({
          title:"Alternate Image",
          content:`<form><div class="form-group"><label><input type="checkbox" name="allowReposition" ${entity.altAllowReposition?"checked":""}/> Allow separate position and scale for the alternate image</label></div><p class="notes" style="margin:6px 0 0;color:#888;font-size:11px;">Leave this off to keep the alt image aligned to the current placement automatically.</p></form>`,
          buttons:{
            save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async html=>{
              entity.altImage=nextImage;
              await syncSceneEntityAltLayout(entity,{image:nextImage,allowReposition:html.find("[name=allowReposition]").is(":checked")});
              refreshGhostArt();
            }}
          },
          default:"save"
        }).render(true);
      }}).browse();
    });
  }
  try{ghost.focus({preventScroll:true});}catch{}

  let dragging=false,startX,startY,startLeft,startTop,closed=false;
  ghost.addEventListener("mousedown",e=>{if(e.target.closest(".totm-drag-tool"))return;dragging=true;startX=e.clientX;startY=e.clientY;const r=main.getBoundingClientRect();const layout=getDragLayout();startLeft=layout.posX/100*r.width;startTop=layout.posY/100*r.height;e.preventDefault();});
  document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);

  function onMove(e){if(!dragging)return;const r=main.getBoundingClientRect();const nx=startLeft+(e.clientX-startX),ny=startTop+(e.clientY-startY);const posX=Math.max(0,Math.min(100,(nx/r.width)*100)),posY=Math.max(0,Math.min(100,(ny/r.height)*100));if(canSetAltImage)setSceneEntityLayout(entity,{posX,posY});else{entity.posX=posX;entity.posY=posY;}ghost.style.left=`${posX}%`;ghost.style.top=`${posY}%`;}
  function onUp(){dragging=false;}

  ghost.addEventListener("wheel",e=>{e.preventDefault();const layout=getDragLayout();const scale=Math.max(MIN_STAGE_ENTITY_SCALE,Math.min(MAX_STAGE_ENTITY_SCALE,(layout.scale||100)+(e.deltaY<0?5:-5)));if(canSetAltImage)setSceneEntityLayout(entity,{scale});else entity.scale=scale;setGhostScale(scale);});

  // Done button overlay
  const doneBtn=document.createElement("button");doneBtn.textContent="Done";doneBtn.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:200;padding:8px 24px;font-size:14px;font-weight:700;background:var(--totm-gold);color:#000;border:none;border-radius:6px;cursor:pointer;";
  document.body.appendChild(doneBtn);
  const cleanup=()=>{if(closed)return;closed=true;document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);ghost.remove();doneBtn.remove();hiddenSourceEls.forEach(node=>node.classList.remove("is-being-positioned"));if(activeDragOverlayCleanup===cleanupWithKeys)activeDragOverlayCleanup=null;if(activeDragOverlayCommit===commitWithSave)activeDragOverlayCommit=null;};
  const onKeyDown=async e=>{
    if(closed||typeof onDelete!=="function")return;
    if(e.key!=="Delete"&&e.key!=="Backspace")return;
    e.preventDefault();
    cleanupWithKeys();
    await onDelete();
  };
  if(typeof onDelete==="function")document.addEventListener("keydown",onKeyDown);
  const originalCleanup=cleanup;
  const cleanupWithKeys=()=>{document.removeEventListener("keydown",onKeyDown);originalCleanup();};
  const commitWithSave=async()=>{if(closed)return;cleanupWithKeys();if(onDone)await onDone();};
  activeDragOverlayCleanup=cleanupWithKeys;
  activeDragOverlayCommit=commitWithSave;
  ghost.querySelector(".totm-drag-delete")?.addEventListener("click",async e=>{e.preventDefault();e.stopPropagation();cleanupWithKeys();await onDelete?.();});
  doneBtn.onclick=null;
  doneBtn.addEventListener("click",()=>{void commitWithSave();});
  return true;
}

function openMultiDragPos(entities,scene,d,onDone){
  const main=document.getElementById("totm-stage-wrap")||document.getElementById("totm-stage");if(!main||!entities?.length)return;
  const cleanups=[];
  entities.forEach((entity,idx)=>{
    const hiddenSourceEls=[];
    if(entity?.id)main.querySelectorAll(`.totm-scene-prop[data-prop-id="${entity.id}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
    if(entity?.kind==="board-actor"&&entity?.id)main.querySelectorAll(`.totm-stage-actor[data-board-actor-id="${entity.id}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
    const targetId=enemyTargetId(entity);
    if(targetId)main.querySelectorAll(`.totm-scene-enemy[data-target-id="${targetId}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
    const dragKind=entity?.kind==="prop"?"prop":(entity?.kind==="board-actor"?"board-actor":(entity?.kind==="quest"?"quest":(entity?.instanceId?"enemy":"npc")));
    const ghost=document.createElement("div");ghost.className=`totm-drag-entity is-${dragKind}`;
  ghost.innerHTML=`<img src="${entity.image||getStageActorImage(entity,d,{inCombat:!!d.combatActive})}"/><div class="totm-drag-label">${entity.name||entity.label||"Entity"} - drag to position, scroll to resize${entity?.kind==="prop"?" | Del to delete":""}</div>`;
    ghost.style.left=`${entity.posX??50}%`;ghost.style.top=`${entity.posY??50}%`;ghost.style.transform=`translate(-50%,-50%) scale(${(entity.scale??100)/100})`;ghost.style.zIndex=String(100+idx);
    main.appendChild(ghost);
    let dragging=false,startX,startY,startLeft,startTop;
    const onMove=e=>{if(!dragging)return;const r=main.getBoundingClientRect();const nx=startLeft+(e.clientX-startX),ny=startTop+(e.clientY-startY);entity.posX=Math.max(0,Math.min(100,(nx/r.width)*100));entity.posY=Math.max(0,Math.min(100,(ny/r.height)*100));ghost.style.left=`${entity.posX}%`;ghost.style.top=`${entity.posY}%`;};
    const onUp=()=>{dragging=false;ghost.classList.remove("active-drag");};
    ghost.addEventListener("mousedown",e=>{dragging=true;startX=e.clientX;startY=e.clientY;const r=main.getBoundingClientRect();startLeft=(entity.posX??50)/100*r.width;startTop=(entity.posY??50)/100*r.height;ghost.classList.add("active-drag");e.preventDefault();});
    document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);
    ghost.addEventListener("wheel",e=>{e.preventDefault();entity.scale=(entity.scale||100)+(e.deltaY<0?5:-5);entity.scale=Math.max(MIN_STAGE_ENTITY_SCALE,Math.min(MAX_STAGE_ENTITY_SCALE,entity.scale));ghost.style.transform=`translate(-50%,-50%) scale(${entity.scale/100})`;});
    cleanups.push(()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);ghost.remove();hiddenSourceEls.forEach(node=>node.classList.remove("is-being-positioned"));});
  });
  const doneBtn=document.createElement("button");doneBtn.textContent="Done";doneBtn.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:200;padding:8px 24px;font-size:14px;font-weight:700;background:var(--totm-gold);color:#000;border:none;border-radius:6px;cursor:pointer;";
  document.body.appendChild(doneBtn);
  doneBtn.addEventListener("click",()=>{cleanups.forEach(fn=>fn());doneBtn.remove();if(onDone)onDone();});
}

// -- ENCOUNTER MANAGER --
function openEncMgr(scene,d){
  if(!d.encounters)d.encounters=[];
  new Dialog({title:"Encounter Setup",content:`<div style="max-height:400px;overflow-y:auto;"><div id="ml"></div></div><hr style="border-color:#444;margin:8px 0;"><button type="button" id="ma" style="width:100%;padding:6px;cursor:pointer;"><i class="fas fa-plus"></i> New Encounter</button>`,buttons:{done:{icon:'<i class="fas fa-check"></i>',label:"Done",callback:async()=>{await saveData(scene,d);emit();scheduleRefresh(scene);}}},default:"done",render:h=>{
    function r(){h.find("#ml").html(d.encounters.map((e,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:4px;margin-bottom:3px;"><i class="fas fa-dragon" style="color:var(--totm-danger);font-size:16px;width:24px;text-align:center;"></i><div style="flex:1;"><div style="font-size:11px;font-weight:600;">${esc(e.name)}</div><div style="font-size:9px;color:#888;">${esc(e.category||"Untagged")} - ${e.enemies.length} enemies${e.tags?` - ${esc(normalizeTagString(e.tags))}`:""}</div></div><button type="button" data-e="${i}" style="background:none;border:none;color:#aaa;cursor:pointer;"><i class="fas fa-pen"></i></button><button type="button" data-d="${i}" style="background:none;border:none;color:#a05050;cursor:pointer;"><i class="fas fa-trash"></i></button></div>`).join("")||'<div style="padding:12px;text-align:center;color:#888;">No encounters</div>');h.find("[data-d]").on("click",async function(){const i=+this.dataset.d;const ok=await confirmDestructive({title:"Delete Encounter?",content:`${d.encounters[i]?.name||"Encounter"} will be removed from the library.`,yes:"Delete"});if(!ok)return;d.encounters.splice(i,1);await saveData(scene,d);emit();scheduleRefresh(scene);r();});h.find("[data-e]").on("click",function(){openEncEditor(scene,d,()=>r(),d.encounters[+this.dataset.e],+this.dataset.e);});}r();
    h.find("#ma").on("click",()=>{openEncEditor(scene,d,()=>r());});
  }}).render(true);
}

function buildEncounterEnemyRosterHtml(enemies,actors,villainFight=false){
  const actorOptions=actors.map(a=>`<option value="${a.id}">${a.name}</option>`).join("");
  if(!enemies.length)return `<div style="padding:10px;text-align:center;color:#888;font-size:11px;border:1px dashed rgba(255,255,255,.12);border-radius:6px;">Drag enemy actors here from the Actors sidebar. Drop the same actor multiple times for duplicates.</div>`;
  enemies.forEach(normalizeEnemyEntry);
  return `<div class="totm-enc-enemy-list">${enemies.map((enemy,i)=>`<div class="totm-enc-enemy-row" data-eeidx="${i}">
    <img src="${attr(enemy.image)}" class="totm-enc-enemy-thumb"/>
    <div class="totm-enc-enemy-main">
      <div class="totm-enc-enemy-name">${esc(enemy.name)}</div>
      <div class="totm-enc-enemy-meta">${esc(enemy.id)}${villainFight?` - ${enemy.phaseEnabled?"villain form set":"normal enemy"}`:""}</div>
      <textarea class="totm-enc-enemy-description" data-enc-act="description" data-eeidx="${i}" placeholder="Description revealed separately">${esc(enemy.description||"")}</textarea>
      ${villainFight?`<div class="totm-enc-villain-controls">
        <label class="totm-enc-villain-toggle"><input type="checkbox" data-enc-act="villain" data-eeidx="${i}" ${enemy.phaseEnabled?"checked":""}/> Villain</label>
        <select data-enc-act="next-form" data-eeidx="${i}" class="totm-enc-next-form" ${enemy.phaseEnabled?"":"disabled"}>
          <option value="">Next form...</option>${actorOptions.replace(`value="${enemy.nextFormId||""}"`,`value="${enemy.nextFormId||""}" selected`)}
        </select>
      </div>`:""}
    </div>
    <div class="totm-enc-enemy-actions">
      <button type="button" data-enc-act="dup" data-eeidx="${i}" style="padding:2px 7px;cursor:pointer;"><i class="fas fa-copy"></i></button>
      <button type="button" data-enc-act="del" data-eeidx="${i}" style="padding:2px 7px;color:#c66;cursor:pointer;"><i class="fas fa-trash"></i></button>
    </div>
  </div>`).join("")}</div>`;
}

function bindEncounterPreview(html){
  const preview=html[0]?.querySelector(".totm-enc-preview");
  if(!preview)return;
  const update=()=>{
    const bg=String(html.find("[name=bg]").val()||"").trim();
    const bgx=Number(html.find("[name=bgx]").val()||50);
    const bgy=Number(html.find("[name=bgy]").val()||50);
    const bgz=Number(html.find("[name=bgz]").val()||100);
    const stretch=html.find("[name=bgstretch]").is(":checked");
    preview.style.backgroundImage=bg?`url('${bg.replace(/'/g,"\\'")}')`:"none";
    preview.style.backgroundPosition=`${bgx}% ${bgy}%`;
    preview.style.backgroundSize=getBgSizeCss(bgz,stretch);
    preview.classList.toggle("is-empty",!bg);
  };
  html.find("[name=bg],[name=bgx],[name=bgy],[name=bgz],[name=bgstretch]").on("input change",update);
  update();
}

function bindEncounterEnemyDrop(html,enemies,actors){
  const roster=html.find("#totm-enc-enemy-roster");
  const isVillainFight=()=>html.find("[name=villainFight]").is(":checked");
  const renderRoster=()=>{
    roster.html(buildEncounterEnemyRosterHtml(enemies,actors,isVillainFight()));
    roster.find("[data-enc-act='del']").on("click",function(){
      enemies.splice(Number(this.dataset.eeidx),1);
      renderRoster();
    });
    roster.find("[data-enc-act='dup']").on("click",function(){
      const src=enemies[Number(this.dataset.eeidx)];
      if(!src)return;
      enemies.push(foundry.utils.deepClone({...src,instanceId:makeEnemyInstanceId(),tokenId:null,posX:30+Math.random()*40,posY:55+Math.random()*20,scale:100,transitionState:"",transitionAt:0,pendingPhasePrompt:false,phaseUsed:false}));
      renderRoster();
    });
    roster.find("[data-enc-act='description']").on("input",function(){
      const enemy=enemies[Number(this.dataset.eeidx)];
      if(enemy)enemy.description=String(this.value||"");
    });
    roster.find("[data-enc-act='villain']").on("change",function(){
      const enemy=enemies[Number(this.dataset.eeidx)];
      if(!enemy)return;
      enemy.phaseEnabled=!!this.checked;
      if(!enemy.phaseEnabled){enemy.nextFormId="";enemy.nextFormName="";enemy.nextFormImage="";enemy.nextPosX=null;enemy.nextPosY=null;enemy.nextScale=null;}
      renderRoster();
    });
    roster.find("[data-enc-act='next-form']").on("change",function(){
      const enemy=enemies[Number(this.dataset.eeidx)],actor=actors.find(a=>a.id===this.value);
      if(!enemy)return;
      enemy.nextFormId=actor?.id||"";
      enemy.nextFormName=actor?.name||"";
      enemy.nextFormImage=actor?.prototypeToken?.texture?.src||actor?.img||"";
    });
  };
  const addActor=actor=>{
    if(!actor||actor.type==="character")return;
    enemies.push(makeEnemyEntry(actor));
    renderRoster();
  };
  roster.on("dragover",ev=>{
    ev.preventDefault();
    ev.originalEvent?.dataTransfer && (ev.originalEvent.dataTransfer.dropEffect="copy");
    roster.addClass("totm-drag-over");
  });
  roster.on("dragleave",()=>roster.removeClass("totm-drag-over"));
  roster.on("drop",async ev=>{
    ev.preventDefault();
    roster.removeClass("totm-drag-over");
    let data;
    try{
      data=JSON.parse(ev.originalEvent?.dataTransfer?.getData("text/plain")||"{}");
    }catch{
      return;
    }
    if(data.type!=="Actor")return;
    const actor=await fromUuid(data.uuid);
    addActor(actor);
  });
  html.find("[name=villainFight]").on("change",renderRoster);
  renderRoster();
}

function openEncEditor(scene,d,onDone,existing=null,existingIndex=-1){
  const curBg=existing?.background?d.backgrounds?.find(b=>b.image===existing.background):d.backgrounds?.find(b=>b.image===d.background);
  const startCfg=bgCfg(existing||curBg||d);
  const draftEnemies=(existing?.enemies||[]).map(enemy=>foundry.utils.deepClone({...enemy,instanceId:enemy.instanceId||makeEnemyInstanceId(),tokenId:null}));
  const actors=game.actors.contents.filter(a=>a.type!=="character");
  new Dialog({title:"New Encounter",content:`<form>
    <div class="form-group"><label>Name</label><input name="name" placeholder="Goblin Ambush" value="${existing?.name||""}"/></div>
    <div class="form-group"><label>Category</label><input name="category" placeholder="Boss, Ambush, Chapter 2" value="${existing?.category||""}"/></div>
    <div class="form-group"><label>Tags</label><input name="tags" placeholder="sewer, undead, intro" value="${normalizeTagString(existing?.tags)}"/></div>
    <div class="form-group"><label><input type="checkbox" name="villainFight" ${existing?.villainFight?"checked":""}/> Villain Fight</label><div style="font-size:10px;color:#888;">Villain enemies can change to a configured next form at 0 HP instead of fading out immediately.</div></div>
    <div class="form-group"><label>Background (optional)</label><div style="display:flex;gap:4px;"><input name="bg" style="flex:1;" value="${existing?.background||curBg?.image||d.background||""}"/><button type="button" id="enc-bp" style="padding:0 8px;"><i class="fas fa-file-image"></i></button></div></div>
    <div class="totm-enc-preview-wrap" style="margin:8px 0 10px;">
      <div class="totm-enc-preview is-empty" style="height:150px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background-color:rgba(0,0,0,.25);background-repeat:no-repeat;background-position:${startCfg.bgPosX}% ${startCfg.bgPosY}%;background-size:${getBgSizeCss(startCfg.bgZoom,startCfg.bgStretch)};position:relative;overflow:hidden;"></div>
      <div style="font-size:10px;color:#888;margin-top:4px;">Live preview of the encounter background framing.</div>
    </div>
    <div class="form-group"><label>Background Horizontal</label><input type="range" name="bgx" min="0" max="100" value="${startCfg.bgPosX}"/></div>
    <div class="form-group"><label>Background Vertical</label><input type="range" name="bgy" min="0" max="100" value="${startCfg.bgPosY}"/></div>
    <div class="form-group"><label>Background Zoom</label><input type="range" name="bgz" min="100" max="300" step="5" value="${startCfg.bgZoom}"/></div>
    <div class="form-group"><label><input type="checkbox" name="bgstretch" ${startCfg.bgStretch?"checked":""}/> Stretch to fill at lower zoom</label></div>
    <div class="form-group"><label>Narration</label><textarea name="narr" style="height:40px;">${existing?.narration||""}</textarea></div>
    <div class="form-group"><label>Enemies</label><div id="totm-enc-enemy-roster" style="max-height:230px;overflow-y:auto;border:1px solid #555;border-radius:6px;padding:6px;"></div></div>
  </form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save & Position",callback:h=>{
    const enemies=draftEnemies.map(enemy=>foundry.utils.deepClone({...normalizeEnemyEntry(enemy),tokenId:null}));
    const enc={name:h.find("[name=name]").val().trim()||"Encounter",category:h.find("[name=category]").val().trim(),tags:normalizeTagString(h.find("[name=tags]").val()),villainFight:h.find("[name=villainFight]").is(":checked"),background:h.find("[name=bg]").val().trim(),bgPosX:+h.find("[name=bgx]").val(),bgPosY:+h.find("[name=bgy]").val(),bgZoom:+h.find("[name=bgz]").val(),bgStretch:h.find("[name=bgstretch]").is(":checked"),narration:h.find("[name=narr]").val().trim(),enemies};
    if(existingIndex>=0)d.encounters[existingIndex]=enc;
    else d.encounters.push(enc);
    const finish=()=>{const phased=enemies.filter(enemy=>enemy.phaseEnabled&&enemy.nextFormId);if(phased.length){const phaseGhosts=phased.map(enemy=>{const nextActor=game.actors.get(enemy.nextFormId);return nextActor?{name:`${enemy.name} -> ${nextActor.name}`,image:enemy.nextFormImage||nextActor.prototypeToken?.texture?.src||nextActor.img||enemy.image,posX:enemy.nextPosX??enemy.posX,posY:enemy.nextPosY??enemy.posY,scale:enemy.nextScale??enemy.scale,_enemy:enemy}:null;}).filter(Boolean);if(phaseGhosts.length){ui.notifications.info("Position villain next forms for dramatic reveals.");openMultiDragPos(phaseGhosts,scene,d,()=>{phaseGhosts.forEach(g=>{g._enemy.nextPosX=g.posX;g._enemy.nextPosY=g.posY;g._enemy.nextScale=g.scale;});if(onDone)onDone();});return;}}if(onDone)onDone();};
    if(enemies.length){ui.notifications.info("Position enemies together. Drag each one and scroll to resize.");openMultiDragPos(enemies,scene,d,finish);}else{finish();}
  }}},default:"save",render:h=>{
    h.closest(".app").css({width:"680px","max-width":"92vw"});
    bindEncounterPreview(h);
    bindEncounterEnemyDrop(h,draftEnemies,actors);
    h.find("#enc-bp").on("click",()=>{new FilePicker({type:"image",callback:p=>{h.find("[name=bg]").val(p);const saved=d.backgrounds?.find(b=>b.image===p);if(saved){const cfg=bgCfg(saved);h.find("[name=bgx]").val(cfg.bgPosX);h.find("[name=bgy]").val(cfg.bgPosY);h.find("[name=bgz]").val(cfg.bgZoom);}h.find("[name=bg]").trigger("change");}}).browse();});
  }}).render(true);
}

// -- ACTOR CONFIG --
function openActorCfg(scene,d,idx){const a=d.actors[idx];if(!a)return;const avail=discRes(a.id);function ci(c){return c==="res-hp"?"#5cb85c":c==="res-1"?"#5ba8e0":c==="res-2"?"#b07cc8":"#d0c050";}function brl(r){if(!r.length)return'<div style="color:#888;font-size:11px;padding:6px;text-align:center;">No resources</div>';return r.map((x,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:4px;background:rgba(255,255,255,.03);border-radius:4px;margin-bottom:2px;"><i class="${x.icon}" style="color:${ci(x.color)};"></i><span style="flex:1;font-size:11px;font-weight:600;">${x.label}</span><button type="button" data-rr="${i}" style="background:none;border:none;color:#a05050;cursor:pointer;"><i class="fas fa-times"></i></button></div>`).join("");}function bpo(r){return avail.map(av=>`<option value="${av.path}|${av.maxPath}" ${r.find(x=>x.path===av.path)?"disabled":""}>${av.label} (${av.value}/${av.max})</option>`).join("");}
  new Dialog({title:`Settings - ${a.name}`,content:`<form style="max-height:540px;overflow-y:auto;"><h3 style="border-bottom:1px solid #555;margin:0 0 6px;font-size:12px;">Default Image</h3><div class="form-group"><label>X</label><input type="range" name="bx" min="0" max="100" value="${a.bgOffsetX??50}"/></div><div class="form-group"><label>Y</label><input type="range" name="by" min="0" max="100" value="${a.bgOffsetY??20}"/></div><div class="form-group"><label>Zoom</label><input type="range" name="bs" min="100" max="400" value="${a.bgScale??150}" step="10"/></div><div class="form-group"><label><input type="checkbox" name="bfit" ${a.bgAutoFit?"checked":""}/> Auto fit image into portrait box</label></div><h3 style="border-bottom:1px solid #555;margin:10px 0 6px;font-size:12px;">Combat Image</h3><div class="form-group"><label>Image</label><div style="display:flex;gap:6px;align-items:center;"><input type="text" name="combatImg" value="${a.combatImg??""}" placeholder="Optional combat portrait" style="flex:1;"/><button type="button" name="combatBrowse" style="padding:2px 8px;cursor:pointer;"><i class="fas fa-folder-open"></i></button><button type="button" name="combatClear" style="padding:2px 8px;cursor:pointer;"><i class="fas fa-times"></i></button></div></div><div class="form-group"><label>X</label><input type="range" name="cbx" min="0" max="100" value="${a.combatOffsetX??a.bgOffsetX??50}"/></div><div class="form-group"><label>Y</label><input type="range" name="cby" min="0" max="100" value="${a.combatOffsetY??a.bgOffsetY??20}"/></div><div class="form-group"><label>Zoom</label><input type="range" name="cbs" min="100" max="400" value="${a.combatScale??a.bgScale??150}" step="10"/></div><div class="form-group"><label><input type="checkbox" name="cbfit" ${a.combatAutoFit?"checked":""}/> Auto fit combat image into portrait box</label></div><p style="margin:4px 0 0;color:#888;font-size:11px;">When a fight is active, this image will replace the normal player portrait automatically.</p><h3 style="border-bottom:1px solid #555;margin:10px 0 6px;font-size:12px;">Resources</h3><div id="rl">${brl(a.resources||[])}</div>${avail.length?`<div style="display:flex;gap:4px;margin-top:4px;"><select id="rp" style="flex:1;font-size:11px;"><option value="">- Select -</option>${bpo(a.resources||[])}</select><select id="rc" style="font-size:11px;">${COLORS.map(c=>`<option value="${c.v}">${c.l}</option>`).join("")}</select><button type="button" id="ra" style="padding:2px 8px;cursor:pointer;"><i class="fas fa-plus"></i></button></div>`:""}</form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async h=>{d.actors[idx].bgOffsetX=+h.find("[name=bx]").val();d.actors[idx].bgOffsetY=+h.find("[name=by]").val();d.actors[idx].bgScale=+h.find("[name=bs]").val();d.actors[idx].bgAutoFit=h.find("[name=bfit]").is(":checked");d.actors[idx].combatImg=String(h.find("[name=combatImg]").val()||"").trim();d.actors[idx].combatOffsetX=+h.find("[name=cbx]").val();d.actors[idx].combatOffsetY=+h.find("[name=cby]").val();d.actors[idx].combatScale=+h.find("[name=cbs]").val();d.actors[idx].combatAutoFit=h.find("[name=cbfit]").is(":checked");await saveData(scene,d);emit();refreshChangedAreas(scene,d);}}},default:"save",render:h=>{const bg=document.querySelector(`.totm-actor-card[data-idx="${idx}"] .totm-card-bg`);const previewDefault=()=>{if(!bg)return;bg.style.backgroundImage=`url('${getImg(d.actors[idx])}')`;bg.style.backgroundPosition=`${h.find("[name=bx]").val()}% ${h.find("[name=by]").val()}%`;bg.style.backgroundSize=h.find("[name=bfit]").is(":checked")?"cover":`${h.find("[name=bs]").val()}%`;};const previewCombat=()=>{if(!bg)return;const combatImg=String(h.find("[name=combatImg]").val()||"").trim();bg.style.backgroundImage=`url('${combatImg||getImg(d.actors[idx])}')`;bg.style.backgroundPosition=`${h.find("[name=cbx]").val()}% ${h.find("[name=cby]").val()}%`;bg.style.backgroundSize=h.find("[name=cbfit]").is(":checked")?"cover":`${h.find("[name=cbs]").val()}%`;};if(bg){h.find("[name=bx],[name=by],[name=bs],[name=bfit]").on("input change",previewDefault);h.find("[name=combatImg],[name=cbx],[name=cby],[name=cbs],[name=cbfit]").on("input change",previewCombat);}h.find("[name=combatBrowse]").on("click",()=>new FilePicker({type:"image",callback:path=>{h.find("[name=combatImg]").val(path);previewCombat();}}).browse());h.find("[name=combatClear]").on("click",()=>{h.find("[name=combatImg]").val("");previewCombat();});function rr(){h.find("#rl").html(brl(d.actors[idx].resources||[]));if(h.find("#rp").length)h.find("#rp").html(`<option value="">- Select -</option>${bpo(d.actors[idx].resources||[])}`);br();}h.find("#ra").on("click",()=>{const v=h.find("#rp").val();if(!v)return;const[path,maxPath]=v.split("|");const c=h.find("#rc").val()||"res-hp";const cd=COLORS.find(x=>x.v===c)||COLORS[0];const disc=avail.find(x=>x.path===path);if(!disc)return;if(!d.actors[idx].resources)d.actors[idx].resources=[];d.actors[idx].resources.push({label:disc.label,icon:cd.i,path,maxPath,color:c});rr();});function br(){h.find("[data-rr]").off("click").on("click",function(){d.actors[idx].resources.splice(+this.dataset.rr,1);rr();});}br();}}).render(true);}

function pickActor(scene,d){const av=game.actors.contents.filter(a=>!d.actors.find(e=>e.id===a.id));if(!av.length){ui.notifications.warn("All actors added.");return;}new Dialog({title:"Add Player",content:`<form><div class="form-group"><label>Actor</label><select name="a" style="width:100%">${av.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}</select></div></form>`,buttons:{add:{icon:'<i class="fas fa-plus"></i>',label:"Add",callback:async h=>{const a=game.actors.get(h.find("[name=a]").val());if(!a)return;d.actors.push(makeEntry(a,d.actors.length));await saveData(scene,d);emit();refreshChangedAreas(scene,d);}}},default:"add"}).render(true);}

// -- HOOKS --
Hooks.on("updateActor",async a=>{if(!document.body.classList.contains("totm-active"))return;const s=game.scenes.viewed;if(!s||!isTOTM(s))return;const d=getData(s);if(d.actors.find(x=>x.id===a.id)||d.boardActors?.find?.(x=>x.actorId===a.id)||d.enemies.find(x=>x.id===a.id)){scheduleRefresh(s);await checkEncounterEnemyStates(s,d);}});
Hooks.on("updateToken",async t=>{const s=game.scenes.viewed;if(!document.body.classList.contains("totm-active")||!s||s.id!==t.parent?.id||!isTOTM(s))return;if(t.getFlag(MODULE_ID,FLAG_PROXY)){const d=getData(s);scheduleRefresh(s);await checkEncounterEnemyStates(s,d);}});
Hooks.on("updateSetting",setting=>{if(setting.key==="global-progress-clocks.activeClocks")window.clockDatabase?.refresh?.();const s=game.scenes.viewed;if(!document.body.classList.contains("totm-active")||!s||!isTOTM(s))return;if(setting.key==="global-progress-clocks.activeClocks")refreshClockUi(s)||requestSceneRefresh(s);});
Hooks.on("getSceneContextOptions",(app,items)=>{items.push({name:"Toggle Theater of the Mind",icon:'<i class="fas fa-theater-masks"></i>',condition:()=>isGM(),callback:async el=>{const id=el.dataset?.sceneId||el.dataset?.documentId||el.dataset?.entryId||el.closest("[data-scene-id]")?.dataset?.sceneId||el.closest("[data-document-id]")?.dataset?.documentId||el.closest("[data-entry-id]")?.dataset?.entryId;const s=game.scenes.get(id);if(s)await toggleTOTM(s);}});});
async function toggleTOTM(s){if(isTOTM(s)){const ok=await confirmDestructive({title:"Disable TOTM on this scene?",content:"This removes TOTM scene flags and overlay data from the scene.",yes:"Disable"});if(!ok)return;const d=getData(s);await setTargets(s,[],game.user,d);if(isGM()){await pruneEnemyTokenDocs(s,{...d,enemies:[]});await prunePlayerTokenDocs(s,{...d,actors:[]});}if(s?.id)SCENE_DATA_CACHE.delete(s.id);await unsetF(s,FLAG_TOTM);await unsetF(s,FLAG_DATA);ui.notifications.info("TOTM disabled.");if(s.id===game.scenes.viewed?.id)deactivate();}else{const d=defData();if(s.background?.src)d.background=s.background.src;if(s?.id)SCENE_DATA_CACHE.set(s.id,cloneData(d));await setF(s,FLAG_TOTM,true);await setF(s,FLAG_DATA,cloneData(d));ui.notifications.info("TOTM enabled.");if(s.id===game.scenes.viewed?.id)activate(s);}emit();}
Hooks.on("canvasReady",async c=>{const s=c.scene||game.scenes.viewed;if(s&&isTOTM(s)){const d=getData(s);const changedEnemies=await ensureEnemyTokenDocs(s,d),changedPlayers=await ensurePlayerTokenDocs(s,d);if(changedEnemies||changedPlayers)await saveData(s,d);activate(s);}else deactivate();});
Hooks.on("updateScene",(s,ch)=>{
  if(ch?.flags?.[MODULE_ID]){
    bumpSceneDataEpoch(s);
    const totmFlags=s.getFlag(MODULE_ID,FLAG_DATA);
    const previous=s?.id?SCENE_DATA_CACHE.get(s.id):null;
    const nextData=totmFlags?normalizeSceneData(totmFlags):null;
    if(s?.id){
      if(nextData)SCENE_DATA_CACHE.set(s.id,cloneData(nextData));
      else SCENE_DATA_CACHE.delete(s.id);
    }
    if(s.id!==game.scenes.viewed?.id)return;
    if(isTOTM(s)){
      if(LOCAL_PIN_DRAG_COUNT>0)PENDING_PIN_REFRESH_SCENE_ID=s.id;
      else if(nextData&&isStageOnlyDataChange(previous,nextData)&&document.body.classList.contains("totm-active")&&refreshStageArea(s,nextData)){}
      else if(document.body.classList.contains("totm-active")&&nextData&&refreshOverlayAreas(s,nextData)){}
      else activate(s);
    }else deactivate();
    return;
  }
  if(s.id!==game.scenes.viewed?.id)return;
});
Hooks.on("updateUser",_u=>{const s=game.scenes.viewed;if(s&&isTOTM(s))requestSceneRefresh(s);});
Hooks.on("targetToken",(_user,_token,_targeted)=>{const s=game.scenes.viewed;if(s&&document.body.classList.contains("totm-active")&&isTOTM(s)){if(!updateTargetHighlights(s))requestSceneRefresh(s);}});
Hooks.on("renderHotbar",()=>{const s=game.scenes.viewed;if(s&&document.body.classList.contains("totm-active")&&isTOTM(s))refreshHotbarOnly(s)||requestSceneRefresh(s);});
Hooks.on("pauseGame",()=>{const s=game.scenes.viewed;if(s&&document.body.classList.contains("totm-active")&&isTOTM(s))requestSceneRefresh(s);});
Hooks.once("init",()=>{console.info("TOTM Overlay loaded",{version:game.modules.get("totm-overlay")?.version,time:new Date().toISOString()});regSettings();});
Hooks.once("ready",async()=>{game.socket.on(`module.${MODULE_ID}`,onSock);injectUI();bindTotmGlobalClickHandler();window.addEventListener("resize",()=>{if(document.body.classList.contains("totm-active")){ensureSidebarExpanded();fitSB();syncHotbarPosition();}});document.addEventListener("click",e=>{if(!document.body.classList.contains("totm-active"))return;const btn=e.target.closest?.("#sidebar .collapse, #sidebar #sidebar-collapse, #sidebar [data-action='collapse']");if(!btn)return;e.preventDefault();e.stopPropagation();ensureSidebarExpanded();},true);const s=game.scenes.viewed;if(s&&isTOTM(s)){const d=getData(s);const changedEnemies=await ensureEnemyTokenDocs(s,d),changedPlayers=await ensurePlayerTokenDocs(s,d);if(changedEnemies||changedPlayers)await saveData(s,d);activate(s);}});
Hooks.once("ready",()=>{window.TOTMOverlay={...(window.TOTMOverlay||{}),isTOTM:s=>isTOTM(s||game.scenes.viewed),toggle:async()=>{const s=game.scenes.viewed;if(s)await toggleTOTM(s);},debugBoardActors:(scene=game.scenes.viewed)=>debugBoardActors(scene),clearBoardActors:async(scene=game.scenes.viewed)=>{if(!game.user.isGM||!scene||!isTOTM(scene))return;await clearBoardActors(scene,{notify:true});},repairBoardActors:async(scene=game.scenes.viewed)=>{if(!game.user.isGM||!scene||!isTOTM(scene))return;await repairBoardActorsForScene(scene,{notify:true});},revealBoardActors:async(scene=game.scenes.viewed)=>{if(!game.user.isGM||!scene||!isTOTM(scene))return;await revealBoardActors(scene,{notify:true});}};});
Hooks.once("ready",()=>{window.addEventListener("keydown",async e=>{if(e.repeat||e.key.toLowerCase()!=="t"||typingInField(e)||!document.body.classList.contains("totm-active"))return;const scene=game.scenes.viewed;if(!scene||!isTOTM(scene))return;const d=getData(scene),hoveredPlayer=document.querySelector("#totm-ui .totm-actor-card:hover"),hoveredStageActor=document.querySelector("#totm-ui .totm-stage-actor:hover"),hoveredEnemy=document.querySelector("#totm-ui .totm-scene-enemy:hover, #totm-ui .totm-enemy-card:hover");e.preventDefault();const exclusive=!e.shiftKey,hoveredActorId=hoveredPlayer?.dataset.actorId||hoveredStageActor?.dataset.actorId;if(hoveredActorId){if(!await togglePlayerTarget(hoveredActorId,scene,{exclusive}))ui.notifications.warn("No scene token found for that player.");updateTargetHighlights(scene,d);return;}if(d.combatActive&&hoveredEnemy?.dataset.targetId){await toggleEnemyTarget(scene,d,hoveredEnemy.dataset.targetId,{exclusive});return;}if(document.querySelector("#totm-ui #totm-actor-list:hover")){await targetNextPlayer(scene,d,{exclusive});return;}if(d.combatActive)await targetNextEnemy(scene,d,{exclusive});});});
Hooks.once("ready",()=>{window.addEventListener("keydown",async e=>{if(e.repeat||e.key.toLowerCase()!=="v"||typingInField(e)||!document.body.classList.contains("totm-active"))return;const scene=game.scenes.viewed;if(!scene||!isTOTM(scene)||!isGM())return;e.preventDefault();await toggleBoardActorsVisibility(scene,getData(scene));});});

