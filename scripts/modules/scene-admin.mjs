const esc=value=>foundry.utils.escapeHTML(String(value??""));
const attr=esc;

export function renderTopbar({d,scene,deps}){
  const {hasClockModule,getClockEntries,moduleVersion,isGM=()=>true,playerTopbarItems=["tb-clocks"],getMediaJournalCount=()=>0}=deps;
  const gm=isGM();
  const playerItems=new Set(playerTopbarItems);
  const canShow=id=>gm||playerItems.has(id)||playerItems.has(id.replace(/^tb-/,""));
  const nc=(d.npcs||[]).filter(n=>n.visible).length,ec=(d.enemies||[]).length,clockCount=hasClockModule()?getClockEntries().length:0,minimapPinCount=(d.minimap?.pins||[]).filter(p=>p.visible!==false).length;
  const mediaCount=getMediaJournalCount(d);
  const compactBtn=(id,icon,label,{active=false,danger=false,count=0,title=""}={})=>`<button class="totm-tb-btn totm-tb-btn-compact ${active?"is-active-gm-pin":""} ${danger?"is-danger":""}" id="${attr(id)}" title="${attr(title||label)}" aria-label="${attr(label)}"><span class="totm-tb-emoji" aria-hidden="true"><i class="${attr(icon)}"></i></span>${count?`<span class="totm-tb-count">${count}</span>`:""}</button>`;
  const visibleGroup=items=>items.filter(item=>item.html&&canShow(item.id)).map(item=>item.html).join("");
  const groups=[
    visibleGroup([
      {id:"tb-clocks",html:hasClockModule()?compactBtn("tb-clocks","fas fa-clock","Clocks",{count:clockCount}):""},
      {id:"tb-minimap",html:compactBtn("tb-minimap","fas fa-map","Minimap",{count:minimapPinCount})},
      {id:"tb-minimap-cfg",html:compactBtn("tb-minimap-cfg","fas fa-map-location-dot","Minimap Controls",{active:!!d.minimap?.image})}
    ]),
    visibleGroup([
      {id:"tb-library",html:compactBtn("tb-library","fas fa-book-open","Library")},
      {id:"tb-media-journal",html:compactBtn("tb-media-journal","fas fa-book","Media Journal",{active:!!d.mediaJournal,count:mediaCount})},
      {id:"tb-bg",html:compactBtn("tb-bg","fas fa-images","Backgrounds")},
      {id:"tb-bg-cfg",html:compactBtn("tb-bg-cfg","fas fa-sliders","Background Position")},
      {id:"tb-prop-wipe",html:compactBtn("tb-prop-wipe","fas fa-trash","Wipe Props",{danger:true,title:"Wipe Props - does not remove player/board character icons."})},
      {id:"tb-quest-add",html:compactBtn("tb-quest-add","fas fa-map-pin","Quest Pin")}
    ]),
    visibleGroup([
      {id:"tb-gm-pin",html:compactBtn("tb-gm-pin","fas fa-thumbtack","GM Pin",{active:!!d.gmPin?.visible})},
      {id:"tb-gm-pin-cfg",html:compactBtn("tb-gm-pin-cfg","fas fa-gear","GM Pin Settings")},
      {id:"tb-board-manager",html:compactBtn("tb-board-manager","fas fa-users-cog","Board Characters",{count:(d.boardActors||[]).length})},
      {id:"tb-board-actors",html:compactBtn("tb-board-actors",d.boardActorsVisible===false?"fas fa-eye-slash":"fas fa-user-group","Toggle Board Characters (V)",{active:d.boardActorsVisible!==false})}
    ]),
    visibleGroup([{id:"tb-npc",html:compactBtn("tb-npc","fas fa-user-tag","NPCs",{count:nc})}]),
    visibleGroup([
      {id:"tb-enc",html:compactBtn("tb-enc","fas fa-shield-halved","Fight Library",{count:ec,active:!!d.combatActive})},
      {id:"tb-start-enc",html:ec&&!d.combatActive?compactBtn("tb-start-enc","fas fa-play","Start Fight",{danger:true}):""},
      {id:"tb-end-enc",html:ec&&d.combatActive?compactBtn("tb-end-enc","fas fa-flag-checkered","Clear Fight",{danger:true}):""}
    ]),
    visibleGroup([
      {id:"tb-backup",html:compactBtn("tb-backup","fas fa-download","Scene Backup")},
      {id:"tb-help",html:compactBtn("tb-help","fas fa-circle-question","GM Help")},
      {id:"tb-share",html:compactBtn("tb-share",d.shared?"fas fa-eye-slash":"fas fa-broadcast-tower",d.shared?"Hide From Players":"Share With Players")}
    ])
  ].filter(Boolean);
  if(!gm&&!groups.length)return "";
  return `<div id="totm-topbar"><div class="totm-topbar-left"><span class="totm-scene-label">${esc(scene.name)}</span><span class="totm-live-badge ${d.shared?"is-live":"is-gm"}"><span class="totm-live-dot"></span>${d.shared?"LIVE":"GM ONLY"}</span><span class="totm-build-marker" title="${attr(`TOTM Overlay ${moduleVersion||"unknown"}`)}">v${esc(moduleVersion||"?")}</span></div><div class="totm-topbar-right">${groups.join(`<div class="totm-tb-sep"></div>`)}</div></div>`;
}

export function bindSceneAdminEvents({el,scene,d,deps}){
  const {openMasterLibraryPicker,openMediaJournalManager,openBgPicker,openNpcPicker,openEncPicker,CLOCKS_OPEN_ref,setCLOCKS_OPEN,getData,refreshUI,scheduleRefresh,refreshClockUi,openBgCfg,clearCurrentBackgroundProps,addQuestPin,toggleGmPin,openGmPinCfg,clearEncounterState,saveData,emit,toggleBoardActorsVisibility,openBoardActorMgr,setCombatActive,openSceneBackupDialog,openGmHelpDialog,toggleMinimap,openMinimapControls,isGM=()=>true}=deps;
  const liveData=()=>getData?.(scene)||d;
  el.querySelector("#tb-clocks")?.addEventListener("click",()=>{setCLOCKS_OPEN(!CLOCKS_OPEN_ref());(refreshClockUi||scheduleRefresh||refreshUI)(scene);});
  el.querySelector("#tb-minimap")?.addEventListener("click",()=>toggleMinimap?.(scene,liveData()));
  if(!isGM())return;
  el.querySelector("#tb-minimap-cfg")?.addEventListener("click",()=>openMinimapControls?.(scene,liveData()));
  el.querySelector("#tb-library")?.addEventListener("click",e=>{e.stopPropagation();openMasterLibraryPicker(scene,liveData());});
  el.querySelector("#tb-media-journal")?.addEventListener("click",e=>{e.stopPropagation();openMediaJournalManager?.(scene,liveData());});
  el.querySelector("#tb-bg")?.addEventListener("click",e=>{e.stopPropagation();openBgPicker(scene,liveData());});
  el.querySelector("#tb-npc")?.addEventListener("click",e=>{e.stopPropagation();openNpcPicker(scene,liveData());});
  el.querySelector("#tb-enc")?.addEventListener("click",e=>{e.stopPropagation();openEncPicker(scene,liveData());});
  el.querySelector("#tb-bg-cfg")?.addEventListener("click",()=>openBgCfg(scene,liveData()));
  el.querySelector("#tb-prop-wipe")?.addEventListener("click",async()=>{await clearCurrentBackgroundProps(scene,liveData());});
  el.querySelector("#tb-quest-add")?.addEventListener("click",async()=>{await addQuestPin(scene,liveData());});
  el.querySelector("#tb-gm-pin")?.addEventListener("click",async()=>{await toggleGmPin(scene,liveData());});
  el.querySelector("#tb-gm-pin-cfg")?.addEventListener("click",()=>openGmPinCfg(scene,liveData()));
  el.querySelector("#tb-board-manager")?.addEventListener("click",()=>openBoardActorMgr?.(scene,liveData()));
  el.querySelector("#tb-board-actors")?.addEventListener("click",async()=>{await toggleBoardActorsVisibility(scene,liveData());});
  el.querySelector("#tb-start-enc")?.addEventListener("click",async()=>{await setCombatActive(scene,liveData(),true);});
  el.querySelector("#tb-end-enc")?.addEventListener("click",async()=>{await clearEncounterState(scene,liveData());});
  el.querySelector("#tb-backup")?.addEventListener("click",()=>openSceneBackupDialog?.(scene,liveData()));
  el.querySelector("#tb-help")?.addEventListener("click",()=>openGmHelpDialog?.());
  el.querySelector("#tb-share")?.addEventListener("click",async()=>{const data=liveData();data.shared=!data.shared;await saveData(scene,data);emit();(scheduleRefresh||refreshUI)(scene);});
}
