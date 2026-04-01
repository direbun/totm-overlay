export function buildStageSceneImages({d,scene,deps}){
  const {
    getPinImage,
    canControlActorPin,
    getActorPinColor,
    getGmPinColor,
    canControlGmPin,
    getTargets,
    normalizeEnemyEntry,
    getEncounterActor,
    ENEMY_FADE_MS,
    enemyTargetId,
    getQuestPinImage
  }=deps;

  const sceneImgs=[];
  const activeBackgroundKey=String(d.background||"");
  const backgroundProps=Array.isArray(d.propsByBackground?.[activeBackgroundKey])?d.propsByBackground[activeBackgroundKey]:(Array.isArray(d.props)?d.props.filter(p=>String(p?.backgroundKey||"")===activeBackgroundKey):[]);
  const backgroundQuestPins=Array.isArray(d.questPinsByBackground?.[activeBackgroundKey])?d.questPinsByBackground[activeBackgroundKey]:(Array.isArray(d.questPins)?d.questPins.filter(p=>String(p?.backgroundKey||"")===activeBackgroundKey):[]);
  (d.npcs||[]).filter(n=>n.visible).forEach(n=>sceneImgs.push(`<div class="totm-scene-img totm-scene-npc" style="left:${n.posX??50}%;top:${n.posY??50}%;transform:translate(-50%,-50%) scale(${(n.scale??100)/100});"><img src="${n.image}" alt="${n.name}"/></div>`));
  backgroundProps.forEach((p,i)=>{
    sceneImgs.push(`<div class="totm-scene-img totm-scene-prop" data-pidx="${i}" data-prop-id="${p.id||""}" style="left:${p.posX??50}%;top:${p.posY??50}%;transform:translate(-50%,-50%) scale(${(p.scale??100)/100});"><img src="${p.image}" alt="${p.name||"Prop"}"/></div>`);
  });
  backgroundQuestPins.forEach((p,i)=>{
    const img=p.image||getQuestPinImage?.(p.type||"quest");
    sceneImgs.push(`<div class="totm-scene-img totm-scene-quest" data-qidx="${i}" data-quest-id="${p.id||""}" style="left:${p.posX??50}%;top:${p.posY??50}%;transform:translate(-50%,-50%) scale(${(p.scale??100)/100});"><img src="${img}" alt="${p.label||"Quest"}"/></div>`);
  });
  (d.actors||[]).forEach((a,i)=>{
    if(!a.pinVisible)return;
    const pinImg=getPinImage(a),pinSize=Number(a.pinSize||64),pinColor=getActorPinColor(a.id);
    sceneImgs.push(`<div class="totm-map-pin ${canControlActorPin(a.id)?"is-owner":""}" data-pin-owner="actor" data-actor-id="${a.id}" data-idx="${i}" style="--totm-pin-color:${pinColor};left:${a.pinX??50}%;top:${a.pinY??50}%;width:${pinSize}px;height:${pinSize}px;"><div class="totm-map-pin-core" style="background-image:url('${pinImg}')"></div></div>`);
  });
  if(d.gmPin?.visible){
    const pinImg=d.gmPin.image||game.users?.activeGM?.avatar||game.user.avatar||"icons/svg/mystery-man.svg";
    const pinSize=Number(d.gmPin.size||64),pinColor=getGmPinColor();
    sceneImgs.push(`<div class="totm-map-pin gm-pin ${canControlGmPin()?"is-owner":""}" data-pin-owner="gm" style="--totm-pin-color:${pinColor};left:${d.gmPin.posX??50}%;top:${d.gmPin.posY??50}%;width:${pinSize}px;height:${pinSize}px;"><div class="totm-map-pin-core" style="background-image:url('${pinImg}')"></div></div>`);
  }
  const enemyTargets=scene?getTargets(scene):[];
  const now=Date.now();
  (d.enemies||[]).forEach((e,i)=>{
    normalizeEnemyEntry(e);
    const a=getEncounterActor(e,scene);
    const img=a?.prototypeToken?.texture?.src||a?.img||e.image||"icons/svg/mystery-man.svg";
    const fadeClass=e.transitionState&&now-(e.transitionAt||0)<ENEMY_FADE_MS+150?`is-${e.transitionState}`:"";
    const scale=(e.scale??100)/100;
    sceneImgs.push(`<div class="totm-scene-img totm-scene-enemy ${enemyTargets.includes(enemyTargetId(e))?"enemy-targeted":""} ${fadeClass}" data-eidx="${i}" data-target-id="${enemyTargetId(e)}" data-token-id="${e.tokenId||""}" style="--totm-scene-scale:${scale};left:${e.posX??50}%;top:${e.posY??70}%;transform:translate(-50%,-50%) scale(var(--totm-scene-scale));"><img src="${img}" alt="${e.name}"/></div>`);
  });
  return sceneImgs;
}

export function renderEnemyBar({d,scene,deps}){
  const {getTargets,normalizeEnemyEntry,getEncounterActor,getRes,enemyTargetId,getEnemyTargetUsers,ENEMY_FADE_MS,isGM}=deps;
  const enemies=d.enemies||[],targets=scene?getTargets(scene):[];
  if(!enemies.length)return "";
  const now=Date.now();
  return `<div id="totm-enemy-wrap"><div id="totm-enemy-tools"><button class="totm-tb-btn" data-target-act="random"><i class="fas fa-dice"></i> Random Target</button><button class="totm-tb-btn" data-target-act="next"><i class="fas fa-crosshairs"></i> T Target</button><button class="totm-tb-btn" data-target-act="clear"><i class="fas fa-ban"></i> Clear</button></div><div id="totm-enemy-bar">${enemies.map((e,i)=>{normalizeEnemyEntry(e);const a=getEncounterActor(e,scene);const res=getRes(e,scene,{enemy:true,auto:true}).filter(r=>r.label==="HP"||r.label==="MP");const img=a?.prototypeToken?.texture?.src||a?.img||e.img||"icons/svg/mystery-man.svg";const dead=(res.find(r=>r.label==="HP")?.value??1)<=0,targeted=targets.includes(enemyTargetId(e)),targeters=getEnemyTargetUsers(e,scene);const fadeClass=e.transitionState&&now-(e.transitionAt||0)<ENEMY_FADE_MS+150?`is-${e.transitionState}`:"";return `<div class="totm-enemy-card ${dead?"enemy-dead":""} ${targeted?"enemy-targeted":""} ${fadeClass}" data-eidx="${i}" data-target-id="${enemyTargetId(e)}"><div class="totm-card-bg" style="background-image:url('${img}')"></div><div class="totm-card-overlay"></div><div class="totm-enemy-targeters">${targeters.map(t=>`<span class="totm-enemy-targeter" title="${t.name}" style="--targeter-color:${t.color};background-image:url('${t.img}')"></span>`).join("")}</div><div class="totm-enemy-actions"><button data-eact="target" class="${targeted?"active-target":""}" title="Target"><i class="fas fa-crosshairs"></i></button>${isGM()?`<button data-eact="remove" title="Remove"><i class="fas fa-times"></i></button>`:""}</div><div class="totm-card-content"><div class="totm-actor-name">${e.name}</div>${deps.renderBars(res,{kind:"enemy"})}</div></div>`;}).join("")}</div></div>`;
}

export function bindEnemyStageEvents({el,scene,d,deps}){
  const {isGM,setTargets,getTargets,targetRandomEnemy,targetNextEnemy,toggleEnemyTarget,getEncounterActor,pruneEnemyTokenDocs,saveData,emit,refreshUI,makeEnemyEntry,ensureEnemyTokenDocs,openDragPos,getQuestPinImage}=deps;
  el.querySelector("#totm-enemy-tools")?.addEventListener("click",async e=>{
    const btn=e.target.closest("[data-target-act]");
    if(!btn)return;
    const act=btn.dataset.targetAct;
    if(act==="random")await targetRandomEnemy(scene,d);
    else if(act==="next")await targetNextEnemy(scene,d);
    else if(act==="clear")await setTargets(scene,[],game.user,d);
  });

  if(!isGM())return;

  const getActiveBackgroundKey = () => String(d.background||"");
  const syncCurrentQuestView = bucket => {
    const key=getActiveBackgroundKey();
    if(!d.questPinsByBackground || typeof d.questPinsByBackground!=="object" || Array.isArray(d.questPinsByBackground)) d.questPinsByBackground={};
    d.questPinsByBackground[key]=bucket;
    d.questPins=Array.isArray(bucket)?bucket.map(p=>foundry.utils.deepClone(p)):[];
    return d.questPinsByBackground[key];
  };
  const getQuestBucket = () => {
    const key=getActiveBackgroundKey();
    if(!d.questPinsByBackground || typeof d.questPinsByBackground!=="object" || Array.isArray(d.questPinsByBackground)) d.questPinsByBackground={};
    const hasBucketData=Object.values(d.questPinsByBackground).some(bucket=>Array.isArray(bucket)&&bucket.length);
    if(!hasBucketData && Array.isArray(d.questPins) && d.questPins.length){
      const legacy=d.questPins.splice(0,d.questPins.length);
      for(const pin of legacy){
        const pinKey=String(pin?.backgroundKey||key);
        if(!Array.isArray(d.questPinsByBackground[pinKey])) d.questPinsByBackground[pinKey]=[];
        d.questPinsByBackground[pinKey].push(pin);
      }
    }
    if(!Array.isArray(d.questPinsByBackground[key])) d.questPinsByBackground[key]=[];
    return syncCurrentQuestView(d.questPinsByBackground[key]);
  };
  const saveQuestBucket = async bucket => {
    syncCurrentQuestView(bucket);
    await saveData(scene,d);
    emit();
    refreshUI(scene);
  };
  const openQuestPinMenu = pin => {
    new Dialog({
      title: pin.label||"Quest Pin",
      content: `<form><div class="form-group"><label>State</label><select name="type"><option value="quest" ${pin.type==="quest"?"selected":""}>Exclamation</option><option value="question" ${pin.type==="question"?"selected":""}>Question Mark</option><option value="complete" ${pin.type==="complete"?"selected":""}>Tick</option></select></div></form>`,
      buttons: {
        move:{icon:'<i class="fas fa-arrows-alt"></i>',label:"Move",callback:()=>openDragPos?.(pin,scene,d,async()=>{await saveQuestBucket(getQuestBucket());})},
        del:{icon:'<i class="fas fa-trash"></i>',label:"Delete",callback:async()=>{const bucket=getQuestBucket();const idx=bucket.findIndex(p=>p?.id===pin.id);if(idx<0)return;bucket.splice(idx,1);await saveQuestBucket(bucket);}},
        save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async html=>{pin.type=String(html.find("[name=type]").val()||"quest");pin.image=getQuestPinImage?.(pin.type);pin.label=pin.type==="question"?"Question":pin.type==="complete"?"Complete":"Quest";await saveQuestBucket(getQuestBucket());}}
      },
      default:"save"
    }).render(true);
  };
  const syncCurrentPropView = bucket => {
    const key=getActiveBackgroundKey();
    if(!d.propsByBackground || typeof d.propsByBackground!=="object" || Array.isArray(d.propsByBackground)) d.propsByBackground={};
    d.propsByBackground[key]=bucket;
    d.props=Array.isArray(bucket)?bucket.map(p=>foundry.utils.deepClone(p)):[];
    return d.propsByBackground[key];
  };
  const getPropBucket = () => {
    const key=getActiveBackgroundKey();
    if(!d.propsByBackground || typeof d.propsByBackground!=="object" || Array.isArray(d.propsByBackground)) d.propsByBackground={};
    const hasBucketData=Object.values(d.propsByBackground).some(bucket=>Array.isArray(bucket)&&bucket.length);
    if(!hasBucketData && Array.isArray(d.props) && d.props.length){
      const legacy=d.props.splice(0,d.props.length);
      for(const prop of legacy){
        const propKey=String(prop?.backgroundKey||key);
        if(!Array.isArray(d.propsByBackground[propKey])) d.propsByBackground[propKey]=[];
        d.propsByBackground[propKey].push(prop);
      }
    }
    if(!Array.isArray(d.propsByBackground[key])) d.propsByBackground[key]=[];
    return syncCurrentPropView(d.propsByBackground[key]);
  };
  const deleteScenePropById = async propId => {
    if(!propId)return;
    if(!d.propsByBackground || typeof d.propsByBackground!=="object" || Array.isArray(d.propsByBackground)) d.propsByBackground={};
    let removed=false;
    for(const [key,bucket] of Object.entries(d.propsByBackground)){
      if(!Array.isArray(bucket))continue;
      const next=bucket.filter(p=>p?.id!==propId);
      if(next.length!==bucket.length){
        d.propsByBackground[key]=next;
        removed=true;
      }
    }
    if(Array.isArray(d.props)){
      d.props=d.props.filter(p=>p?.id!==propId);
      if(!removed){
        removed=true;
      }
    }
    if(!removed)return;
    syncCurrentPropView(getPropBucket());
    await saveData(scene,d);
    emit();
    refreshUI(scene);
  };

  const addSceneProp = async (image, opts={}) => {
    if(!image)return;
    const propBucket=getPropBucket();
    const activeBackgroundKey=String(d.background||"");
    const name = String(opts.name || image.split("/").pop()?.replace(/\.\w+$/,"") || "Prop").trim() || "Prop";
    const prop = {
      id: foundry.utils.randomID(),
      kind: "prop",
      name,
      image,
      backgroundKey: activeBackgroundKey,
      posX: Number.isFinite(opts.posX) ? opts.posX : 50,
      posY: Number.isFinite(opts.posY) ? opts.posY : 50,
      scale: Number.isFinite(opts.scale) ? opts.scale : 100
    };
    propBucket.push(prop);
    syncCurrentPropView(propBucket);
    await saveData(scene,d);
    emit();
    refreshUI(scene);
    setTimeout(() => {
      openDragPos?.(prop, scene, d, async () => {
        syncCurrentPropView(propBucket);
        await saveData(scene, d);
        emit();
        refreshUI(scene);
      }, async () => {
        await deleteScenePropById(prop.id);
      });
    }, 30);
  };

  const isImagePath = value => {
    const text = String(value || "").trim();
    return !!text && /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(text.split("?")[0]);
  };

  const getDroppedImageData = data => {
    if(!data || typeof data !== "object") return null;
    const image = String(data.img || data.image || data.src || data.path || data.file || data.texture?.src || "").trim();
    if(!isImagePath(image)) return null;
    const name = String(data.name || data.label || image.split("/").pop()?.replace(/\.\w+$/,"") || "Prop").trim();
    return { image, name };
  };

  const resolveImageFromDocument = async data => {
    if(!data?.uuid) return null;
    let doc = null;
    try{
      doc = await fromUuid(data.uuid);
    }catch{
      doc = null;
    }
    if(!doc) return null;

    const image = String(
      doc.img ||
      doc.src ||
      doc.image?.src ||
      doc.texture?.src ||
      doc.system?.image ||
      doc.system?.src ||
      ""
    ).trim();
    if(!isImagePath(image)) return null;

    const name = String(
      doc.name ||
      data.name ||
      data.label ||
      image.split("/").pop()?.replace(/\.\w+$/,"") ||
      "Prop"
    ).trim();

    return { image, name };
  };

  const getImageDropFromTransfer = transfer => {
    if(!transfer) return null;
    const rawPlain = String(transfer.getData?.("text/plain") || "").trim();
    let parsed = null;
    if(rawPlain){
      try{
        parsed = JSON.parse(rawPlain);
      }catch{
        if(isImagePath(rawPlain)) return { image: rawPlain, name: rawPlain.split("/").pop()?.replace(/\.\w+$/,"") || "Prop" };
      }
    }
    const fromParsed = getDroppedImageData(parsed);
    if(fromParsed) return fromParsed;

    const uriList = String(transfer.getData?.("text/uri-list") || "").trim().split(/\r?\n/).find(line=>line && !line.startsWith("#"));
    if(isImagePath(uriList)) return { image: uriList, name: uriList.split("/").pop()?.replace(/\.\w+$/,"") || "Prop" };

    const downloadUrl = String(transfer.getData?.("DownloadURL") || "").trim();
    if(downloadUrl){
      const parts = downloadUrl.split(":");
      const maybeUrl = parts.slice(2).join(":");
      if(isImagePath(maybeUrl)) return { image: maybeUrl, name: maybeUrl.split("/").pop()?.replace(/\.\w+$/,"") || "Prop" };
    }

    const files = Array.from(transfer.files || []);
    const file = files.find(f=>isImagePath(f?.path || f?.name || ""));
    if(file){
      const image = String(file.path || file.name || "").trim();
      return { image, name: image.split(/[\\/]/).pop()?.replace(/\.\w+$/,"") || "Prop" };
    }

    return null;
  };

  const addEncounterEnemy = async (actor, opts={}) => {
    if(!actor || actor.type === "character") return;
    const enemy = makeEnemyEntry(actor, opts);
    d.enemies.push(enemy);
    await ensureEnemyTokenDocs(scene, d);
    await saveData(scene, d);
    emit();
    refreshUI(scene);
    ui.notifications.info(`Added ${actor.name} to the encounter.`);
    setTimeout(() => {
      openDragPos?.(enemy, scene, d, async () => {
        await ensureEnemyTokenDocs(scene, d);
        await saveData(scene, d);
        emit();
        refreshUI(scene);
      }, async () => {
        const enemyIdx=(d.enemies||[]).findIndex(en=>en?.instanceId===enemy.instanceId);
        if(enemyIdx<0)return;
        d.enemies.splice(enemyIdx,1);
        await pruneEnemyTokenDocs(scene,d);
        await saveData(scene,d);
        emit();
        refreshUI(scene);
      });
    }, 30);
  };

  const bindEnemyDropZone = node => {
    if(!node || node.dataset.totmEnemyDropBound === "1") return;
    node.dataset.totmEnemyDropBound = "1";
    node.addEventListener("dragover", e => {
      e.preventDefault();
      node.classList.add("totm-drag-over");
    });
    node.addEventListener("dragleave", () => node.classList.remove("totm-drag-over"));
    node.addEventListener("drop", async e => {
      e.preventDefault();
      node.classList.remove("totm-drag-over");
      let data;
      try{
        data = JSON.parse(e.dataTransfer?.getData("text/plain") || "{}");
      }catch{
        data = null;
      }
      const stage = el.querySelector("#totm-stage");
      let posX, posY;
      if(node.id === "totm-stage" || node.id === "totm-stage-wrap"){
        const rect = stage?.getBoundingClientRect?.();
        if(rect){
          posX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 100));
          posY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 100));
        }
      }
      if(data?.type === "Actor"){
        const actor = await fromUuid(data.uuid);
        if(!actor) return;
        await addEncounterEnemy(actor, {
          posX: Number.isFinite(posX) ? posX : undefined,
          posY: Number.isFinite(posY) ? posY : undefined
        });
        return;
      }
      const droppedImage =
        getDroppedImageData(data) ||
        await resolveImageFromDocument(data) ||
        getImageDropFromTransfer(e.dataTransfer);
      if(!droppedImage) return;
      await addSceneProp(droppedImage.image, {
        name: droppedImage.name,
        posX: Number.isFinite(posX) ? posX : undefined,
        posY: Number.isFinite(posY) ? posY : undefined
      });
    });
  };

  bindEnemyDropZone(el.querySelector("#totm-stage"));
  bindEnemyDropZone(el.querySelector("#totm-stage-wrap"));
  bindEnemyDropZone(el.querySelector("#totm-enemy-wrap"));
  bindEnemyDropZone(el.querySelector("#totm-enemy-bar"));

  el.querySelector("#totm-enemy-bar")?.addEventListener("click",async e=>{
    const card=e.target.closest(".totm-enemy-card"),ab=e.target.closest("[data-eact]");
    if(ab&&card){
      const i=+card.dataset.eidx,act=ab.dataset.eact,targetId=card.dataset.targetId;
      if(act==="remove"){
        d.enemies.splice(i,1);
        await setTargets(scene,getTargets(scene).filter(id=>id!==targetId),game.user,d);
        await pruneEnemyTokenDocs(scene,d);
        await saveData(scene,d);
        emit();
        refreshUI(scene);
        return;
      }
      if(act==="target"){
        await toggleEnemyTarget(scene,d,targetId);
        return;
      }
    }
    if(card)await toggleEnemyTarget(scene,d,card.dataset.targetId);
  });
  el.querySelector("#totm-enemy-bar")?.addEventListener("dblclick",e=>{
    const card=e.target.closest(".totm-enemy-card");
    if(!card)return;
    const en=d.enemies[+card.dataset.eidx];
    if(!en)return;
    const a=getEncounterActor(en,scene);
    if(a)a.sheet.render(true);
  });
  el.querySelector("#totm-enemy-bar")?.addEventListener("contextmenu",e=>{
    const card=e.target.closest(".totm-enemy-card");
    if(!card)return;
    e.preventDefault();
    const en=d.enemies[+card.dataset.eidx];
    if(!en)return;
    openDragPos?.(en, scene, d, async () => {
      await ensureEnemyTokenDocs(scene, d);
      await saveData(scene, d);
      emit();
      refreshUI(scene);
    });
  });
  el.querySelectorAll(".totm-scene-enemy").forEach(img=>img.addEventListener("click",async e=>{
    const enemyId=e.currentTarget?.dataset?.targetId;
    if(enemyId)await toggleEnemyTarget(scene,d,enemyId);
  }));
  el.querySelectorAll(".totm-scene-enemy").forEach(img=>img.addEventListener("dblclick",e=>{
    const en=d.enemies[+e.currentTarget?.dataset?.eidx];
    if(!en)return;
    const a=getEncounterActor(en,scene);
    if(a)a.sheet.render(true);
  }));
  el.querySelectorAll(".totm-scene-enemy").forEach(img=>img.addEventListener("contextmenu",e=>{
    e.preventDefault();
    const en=d.enemies[+e.currentTarget?.dataset?.eidx];
    if(!en)return;
    openDragPos?.(en, scene, d, async () => {
      await ensureEnemyTokenDocs(scene, d);
      await saveData(scene, d);
      emit();
      refreshUI(scene);
    });
  }));
  el.querySelectorAll(".totm-scene-prop").forEach(img=>img.addEventListener("click",async e=>{
    if(!e.shiftKey)return;
    e.preventDefault();
    e.stopPropagation();
    const idx=+e.currentTarget?.dataset?.pidx;
    if(!Number.isInteger(idx)||idx<0)return;
    const propBucket=getPropBucket();
    const prop=propBucket[idx];
    if(!prop)return;
    await deleteScenePropById(prop.id);
  }));
  el.querySelectorAll(".totm-scene-prop").forEach(img=>img.addEventListener("contextmenu",async e=>{
    e.preventDefault();
    const idx=+e.currentTarget?.dataset?.pidx;
    if(!Number.isInteger(idx)||idx<0)return;
    const propBucket=getPropBucket();
    const prop=propBucket[idx];
    if(!prop)return;
    if(e.shiftKey){
      await deleteScenePropById(prop.id);
      return;
    }
    openDragPos?.(prop, scene, d, async () => {
      syncCurrentPropView(propBucket);
      await saveData(scene,d);
      emit();
      refreshUI(scene);
    }, async () => {
      await deleteScenePropById(prop.id);
    });
  }));
  el.querySelectorAll(".totm-scene-quest").forEach(img=>img.addEventListener("contextmenu",e=>{
    e.preventDefault();
    const idx=+e.currentTarget?.dataset?.qidx;
    if(!Number.isInteger(idx)||idx<0)return;
    const pin=getQuestBucket()[idx];
    if(!pin)return;
    openQuestPinMenu(pin);
  }));
}
