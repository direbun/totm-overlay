const esc=value=>foundry.utils.escapeHTML(String(value??""));
const attr=esc;

export function renderTopbar({d,scene,deps}){
  const {hasClockModule,getClockEntries,moduleVersion}=deps;
  const nc=(d.npcs||[]).filter(n=>n.visible).length,ec=(d.enemies||[]).length,clockCount=hasClockModule()?getClockEntries().length:0;
  const compactBtn=(id,icon,label,{active=false,danger=false,count=0,title=""}={})=>`<button class="totm-tb-btn totm-tb-btn-compact ${active?"is-active-gm-pin":""} ${danger?"is-danger":""}" id="${attr(id)}" title="${attr(title||label)}" aria-label="${attr(label)}"><span class="totm-tb-emoji" aria-hidden="true"><i class="${attr(icon)}"></i></span>${count?`<span class="totm-tb-count">${count}</span>`:""}</button>`;
  return `<div id="totm-topbar"><div class="totm-topbar-left"><span class="totm-scene-label">${esc(scene.name)}</span><span class="totm-live-badge ${d.shared?"is-live":"is-gm"}"><span class="totm-live-dot"></span>${d.shared?"LIVE":"GM ONLY"}</span><span class="totm-build-marker" title="${attr(`TOTM Overlay ${moduleVersion||"unknown"}`)}">v${esc(moduleVersion||"?")}</span></div><div class="totm-topbar-right">${hasClockModule()?`${compactBtn("tb-clocks","fas fa-clock","Clocks",{count:clockCount})}<div class="totm-tb-sep"></div>`:""}${compactBtn("tb-library","fas fa-book-open","Library")}${compactBtn("tb-bg","fas fa-images","Backgrounds")}${compactBtn("tb-bg-cfg","fas fa-sliders","Background Position")}${compactBtn("tb-prop-wipe","fas fa-trash","Wipe Props",{danger:true,title:"Wipe Props - does not remove player/board character icons."})}${compactBtn("tb-quest-add","fas fa-map-pin","Quest Pin")}<div class="totm-tb-sep"></div>${compactBtn("tb-gm-pin","fas fa-thumbtack","GM Pin",{active:!!d.gmPin?.visible})}${compactBtn("tb-gm-pin-cfg","fas fa-gear","GM Pin Settings")}${compactBtn("tb-board-manager","fas fa-users-cog","Board Characters",{count:(d.boardActors||[]).length})}${compactBtn("tb-board-actors",d.boardActorsVisible===false?"fas fa-eye-slash":"fas fa-user-group","Toggle Board Characters (V)",{active:d.boardActorsVisible!==false})}<div class="totm-tb-sep"></div>${compactBtn("tb-npc","fas fa-user-tag","NPCs",{count:nc})}<div class="totm-tb-sep"></div>${compactBtn("tb-enc","fas fa-shield-halved","Fight Library",{count:ec,active:!!d.combatActive})}${ec&&!d.combatActive?compactBtn("tb-start-enc","fas fa-play","Start Fight",{danger:true}):""}${ec&&d.combatActive?compactBtn("tb-end-enc","fas fa-flag-checkered","Clear Fight",{danger:true}):""}<div class="totm-tb-sep"></div>${compactBtn("tb-help","fas fa-circle-question","GM Help")}${compactBtn("tb-share",d.shared?"fas fa-eye-slash":"fas fa-broadcast-tower",d.shared?"Hide From Players":"Share With Players")}</div></div>`;
}

export function bindSceneAdminEvents({el,scene,d,deps}){
  const {openMasterLibraryPicker,openBgPicker,openNpcPicker,openEncPicker,CLOCKS_OPEN_ref,setCLOCKS_OPEN,getData,refreshUI,scheduleRefresh,refreshClockUi,openBgCfg,clearCurrentBackgroundProps,addQuestPin,toggleGmPin,openGmPinCfg,clearEncounterState,saveData,emit,toggleBoardActorsVisibility,openBoardActorMgr,setCombatActive,openGmHelpDialog}=deps;
  const liveData=()=>getData?.(scene)||d;
  el.querySelector("#tb-library")?.addEventListener("click",e=>{e.stopPropagation();openMasterLibraryPicker(scene,liveData());});
  el.querySelector("#tb-bg")?.addEventListener("click",e=>{e.stopPropagation();openBgPicker(scene,liveData());});
  el.querySelector("#tb-npc")?.addEventListener("click",e=>{e.stopPropagation();openNpcPicker(scene,liveData());});
  el.querySelector("#tb-enc")?.addEventListener("click",e=>{e.stopPropagation();openEncPicker(scene,liveData());});
  el.querySelector("#tb-clocks")?.addEventListener("click",()=>{setCLOCKS_OPEN(!CLOCKS_OPEN_ref());(refreshClockUi||scheduleRefresh||refreshUI)(scene);});
  el.querySelector("#tb-bg-cfg")?.addEventListener("click",()=>openBgCfg(scene,liveData()));
  el.querySelector("#tb-prop-wipe")?.addEventListener("click",async()=>{await clearCurrentBackgroundProps(scene,liveData());});
  el.querySelector("#tb-quest-add")?.addEventListener("click",async()=>{await addQuestPin(scene,liveData());});
  el.querySelector("#tb-gm-pin")?.addEventListener("click",async()=>{await toggleGmPin(scene,liveData());});
  el.querySelector("#tb-gm-pin-cfg")?.addEventListener("click",()=>openGmPinCfg(scene,liveData()));
  el.querySelector("#tb-board-manager")?.addEventListener("click",()=>openBoardActorMgr?.(scene,liveData()));
  el.querySelector("#tb-board-actors")?.addEventListener("click",async()=>{await toggleBoardActorsVisibility(scene,liveData());});
  el.querySelector("#tb-start-enc")?.addEventListener("click",async()=>{await setCombatActive(scene,liveData(),true);});
  el.querySelector("#tb-end-enc")?.addEventListener("click",async()=>{await clearEncounterState(scene,liveData());});
  el.querySelector("#tb-help")?.addEventListener("click",()=>openGmHelpDialog?.());
  el.querySelector("#tb-share")?.addEventListener("click",async()=>{const data=liveData();data.shared=!data.shared;await saveData(scene,data);emit();(scheduleRefresh||refreshUI)(scene);});
}
