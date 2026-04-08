export function renderPlayerCards({d,scene,deps}){
  const {isGM,getConds,MODULE_ID,getActorStatus,isActorTargeted,getRes,getImg,getFabulaPoints,rPath,renderBars,canControlActorPin}=deps;
  const actors=isGM()?d.actors:d.actors.filter(a=>a.visible!==false);
  const inCombat=!!(d.enemies||[]).length;
  if(!actors.length)return `<div class="totm-actor-empty"><i class="fas fa-users"></i><span>Drag players from sidebar</span></div>`;
  const sp=game.settings.get(MODULE_ID,"subtitlePath");
  const conds=getConds();
  const canAfk=game.settings.get(MODULE_ID,"playersCanAfk");
  return actors.map((a,i)=>{
    const actorDoc=game.actors.get(a.id);
    const status=getActorStatus(a);
    const isTargeted=isActorTargeted(a.id,scene);
    const sc=status?`has-status-${status}`:"";
    const cls=["totm-actor-card",a.highlighted?"highlighted":"",a.visible===false?"hidden-actor":"",sc,isTargeted?"externally-targeted":""].filter(Boolean).join(" ");
    const res=getRes(a,scene,{enemy:false,auto:true});
    const bg=inCombat&&a.combatImg?a.combatImg:getImg(a);
    const bgOffsetX=inCombat&&a.combatImg?(a.combatOffsetX??a.bgOffsetX??50):(a.bgOffsetX??50);
    const bgOffsetY=inCombat&&a.combatImg?(a.combatOffsetY??a.bgOffsetY??20):(a.bgOffsetY??20);
    const bgScale=inCombat&&a.combatImg?(a.combatScale??a.bgScale??150):(a.bgScale??150);
    const bgAutoFit=inCombat&&a.combatImg?!!(a.combatAutoFit??a.bgAutoFit):!!a.bgAutoFit;
    const bgSize=bgAutoFit?"cover":`${bgScale}%`;
    const fp=getFabulaPoints(actorDoc);
    let sub="";
    if(sp&&actorDoc)sub=rPath(actorDoc,sp)||"";
    const ac=a.conditions||[];
    const ce=isGM();
    const io=actorDoc?.isOwner;
    const pinOwner=canControlActorPin(a.id);
    const overlay=status
      ? `<div class="totm-status-overlay status-${status}"><span class="totm-status-label">${status.toUpperCase()}</span></div>`
      : (isTargeted?`<div class="totm-status-overlay status-targeted"><span class="totm-status-label">TARGETED</span></div>`:"");
    const gmBtns=ce
      ? `<button data-act="adjust"><i class="fas fa-cog"></i></button><button data-act="highlight"><i class="fas fa-star"></i></button><button data-act="target" class="${isTargeted?"active-target":""}" title="Target Player"><i class="fas fa-crosshairs"></i></button><button data-act="pin" class="${a.pinVisible?"active-pin":""}" title="Toggle Map Pin"><i class="fas fa-map-pin"></i></button><button data-act="pin-cfg" title="Pin Settings"><i class="fas fa-circle-dot"></i></button><button data-act="toggle-vis"><i class="fas fa-eye${a.visible===false?"-slash":""}"></i></button><button data-act="remove" class="act-danger"><i class="fas fa-trash"></i></button>`
      : "";
    const ownerBtns=!ce&&pinOwner
      ? `<button data-act="pin" class="${a.pinVisible?"active-pin":""}" title="Toggle Map Pin"><i class="fas fa-map-pin"></i></button><button data-act="pin-cfg" title="Pin Settings"><i class="fas fa-circle-dot"></i></button>`
      : "";
    return `<div class="${cls}" data-idx="${i}" data-actor-id="${a.id||""}" draggable="true">${overlay}${ac.length?`<div class="totm-conditions">${ac.map(c=>{const df=conds.find(x=>x.id===c);return df?`<span class="totm-condition-badge ${df.color}"><i class="${df.icon}"></i> ${df.label}</span>`:"";}).join("")}</div>`:""}${(gmBtns||ownerBtns)?`<div class="totm-actor-btns">${gmBtns||ownerBtns}</div>`:""}<div class="totm-player-shell"><div class="totm-player-portrait-col"><div class="totm-player-portrait-frame"><div class="totm-card-bg" style="background-image:url('${bg}');background-position:${bgOffsetX}% ${bgOffsetY}%;background-size:${bgSize}"></div><div class="totm-card-overlay"></div></div>${fp!=null?`<div class="totm-fp-panel" title="Fabula Points"><span class="totm-fp-panel-label">FP</span><span class="totm-fp-panel-value">${fp}</span></div>`:""}</div><div class="totm-player-stats-col"><div class="totm-card-content"><div class="totm-actor-name">${a.name}</div>${sub?`<div class="totm-actor-subtitle">${sub}</div>`:""}${renderBars(res,{kind:"player"})}</div></div></div>${((io&&canAfk)||ce)?`<div class="totm-actor-status-bar">${(io&&canAfk)?`<button data-status="afk" class="${status==="afk"?"active-status":""}">AFK</button>`:""} ${ce?`<button data-status="targeted" class="${status==="targeted"?"active-status":""}">TGT</button><button data-status="missing" class="${status==="missing"?"active-status":""}">MIA</button><button data-act="conditions"><i class="fas fa-list"></i></button>`:""}</div>`:""}</div>`;
  }).join("");
}

export function bindPlayerPanelEvents({el,scene,d,deps}){
  const {
    isGM,
    saveData,
    emit,
    refreshUI,
    targetRandomPlayer,
    pickActor,
    togglePlayerTarget,
    toggleActorPin,
    openActorPinCfg,
    openActorCfg,
    togCondDD,
    makeEntry,
    toggleActorAfkStatus
  }=deps;

  el.querySelector("#totm-random-player")?.addEventListener("click",async()=>{await targetRandomPlayer(scene,d);});
  el.querySelector("#totm-add-actor")?.addEventListener("click",()=>pickActor(scene,d));

  el.querySelector("#totm-actor-list")?.addEventListener("click",async e=>{
    const sb=e.target.closest("[data-status]");
    if(sb){
      const i=+sb.closest(".totm-actor-card").dataset.idx;
      const st=sb.dataset.status;
      const actorId=d.actors[i]?.id;
      if(st==="afk"){
        if(!(game.settings.get("totm-overlay","playersCanAfk")&&game.actors.get(actorId)?.isOwner))return;
        await toggleActorAfkStatus(scene,d,actorId);
        return;
      }else{
        if(!isGM())return;
        d.actors[i].status=d.actors[i].status===st?"":st;
      }
      await saveData(scene,d);
      emit();
      refreshUI(scene);
      return;
    }

    const cb=e.target.closest("[data-act='conditions']");
    if(cb&&isGM()){
      e.stopPropagation();
      togCondDD(cb.closest(".totm-actor-card"),scene,d,+cb.closest(".totm-actor-card").dataset.idx);
      return;
    }

    const ab=e.target.closest("[data-act]");
    if(ab&&(isGM()||["target","pin","pin-cfg"].includes(ab.dataset.act))){
      const i=+ab.closest(".totm-actor-card").dataset.idx;
      const act=ab.dataset.act;
      if(act==="target"){
        if(!await togglePlayerTarget(d.actors[i].id,scene))ui.notifications.warn("No scene token found for that player.");
        refreshUI(scene);
        return;
      }
      if(act==="pin"){
        await toggleActorPin(scene,d,i);
        return;
      }
      if(act==="pin-cfg"){
        openActorPinCfg(scene,d,i);
        return;
      }
      if(!isGM())return;
      if(act==="remove")d.actors.splice(i,1);
      else if(act==="toggle-vis")d.actors[i].visible=d.actors[i].visible===false;
      else if(act==="highlight")d.actors[i].highlighted=!d.actors[i].highlighted;
      else if(act==="adjust"){
        openActorCfg(scene,d,i);
        return;
      }
      await saveData(scene,d);
      emit();
      refreshUI(scene);
      return;
    }

    const card=e.target.closest(".totm-actor-card");
    if(card&&!e.target.closest(".totm-actor-status-bar")&&!e.target.closest(".totm-actor-btns")){
      const a=d.actors[+card.dataset.idx];
      const ac=game.actors.get(a?.id);
      if(ac?.sheet)ac.sheet.render(true);
    }
  });

  if(isGM()){
    const list=el.querySelector("#totm-actor-list");
    if(list){
      list.querySelectorAll(".totm-actor-card").forEach(card=>card.addEventListener("dragstart",e=>{
        const actorId=d.actors?.[+card.dataset.idx]?.id;
        if(!actorId)return;
        const actor=game.actors.get(actorId);
        if(!actor)return;
        e.dataTransfer?.setData("text/plain",JSON.stringify({type:"Actor",uuid:actor.uuid}));
        if(e.dataTransfer)e.dataTransfer.effectAllowed="copy";
      }));
      list.addEventListener("dragover",e=>{e.preventDefault();list.classList.add("totm-drag-over");});
      list.addEventListener("dragleave",()=>list.classList.remove("totm-drag-over"));
      list.addEventListener("drop",async e=>{
        e.preventDefault();
        list.classList.remove("totm-drag-over");
        let j;
        try{j=JSON.parse(e.dataTransfer.getData("text/plain"));}catch{return;}
        if(j.type!=="Actor")return;
        const a=await fromUuid(j.uuid);
        if(!a||d.actors.find(x=>x.id===a.id))return;
        d.actors.push(makeEntry(a,d.actors.length));
        await saveData(scene,d);
        emit();
        refreshUI(scene);
        ui.notifications.info(`Added ${a.name}.`);
      });
    }
  }
}
