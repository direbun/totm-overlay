export function renderTopbar({d,scene,deps}){
  const {hasClockModule,getClockEntries,getTimeDisplayText,getWeatherDisplayText,hasSimpleTimekeeping}=deps;
  const nc=(d.npcs||[]).filter(n=>n.visible).length,ec=(d.enemies||[]).length,clockCount=hasClockModule()?getClockEntries().length:0,timeText=getTimeDisplayText(),weatherText=getWeatherDisplayText();
  const compactBtn=(id,emoji,label,{active=false,danger=false,count=0}={})=>`<button class="totm-tb-btn totm-tb-btn-compact ${active?"is-active-gm-pin":""} ${danger?"is-danger":""}" id="${id}" title="${label}" aria-label="${label}"><span class="totm-tb-emoji" aria-hidden="true">${emoji}</span>${count?`<span class="totm-tb-count">${count}</span>`:""}</button>`;
  return `<div id="totm-topbar"><div class="totm-topbar-left"><span class="totm-scene-label">${scene.name}</span><span class="totm-live-badge ${d.shared?"is-live":"is-gm"}"><span class="totm-live-dot"></span>${d.shared?"LIVE":"GM ONLY"}</span></div><div class="totm-topbar-right">${hasSimpleTimekeeping()?`<div id="totm-st-slot" title="${timeText.full||timeText.short||"Simple Timekeeping"}"></div><div class="totm-tb-sep"></div>`:`<button class="totm-tb-btn" id="tb-timekeep" title="${timeText.full||timeText.short||"Open Simple Timekeeping"}"><span class="totm-tb-emoji" aria-hidden="true">⏳</span> ${timeText.short||"Time"}</button>${weatherText?`<button class="totm-tb-btn totm-weather-chip" id="tb-weather" title="${weatherText}"><span class="totm-tb-emoji" aria-hidden="true">☁️</span> ${weatherText}</button>`:""}<div class="totm-tb-sep"></div>`}${hasClockModule()?`${compactBtn("tb-clocks","🕰️","Clocks",{count:clockCount})}<div class="totm-tb-sep"></div>`:""}${compactBtn("tb-library","📚","Library")}${compactBtn("tb-bg","🖼️","Backgrounds")}${compactBtn("tb-bg-cfg","🎚️","Background Position")}${compactBtn("tb-prop-wipe","🗑️","Wipe Props",{danger:true})}${compactBtn("tb-quest-add","📍","Quest Pin")}<div class="totm-tb-sep"></div>${compactBtn("tb-gm-pin","📌","GM Pin",{active:!!d.gmPin?.visible})}${compactBtn("tb-gm-pin-cfg","⚙️","GM Pin Settings")}${compactBtn("tb-board-actors",d.boardActorsVisible===false?"🫥":"🧍","Toggle Board Characters (V)",{active:d.boardActorsVisible!==false})}<div class="totm-tb-sep"></div>${compactBtn("tb-npc","🧍","NPCs",{count:nc})}<div class="totm-tb-sep"></div>${compactBtn("tb-enc","⚔️","Fight Library",{count:ec,active:!!d.combatActive})}${ec&&!d.combatActive?compactBtn("tb-start-enc","▶️","Start Fight",{danger:true}):""}${ec&&d.combatActive?compactBtn("tb-end-enc","🏁","Clear Fight",{danger:true}):""}<div class="totm-tb-sep"></div>${compactBtn("tb-share",d.shared?"🙈":"📡",d.shared?"Hide From Players":"Share With Players")}</div></div>`;
}

export function bindSceneAdminEvents({el,scene,d,deps}){
  const {openMasterLibraryPicker,openBgPicker,openNpcPicker,openEncPicker,CLOCKS_OPEN_ref,setCLOCKS_OPEN,refreshUI,openBgCfg,clearCurrentBackgroundProps,addQuestPin,toggleGmPin,openGmPinCfg,clearEncounterState,openSimpleTimekeeping,saveData,emit,toggleBoardActorsVisibility,setCombatActive}=deps;
  el.querySelector("#tb-library")?.addEventListener("click",e=>{e.stopPropagation();openMasterLibraryPicker(scene,d);});
  el.querySelector("#tb-bg")?.addEventListener("click",e=>{e.stopPropagation();openBgPicker(scene,d);});
  el.querySelector("#tb-npc")?.addEventListener("click",e=>{e.stopPropagation();openNpcPicker(scene,d);});
  el.querySelector("#tb-enc")?.addEventListener("click",e=>{e.stopPropagation();openEncPicker(scene,d);});
  el.querySelector("#tb-timekeep")?.addEventListener("click",e=>{e.stopPropagation();openSimpleTimekeeping("time");});
  el.querySelector("#tb-weather")?.addEventListener("click",e=>{e.stopPropagation();openSimpleTimekeeping("weather");});
  el.querySelector("#tb-clocks")?.addEventListener("click",()=>{setCLOCKS_OPEN(!CLOCKS_OPEN_ref());refreshUI(scene);});
  el.querySelector("#tb-bg-cfg")?.addEventListener("click",()=>openBgCfg(scene,d));
  el.querySelector("#tb-bg-mgr")?.addEventListener("click",()=>openBgMgr(scene,d));
  el.querySelector("#tb-prop-wipe")?.addEventListener("click",async()=>{await clearCurrentBackgroundProps(scene,d);});
  el.querySelector("#tb-quest-add")?.addEventListener("click",async()=>{await addQuestPin(scene,d);});
  el.querySelector("#tb-gm-pin")?.addEventListener("click",async()=>{await toggleGmPin(scene,d);});
  el.querySelector("#tb-gm-pin-cfg")?.addEventListener("click",()=>openGmPinCfg(scene,d));
  el.querySelector("#tb-board-actors")?.addEventListener("click",async()=>{await toggleBoardActorsVisibility(scene,d);});
  el.querySelector("#tb-start-enc")?.addEventListener("click",async()=>{await setCombatActive(scene,d,true);});
  el.querySelector("#tb-end-enc")?.addEventListener("click",async()=>{await clearEncounterState(scene,d);});
  el.querySelector("#tb-share")?.addEventListener("click",async()=>{d.shared=!d.shared;await saveData(scene,d);emit();refreshUI(scene);});
}
