// TOTM v8 â€“ Enemies on scene + bar, drag position, BG zoom, reusable encounters
import { syncHotbarPosition as syncHotbarPositionModule, getHotbarDropSlot as getHotbarDropSlotModule, createProjectFUItemHotbarMacro as createProjectFUItemHotbarMacroModule, handleTotmHotbarDrop as handleTotmHotbarDropModule, bindTotmHotbarDropZone as bindTotmHotbarDropZoneModule, renderTotmHotbar as renderTotmHotbarModule, bindTotmHotbarUi as bindTotmHotbarUiModule } from "./modules/hotbar.mjs";
import { renderPlayerCards as renderPlayerCardsModule, bindPlayerPanelEvents as bindPlayerPanelEventsModule } from "./modules/player-panel.mjs";
import { buildStageSceneImages as buildStageSceneImagesModule, renderEnemyBar as renderEnemyBarModule, bindEnemyStageEvents as bindEnemyStageEventsModule } from "./modules/enemy-stage.mjs";
import { renderTopbar as renderTopbarModule, bindSceneAdminEvents as bindSceneAdminEventsModule } from "./modules/scene-admin.mjs";
const MODULE_ID="totm-overlay",FLAG_TOTM="isTOTM",FLAG_DATA="totmData",FLAG_TARGETS="userTargets",FLAG_PROXY="proxyToken",FLAG_PLAYER_PROXY="playerProxyToken",FLAG_USER_AFK="afkActors";
const loc=k=>game.i18n.localize(`TOTM.${k}`),isGM=()=>game.user.isGM;
const getF=(s,k)=>s?.getFlag(MODULE_ID,k),setF=async(s,k,v)=>s?.setFlag(MODULE_ID,k,v),unsetF=async(s,k)=>s?.unsetFlag(MODULE_ID,k);
const defData=()=>({background:"",bgPosX:50,bgPosY:50,bgZoom:100,featuredArt:"",featuredCaption:"",narration:"",style:"classic",actors:[],backgrounds:[],npcs:[],props:[],propsByBackground:{},questPins:[],questPinsByBackground:{},enemies:[],encounters:[],shared:false,preEncounterView:null,gmPin:{visible:false,image:"",size:64,posX:50,posY:50}});
const getData=s=>Object.assign(defData(),getF(s,FLAG_DATA)||{});
const saveData=async(s,d)=>setF(s,FLAG_DATA,JSON.parse(JSON.stringify(d)));
const emit=()=>game.socket.emit(`module.${MODULE_ID}`,{action:"refresh"});
const emitAfkToggle=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"afkToggle",sceneId,payload});
const emitPinMove=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"pinMove",sceneId,payload});
const emitPinPersist=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"pinPersist",sceneId,payload});
const emitPinToggle=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"pinToggle",sceneId,payload});
const emitPinConfig=(sceneId,payload)=>game.socket.emit(`module.${MODULE_ID}`,{action:"pinConfig",sceneId,payload});
function requestSceneRefresh(scene){
  if(!scene)return;
  if(LOCAL_PIN_DRAG_COUNT>0){
    PENDING_PIN_REFRESH_SCENE_ID=scene.id;
    return;
  }
  refreshUI(scene);
}
function flushDeferredPinRefresh(){
  if(LOCAL_PIN_DRAG_COUNT>0||!PENDING_PIN_REFRESH_SCENE_ID)return;
  const scene=game.scenes.get(PENDING_PIN_REFRESH_SCENE_ID);
  PENDING_PIN_REFRESH_SCENE_ID=null;
  if(scene&&isTOTM(scene)&&scene.id===game.scenes.viewed?.id)refreshUI(scene);
}
const onSock=p=>{
  const s=game.scenes.viewed;
  if(p?.action==="refresh"){if(s&&isTOTM(s))requestSceneRefresh(s);return;}
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
const BG_FADE_MS=1600;
let CLOCKS_OPEN=false;
let LOCAL_PIN_DRAG_COUNT=0;
let PENDING_PIN_REFRESH_SCENE_ID=null;
const HAS_FORM_APPLICATION=typeof globalThis.FormApplication==="function";
const getThemeMeta=id=>UI_THEMES.find(t=>t.id===id)||UI_THEMES[0];
const nextThemeId=id=>UI_THEMES[(Math.max(0,UI_THEMES.findIndex(t=>t.id===id))+1)%UI_THEMES.length].id;
const questPinSvg=(label,bg="#1d3557",fg="#fff")=>`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="42" fill="${bg}" stroke="rgba(255,255,255,.85)" stroke-width="6"/><text x="48" y="60" text-anchor="middle" font-size="52" font-family="Arial, sans-serif" font-weight="700" fill="${fg}">${label}</text></svg>`)}`;
const getQuestPinImage=type=>type==="question"?questPinSvg("?","#8d5cf6"):type==="complete"?questPinSvg("âœ“","#2f9e44"):questPinSvg("!","#d97706");
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
function getActorStatus(entry){if(!entry)return"";return entry.status||"";}
async function handleAfkSceneUpdate(scene,message){
  const actorId=message?.payload?.actorId;
  if(!actorId)return;
  const d=getData(scene);
  const actor=d.actors?.find?.(a=>a.id===actorId);
  if(!actor)return;
  actor.status=actor.status==="afk"?"":"afk";
  await saveData(scene,d);
  emit();
  if(scene.id===game.scenes.viewed?.id)refreshUI(scene);
}
async function toggleActorAfkStatus(scene,d,actorId){
  if(!scene||!actorId)return;
  if(isGM()){
    const actor=d.actors?.find?.(a=>a.id===actorId);
    if(!actor)return;
    actor.status=actor.status==="afk"?"":"afk";
    await saveData(scene,d);
    emit();
    refreshUI(scene);
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
  game.settings.register(MODULE_ID,"conditions",{name:"Conditions JSON",scope:"world",config:true,type:String,default:JSON.stringify(DEF_CONDS)});
  game.settings.register(MODULE_ID,"playersCanAfk",{name:"Players Can AFK",scope:"world",config:true,type:Boolean,default:true});
  game.settings.register(MODULE_ID,"damageAnimations",{name:"Damage Animation Config",scope:"world",config:false,type:Object,default:defaultAnimSettings()});
  if(HAS_FORM_APPLICATION)game.settings.registerMenu(MODULE_ID,"damageAnimationMenu",{name:"Damage Animations",label:"Configure",hint:"Set JB2A or other video overlays for Fabula damage types and defeat.",icon:"fas fa-burst",type:TOTMDamageAnimSettings,restricted:true});
}
const getConds=()=>{try{return JSON.parse(game.settings.get(MODULE_ID,"conditions"));}catch{return DEF_CONDS;}};

// Resources
function discRes(id){const a=game.actors.get(id);if(!a)return[];const f=[];(function sc(o,px){if(!o||typeof o!=="object")return;for(const[k,v]of Object.entries(o)){const p=px?`${px}.${k}`:k;if(v&&typeof v==="object"&&!Array.isArray(v)){if("value"in v&&"max"in v&&typeof v.max==="number"&&v.max>0)f.push({label:p.split(".").filter(s=>!["system","attributes","resources"].includes(s)).join(" â€º ")||p,path:`${p}.value`,maxPath:`${p}.max`,value:+v.value,max:+v.max});sc(v,p);}}})(a.system,"system");return f;}
function getEncounterActor(e,scene=game.scenes.viewed){const td=scene&&e?.tokenId?scene.tokens.get(e.tokenId):null;return td?.actor||game.actors.get(e?.id)||null;}
function getAutoRes(actor,{enemy=false}={}){if(!actor?.system?.resources)return[];const res=[];const add=(label,icon,key,color)=>{const data=actor.system.resources?.[key],value=+data?.value,max=+data?.max;if(!Number.isFinite(value)||!Number.isFinite(max)||max<=0)return;res.push({value,max,label,icon,color});};add("HP","fas fa-heart","hp",enemy?"res-enemy-hp":"res-hp");add("MP","fas fa-droplet","mp",enemy?"res-enemy-mp":"res-mp");if(!enemy)add("IP","fas fa-briefcase","ip","res-ip");return res;}
function getRes(e,scene=game.scenes.viewed,{enemy=false,auto=true}={}){const a=getEncounterActor(e,scene);if(!a)return[];const manual=(e.resources||[]).map(r=>{if(!r.path||!r.maxPath)return null;const v=rPath(a,r.path),m=rPath(a,r.maxPath);if(v==null||m==null||m<=0)return null;return{value:+v,max:+m,label:r.label,icon:r.icon||"fas fa-circle",color:r.color||"res-hp"};}).filter(Boolean);if(auto){const labels=new Set(manual.map(r=>r.label));getAutoRes(a,{enemy}).forEach(r=>{if(!labels.has(r.label))manual.push(r);});}return manual;}
function getFabulaPoints(actor){const value=+actor?.system?.resources?.fp?.value;return Number.isFinite(value)?value:null;}
function getClockEntries(){if(!hasClockModule())return[];const db=window.clockDatabase,clockColors=game.settings.get("global-progress-clocks","clockColors"),defaultColor=game.settings.get("global-progress-clocks","defaultColor"),backgroundColor=game.settings.get("global-progress-clocks","defaultBackgroundColor"),entries=Object.values(game.settings.get("global-progress-clocks","activeClocks")||{});return entries.map(data=>({id:data.id,name:data.name||"New Clock",type:data.type||"clock",value:Math.clamp(data.value??0,0,data.max??0),max:data.max??4,private:!!data.private,visible:!data.private||game.user.isGM,editable:db.canUserEdit(game.user),color:clockColors.find(c=>c.id===data.colorId)?.color??defaultColor,backgroundColor,ratio:(data.max??0)>0?Math.max(0,Math.min(1,(data.value??0)/(data.max??1))):0,slashes:Array.from({length:data.max||0},(_,i)=>i<(data.value??0))})).filter(c=>c.visible);}
async function stepClock(clockId,delta){if(!hasClockModule())return;const db=window.clockDatabase,clock=db.get(clockId);if(!clock)return;await db.update({id:clock.id,value:Math.clamp((clock.value??0)+delta,0,clock.max??0)});}
async function deleteClock(clockId){if(!hasClockModule())return;const db=window.clockDatabase;if(!db.canUserEdit(game.user))return;db.delete(clockId);}
const TOTMFormApplicationBase=HAS_FORM_APPLICATION?globalThis.FormApplication:class{};
class TOTMDamageAnimSettings extends TOTMFormApplicationBase{render(){openDamageAnimConfig();return this;}}
function damageAnimRows(){const cfg=getAnimSettings(),types=globalThis.CONFIG?.FU?.damageTypes||Object.fromEntries(DAMAGE_TYPES.map(k=>[k,k]));return[...DAMAGE_TYPES,"defeat"].map(key=>({key,label:key==="defeat"?"Defeat":game.i18n.localize(types[key]||key),path:cfg[key]?.path||"",duration:cfg[key]?.duration??1200}));}
function buildDamageAnimRowsHtml(rows){return rows.map(r=>`<div class="totm-dmgfx-row" style="display:grid;grid-template-columns:140px 1fr 110px;gap:8px;align-items:center;padding:8px;border:1px solid rgba(0,0,0,.15);border-radius:8px;background:rgba(0,0,0,.04);"><div class="totm-dmgfx-label" style="font-weight:700;">${foundry.utils.escapeHTML(String(r.label||r.key))}</div><div class="totm-dmgfx-path" style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;"><input type="text" name="${r.key}.path" value="${foundry.utils.escapeHTML(String(r.path||""))}" placeholder="modules/JB2A_DnD5e/..."/><button type="button" class="totm-dmgfx-btn" data-pick="${r.key}">Browse</button><button type="button" class="totm-dmgfx-btn" data-clear="${r.key}">Clear</button></div><div class="totm-dmgfx-duration" style="display:flex;align-items:center;gap:6px;"><input type="number" name="${r.key}.duration" value="${r.duration}" min="100" step="100"/><span>ms</span></div></div>`).join("");}
function buildDamageAnimDialogContent(rows){return `<form class="totm-dmgfx-form"><p class="notes">Set a JB2A or other video path and playback duration for each Fabula damage type. This keeps the config in module settings while combat rendering is kept separate.</p><div class="totm-dmgfx-grid" style="display:flex;flex-direction:column;gap:8px;max-height:65vh;overflow:auto;padding-right:4px;">${buildDamageAnimRowsHtml(rows)}</div></form>`;}
async function saveDamageAnimFromHtml(html){const next=defaultAnimSettings();for(const key of Object.keys(next)){next[key]={path:String(html.find(`[name="${key}.path"]`).val()||"").trim(),duration:Math.max(100,Number(html.find(`[name="${key}.duration"]`).val())||1200)};}await game.settings.set(MODULE_ID,"damageAnimations",next);}
function bindDamageAnimDialog(html){html.find("[data-pick]").on("click",ev=>{const key=ev.currentTarget.dataset.pick;new FilePicker({type:"video",callback:path=>html.find(`[name="${key}.path"]`).val(path)}).browse();});html.find("[data-clear]").on("click",ev=>{const key=ev.currentTarget.dataset.clear;html.find(`[name="${key}.path"]`).val("");});}
function openDamageAnimConfig(){const rows=damageAnimRows();new Dialog({title:"TOTM Damage Animations",content:buildDamageAnimDialogContent(rows),buttons:{save:{icon:'<i class="fas fa-save"></i>',label:"Save",callback:async html=>{await saveDamageAnimFromHtml(html);}}},default:"save",render:html=>{bindDamageAnimDialog(html);}}).render(true);}
function openClockCreateDialog(){if(!hasClockModule())return;const db=window.clockDatabase;if(!db.canUserEdit(game.user)){ui.notifications.warn("You do not have permission to create clocks.");return;}new Dialog({title:"Add Clock",content:`<form><div class="form-group"><label>Name</label><input name="name" placeholder="Danger Clock"/></div><div class="form-group"><label>Type</label><select name="type"><option value="clock">Clock</option><option value="tracker">Tracker</option><option value="points">Points</option></select></div><div class="form-group"><label>Max</label><input type="number" name="max" min="1" max="99" step="1" value="6"/></div><div class="form-group"><label><input type="checkbox" name="private"/> Private</label></div></form>`,buttons:{add:{icon:'<i class="fas fa-plus"></i>',label:"Add",callback:async h=>{const type=h.find("[name=type]").val(),maxRaw=+h.find("[name=max]").val(),max=Math.max(1,Math.min(type==="points"?99:type==="tracker"?12:128,Number.isFinite(maxRaw)?maxRaw:6));db.addClock({name:h.find("[name=name]").val().trim()||"New Clock",type,max,private:h.find("[name=private]").is(":checked")});CLOCKS_OPEN=true;const s=game.scenes.viewed;if(s&&isTOTM(s))refreshUI(s);}}},default:"add"}).render(true);}
function getImg(a){const src=game.settings.get(MODULE_ID,"portraitSource"),ac=game.actors.get(a.id);if(!ac)return a.img||"icons/svg/mystery-man.svg";return src==="token"?(ac.prototypeToken?.texture?.src||ac.img||"icons/svg/mystery-man.svg"):(ac.img||"icons/svg/mystery-man.svg");}
function makeEntry(actor){const p=PRESETS[game.settings.get(MODULE_ID,"systemPreset")];const res=[];if(p?.hp)res.push({label:"HP",icon:"fas fa-heart",path:p.hp,maxPath:p.hpM,color:"res-hp"});return{id:actor.id,name:actor.name,img:actor.prototypeToken?.texture?.src||actor.img||"icons/svg/mystery-man.svg",artImg:actor.img||"icons/svg/mystery-man.svg",visible:true,highlighted:false,bgOffsetX:50,bgOffsetY:20,bgScale:150,status:"",conditions:[],resources:res,pinVisible:false,pinImg:actor.img||actor.prototypeToken?.texture?.src||"icons/svg/mystery-man.svg",pinSize:64,pinX:50,pinY:50};}
const makeEnemyInstanceId=()=>foundry.utils.randomID();
const enemyTargetId=e=>e?.instanceId||e?.id;
function makeEnemyEntry(actor,overrides={}){const entry=makeEntry(actor);return foundry.utils.mergeObject({instanceId:makeEnemyInstanceId(),id:actor.id,name:actor.name,image:actor.prototypeToken?.texture?.src||actor.img||"icons/svg/mystery-man.svg",posX:30+Math.random()*40,posY:55+Math.random()*20,scale:100,tokenId:null,resources:entry.resources,phaseEnabled:false,nextFormId:"",nextFormName:"",nextFormImage:"",nextPosX:null,nextPosY:null,nextScale:null,phaseUsed:false,transitionState:"",transitionAt:0,pendingPhasePrompt:false},overrides,{inplace:false,overwrite:true});}
function normalizeEnemyEntry(enemy){if(!enemy)return enemy;if(!enemy.instanceId)enemy.instanceId=makeEnemyInstanceId();if(enemy.transitionState==null)enemy.transitionState="";if(enemy.transitionAt==null)enemy.transitionAt=0;if(enemy.pendingPhasePrompt==null)enemy.pendingPhasePrompt=false;if(enemy.phaseUsed==null)enemy.phaseUsed=false;return enemy;}
const playerProxyFlags=actorId=>({[MODULE_ID]:{[FLAG_PLAYER_PROXY]:true,actorId}});
function getPlayerTokenDoc(scene,actorId){if(!scene||!actorId)return null;return scene.tokens.find(t=>t.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)&&t.actor?.id===actorId)||null;}
async function ensurePlayerTokenDoc(scene,actorId,index=0){let td=getPlayerTokenDoc(scene,actorId);if(td)return td;if(!isGM())return null;const actor=game.actors.get(actorId);if(!actor)return null;const base=actor.prototypeToken?.toObject?.()||{};const data=foundry.utils.mergeObject(base,{actorId:actor.id,actorLink:true,hidden:false,alpha:0,name:`TOTM ${actor.name}`,x:index*100,y:80,flags:playerProxyFlags(actor.id)},{inplace:false,overwrite:true,insertKeys:true,insertValues:true});const [created]=await scene.createEmbeddedDocuments("Token",[data]);return created||null;}
async function ensurePlayerTokenDocs(scene,d){if(!scene||!isGM()||!(d.actors||[]).length)return false;let changed=false;for(let i=0;i<d.actors.length;i++){const a=d.actors[i];const td=await ensurePlayerTokenDoc(scene,a.id,i);if(td)changed=true;}return changed;}
function getActorTokenDocs(actorId,scene=game.scenes.viewed){if(!scene||!actorId)return[];return scene.tokens.filter(t=>t.actor?.id===actorId&&(!t.getFlag(MODULE_ID,FLAG_PROXY)||t.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)));}
function getActorTokenPlaceables(actorId,scene=game.scenes.viewed){const layer=canvas?.tokens;if(!layer||!scene||scene.id!==game.scenes.viewed?.id)return[];return layer.placeables.filter(t=>t.actor?.id===actorId&&(!t.document?.getFlag(MODULE_ID,FLAG_PROXY)||t.document?.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)));}
function isActorTargeted(actorId,scene=game.scenes.viewed){const tokens=getActorTokenPlaceables(actorId,scene);return tokens.some(t=>game.user.targets.has(t)||t.controlled);}
async function syncActorTargets(actorId,{exclusive=true}={},scene=game.scenes.viewed){let actorDocs=getActorTokenDocs(actorId,scene),actorTokens=getActorTokenPlaceables(actorId,scene),layer=canvas?.tokens;if(!actorDocs.length&&isGM()){await ensurePlayerTokenDoc(scene,actorId,(d=>d?.actors?.findIndex?.(a=>a.id===actorId))(getData(scene)));actorDocs=getActorTokenDocs(actorId,scene);actorTokens=getActorTokenPlaceables(actorId,scene);}if(!actorDocs.length)return false;const actorTokenIds=actorDocs.map(t=>t.id);if(typeof game.user.updateTokenTargets==="function")game.user.updateTokenTargets(actorTokenIds);if(!layer)return true;const allSceneActorTokens=layer.placeables.filter(t=>!t.document?.getFlag(MODULE_ID,FLAG_PROXY)||t.document?.getFlag(MODULE_ID,FLAG_PLAYER_PROXY));if(exclusive){allSceneActorTokens.forEach(t=>{if(!actorTokenIds.includes(t.id)&&game.user.targets.has(t))t.setTarget(false,{user:game.user,releaseOthers:false,groupSelection:true});if(t.controlled&&!actorTokenIds.includes(t.id))t.release();});}actorTokens.forEach((t,i)=>{t.setTarget(true,{user:game.user,releaseOthers:i===0,groupSelection:i<actorTokens.length-1});if(!t.controlled)t.control({releaseOthers:i===0&&exclusive});});return true;}
async function clearActorTargets(scene=game.scenes.viewed){const layer=canvas?.tokens;if(typeof game.user.updateTokenTargets==="function")game.user.updateTokenTargets([]);if(!layer)return true;layer.placeables.filter(t=>!t.document?.getFlag(MODULE_ID,FLAG_PROXY)||t.document?.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)).forEach(t=>{if(game.user.targets.has(t))t.setTarget(false,{user:game.user,releaseOthers:false,groupSelection:true});if(t.controlled)t.release();});refreshUI(scene);return true;}
async function togglePlayerTarget(actorId,scene=game.scenes.viewed){if(isActorTargeted(actorId,scene))return clearActorTargets(scene);return syncActorTargets(actorId,{exclusive:true},scene);}
const bgCfg=(src={})=>({bgPosX:Number.isFinite(+src.bgPosX)?+src.bgPosX:50,bgPosY:Number.isFinite(+src.bgPosY)?+src.bgPosY:50,bgZoom:Number.isFinite(+src.bgZoom)?+src.bgZoom:100});
const setSceneBg=(d,src={},opts={})=>{const cfg=bgCfg(src);d.background=src.image??src.background??d.background??"";d.bgPosX=cfg.bgPosX;d.bgPosY=cfg.bgPosY;d.bgZoom=cfg.bgZoom;if(opts.animate!==false)d.bgFadeAt=Date.now();};
const getTargetMap=()=>Object.fromEntries(LOCAL_TARGETS);
const getTargets=(scene,u=game.user)=>{if(!scene)return[];if(u===game.user){const targeted=Array.from(game.user.targets).filter(t=>t.document?.getFlag(MODULE_ID,FLAG_PROXY)).map(t=>t.document?.getFlag(MODULE_ID,"enemyInstanceId")||t.actor?.id).filter(Boolean);const controlled=(canvas?.tokens?.controlled||[]).filter(t=>t.document?.getFlag(MODULE_ID,FLAG_PROXY)).map(t=>t.document?.getFlag(MODULE_ID,"enemyInstanceId")||t.actor?.id).filter(Boolean);const live=[...new Set([...targeted,...controlled])];if(live.length)return live;}return LOCAL_TARGETS.get(scene.id)||[];};
const proxyFlags=enemy=>({[MODULE_ID]:{[FLAG_PROXY]:true,enemyActorId:enemy.id,enemyInstanceId:enemyTargetId(enemy)}});
const getEnemyByTargetId=(d,targetId)=>(d.enemies||[]).find(e=>enemyTargetId(normalizeEnemyEntry(e))===targetId)||(d.enemies||[]).find(e=>e.id===targetId);
function getEnemyTokenDoc(scene,enemy){if(!scene||!enemy)return null;normalizeEnemyEntry(enemy);const direct=enemy.tokenId?scene.tokens.get(enemy.tokenId):null;if(direct)return direct;return scene.tokens.find(t=>t.getFlag(MODULE_ID,FLAG_PROXY)&&((t.getFlag(MODULE_ID,"enemyInstanceId")&&t.getFlag(MODULE_ID,"enemyInstanceId")===enemyTargetId(enemy))||t.getFlag(MODULE_ID,"enemyActorId")===enemy.id))||null;}
function getEnemyTargetUsers(enemy,scene=game.scenes.viewed){const td=getEnemyTokenDoc(scene,enemy),token=td?canvas?.tokens?.get(td.id):null,users=token?.targeted?Array.from(token.targeted):[];return users.map(u=>({id:u.id,name:u.name,color:u.color?.css||u.color?.toString?.()||String(u.color||"#ff6a00"),img:u.character?.img||u.avatar||u.character?.prototypeToken?.texture?.src||"icons/svg/mystery-man.svg"}));}
async function ensureEnemyTokenDoc(scene,d,enemy,index=0){normalizeEnemyEntry(enemy);let td=getEnemyTokenDoc(scene,enemy);if(td){if(enemy.tokenId!==td.id)enemy.tokenId=td.id;if(isGM()&&(td.hidden||td.alpha!==0||td.name!==`TOTM ${enemy.name}`||td.getFlag(MODULE_ID,"enemyInstanceId")!==enemyTargetId(enemy)))await td.update({hidden:false,alpha:0,name:`TOTM ${enemy.name}`,flags:proxyFlags(enemy)});return td;}if(!isGM())return null;const actor=game.actors.get(enemy.id);if(!actor)return null;const base=actor.prototypeToken?.toObject?.()||{};const data=foundry.utils.mergeObject(base,{actorId:actor.id,actorLink:false,hidden:false,alpha:0,name:`TOTM ${enemy.name}`,x:index*100,y:0,flags:proxyFlags(enemy)},{inplace:false,overwrite:true,insertKeys:true,insertValues:true});const [created]=await scene.createEmbeddedDocuments("Token",[data]);if(created)enemy.tokenId=created.id;return created||null;}
async function ensureEnemyTokenDocs(scene,d){if(!scene||!isGM()||!(d.enemies||[]).length)return false;let changed=false;for(let i=0;i<d.enemies.length;i++){const enemy=d.enemies[i],before=enemy.tokenId;const td=await ensureEnemyTokenDoc(scene,d,enemy,i);if(td&&enemy.tokenId!==before)changed=true;}return changed;}
async function syncFoundryTargets(scene,d,ids,u=game.user){const tokenIds=[];for(let i=0;i<(ids||[]).length;i++){const enemy=getEnemyByTargetId(d,ids[i]);if(!enemy)continue;const td=getEnemyTokenDoc(scene,enemy)||(isGM()?await ensureEnemyTokenDoc(scene,d,enemy,i):null);if(td?.id)tokenIds.push(td.id);}if(u===game.user){const layer=canvas?.tokens;layer?.placeables?.filter(t=>t.document?.getFlag(MODULE_ID,FLAG_PROXY)).forEach(t=>{if(!tokenIds.includes(t.id)&&game.user.targets.has(t))t.setTarget(false,{user:game.user,releaseOthers:false,groupSelection:true});});tokenIds.forEach((id,i)=>{const token=layer?.get(id);if(token)token.setTarget(true,{user:game.user,releaseOthers:i===0,groupSelection:i<tokenIds.length-1});});}else if(typeof u.updateTokenTargets==="function")u.updateTokenTargets(tokenIds);return tokenIds;}
function syncFoundryControls(tokenIds=[]){const layer=canvas?.tokens;if(!layer)return;layer.controlled.filter(t=>t.document?.getFlag(MODULE_ID,FLAG_PROXY)).forEach(t=>{if(!tokenIds.includes(t.id))t.release();});tokenIds.forEach((id,i)=>{const token=layer.get(id);if(token&&!token.controlled)token.control({releaseOthers:i===0});});}
async function setTargets(scene,ids,u=game.user,d=getData(scene)){const unique=ids?.length?[...new Set(ids)]:[];if(unique.length)LOCAL_TARGETS.set(scene.id,unique);else LOCAL_TARGETS.delete(scene.id);const tokenIds=await syncFoundryTargets(scene,d,unique,u);if(u===game.user)syncFoundryControls(tokenIds);refreshUI(scene);}
function targetableEnemies(d){return(d.enemies||[]).map(normalizeEnemyEntry).filter(e=>{const res=getRes(e);const hp=res.find(r=>r.label==="HP")?.value??1;return hp>0&&e.transitionState!=="out";});}
function typingInField(e){const t=e.target;return !!(t&&((t.tagName==="INPUT")||(t.tagName==="TEXTAREA")||(t.tagName==="SELECT")||t.isContentEditable));}
async function toggleEnemyTarget(scene,d,enemyId,{exclusive=true}={}){const cur=getTargets(scene),next=exclusive?(cur[0]===enemyId?[]:[enemyId]):(cur.includes(enemyId)?cur.filter(id=>id!==enemyId):[...cur,enemyId]);await setTargets(scene,next,game.user,d);}
async function targetNextEnemy(scene,d){const enemies=targetableEnemies(d);if(!enemies.length){ui.notifications.warn("No enemies available to target.");return;}const cur=getTargets(scene)[0],idx=enemies.findIndex(e=>enemyTargetId(e)===cur),next=enemies[(idx+1)%enemies.length];await setTargets(scene,next?[enemyTargetId(next)]:[],game.user,d);}
async function targetRandomEnemy(scene,d){const enemies=targetableEnemies(d);if(!enemies.length){ui.notifications.warn("No enemies available to target.");return;}const next=enemies[Math.floor(Math.random()*enemies.length)];await setTargets(scene,next?[enemyTargetId(next)]:[],game.user,d);}
async function targetRandomPlayer(scene,d){const players=(d.actors||[]).filter(a=>a.visible!==false);if(!players.length){ui.notifications.warn("No players available to target.");return;}const next=players[Math.floor(Math.random()*players.length)];if(!await syncActorTargets(next.id,{exclusive:true},scene))ui.notifications.warn("No scene token found for that player.");refreshUI(scene);}
async function targetNextPlayer(scene,d){const players=(d.actors||[]).filter(a=>a.visible!==false);if(!players.length){ui.notifications.warn("No players available to target.");return;}const current=players.findIndex(a=>isActorTargeted(a.id,scene));const next=players[(current+1)%players.length];if(!await syncActorTargets(next.id,{exclusive:true},scene))ui.notifications.warn("No scene token found for that player.");refreshUI(scene);}
async function pruneEnemyTokenDocs(scene,d){if(!scene||!isGM())return;const keep=new Set((d.enemies||[]).map(e=>e.tokenId).filter(Boolean));const stale=scene.tokens.filter(t=>t.getFlag(MODULE_ID,FLAG_PROXY)&&!keep.has(t.id)).map(t=>t.id);if(stale.length)await scene.deleteEmbeddedDocuments("Token",stale);}
async function prunePlayerTokenDocs(scene,d){if(!scene||!isGM())return;const keep=new Set((d.actors||[]).map(a=>a.id));const stale=scene.tokens.filter(t=>t.getFlag(MODULE_ID,FLAG_PLAYER_PROXY)&&!keep.has(t.actor?.id)).map(t=>t.id);if(stale.length)await scene.deleteEmbeddedDocuments("Token",stale);}
async function clearEncounterState(scene,d){
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
  refreshUI(scene);
}
async function clearCurrentBackgroundProps(scene,d){
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
  refreshUI(scene);
  ui.notifications.warn("Cleared all props on the current background.");
}
async function addQuestPin(scene,d){
  const key=String(d.background||"");
  if(!d.questPinsByBackground || typeof d.questPinsByBackground!=="object" || Array.isArray(d.questPinsByBackground)) d.questPinsByBackground={};
  if(!Array.isArray(d.questPinsByBackground[key])) d.questPinsByBackground[key]=[];
  const pin={id:foundry.utils.randomID(),type:"quest",label:"Quest",posX:50,posY:50,scale:100,backgroundKey:key,image:getQuestPinImage("quest")};
  d.questPinsByBackground[key].push(pin);
  d.questPins=d.questPinsByBackground[key].map(p=>foundry.utils.deepClone(p));
  await saveData(scene,d);
  emit();
  refreshUI(scene);
  setTimeout(()=>openDragPos(pin,scene,d,async()=>{d.questPins=d.questPinsByBackground[key].map(p=>foundry.utils.deepClone(p));await saveData(scene,d);emit();refreshUI(scene);}),30);
}

function getEnemyHp(enemy,scene=game.scenes.viewed){return getRes(enemy,scene,{enemy:true,auto:true}).find(r=>r.label==="HP")?.value??null;}
async function removeEnemyInstance(scene,d,targetId){const idx=(d.enemies||[]).findIndex(e=>enemyTargetId(normalizeEnemyEntry(e))===targetId);if(idx<0)return;d.enemies.splice(idx,1);await setTargets(scene,getTargets(scene).filter(id=>id!==targetId),game.user,d);await pruneEnemyTokenDocs(scene,d);await saveData(scene,d);emit();refreshUI(scene);}
async function fadeOutEnemy(scene,d,enemy){normalizeEnemyEntry(enemy);if(enemy.transitionState==="out"||enemy.pendingPhasePrompt)return;enemy.transitionState="out";enemy.transitionAt=Date.now();enemy.pendingPhasePrompt=false;await saveData(scene,d);emit();refreshUI(scene);const targetId=enemyTargetId(enemy);setTimeout(async()=>{const live=getData(scene);await removeEnemyInstance(scene,live,targetId);},ENEMY_FADE_MS);}
async function transitionEnemyPhase(scene,d,enemy){normalizeEnemyEntry(enemy);if(enemy.transitionState==="phase-out")return;enemy.transitionState="phase-out";enemy.transitionAt=Date.now();enemy.pendingPhasePrompt=false;await saveData(scene,d);emit();refreshUI(scene);const targetId=enemyTargetId(enemy);setTimeout(async()=>{const live=getData(scene);const current=getEnemyByTargetId(live,targetId);if(!current)return;const nextActor=game.actors.get(current.nextFormId);if(!nextActor){await fadeOutEnemy(scene,live,current);return;}const nextEntry=makeEnemyEntry(nextActor,{instanceId:current.instanceId,posX:current.nextPosX??current.posX,posY:current.nextPosY??current.posY,scale:current.nextScale??current.scale,phaseEnabled:false,phaseUsed:true,transitionState:"phase-in",transitionAt:Date.now(),pendingPhasePrompt:false});Object.assign(current,nextEntry);current.tokenId=null;await pruneEnemyTokenDocs(scene,live);await ensureEnemyTokenDocs(scene,live);await saveData(scene,live);emit();refreshUI(scene);},ENEMY_FADE_MS);}
async function promptEnemyPhase(scene,d,enemy){
  normalizeEnemyEntry(enemy);
  if(enemy.pendingPhasePrompt)return;
  enemy.pendingPhasePrompt=true;
  await saveData(scene,d);
  emit();
  refreshUI(scene);
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
async function checkEncounterEnemyStates(scene,d){if(!isGM()||!scene||!isTOTM(scene))return;for(const enemy of d.enemies||[]){normalizeEnemyEntry(enemy);const hp=getEnemyHp(enemy,scene);if(hp==null||hp>0)continue;if(enemy.transitionState==="out"||enemy.transitionState==="phase-out"||enemy.pendingPhasePrompt)continue;if(enemy.phaseEnabled&&enemy.nextFormId&&!enemy.phaseUsed){await promptEnemyPhase(scene,d,enemy);return;}await fadeOutEnemy(scene,d,enemy);return;}}

// Sidebar
let sRO=null,sMO=null;
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
async function saveAndRefresh(scene,d){await saveData(scene,d);emit();refreshUI(scene);}
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
  emit();
  if(scene.id===game.scenes.viewed?.id)requestSceneRefresh(scene);
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
async function toggleActorPin(scene,d,idx){const actor=d.actors?.[idx];if(!actor||!canControlActorPin(actor.id))return;actor.pinVisible=!actor.pinVisible;if(actor.pinVisible){if(!Number.isFinite(+actor.pinX))actor.pinX=50;if(!Number.isFinite(+actor.pinY))actor.pinY=50;if(!Number.isFinite(+actor.pinSize))actor.pinSize=64;}if(!isGM()){emitPinToggle(scene.id,{owner:"actor",actorId:actor.id,visible:actor.pinVisible,x:actor.pinX,y:actor.pinY,size:actor.pinSize});refreshUI(scene);return;}await saveAndRefresh(scene,d);}
async function toggleGmPin(scene,d){if(!canControlGmPin())return;if(!d.gmPin)d.gmPin={visible:false,image:"",size:64,posX:50,posY:50};d.gmPin.visible=!d.gmPin.visible;if(d.gmPin.visible){if(!Number.isFinite(+d.gmPin.posX))d.gmPin.posX=50;if(!Number.isFinite(+d.gmPin.posY))d.gmPin.posY=50;if(!Number.isFinite(+d.gmPin.size))d.gmPin.size=64;}await saveAndRefresh(scene,d);}
function openActorPinCfg(scene,d,idx){const actor=d.actors?.[idx];if(!actor||!canControlActorPin(actor.id))return;new Dialog({title:`Pin Settings â€“ ${actor.name}`,content:`<form><div class="form-group"><label>Pin Image</label><div style="display:flex;gap:6px;"><input name="img" value="${actor.pinImg||actor.img||""}" style="flex:1;"/><button type="button" id="pin-browse"><i class="fas fa-file-image"></i></button></div></div><div class="form-group"><label>Pin Size</label><input type="range" name="size" min="24" max="140" step="2" value="${actor.pinSize??64}"/></div><div class="totm-pin-preview" style="display:flex;justify-content:center;align-items:center;padding:8px;"><div style="width:${actor.pinSize??64}px;height:${actor.pinSize??64}px;border-radius:999px;border:2px solid rgba(255,255,255,.7);background:#0b1020 center/cover no-repeat;background-image:url('${actor.pinImg||actor.img||""}');"></div></div></form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async h=>{actor.pinImg=String(h.find("[name=img]").val()||"").trim()||actor.img;actor.pinSize=Number(h.find("[name=size]").val()||64);if(!isGM()){emitPinConfig(scene.id,{owner:"actor",actorId:actor.id,image:actor.pinImg,size:actor.pinSize});refreshUI(scene);return;}await saveAndRefresh(scene,d);}}},default:"save",render:h=>{const update=()=>{const img=String(h.find("[name=img]").val()||"").trim()||actor.img;const size=Number(h.find("[name=size]").val()||64);const pv=h[0].querySelector(".totm-pin-preview > div");if(pv){pv.style.width=`${size}px`;pv.style.height=`${size}px`;pv.style.backgroundImage=`url('${img}')`;}};h.find("#pin-browse").on("click",()=>new FilePicker({type:"image",callback:p=>{h.find("[name=img]").val(p);update();}}).browse());h.find("[name=img],[name=size]").on("input change",update);}}).render(true);}
function openGmPinCfg(scene,d){if(!canControlGmPin())return;if(!d.gmPin)d.gmPin={visible:false,image:"",size:64,posX:50,posY:50};new Dialog({title:"GM Pin Settings",content:`<form><div class="form-group"><label>Pin Image</label><div style="display:flex;gap:6px;"><input name="img" value="${d.gmPin.image||game.user.avatar||game.user.character?.img||""}" style="flex:1;"/><button type="button" id="pin-browse"><i class="fas fa-file-image"></i></button></div></div><div class="form-group"><label>Pin Size</label><input type="range" name="size" min="24" max="140" step="2" value="${d.gmPin.size??64}"/></div><div class="totm-pin-preview" style="display:flex;justify-content:center;align-items:center;padding:8px;"><div style="width:${d.gmPin.size??64}px;height:${d.gmPin.size??64}px;border-radius:999px;border:2px solid rgba(255,255,255,.7);background:#0b1020 center/cover no-repeat;background-image:url('${d.gmPin.image||game.user.avatar||game.user.character?.img||""}');"></div></div></form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async h=>{d.gmPin.image=String(h.find("[name=img]").val()||"").trim()||game.user.avatar||game.user.character?.img||"";d.gmPin.size=Number(h.find("[name=size]").val()||64);await saveAndRefresh(scene,d);}}},default:"save",render:h=>{const update=()=>{const img=String(h.find("[name=img]").val()||"").trim()||game.user.avatar||game.user.character?.img||"";const size=Number(h.find("[name=size]").val()||64);const pv=h[0].querySelector(".totm-pin-preview > div");if(pv){pv.style.width=`${size}px`;pv.style.height=`${size}px`;pv.style.backgroundImage=`url('${img}')`;}};h.find("#pin-browse").on("click",()=>new FilePicker({type:"image",callback:p=>{h.find("[name=img]").val(p);update();}}).browse());h.find("[name=img],[name=size]").on("input change",update);}}).render(true);}
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
function startSB(){stopSB();const sb=document.getElementById("sidebar");if(!sb)return;sRO=new ResizeObserver(()=>{fitSB();syncHotbarPosition();});sRO.observe(sb);if(sb.parentElement)sRO.observe(sb.parentElement);sMO=new MutationObserver(()=>{requestAnimationFrame(()=>{fitSB();syncHotbarPosition();});setTimeout(()=>{fitSB();syncHotbarPosition();},350);});sMO.observe(sb,{attributes:true,attributeFilter:["class","style"]});}
function stopSB(){if(sRO){sRO.disconnect();sRO=null;}if(sMO){sMO.disconnect();sMO=null;}}
function injectUI(){if(document.getElementById("totm-ui"))return;document.body.appendChild(Object.assign(document.createElement("div"),{id:"totm-ui"}));}
function activate(s){document.body.classList.add("totm-active");injectUI();refreshUI(s);fitSB();syncHotbarPosition();startSB();setTimeout(()=>{fitSB();syncHotbarPosition();},50);setTimeout(()=>{fitSB();syncHotbarPosition();},200);}
function deactivate(){document.body.classList.remove("totm-active");const el=document.getElementById("totm-ui");if(el)el.innerHTML="";stopSB();syncHotbarPosition();}

// â”€â”€ RENDER â”€â”€
function refreshUI(scene){
  const el=document.getElementById("totm-ui");if(!el)return;
  const d=getData(scene);
  const theme=getThemeMeta(d.style);
  el.dataset.style=theme.id;
  el.style.setProperty("--totm-target-color",getUserTargetColor());
  if(!isGM()&&!d.shared){el.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--totm-text-faint);font-size:14px;">The GM is preparingâ€¦</div>`;return;}

  const sceneImgs=buildStageSceneImagesModule({d,scene,deps:{getPinImage,canControlActorPin,getActorPinColor,getGmPinColor,canControlGmPin,getTargets,normalizeEnemyEntry,getEncounterActor,ENEMY_FADE_MS,enemyTargetId,getQuestPinImage}});

  // Background with position/zoom
  const bgStyle=d.background?`background-image:url('${d.background}');background-position:${d.bgPosX??50}% ${d.bgPosY??50}%;background-size:${d.bgZoom??100}%`:"";
  const bgFadeClass=d.bgFadeAt&&Date.now()-d.bgFadeAt<BG_FADE_MS+150?"totm-bg-fade":"";

  el.innerHTML=`
    <div id="totm-bg-layer" class="${bgFadeClass}" style="${bgStyle}"></div>
    <div class="totm-layout">
      <div class="totm-main-row">
        <div id="totm-actor-panel">
          <div class="totm-panel-header"><h3>Players</h3>${isGM()?`<div class="totm-header-btns"><button class="totm-btn-sm" id="totm-random-player" title="Random Player Target"><i class="fas fa-dice"></i></button><button class="totm-btn-sm" id="totm-add-actor"><i class="fas fa-plus"></i></button></div>`:""}</div>
          <div id="totm-actor-list">${renderCards(d)}</div>
        </div>
        <div id="totm-main">
          ${isGM()?renderTopbar(d,scene):""}
          ${renderClockDock()}
          <div id="totm-stage-wrap"><div id="totm-stage">${sceneImgs.join("")}</div><div id="totm-art-area"><div id="totm-art-display">${renderArt(d)}</div></div></div>
          ${d.narration?`<div id="totm-narration"><div class="totm-narration-inner"><div class="totm-narration-text">${d.narration}</div></div></div>`:""}
        </div>
      </div>
      <div id="totm-hotbar-slot">${renderTotmHotbar()}</div>
      ${renderEnemyBar(d)}
    </div>`;
  bindEvents(scene,d);bindStagePins(scene,d,el);fitSB();syncHotbarPosition();
}

function renderCards(d){return renderPlayerCardsModule({d,scene:game.scenes.viewed,deps:{isGM,getConds,MODULE_ID,getActorStatus,isActorTargeted,getRes,getImg,getFabulaPoints,rPath,renderBars,canControlActorPin}});}

function renderBars(res,{kind="default"}={}){if(!res.length)return"";const slim=kind==="enemy";return`<div class="totm-resource-bars ${slim?"enemy-bars":"player-bars"}">${res.map(r=>{const p=Math.max(0,Math.min(100,(r.value/r.max)*100)),l=r.color==="res-hp"?(p<=25?"crit":p<=50?"low":""):"";return`<div class="totm-resource-row ${slim?"is-thin":""}"><span class="totm-resource-icon ${r.color}-label ${slim?"thin-icon":""}">${slim?"":`<i class="${r.icon}"></i>`}</span><span class="totm-resource-lbl ${slim?"thin-lbl":""}">${slim?"":r.label}</span><div class="totm-resource-bar ${slim?"thin-bar":""}"><div class="totm-resource-fill ${r.color} ${l}" style="width:${p}%"></div></div><span class="totm-resource-value ${slim?"thin-value":""}">${slim?"":`${r.value}/${r.max}`}</span></div>`;}).join("")}</div>`;}

function renderArt(d){if(d.featuredArt)return`<img src="${d.featuredArt}"/>${d.featuredCaption?`<div class="totm-caption">${d.featuredCaption}</div>`:""}`;return"";}

function renderEnemyBar(d){return renderEnemyBarModule({d,scene:game.scenes.viewed,deps:{getTargets,normalizeEnemyEntry,getEncounterActor,getRes,enemyTargetId,getEnemyTargetUsers,ENEMY_FADE_MS,isGM,renderBars}});}
function renderClockDock(){if(!hasClockModule())return"";const clocks=getClockEntries(),canEdit=window.clockDatabase?.canUserEdit?.(game.user),controls=clock=>clock.editable?`<button class="totm-clock-delete" data-clock-act="delete" data-clock-id="${clock.id}" title="Delete Clock"><i class="fas fa-trash"></i></button>`:"";return`<div id="totm-clock-dock" class="${CLOCKS_OPEN?"is-open":"is-closed"}"><div class="totm-clock-dock-head"><div class="totm-clock-title"><i class="fas fa-clock"></i> Clocks</div><div class="totm-clock-dock-actions">${canEdit?`<button class="totm-btn-sm" id="totm-clock-add" title="Add Clock"><i class="fas fa-plus"></i></button>`:""}<div class="totm-clock-count">${clocks.length}</div></div></div>${clocks.length?`<div class="totm-clock-list">${clocks.map(clock=>clock.type==="tracker"?`<div class="totm-clock-entry ${clock.editable?"editable":""}" data-clock-id="${clock.id}" data-clock-type="${clock.type}" style="--clock-color:${clock.color};--clock-bg:${clock.backgroundColor};"><div class="totm-clock-main"><div class="totm-clock-meta"><span class="totm-clock-name">${clock.private?`<i class="fas fa-eye-slash"></i> `:""}${clock.name}</span><span class="totm-clock-value">${clock.value}/${clock.max}</span></div><div class="totm-clock-tracker">${clock.slashes.map(f=>`<span class="totm-clock-slash ${f?"filled":""}"></span>`).join("")}</div></div>${controls(clock)}</div>`:clock.type==="points"?`<div class="totm-clock-entry points ${clock.editable?"editable":""}" data-clock-id="${clock.id}" data-clock-type="${clock.type}" style="--clock-color:${clock.color};--clock-bg:${clock.backgroundColor};"><div class="totm-clock-main"><div class="totm-clock-meta"><span class="totm-clock-name">${clock.private?`<i class="fas fa-eye-slash"></i> `:""}${clock.name}</span><span class="totm-clock-points">${clock.value}</span></div></div>${controls(clock)}</div>`:`<div class="totm-clock-entry ${clock.editable?"editable":""}" data-clock-id="${clock.id}" data-clock-type="${clock.type}" style="--clock-color:${clock.color};--clock-bg:${clock.backgroundColor};--clock-pct:${Math.round(clock.ratio*100)}%;"><div class="totm-clock-main"><div class="totm-clock-ring"><div class="totm-clock-ring-inner">${clock.value}/${clock.max}</div></div><div class="totm-clock-meta"><span class="totm-clock-name">${clock.private?`<i class="fas fa-eye-slash"></i> `:""}${clock.name}</span></div></div>${controls(clock)}</div>`).join("")}</div>`:`<div class="totm-clock-empty">No clocks yet.</div>`}</div>`;}

function renderTopbar(d,scene){return renderTopbarModule({d,scene,deps:{getThemeMeta,hasClockModule,getClockEntries}});}

// â”€â”€ EVENTS â”€â”€
function bindEvents(scene,d){
  const el=document.getElementById("totm-ui");if(!el)return;
  const hotbarSlot=el.querySelector("#totm-hotbar-slot");
  bindTotmHotbarDropZone(hotbarSlot);
  bindTotmHotbarUi(el,{refresh:()=>{const s=game.scenes.viewed;if(s&&isTOTM(s))refreshUI(s);}});
  if(isGM()){
    bindSceneAdminEventsModule({el,scene,d,deps:{openMasterLibraryPicker,openBgPicker,openNpcPicker,openEncPicker,CLOCKS_OPEN_ref:()=>CLOCKS_OPEN,setCLOCKS_OPEN:v=>{CLOCKS_OPEN=v;},refreshUI,nextThemeId,getThemeMeta,saveData,emit,openBgCfg,clearCurrentBackgroundProps,addQuestPin,toggleGmPin,openGmPinCfg,clearEncounterState}});
  }
  el.querySelector("#totm-clock-add")?.addEventListener("click",e=>{e.stopPropagation();openClockCreateDialog();});
  el.querySelectorAll("[data-clock-act='delete']").forEach(btn=>btn.addEventListener("click",async e=>{e.stopPropagation();await deleteClock(e.currentTarget.dataset.clockId);refreshUI(scene);}));
  el.querySelector("#totm-clock-dock")?.addEventListener("click",async e=>{const entry=e.target.closest("[data-clock-id]");if(!entry)return;await stepClock(entry.dataset.clockId,1);refreshUI(scene);});
  el.querySelector("#totm-clock-dock")?.addEventListener("contextmenu",async e=>{const entry=e.target.closest("[data-clock-id]");if(!entry)return;e.preventDefault();await stepClock(entry.dataset.clockId,-1);refreshUI(scene);});
  bindPlayerPanelEventsModule({el,scene,d,deps:{isGM,saveData,emit,refreshUI,targetRandomPlayer,pickActor,togglePlayerTarget,toggleActorPin,openActorPinCfg,openActorCfg,togCondDD,makeEntry,toggleActorAfkStatus}});
  bindEnemyStageEventsModule({el,scene,d,deps:{isGM,setTargets,getTargets,targetRandomEnemy,targetNextEnemy,toggleEnemyTarget,getEncounterActor,pruneEnemyTokenDocs,saveData,emit,refreshUI,makeEnemyEntry,ensureEnemyTokenDocs,openDragPos,getQuestPinImage}});

  document.addEventListener("click",e=>{document.querySelectorAll(".totm-cond-dropdown").forEach(x=>x.remove());if(!e.target.closest(".totm-bg-dropdown")&&!e.target.closest(".totm-tb-btn"))el.querySelectorAll(".totm-bg-dropdown").forEach(x=>x.style.display="none");});
}

function togCondDD(card,scene,d,idx){document.querySelectorAll(".totm-cond-dropdown").forEach(x=>x.remove());const conds=getConds(),ac=d.actors[idx].conditions||[];const bar=card.querySelector(".totm-actor-status-bar");if(!bar)return;const dd=document.createElement("div");dd.className="totm-cond-dropdown";dd.addEventListener("click",e=>e.stopPropagation());dd.innerHTML=conds.map(c=>`<button data-cid="${c.id}" class="${ac.includes(c.id)?"has-condition":""}"><i class="${c.icon}"></i> ${c.label}</button>`).join("");dd.addEventListener("click",async e=>{const b=e.target.closest("[data-cid]");if(!b)return;if(!d.actors[idx].conditions)d.actors[idx].conditions=[];const arr=d.actors[idx].conditions,ei=arr.indexOf(b.dataset.cid);if(ei>=0)arr.splice(ei,1);else arr.push(b.dataset.cid);await saveData(scene,d);emit();refreshUI(scene);});bar.appendChild(dd);}

// â”€â”€ BG CONFIG (position/zoom) â”€â”€
function openBgCfg(scene,d){
  new Dialog({title:"Background Position",content:`<form>
    <div class="form-group"><label>Horizontal</label><div style="display:flex;gap:6px;align-items:center;"><span style="font-size:10px;">L</span><input type="range" name="x" min="0" max="100" value="${d.bgPosX??50}" style="flex:1;"/><span style="font-size:10px;">R</span></div></div>
    <div class="form-group"><label>Vertical</label><div style="display:flex;gap:6px;align-items:center;"><span style="font-size:10px;">Top</span><input type="range" name="y" min="0" max="100" value="${d.bgPosY??50}" style="flex:1;"/><span style="font-size:10px;">Bot</span></div></div>
    <div class="form-group"><label>Zoom</label><div style="display:flex;gap:6px;align-items:center;"><span style="font-size:10px;">Fit</span><input type="range" name="z" min="100" max="300" value="${d.bgZoom??100}" step="5" style="flex:1;"/><span style="font-size:10px;">Close</span></div></div>
  </form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async h=>{d.bgPosX=+h.find("[name=x]").val();d.bgPosY=+h.find("[name=y]").val();d.bgZoom=+h.find("[name=z]").val();await saveData(scene,d);emit();refreshUI(scene);}}},default:"save",render:h=>{const bg=document.getElementById("totm-bg-layer");if(bg)h.find("input[type=range]").on("input",()=>{bg.style.backgroundPosition=`${h.find("[name=x]").val()}% ${h.find("[name=y]").val()}%`;bg.style.backgroundSize=`${h.find("[name=z]").val()}%`;});}}).render(true);
}

// â”€â”€ DROPDOWNS â”€â”€
function renderBgDD(c,scene,d){const bgs=(d.backgrounds||[]).map((b,i)=>({...b,_idx:i}));if(!bgs.length){c.innerHTML=`<div style="padding:10px;text-align:center;color:#888;font-size:11px;">No backgrounds.</div>`;return;}const gr={};bgs.forEach(b=>{const cat=b.category||"â€”";if(!gr[cat])gr[cat]=[];gr[cat].push(b);});c.innerHTML=Object.entries(gr).sort(([a],[b])=>a.localeCompare(b)).map(([cat,items])=>`<div class="totm-bg-category"><div class="totm-bg-cat-label">${cat}</div>${items.map(b=>`<button class="totm-bg-item ${d.background===b.image?"active":""}" data-bi="${b._idx}"><span class="totm-bg-thumb" style="background-image:url('${b.image}')"></span><span class="totm-bg-name">${b.name}</span></button>`).join("")}</div>`).join("");c.querySelectorAll(".totm-bg-item").forEach(b=>b.addEventListener("click",async()=>{const bg=d.backgrounds?.[+b.dataset.bi];if(!bg)return;setSceneBg(d,bg);d.narration=bg.narration||"";await saveData(scene,d);emit();refreshUI(scene);}));}

function renderNpcDD(c,scene,d){const npcs=d.npcs||[];if(!npcs.length){c.innerHTML=`<div style="padding:10px;text-align:center;color:#888;font-size:11px;">No NPCs.</div>`;return;}c.innerHTML=npcs.map((n,i)=>`<button class="totm-bg-item ${n.visible?"active":""}" data-i="${i}"><span class="totm-bg-thumb" style="background-image:url('${n.image}')"></span><span class="totm-bg-name">${n.name}</span><i class="fas fa-${n.visible?"eye":"eye-slash"}" style="color:${n.visible?"var(--totm-gold)":"#666"};font-size:10px;"></i></button>`).join("");c.querySelectorAll("[data-i]").forEach(b=>b.addEventListener("click",async()=>{d.npcs[+b.dataset.i].visible=!d.npcs[+b.dataset.i].visible;await saveData(scene,d);emit();refreshUI(scene);}));}

function renderEncDD(c,scene,d){const encs=d.encounters||[];if(!encs.length){c.innerHTML=`<div style="padding:10px;text-align:center;color:#888;font-size:11px;">No encounters set up.</div>`;return;}c.innerHTML=encs.map((enc,i)=>`<button class="totm-bg-item" data-ei="${i}"><i class="fas fa-dragon" style="color:var(--totm-danger);"></i><span class="totm-bg-name">${enc.name} <span style="color:#888;font-size:9px;">(${enc.enemies.length})</span></span></button>`).join("");c.querySelectorAll("[data-ei]").forEach(b=>b.addEventListener("click",async()=>{const enc=encs[+b.dataset.ei];if(!enc)return;if(!d.preEncounterView)d.preEncounterView={background:d.background,bgPosX:d.bgPosX,bgPosY:d.bgPosY,bgZoom:d.bgZoom,narration:d.narration,featuredArt:d.featuredArt||"",featuredCaption:d.featuredCaption||""};if(enc.background){setSceneBg(d,enc,{animate:true});d.narration=enc.narration||"";}d.enemies=enc.enemies.map(e=>{const a=game.actors.get(e.id);if(!a)return null;const base=makeEnemyEntry(a,{instanceId:e.instanceId||makeEnemyInstanceId(),image:e.image||a.prototypeToken?.texture?.src||a.img||"icons/svg/mystery-man.svg",posX:e.posX??50,posY:e.posY??70,scale:e.scale??100,tokenId:e.tokenId??null,phaseEnabled:!!e.phaseEnabled,nextFormId:e.nextFormId||"",nextFormName:e.nextFormName||"",nextFormImage:e.nextFormImage||"",nextPosX:e.nextPosX??null,nextPosY:e.nextPosY??null,nextScale:e.nextScale??null,phaseUsed:false,transitionState:"",transitionAt:0,pendingPhasePrompt:false});return base;}).filter(Boolean);await ensureEnemyTokenDocs(scene,d);await pruneEnemyTokenDocs(scene,d);await setTargets(scene,[],game.user,d);await saveData(scene,d);emit();refreshUI(scene);ui.notifications.info(`Encounter: ${enc.name}`);}));}

function activateEncounter(scene,d,enc){
  if(!enc)return;
  if(!d.preEncounterView)d.preEncounterView={background:d.background,bgPosX:d.bgPosX,bgPosY:d.bgPosY,bgZoom:d.bgZoom,narration:d.narration,featuredArt:d.featuredArt||"",featuredCaption:d.featuredCaption||""};
  if(enc.background){setSceneBg(d,enc,{animate:true});d.narration=enc.narration||"";}
  d.enemies=enc.enemies.map(e=>{
    const a=game.actors.get(e.id);
    if(!a)return null;
    return makeEnemyEntry(a,{instanceId:e.instanceId||makeEnemyInstanceId(),image:e.image||a.prototypeToken?.texture?.src||a.img||"icons/svg/mystery-man.svg",posX:e.posX??50,posY:e.posY??70,scale:e.scale??100,tokenId:e.tokenId??null,phaseEnabled:!!e.phaseEnabled,nextFormId:e.nextFormId||"",nextFormName:e.nextFormName||"",nextFormImage:e.nextFormImage||"",nextPosX:e.nextPosX??null,nextPosY:e.nextPosY??null,nextScale:e.nextScale??null,phaseUsed:false,transitionState:"",transitionAt:0,pendingPhasePrompt:false});
  }).filter(Boolean);
  return ensureEnemyTokenDocs(scene,d)
    .then(()=>pruneEnemyTokenDocs(scene,d))
    .then(()=>setTargets(scene,[],game.user,d))
    .then(()=>saveData(scene,d))
    .then(()=>{emit();refreshUI(scene);ui.notifications.info(`Encounter: ${enc.name}`);});
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

function openLibraryPicker({title,placeholder="Search...",items=[],renderRow,onPick,emptyText="Nothing here yet.",getTabs=()=>[],headerActions=[]}){
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
        app.style.width="960px";
        app.style.maxWidth="92vw";
        app.style.height="760px";
        app.style.minWidth="680px";
        app.style.minHeight="520px";
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
        if(action.closeOnClick!==false)html.closest(".app")?.querySelector?.(".header-button.close")?.click?.();
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
        html.closest(".app")?.querySelector?.(".header-button.close")?.click?.();
      }));
      filter();
      setTimeout(()=>search?.focus(),0);
    }
  }));
  dlg.render(true);
}

function openBgPicker(scene,d){
  const items=(d.backgrounds||[]).map((bg,index)=>({
    ...bg,
    _idx:index,
    searchText:[bg.name,bg.category,bg.tags,bg.narration].filter(Boolean).join(" ")
  }));
  openLibraryPicker({
    title:"Choose Background",
    placeholder:"Search backgrounds...",
    items,
    emptyText:"No backgrounds saved yet.",
    getTabs:bg=>[bg.category,...(Array.isArray(bg.tags)?bg.tags:String(bg.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
    headerActions:[{label:"Manage",icon:"fas fa-folder-open",onClick:()=>openBgMgr(scene,d)}],
    renderRow:bg=>`<span class="totm-picker-card-media totm-picker-thumb" style="background-image:url('${bg.image}')">${d.background===bg.image?`<span class="totm-picker-state">Current</span>`:""}</span><span class="totm-picker-main"><span class="totm-picker-title">${bg.name}</span><span class="totm-picker-meta">${bg.category||"Uncategorized"}</span></span>`,
    onPick:async bg=>{const live=getData(scene);setSceneBg(live,bg);live.narration=bg.narration||"";await saveData(scene,live);emit();refreshUI(scene);}
  });
}

function openNpcPicker(scene,d){
  const items=(d.npcs||[]).map((npc,index)=>({
    ...npc,
    _idx:index,
    searchText:[npc.name,npc.category,npc.tags,npc.visible?"visible":"hidden"].filter(Boolean).join(" ")
  }));
  openLibraryPicker({
    title:"NPC Roster",
    placeholder:"Search NPCs...",
    items,
    emptyText:"No NPCs saved yet.",
    getTabs:npc=>[npc.category,...(Array.isArray(npc.tags)?npc.tags:String(npc.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
    headerActions:[{label:"Manage",icon:"fas fa-users-cog",onClick:()=>openNpcMgr(scene,d)}],
    renderRow:npc=>`<span class="totm-picker-card-media totm-picker-thumb" style="background-image:url('${npc.image}')"><span class="totm-picker-state">${npc.visible?"Shown":"Hidden"}</span></span><span class="totm-picker-main"><span class="totm-picker-title">${npc.name}</span><span class="totm-picker-meta">${npc.category||"Untagged"}</span></span>`,
    onPick:async npc=>{
      const liveData=getData(scene);
      const live=liveData.npcs?.[npc._idx];
      if(!live)return;
      live.visible=!live.visible;
      await saveData(scene,liveData);
      emit();
      refreshUI(scene);
    }
  });
}

function openEncPicker(scene,d){
  const items=(d.encounters||[]).map((enc,index)=>({
    ...enc,
    _idx:index,
    searchText:[enc.name,enc.category,enc.tags,enc.narration,`${enc.enemies?.length||0} enemies`].filter(Boolean).join(" ")
  }));
  openLibraryPicker({
    title:"Start Encounter",
    placeholder:"Search encounters...",
    items,
    emptyText:"No encounters saved yet.",
    getTabs:enc=>[enc.category,...(Array.isArray(enc.tags)?enc.tags:String(enc.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
    headerActions:[{label:"Manage",icon:"fas fa-skull-crossbones",onClick:()=>openEncMgr(scene,d)}],
    renderRow:enc=>`<span class="totm-picker-card-media totm-picker-icon danger"><i class="fas fa-dragon"></i><span class="totm-picker-state">${enc.enemies?.length||0}</span></span><span class="totm-picker-main"><span class="totm-picker-title">${enc.name}</span><span class="totm-picker-meta">${enc.category||"Untagged"}${enc.background?" - custom background":""}</span></span>`,
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
      renderRow:bg=>`<span class="totm-picker-card-media totm-picker-thumb" style="background-image:url('${bg.image}')">${d.background===bg.image?`<span class="totm-picker-state">Current</span>`:""}</span><span class="totm-picker-main"><span class="totm-picker-title">${bg.name}</span><span class="totm-picker-meta">${bg.category||"Uncategorized"}</span></span>`,
      pick:async bg=>{const live=getData(scene);setSceneBg(live,bg);live.narration=bg.narration||"";await saveData(scene,live);emit();refreshUI(scene);},
      manage:()=>openBgMgr(scene,d),
      placeholder:"Search backgrounds..."
    },
    npcs:{
      label:"NPCs",
      items:(d.npcs||[]).map((npc,index)=>({...npc,_idx:index,searchText:[npc.name,npc.category,npc.tags,npc.visible?"visible":"hidden"].filter(Boolean).join(" ")})),
      getTabs:npc=>[npc.category,...(Array.isArray(npc.tags)?npc.tags:String(npc.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
      renderRow:npc=>`<span class="totm-picker-card-media totm-picker-thumb" style="background-image:url('${npc.image}')"><span class="totm-picker-state">${npc.visible?"Shown":"Hidden"}</span></span><span class="totm-picker-main"><span class="totm-picker-title">${npc.name}</span><span class="totm-picker-meta">${npc.category||"Untagged"}</span></span>`,
      pick:async npc=>{const liveData=getData(scene);const live=liveData.npcs?.[npc._idx];if(!live)return;live.visible=!live.visible;await saveData(scene,liveData);emit();refreshUI(scene);},
      manage:()=>openNpcMgr(scene,d),
      placeholder:"Search NPCs..."
    },
    encounters:{
      label:"Encounters",
      items:(d.encounters||[]).map((enc,index)=>({...enc,_idx:index,searchText:[enc.name,enc.category,enc.tags,enc.narration,`${enc.enemies?.length||0} enemies`].filter(Boolean).join(" ")})),
      getTabs:enc=>[enc.category,...(Array.isArray(enc.tags)?enc.tags:String(enc.tags||"").split(",").map(t=>t.trim()).filter(Boolean))],
      renderRow:enc=>`<span class="totm-picker-card-media totm-picker-icon danger"><i class="fas fa-dragon"></i><span class="totm-picker-state">${enc.enemies?.length||0}</span></span><span class="totm-picker-main"><span class="totm-picker-title">${enc.name}</span><span class="totm-picker-meta">${enc.category||"Untagged"}${enc.background?" - custom background":""}</span></span>`,
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
        body.querySelector("[data-master-manage]")?.addEventListener("click",()=>{html.closest(".app")?.querySelector?.(".header-button.close")?.click?.();def.manage();});
        body.querySelectorAll("[data-picker-tab]").forEach(btn=>btn.addEventListener("click",()=>{activeTab=btn.dataset.pickerTab||"all";body.querySelectorAll("[data-picker-tab]").forEach(x=>x.classList.toggle("is-active",x===btn));filter();}));
        body.querySelectorAll("[data-picker-index]").forEach(row=>row.addEventListener("click",async()=>{const picked=rows[Number(row.dataset.pickerIndex)]?.item;if(!picked)return;await def.pick(picked);html.closest(".app")?.querySelector?.(".header-button.close")?.click?.();}));
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

// â”€â”€ MANAGERS â”€â”€
const normalizeTagString=value=>Array.isArray(value)?value.join(", "):String(value||"").split(",").map(t=>t.trim()).filter(Boolean).join(", ");

function openBgMgr(scene,d){if(!d.backgrounds)d.backgrounds=[];new Dialog({title:"Manage Backgrounds",content:`<div style="max-height:400px;overflow-y:auto;"><div id="ml"></div></div><hr style="border-color:#444;margin:8px 0;"><button type="button" id="ma" style="width:100%;padding:6px;cursor:pointer;"><i class="fas fa-plus"></i> Add</button>`,buttons:{done:{icon:'<i class="fas fa-check"></i>',label:"Done",callback:async()=>{await saveData(scene,d);emit();refreshUI(scene);}}},default:"done",render:h=>{function openBgDetails(existing,p,onSave){const n=(existing?.name||p.split("/").pop().replace(/\.\w+$/,""));const cfg=bgCfg(existing||d);new Dialog({title:"Background Details",content:`<form><div class="form-group"><label>Name</label><input name="n" value="${n}"/></div><div class="form-group"><label>Category</label><input name="c" value="${existing?.category||""}" placeholder="Act 1"/></div><div class="form-group"><label>Tags</label><input name="tags" value="${normalizeTagString(existing?.tags)}" placeholder="town, night, danger"/></div><div class="form-group"><label>Narration</label><textarea name="t" style="height:60px;">${existing?.narration||""}</textarea></div><div class="totm-bg-frame-preview" style="height:140px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:url('${p}') ${cfg.bgPosX}% ${cfg.bgPosY}%/${cfg.bgZoom}% no-repeat;margin:8px 0;"></div><div class="form-group"><label>Horizontal</label><input type="range" name="x" min="0" max="100" value="${cfg.bgPosX}"/></div><div class="form-group"><label>Vertical</label><input type="range" name="y" min="0" max="100" value="${cfg.bgPosY}"/></div><div class="form-group"><label>Zoom</label><input type="range" name="z" min="100" max="300" value="${cfg.bgZoom}" step="5"/></div></form>`,buttons:{ok:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:h2=>onSave({name:h2.find("[name=n]").val().trim()||n,image:p,category:h2.find("[name=c]").val().trim()||"Uncategorized",tags:normalizeTagString(h2.find("[name=tags]").val()),narration:h2.find("[name=t]").val().trim(),bgPosX:+h2.find("[name=x]").val(),bgPosY:+h2.find("[name=y]").val(),bgZoom:+h2.find("[name=z]").val()})}},default:"ok",render:h2=>{const pv=h2[0].querySelector(".totm-bg-frame-preview");const upd=()=>{if(pv)pv.style.background=`url('${p}') ${h2.find("[name=x]").val()}% ${h2.find("[name=y]").val()}% / ${h2.find("[name=z]").val()}% no-repeat`;};h2.find("input[type=range]").on("input",upd);}}).render(true);}
    function r(){h.find("#ml").html(d.backgrounds.map((b,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:4px;margin-bottom:3px;"><div style="width:48px;height:32px;border-radius:3px;background:url('${b.image}') ${b.bgPosX??50}% ${b.bgPosY??50}%/${b.bgZoom??100}% no-repeat;flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:11px;font-weight:600;">${b.name}</div><div style="font-size:9px;color:#888;">${b.category||"â€”"} Â· ${b.bgPosX??50}/${b.bgPosY??50}/${b.bgZoom??100}</div></div><button type="button" data-e="${i}" style="background:none;border:none;color:#aaa;cursor:pointer;"><i class="fas fa-pen"></i></button><button type="button" data-d="${i}" style="background:none;border:none;color:#a05050;cursor:pointer;"><i class="fas fa-trash"></i></button></div>`).join("")||'<div style="padding:12px;text-align:center;color:#888;">Empty</div>');h.find("[data-d]").on("click",function(){d.backgrounds.splice(+this.dataset.d,1);r();});h.find("[data-e]").on("click",function(){const i=+this.dataset.e,b=d.backgrounds[i];openBgDetails(b,b.image,upd=>{d.backgrounds[i]={...b,...upd};r();});});}
    r();h.find("#ma").on("click",()=>{new FilePicker({type:"image",callback:p=>openBgDetails(null,p,upd=>{d.backgrounds.push(upd);r();})}).browse();});}}).render(true);}

function openNpcMgr(scene,d){if(!d.npcs)d.npcs=[];new Dialog({title:"NPC Setup",content:`<div style="max-height:400px;overflow-y:auto;"><div id="ml"></div></div><hr style="border-color:#444;margin:8px 0;"><button type="button" id="ma" style="width:100%;padding:6px;cursor:pointer;"><i class="fas fa-plus"></i> Add NPC</button>`,buttons:{done:{icon:'<i class="fas fa-check"></i>',label:"Done",callback:async()=>{await saveData(scene,d);emit();refreshUI(scene);}}},default:"done",render:h=>{function openNpcDetails(existing,p,onSave){const name=existing?.name||p.split("/").pop().replace(/\.\w+$/,"");new Dialog({title:"NPC Details",content:`<form><div class="form-group"><label>Name</label><input name="n" value="${name}"/></div><div class="form-group"><label>Category</label><input name="c" value="${existing?.category||""}" placeholder="Shopkeeper"/></div><div class="form-group"><label>Tags</label><input name="tags" value="${normalizeTagString(existing?.tags)}" placeholder="town, healer, ally"/></div><div class="form-group"><label><input type="checkbox" name="visible" ${existing?.visible?"checked":""}/> Visible on stage</label></div></form>`,buttons:{ok:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:h2=>onSave({...existing,name:h2.find("[name=n]").val().trim()||name,image:p,category:h2.find("[name=c]").val().trim(),tags:normalizeTagString(h2.find("[name=tags]").val()),visible:h2.find("[name=visible]").is(":checked")})}},default:"ok"}).render(true);}
    function r(){h.find("#ml").html(d.npcs.map((n,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:4px;margin-bottom:3px;"><div style="width:40px;height:40px;border-radius:4px;background:url('${n.image}') center/cover;flex-shrink:0;"></div><div style="flex:1;"><div style="font-size:11px;font-weight:600;">${n.name}</div><div style="font-size:9px;color:#888;">${n.category||"Untagged"}${n.tags?` Â· ${normalizeTagString(n.tags)}`:""}</div></div><button type="button" data-meta="${i}" style="background:none;border:none;color:#aaa;cursor:pointer;"><i class="fas fa-pen"></i></button><button type="button" data-pos="${i}" style="background:none;border:none;color:#aaa;cursor:pointer;"><i class="fas fa-arrows-alt"></i></button><button type="button" data-d="${i}" style="background:none;border:none;color:#a05050;cursor:pointer;"><i class="fas fa-trash"></i></button></div>`).join("")||'<div style="padding:12px;text-align:center;color:#888;">No NPCs</div>');h.find("[data-d]").on("click",function(){d.npcs.splice(+this.dataset.d,1);r();});h.find("[data-pos]").on("click",function(){openDragPos(d.npcs[+this.dataset.pos],scene,d,()=>r());});h.find("[data-meta]").on("click",function(){const i=+this.dataset.meta;const npc=d.npcs[i];openNpcDetails(npc,npc.image,upd=>{d.npcs[i]={...npc,...upd};r();});});}
    r();h.find("#ma").on("click",()=>{new FilePicker({type:"image",callback:p=>{const baseName=p.split("/").pop().replace(/\.\w+$/,"");const npc={name:baseName,image:p,posX:50,posY:50,scale:100,visible:false,category:"",tags:""};openNpcDetails(npc,p,upd=>{d.npcs.push(upd);r();setTimeout(()=>openDragPos(upd,scene,d,()=>r()),300);});}}).browse();});}}).render(true);}

// â”€â”€ DRAG POSITION EDITOR â”€â”€
function openDragPos(entity,scene,d,onDone,onDelete){
  const main=document.getElementById("totm-stage");if(!main)return;
  const hiddenSourceEls=[];
  if(entity?.id)main.querySelectorAll(`.totm-scene-prop[data-prop-id="${entity.id}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
  const targetId=enemyTargetId(entity);
  if(targetId)main.querySelectorAll(`.totm-scene-enemy[data-target-id="${targetId}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
  const dragKind=entity?.kind==="prop"?"prop":(entity?.instanceId?"enemy":"npc");
  const ghost=document.createElement("div");ghost.className=`totm-drag-entity is-${dragKind}`;ghost.tabIndex=0;
  ghost.innerHTML=`<img src="${entity.image}"/><div class="totm-drag-label">${entity.name} â€” drag to position, scroll to resize</div>`;
  ghost.style.left=`${entity.posX??50}%`;ghost.style.top=`${entity.posY??50}%`;ghost.style.transform=`translate(-50%,-50%) scale(${(entity.scale??100)/100})`;
  main.appendChild(ghost);
  if(typeof onDelete==="function"&&entity?.kind==="prop"){
    const deleteBtn=document.createElement("button");
    deleteBtn.type="button";
    deleteBtn.className="totm-drag-delete";
    deleteBtn.title="Delete prop";
    deleteBtn.innerHTML='<i class="fas fa-trash"></i>';
    ghost.appendChild(deleteBtn);
  }
  try{ghost.focus({preventScroll:true});}catch{}

  let dragging=false,startX,startY,startLeft,startTop,closed=false;
  ghost.addEventListener("mousedown",e=>{if(e.target.closest(".totm-drag-delete"))return;dragging=true;startX=e.clientX;startY=e.clientY;const r=main.getBoundingClientRect();startLeft=(entity.posX??50)/100*r.width;startTop=(entity.posY??50)/100*r.height;e.preventDefault();});
  document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);

  function onMove(e){if(!dragging)return;const r=main.getBoundingClientRect();const nx=startLeft+(e.clientX-startX),ny=startTop+(e.clientY-startY);entity.posX=Math.max(0,Math.min(100,(nx/r.width)*100));entity.posY=Math.max(0,Math.min(100,(ny/r.height)*100));ghost.style.left=`${entity.posX}%`;ghost.style.top=`${entity.posY}%`;}
  function onUp(){dragging=false;}

  ghost.addEventListener("wheel",e=>{e.preventDefault();entity.scale=(entity.scale||100)+(e.deltaY<0?5:-5);entity.scale=Math.max(20,Math.min(300,entity.scale));ghost.style.transform=`translate(-50%,-50%) scale(${entity.scale/100})`;});

  // Done button overlay
  const doneBtn=document.createElement("button");doneBtn.textContent="âœ“ Done";doneBtn.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:200;padding:8px 24px;font-size:14px;font-weight:700;background:var(--totm-gold);color:#000;border:none;border-radius:6px;cursor:pointer;";
  document.body.appendChild(doneBtn);
  const cleanup=()=>{if(closed)return;closed=true;document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);ghost.remove();doneBtn.remove();hiddenSourceEls.forEach(node=>node.classList.remove("is-being-positioned"));};
  ghost.querySelector(".totm-drag-delete")?.addEventListener("click",async e=>{e.preventDefault();e.stopPropagation();cleanup();await onDelete?.();});
  doneBtn.addEventListener("click",()=>{cleanup();if(onDone)onDone();});
}

function openMultiDragPos(entities,scene,d,onDone){
  const main=document.getElementById("totm-stage");if(!main||!entities?.length)return;
  const cleanups=[];
  entities.forEach((entity,idx)=>{
    const hiddenSourceEls=[];
    if(entity?.id)main.querySelectorAll(`.totm-scene-prop[data-prop-id="${entity.id}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
    const targetId=enemyTargetId(entity);
    if(targetId)main.querySelectorAll(`.totm-scene-enemy[data-target-id="${targetId}"]`).forEach(node=>{node.classList.add("is-being-positioned");hiddenSourceEls.push(node);});
    const dragKind=entity?.kind==="prop"?"prop":(entity?.instanceId?"enemy":"npc");
    const ghost=document.createElement("div");ghost.className=`totm-drag-entity is-${dragKind}`;
  ghost.innerHTML=`<img src="${entity.image}"/><div class="totm-drag-label">${entity.name} Ã¢â‚¬â€ drag to position, scroll to resize${entity?.kind==="prop"?" | Del to delete":""}</div>`;
    ghost.style.left=`${entity.posX??50}%`;ghost.style.top=`${entity.posY??50}%`;ghost.style.transform=`translate(-50%,-50%) scale(${(entity.scale??100)/100})`;ghost.style.zIndex=String(100+idx);
    main.appendChild(ghost);
    let dragging=false,startX,startY,startLeft,startTop;
    const onMove=e=>{if(!dragging)return;const r=main.getBoundingClientRect();const nx=startLeft+(e.clientX-startX),ny=startTop+(e.clientY-startY);entity.posX=Math.max(0,Math.min(100,(nx/r.width)*100));entity.posY=Math.max(0,Math.min(100,(ny/r.height)*100));ghost.style.left=`${entity.posX}%`;ghost.style.top=`${entity.posY}%`;};
    const onUp=()=>{dragging=false;ghost.classList.remove("active-drag");};
    ghost.addEventListener("mousedown",e=>{dragging=true;startX=e.clientX;startY=e.clientY;const r=main.getBoundingClientRect();startLeft=(entity.posX??50)/100*r.width;startTop=(entity.posY??50)/100*r.height;ghost.classList.add("active-drag");e.preventDefault();});
    document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);
    ghost.addEventListener("wheel",e=>{e.preventDefault();entity.scale=(entity.scale||100)+(e.deltaY<0?5:-5);entity.scale=Math.max(20,Math.min(300,entity.scale));ghost.style.transform=`translate(-50%,-50%) scale(${entity.scale/100})`;});
    cleanups.push(()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);ghost.remove();hiddenSourceEls.forEach(node=>node.classList.remove("is-being-positioned"));});
  });
  const doneBtn=document.createElement("button");doneBtn.textContent="Ã¢Å“â€œ Done";doneBtn.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:200;padding:8px 24px;font-size:14px;font-weight:700;background:var(--totm-gold);color:#000;border:none;border-radius:6px;cursor:pointer;";
  document.body.appendChild(doneBtn);
  doneBtn.addEventListener("click",()=>{cleanups.forEach(fn=>fn());doneBtn.remove();if(onDone)onDone();});
}

// â”€â”€ ENCOUNTER MANAGER â”€â”€
function openEncMgr(scene,d){
  if(!d.encounters)d.encounters=[];
  new Dialog({title:"Encounter Setup",content:`<div style="max-height:400px;overflow-y:auto;"><div id="ml"></div></div><hr style="border-color:#444;margin:8px 0;"><button type="button" id="ma" style="width:100%;padding:6px;cursor:pointer;"><i class="fas fa-plus"></i> New Encounter</button>`,buttons:{done:{icon:'<i class="fas fa-check"></i>',label:"Done",callback:async()=>{await saveData(scene,d);emit();refreshUI(scene);}}},default:"done",render:h=>{
    function r(){h.find("#ml").html(d.encounters.map((e,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:4px;margin-bottom:3px;"><i class="fas fa-dragon" style="color:var(--totm-danger);font-size:16px;width:24px;text-align:center;"></i><div style="flex:1;"><div style="font-size:11px;font-weight:600;">${e.name}</div><div style="font-size:9px;color:#888;">${e.category||"Untagged"} Â· ${e.enemies.length} enemies${e.tags?` Â· ${normalizeTagString(e.tags)}`:""}</div></div><button type="button" data-e="${i}" style="background:none;border:none;color:#aaa;cursor:pointer;"><i class="fas fa-pen"></i></button><button type="button" data-d="${i}" style="background:none;border:none;color:#a05050;cursor:pointer;"><i class="fas fa-trash"></i></button></div>`).join("")||'<div style="padding:12px;text-align:center;color:#888;">No encounters</div>');h.find("[data-d]").on("click",function(){d.encounters.splice(+this.dataset.d,1);r();});h.find("[data-e]").on("click",function(){openEncEditor(scene,d,()=>r(),d.encounters[+this.dataset.e],+this.dataset.e);});}r();
    h.find("#ma").on("click",()=>{openEncEditor(scene,d,()=>r());});
  }}).render(true);
}

function buildEncounterEnemyRosterHtml(enemies,actors,villainFight=false){
  const actorOptions=actors.map(a=>`<option value="${a.id}">${a.name}</option>`).join("");
  if(!enemies.length)return `<div style="padding:10px;text-align:center;color:#888;font-size:11px;border:1px dashed rgba(255,255,255,.12);border-radius:6px;">Drag enemy actors here from the Actors sidebar. Drop the same actor multiple times for duplicates.</div>`;
  return `<div class="totm-enc-enemy-list">${enemies.map((enemy,i)=>`<div class="totm-enc-enemy-row" data-eeidx="${i}">
    <img src="${enemy.image}" class="totm-enc-enemy-thumb"/>
    <div class="totm-enc-enemy-main">
      <div class="totm-enc-enemy-name">${enemy.name}</div>
      <div class="totm-enc-enemy-meta">${enemy.id}${villainFight?` Â· ${enemy.phaseEnabled?"villain form set":"normal enemy"}`:""}</div>
      ${villainFight?`<div class="totm-enc-villain-controls">
        <label class="totm-enc-villain-toggle"><input type="checkbox" data-enc-act="villain" data-eeidx="${i}" ${enemy.phaseEnabled?"checked":""}/> Villain</label>
        <select data-enc-act="next-form" data-eeidx="${i}" class="totm-enc-next-form" ${enemy.phaseEnabled?"":"disabled"}>
          <option value="">Next formâ€¦</option>${actorOptions.replace(`value="${enemy.nextFormId||""}"`,`value="${enemy.nextFormId||""}" selected`)}
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
    preview.style.backgroundImage=bg?`url('${bg.replace(/'/g,"\\'")}')`:"none";
    preview.style.backgroundPosition=`${bgx}% ${bgy}%`;
    preview.style.backgroundSize=`${bgz}%`;
    preview.classList.toggle("is-empty",!bg);
  };
  html.find("[name=bg],[name=bgx],[name=bgy],[name=bgz]").on("input change",update);
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
      <div class="totm-enc-preview is-empty" style="height:150px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background-color:rgba(0,0,0,.25);background-repeat:no-repeat;background-position:${startCfg.bgPosX}% ${startCfg.bgPosY}%;background-size:${startCfg.bgZoom}%;position:relative;overflow:hidden;"></div>
      <div style="font-size:10px;color:#888;margin-top:4px;">Live preview of the encounter background framing.</div>
    </div>
    <div class="form-group"><label>Background Horizontal</label><input type="range" name="bgx" min="0" max="100" value="${startCfg.bgPosX}"/></div>
    <div class="form-group"><label>Background Vertical</label><input type="range" name="bgy" min="0" max="100" value="${startCfg.bgPosY}"/></div>
    <div class="form-group"><label>Background Zoom</label><input type="range" name="bgz" min="100" max="300" step="5" value="${startCfg.bgZoom}"/></div>
    <div class="form-group"><label>Narration</label><textarea name="narr" style="height:40px;">${existing?.narration||""}</textarea></div>
    <div class="form-group"><label>Enemies</label><div id="totm-enc-enemy-roster" style="max-height:230px;overflow-y:auto;border:1px solid #555;border-radius:6px;padding:6px;"></div></div>
  </form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save & Position",callback:h=>{
    const enemies=draftEnemies.map(enemy=>foundry.utils.deepClone({...enemy,tokenId:null}));
    const enc={name:h.find("[name=name]").val().trim()||"Encounter",category:h.find("[name=category]").val().trim(),tags:normalizeTagString(h.find("[name=tags]").val()),villainFight:h.find("[name=villainFight]").is(":checked"),background:h.find("[name=bg]").val().trim(),bgPosX:+h.find("[name=bgx]").val(),bgPosY:+h.find("[name=bgy]").val(),bgZoom:+h.find("[name=bgz]").val(),narration:h.find("[name=narr]").val().trim(),enemies};
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

// â”€â”€ ACTOR CONFIG â”€â”€
function openActorCfg(scene,d,idx){const a=d.actors[idx];if(!a)return;const avail=discRes(a.id);function ci(c){return c==="res-hp"?"#5cb85c":c==="res-1"?"#5ba8e0":c==="res-2"?"#b07cc8":"#d0c050";}function brl(r){if(!r.length)return'<div style="color:#888;font-size:11px;padding:6px;text-align:center;">No resources</div>';return r.map((x,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:4px;background:rgba(255,255,255,.03);border-radius:4px;margin-bottom:2px;"><i class="${x.icon}" style="color:${ci(x.color)};"></i><span style="flex:1;font-size:11px;font-weight:600;">${x.label}</span><button type="button" data-rr="${i}" style="background:none;border:none;color:#a05050;cursor:pointer;"><i class="fas fa-times"></i></button></div>`).join("");}function bpo(r){return avail.map(av=>`<option value="${av.path}|${av.maxPath}" ${r.find(x=>x.path===av.path)?"disabled":""}>${av.label} (${av.value}/${av.max})</option>`).join("");}
  new Dialog({title:`Settings â€“ ${a.name}`,content:`<form style="max-height:500px;overflow-y:auto;"><h3 style="border-bottom:1px solid #555;margin:0 0 6px;font-size:12px;">Image</h3><div class="form-group"><label>X</label><input type="range" name="bx" min="0" max="100" value="${a.bgOffsetX??50}"/></div><div class="form-group"><label>Y</label><input type="range" name="by" min="0" max="100" value="${a.bgOffsetY??20}"/></div><div class="form-group"><label>Zoom</label><input type="range" name="bs" min="100" max="400" value="${a.bgScale??150}" step="10"/></div><h3 style="border-bottom:1px solid #555;margin:10px 0 6px;font-size:12px;">Resources</h3><div id="rl">${brl(a.resources||[])}</div>${avail.length?`<div style="display:flex;gap:4px;margin-top:4px;"><select id="rp" style="flex:1;font-size:11px;"><option value="">â€” Select â€”</option>${bpo(a.resources||[])}</select><select id="rc" style="font-size:11px;">${COLORS.map(c=>`<option value="${c.v}">${c.l}</option>`).join("")}</select><button type="button" id="ra" style="padding:2px 8px;cursor:pointer;"><i class="fas fa-plus"></i></button></div>`:""}</form>`,buttons:{save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async h=>{d.actors[idx].bgOffsetX=+h.find("[name=bx]").val();d.actors[idx].bgOffsetY=+h.find("[name=by]").val();d.actors[idx].bgScale=+h.find("[name=bs]").val();await saveData(scene,d);emit();refreshUI(scene);}}},default:"save",render:h=>{const bg=document.querySelector(`.totm-actor-card[data-idx="${idx}"] .totm-card-bg`);if(bg)h.find("input[type=range]").on("input",()=>{bg.style.backgroundPosition=`${h.find("[name=bx]").val()}% ${h.find("[name=by]").val()}%`;bg.style.backgroundSize=`${h.find("[name=bs]").val()}%`;});function rr(){h.find("#rl").html(brl(d.actors[idx].resources||[]));if(h.find("#rp").length)h.find("#rp").html(`<option value="">â€” Select â€”</option>${bpo(d.actors[idx].resources||[])}`);br();}h.find("#ra").on("click",()=>{const v=h.find("#rp").val();if(!v)return;const[path,maxPath]=v.split("|");const c=h.find("#rc").val()||"res-hp";const cd=COLORS.find(x=>x.v===c)||COLORS[0];const disc=avail.find(x=>x.path===path);if(!disc)return;if(!d.actors[idx].resources)d.actors[idx].resources=[];d.actors[idx].resources.push({label:disc.label,icon:cd.i,path,maxPath,color:c});rr();});function br(){h.find("[data-rr]").off("click").on("click",function(){d.actors[idx].resources.splice(+this.dataset.rr,1);rr();});}br();}}).render(true);}

function pickActor(scene,d){const av=game.actors.contents.filter(a=>!d.actors.find(e=>e.id===a.id));if(!av.length){ui.notifications.warn("All actors added.");return;}new Dialog({title:"Add Player",content:`<form><div class="form-group"><label>Actor</label><select name="a" style="width:100%">${av.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}</select></div></form>`,buttons:{add:{icon:'<i class="fas fa-plus"></i>',label:"Add",callback:async h=>{const a=game.actors.get(h.find("[name=a]").val());if(!a)return;d.actors.push(makeEntry(a));await saveData(scene,d);emit();refreshUI(scene);}}},default:"add"}).render(true);}

// â”€â”€ HOOKS â”€â”€
Hooks.on("updateActor",async a=>{if(!document.body.classList.contains("totm-active"))return;const s=game.scenes.viewed;if(!s||!isTOTM(s))return;const d=getData(s);if(d.actors.find(x=>x.id===a.id)||d.enemies.find(x=>x.id===a.id)){refreshUI(s);await checkEncounterEnemyStates(s,d);}});
Hooks.on("updateToken",async t=>{const s=game.scenes.viewed;if(!document.body.classList.contains("totm-active")||!s||s.id!==t.parent?.id||!isTOTM(s))return;if(t.getFlag(MODULE_ID,FLAG_PROXY)){const d=getData(s);refreshUI(s);await checkEncounterEnemyStates(s,d);}});
Hooks.on("updateSetting",setting=>{if(setting.key==="global-progress-clocks.activeClocks")window.clockDatabase?.refresh?.();const s=game.scenes.viewed;if(!document.body.classList.contains("totm-active")||!s||!isTOTM(s))return;if(setting.key==="global-progress-clocks.activeClocks")requestSceneRefresh(s);});
Hooks.on("getSceneContextOptions",(app,items)=>{items.push({name:"Toggle Theater of the Mind",icon:'<i class="fas fa-theater-masks"></i>',condition:()=>isGM(),callback:async el=>{const id=el.dataset?.sceneId||el.dataset?.documentId||el.dataset?.entryId||el.closest("[data-scene-id]")?.dataset?.sceneId||el.closest("[data-document-id]")?.dataset?.documentId||el.closest("[data-entry-id]")?.dataset?.entryId;const s=game.scenes.get(id);if(s)await toggleTOTM(s);}});});
async function toggleTOTM(s){if(isTOTM(s)){const d=getData(s);await setTargets(s,[],game.user,d);if(isGM()){await pruneEnemyTokenDocs(s,{...d,enemies:[]});await prunePlayerTokenDocs(s,{...d,actors:[]});}await unsetF(s,FLAG_TOTM);await unsetF(s,FLAG_DATA);ui.notifications.info("TOTM disabled.");if(s.id===game.scenes.viewed?.id)deactivate();}else{await setF(s,FLAG_TOTM,true);const d=defData();if(s.background?.src)d.background=s.background.src;await setF(s,FLAG_DATA,d);ui.notifications.info("TOTM enabled.");if(s.id===game.scenes.viewed?.id)activate(s);}emit();}
Hooks.on("canvasReady",async c=>{const s=c.scene||game.scenes.viewed;if(s&&isTOTM(s)){const d=getData(s);const changedEnemies=await ensureEnemyTokenDocs(s,d),changedPlayers=await ensurePlayerTokenDocs(s,d);if(changedEnemies||changedPlayers)await saveData(s,d);activate(s);}else deactivate();});
Hooks.on("updateScene",(s,ch)=>{if(!ch?.flags?.[MODULE_ID])return;if(s.id===game.scenes.viewed?.id){if(isTOTM(s)){if(LOCAL_PIN_DRAG_COUNT>0)PENDING_PIN_REFRESH_SCENE_ID=s.id;else activate(s);}else deactivate();}});
Hooks.on("updateUser",_u=>{const s=game.scenes.viewed;if(s&&isTOTM(s))requestSceneRefresh(s);});
Hooks.on("targetToken",(_user,_token,_targeted)=>{const s=game.scenes.viewed;if(s&&document.body.classList.contains("totm-active")&&isTOTM(s))requestSceneRefresh(s);});
Hooks.on("renderHotbar",()=>{const s=game.scenes.viewed;if(s&&document.body.classList.contains("totm-active")&&isTOTM(s))requestSceneRefresh(s);});
Hooks.once("init",()=>{console.log(`${MODULE_ID} | v8`);regSettings();});
Hooks.once("ready",async()=>{game.socket.on(`module.${MODULE_ID}`,onSock);injectUI();window.addEventListener("resize",()=>{if(document.body.classList.contains("totm-active")){fitSB();syncHotbarPosition();}});const s=game.scenes.viewed;if(s&&isTOTM(s)){const d=getData(s);const changedEnemies=await ensureEnemyTokenDocs(s,d),changedPlayers=await ensurePlayerTokenDocs(s,d);if(changedEnemies||changedPlayers)await saveData(s,d);activate(s);}});
Hooks.once("ready",()=>{window.TOTMOverlay={isTOTM:s=>isTOTM(s||game.scenes.viewed),toggle:async()=>{const s=game.scenes.viewed;if(s)await toggleTOTM(s);}};});
Hooks.once("ready",()=>{window.addEventListener("keydown",async e=>{if(e.repeat||e.key.toLowerCase()!=="t"||typingInField(e)||!document.body.classList.contains("totm-active"))return;const scene=game.scenes.viewed;if(!scene||!isTOTM(scene))return;const d=getData(scene),hoveredPlayer=document.querySelector("#totm-ui .totm-actor-card:hover"),hoveredEnemy=document.querySelector("#totm-ui .totm-scene-enemy:hover, #totm-ui .totm-enemy-card:hover");e.preventDefault();if(hoveredPlayer?.dataset.actorId){if(!await togglePlayerTarget(hoveredPlayer.dataset.actorId,scene))ui.notifications.warn("No scene token found for that player.");refreshUI(scene);return;}if(hoveredEnemy?.dataset.targetId){await toggleEnemyTarget(scene,d,hoveredEnemy.dataset.targetId);return;}if(document.querySelector("#totm-ui #totm-actor-list:hover")){await targetNextPlayer(scene,d);return;}await targetNextEnemy(scene,d);});});

