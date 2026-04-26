const esc=value=>foundry.utils.escapeHTML(String(value??""));
const attr=esc;
const cssUrl=value=>`url("${String(value??"").replace(/\\/g,"/").replace(/"/g,"%22").replace(/[\r\n\f]/g,"")}")`;

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
    getQuestPinImage,
    getSceneEntityImage,
    getSceneEntityLayout,
    getStageActorImage,
    getStageActorLayout,
    SCENE_IMAGE_SWAP_MS
  }=deps;

  const sceneImgs=[];
  const activeBackgroundKey=String(d.background||"");
  const backgroundProps=Array.isArray(d.propsByBackground?.[activeBackgroundKey])?d.propsByBackground[activeBackgroundKey]:(Array.isArray(d.props)?d.props.filter(p=>String(p?.backgroundKey||"")===activeBackgroundKey):[]);
  const backgroundQuestPins=Array.isArray(d.questPins)?d.questPins.filter(p=>String(p?.backgroundKey||"")===activeBackgroundKey):(Array.isArray(d.questPinsByBackground?.[activeBackgroundKey])?d.questPinsByBackground[activeBackgroundKey]:[]);
  (d.npcs||[]).filter(n=>n.visible).forEach((n,i)=>{
    const layout=getSceneEntityLayout(n);
    const fadeClass=n.imageSwapAt&&Date.now()-(n.imageSwapAt||0)<SCENE_IMAGE_SWAP_MS+100?"is-image-swapping":"";
    sceneImgs.push(`<div class="totm-scene-img totm-scene-npc ${fadeClass}" data-nidx="${i}" style="left:${layout.posX}%;top:${layout.posY}%;transform:translate(-50%,-50%) scale(${layout.scale/100});"><img src="${attr(getSceneEntityImage(n))}" alt="${attr(n.name)}"/></div>`);
  });
  backgroundProps.forEach((p,i)=>{
    const layout=getSceneEntityLayout(p);
    const fadeClass=p.imageSwapAt&&Date.now()-(p.imageSwapAt||0)<SCENE_IMAGE_SWAP_MS+100?"is-image-swapping":"";
    sceneImgs.push(`<div class="totm-scene-img totm-scene-prop ${fadeClass}" data-pidx="${i}" data-prop-id="${attr(p.id||"")}" style="left:${layout.posX}%;top:${layout.posY}%;transform:translate(-50%,-50%) scale(${layout.scale/100});"><img src="${attr(getSceneEntityImage(p))}" alt="${attr(p.name||"Prop")}"/></div>`);
  });
  backgroundQuestPins.forEach((p,i)=>{
    const img=p.image||getQuestPinImage?.(p.type||"quest");
    const questName=foundry.utils.escapeHTML(String(p.name||p.label||"Quest"));
    sceneImgs.push(`<div class="totm-scene-img totm-scene-quest" data-qidx="${i}" data-quest-id="${attr(p.id||"")}" title="${questName}" aria-label="${questName}" style="left:${p.posX??50}%;top:${p.posY??50}%;transform:translate(-50%,-50%) scale(${(p.scale??100)/100});"><img src="${attr(img)}" alt="${questName}"/></div>`);
  });
  if(d.boardActorsVisible!==false){
    (d.boardActors||[]).forEach((entry,i)=>{
      const img=getStageActorImage(entry,d,{inCombat:!!d.combatActive});
      const layout=getStageActorLayout(entry,{inCombat:!!d.combatActive});
      sceneImgs.push(`<div class="totm-scene-img totm-stage-actor" data-baidx="${i}" data-board-actor-id="${attr(entry.id||"")}" data-actor-id="${attr(entry.actorId||"")}" style="left:${layout.posX}%;top:${layout.posY}%;transform:translate(-50%,-50%) scale(${layout.scale/100});"><img src="${attr(img)}" alt="${attr(entry.name||"Character")}"/></div>`);
    });
  }
  (d.actors||[]).forEach((a,i)=>{
    if(!a.pinVisible)return;
    const pinImg=getPinImage(a),pinSize=Number(a.pinSize||64),pinColor=getActorPinColor(a.id);
    sceneImgs.push(`<div class="totm-map-pin ${canControlActorPin(a.id)?"is-owner":""}" data-pin-owner="actor" data-actor-id="${attr(a.id)}" data-idx="${i}" style="${attr(`--totm-pin-color:${pinColor};left:${a.pinX??50}%;top:${a.pinY??50}%;width:${pinSize}px;height:${pinSize}px;`)}"><div class="totm-map-pin-core" style="${attr(`background-image:${cssUrl(pinImg)}`)}"></div></div>`);
  });
  if(d.gmPin?.visible){
    const pinImg=d.gmPin.image||game.users?.activeGM?.avatar||game.user.avatar||"icons/svg/mystery-man.svg";
    const pinSize=Number(d.gmPin.size||64),pinColor=getGmPinColor();
    sceneImgs.push(`<div class="totm-map-pin gm-pin ${canControlGmPin()?"is-owner":""}" data-pin-owner="gm" style="${attr(`--totm-pin-color:${pinColor};left:${d.gmPin.posX??50}%;top:${d.gmPin.posY??50}%;width:${pinSize}px;height:${pinSize}px;`)}"><div class="totm-map-pin-core" style="${attr(`background-image:${cssUrl(pinImg)}`)}"></div></div>`);
  }
  const enemyTargets=scene?getTargets(scene):[];
  const now=Date.now();
  (d.enemies||[]).forEach((e,i)=>{
    normalizeEnemyEntry(e);
    const a=getEncounterActor(e,scene);
    const layout=getSceneEntityLayout(e);
    const img=getSceneEntityImage?.(e)||a?.prototypeToken?.texture?.src||a?.img||e.image||"icons/svg/mystery-man.svg";
    const fadeClass=e.transitionState&&now-(e.transitionAt||0)<ENEMY_FADE_MS+150?`is-${e.transitionState}`:"";
    const imageFadeClass=e.imageSwapAt&&Date.now()-(e.imageSwapAt||0)<SCENE_IMAGE_SWAP_MS+100?"is-image-swapping":"";
    sceneImgs.push(`<div class="totm-scene-img totm-scene-enemy ${enemyTargets.includes(enemyTargetId(e))?"enemy-targeted":""} ${fadeClass} ${imageFadeClass}" data-eidx="${i}" data-target-id="${attr(enemyTargetId(e))}" data-token-id="${attr(e.tokenId||"")}" style="--totm-scene-scale:${layout.scale/100};left:${layout.posX}%;top:${layout.posY}%;transform:translate(-50%,-50%) scale(var(--totm-scene-scale));"><img src="${attr(img)}" alt="${attr(e.name)}"/></div>`);
  });
  return sceneImgs;
}

export function renderEnemyBar({d,scene,deps}){
  const {getTargets,normalizeEnemyEntry,getEncounterActor,getRes,enemyTargetId,getEnemyTargetUsers,ENEMY_FADE_MS,isGM}=deps;
  const enemies=d.enemies||[],targets=scene?getTargets(scene):[];
  if(!d.combatActive||!enemies.length)return "";
  const now=Date.now();
  return `<div id="totm-enemy-wrap"><div id="totm-enemy-tools"><button class="totm-tb-btn" data-target-act="random"><i class="fas fa-dice"></i> Random Target</button><button class="totm-tb-btn" data-target-act="next"><i class="fas fa-crosshairs"></i> T Target</button><button class="totm-tb-btn" data-target-act="clear"><i class="fas fa-ban"></i> Clear</button></div><div id="totm-enemy-bar">${enemies.map((e,i)=>{normalizeEnemyEntry(e);const a=getEncounterActor(e,scene);const res=getRes(e,scene,{enemy:true,auto:true}).filter(r=>r.label==="HP"||r.label==="MP");const img=a?.prototypeToken?.texture?.src||a?.img||e.img||"icons/svg/mystery-man.svg";const dead=(res.find(r=>r.label==="HP")?.value??1)<=0,targeted=targets.includes(enemyTargetId(e)),targeters=getEnemyTargetUsers(e,scene);const fadeClass=e.transitionState&&now-(e.transitionAt||0)<ENEMY_FADE_MS+150?`is-${e.transitionState}`:"";return `<div class="totm-enemy-card ${dead?"enemy-dead":""} ${targeted?"enemy-targeted":""} ${fadeClass}" data-eidx="${i}" data-target-id="${attr(enemyTargetId(e))}"><div class="totm-card-bg" style="${attr(`background-image:${cssUrl(img)}`)}"></div><div class="totm-card-overlay"></div><div class="totm-enemy-targeters">${targeters.map(t=>`<span class="totm-enemy-targeter" title="${attr(t.name)}" style="${attr(`--targeter-color:${t.color};background-image:${cssUrl(t.img)}`)}"></span>`).join("")}</div><div class="totm-enemy-actions"><button data-eact="target" class="${targeted?"active-target":""}" title="Target"><i class="fas fa-crosshairs"></i></button>${isGM()?`<button data-eact="remove" title="Remove"><i class="fas fa-times"></i></button>`:""}</div><div class="totm-card-content"><div class="totm-actor-name">${esc(e.name)}</div>${deps.renderBars(res,{kind:"enemy"})}</div></div>`;}).join("")}</div></div>`;
}

export function bindEnemyStageEvents({el,scene,d,deps}){
  const {isGM,setTargets,getTargets,targetRandomEnemy,targetNextEnemy,toggleEnemyTarget,getEncounterActor,pruneEnemyTokenDocs,saveData,emit,refreshUI,scheduleRefresh,makeEnemyEntry,ensureEnemyTokenDocs,openDragPos,getQuestPinImage,addStageActor,openStageActorCfg,removeStageActor,moveStageActor,moveStageActorToEdge,toggleSceneEntityImage,hasSceneEntityAltImage,confirmDestructive}=deps;
  const refresh=()=>scheduleRefresh?scheduleRefresh(scene):refreshUI(scene);
  const confirmDelete=(title,content)=>confirmDestructive?confirmDestructive({title,content,yes:"Delete"}):Promise.resolve(true);
  const wait = ms => new Promise(resolve=>setTimeout(resolve, ms));
  const animateSwapThen = async (node, action) => {
    if(node) node.classList.add("is-image-swap-pending");
    await wait(140);
    await action();
  };
  el.querySelector("#totm-enemy-tools")?.addEventListener("click",async e=>{
    const btn=e.target.closest("[data-target-act]");
    if(!btn)return;
    const act=btn.dataset.targetAct;
    if(act==="random")await targetRandomEnemy(scene,d);
    else if(act==="next")await targetNextEnemy(scene,d);
    else if(act==="clear")await setTargets(scene,[],game.user,d);
  });

  if(!isGM())return;

  const removeNpcAtIndex = async idx => {
    if(!Number.isInteger(idx)||idx<0||!Array.isArray(d.npcs)||!d.npcs[idx])return;
    if(!await confirmDelete("Delete NPC?",`${d.npcs[idx].name||"NPC"} will be removed from this scene.`))return;
    d.npcs.splice(idx,1);
    await saveData(scene,d);
    emit();
    refreshUI(scene);
  };
  const toggleNpcImageAtIndex = async (idx,node=null) => {
    if(!Number.isInteger(idx)||idx<0||!Array.isArray(d.npcs)||!d.npcs[idx])return false;
    await animateSwapThen(node, async ()=>{
      if(!toggleSceneEntityImage(d.npcs[idx]))return false;
      await saveData(scene,d);
      emit();
      refreshUI(scene);
    });
    return true;
  };
  const removeEnemyAtIndex = async idx => {
    if(!Number.isInteger(idx)||idx<0||!Array.isArray(d.enemies)||!d.enemies[idx])return;
    if(!await confirmDelete("Delete Enemy?",`${d.enemies[idx].name||"Enemy"} will be removed from this encounter.`))return;
    const targetId=d.enemies[idx].instanceId||d.enemies[idx].id;
    d.enemies.splice(idx,1);
    if(!d.enemies.length)d.combatActive=false;
    await setTargets(scene,getTargets(scene).filter(id=>id!==targetId),game.user,d);
    await pruneEnemyTokenDocs(scene,d);
    await saveData(scene,d);
    emit();
    refreshUI(scene);
  };
  const toggleEnemyImageAtIndex = async (idx,node=null) => {
    if(!Number.isInteger(idx)||idx<0||!Array.isArray(d.enemies)||!d.enemies[idx])return false;
    if(!hasSceneEntityAltImage(d.enemies[idx]))return false;
    await animateSwapThen(node, async ()=>{
      toggleSceneEntityImage(d.enemies[idx]);
      await saveData(scene,d);
      emit();
      refreshUI(scene);
    });
    return true;
  };

  const getActiveBackgroundKey = () => String(d.background||"");
  const syncCurrentQuestView = bucket => {
    const key=getActiveBackgroundKey();
    const normalized=(Array.isArray(bucket)?bucket:[]).map(pin=>foundry.utils.deepClone({...pin,backgroundKey:key}));
    if(!Array.isArray(d.questPins)) d.questPins=[];
    d.questPins=d.questPins.filter(pin=>String(pin?.backgroundKey||"")!==key);
    d.questPins.push(...normalized);
    if(!d.questPinsByBackground || typeof d.questPinsByBackground!=="object" || Array.isArray(d.questPinsByBackground)) d.questPinsByBackground={};
    d.questPinsByBackground[key]=normalized.map(pin=>foundry.utils.deepClone(pin));
    return d.questPinsByBackground[key];
  };
  const getQuestBucket = () => {
    const key=getActiveBackgroundKey();
    if(!Array.isArray(d.questPins)) d.questPins=[];
    if(!d.questPinsByBackground || typeof d.questPinsByBackground!=="object" || Array.isArray(d.questPinsByBackground)) d.questPinsByBackground={};
    const hasFlatData=d.questPins.some(pin=>pin);
    const hasBucketData=Object.values(d.questPinsByBackground).some(bucket=>Array.isArray(bucket)&&bucket.length);
    if(!hasFlatData && hasBucketData){
      const flat=[];
      for(const [bucketKey,bucket] of Object.entries(d.questPinsByBackground)){
        if(!Array.isArray(bucket))continue;
        flat.push(...bucket.map(pin=>foundry.utils.deepClone({...pin,backgroundKey:String(pin?.backgroundKey||bucketKey)})));
      }
      d.questPins=flat;
    }else if(!hasBucketData && d.questPins.length){
      const legacy=d.questPins.splice(0,d.questPins.length);
      for(const pin of legacy){
        const pinKey=String(pin?.backgroundKey||key);
        if(!Array.isArray(d.questPinsByBackground[pinKey])) d.questPinsByBackground[pinKey]=[];
        d.questPinsByBackground[pinKey].push(foundry.utils.deepClone({...pin,backgroundKey:pinKey}));
        d.questPins.push(foundry.utils.deepClone({...pin,backgroundKey:pinKey}));
      }
    }
    const current=d.questPins.filter(pin=>String(pin?.backgroundKey||"")===key);
    return syncCurrentQuestView(current);
  };
  const saveQuestBucket = async bucket => {
    syncCurrentQuestView(bucket);
    await saveData(scene,d);
    emit();
    refreshUI(scene);
  };
  const openQuestPinMenu = pin => {
    new Dialog({
      title: pin.name||pin.label||"Quest Pin",
      content: `<form><div class="form-group"><label>Name</label><input name="name" value="${foundry.utils.escapeHTML(String(pin.name||"Quest"))}"/></div><div class="form-group"><label>State</label><select name="type"><option value="quest" ${pin.type==="quest"?"selected":""}>Exclamation</option><option value="question" ${pin.type==="question"?"selected":""}>Question Mark</option><option value="complete" ${pin.type==="complete"?"selected":""}>Tick</option></select></div></form>`,
      buttons: {
        move:{icon:'<i class="fas fa-arrows-alt"></i>',label:"Move",callback:()=>{
          const bucket=getQuestBucket();
          const livePin=bucket.find(p=>p?.id===pin.id);
          if(!livePin)return;
          openDragPos?.(livePin,scene,d,async()=>{await saveQuestBucket(bucket);});
        }},
        del:{icon:'<i class="fas fa-trash"></i>',label:"Delete",callback:async()=>{const bucket=getQuestBucket();const idx=bucket.findIndex(p=>p?.id===pin.id);if(idx<0)return;bucket.splice(idx,1);await saveQuestBucket(bucket);}},
        save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async html=>{
          const bucket=getQuestBucket();
          const livePin=bucket.find(p=>p?.id===pin.id);
          if(!livePin)return;
          livePin.name=String(html.find("[name=name]").val()||"Quest").trim()||"Quest";
          livePin.type=String(html.find("[name=type]").val()||"quest");
          livePin.image=getQuestPinImage?.(livePin.type);
          livePin.label=livePin.type==="question"?"Question":livePin.type==="complete"?"Complete":"Quest";
          await saveQuestBucket(bucket);
        }}
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
    if(!await confirmDelete("Delete Prop?","This prop will be removed from the scene."))return;
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
  const toggleScenePropImageById = async (propId,node=null) => {
    if(!propId)return false;
    const propBucket=getPropBucket();
    const prop=propBucket.find(p=>p?.id===propId);
    if(!prop||!hasSceneEntityAltImage(prop))return false;
    await animateSwapThen(node, async ()=>{
      toggleSceneEntityImage(prop);
      syncCurrentPropView(propBucket);
      await saveData(scene,d);
      emit();
      refreshUI(scene);
    });
    return true;
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
        if(actor.type === "character"){
          await addStageActor(scene, d, actor, {
            posX: Number.isFinite(posX) ? posX : undefined,
            posY: Number.isFinite(posY) ? posY : undefined
          });
          return;
        }
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

  const openEnemyPosition = (idx,node=null) => {
    const en=d.enemies?.[idx];
    if(!en)return;
    openDragPos?.(en, scene, d, async () => {
      await ensureEnemyTokenDocs(scene, d);
      await saveData(scene, d);
      emit();
      refresh();
    }, async () => {
      await removeEnemyAtIndex(idx);
    });
  };
  const openNpcPosition = (idx,node=null) => {
    const npc=d.npcs?.[idx];
    if(!npc)return;
    openDragPos?.(npc, scene, d, async () => {
      await saveData(scene, d);
      emit();
      refresh();
    }, async () => {
      await removeNpcAtIndex(idx);
    });
  };
  const openPropPosition = (idx,node=null) => {
    const propBucket=getPropBucket();
    const prop=propBucket[idx];
    if(!prop)return;
    openDragPos?.(prop, scene, d, async () => {
      syncCurrentPropView(propBucket);
      await saveData(scene,d);
      emit();
      refresh();
    }, async () => {
      await deleteScenePropById(prop.id);
    });
  };

  el.querySelector("#totm-enemy-bar")?.addEventListener("click",async e=>{
    const card=e.target.closest(".totm-enemy-card"),ab=e.target.closest("[data-eact]");
    if(!card)return;
    const i=+card.dataset.eidx,targetId=card.dataset.targetId;
    if(ab?.dataset.eact==="remove"){
      await removeEnemyAtIndex(i);
      return;
    }
    await toggleEnemyTarget(scene,d,targetId);
  });
  el.querySelector("#totm-enemy-bar")?.addEventListener("dblclick",e=>{
    const card=e.target.closest(".totm-enemy-card");
    if(!card)return;
    const en=d.enemies[+card.dataset.eidx],a=en?getEncounterActor(en,scene):null;
    a?.sheet?.render?.(true);
  });
  el.querySelector("#totm-enemy-bar")?.addEventListener("contextmenu",e=>{
    const card=e.target.closest(".totm-enemy-card");
    if(!card)return;
    e.preventDefault();
    openEnemyPosition(+card.dataset.eidx,card);
  });

  const stage=el.querySelector("#totm-stage");
  stage?.addEventListener("click",async e=>{
    const enemy=e.target.closest(".totm-scene-enemy");
    if(enemy){
      if(!d.combatActive)return;
      const enemyId=enemy.dataset.targetId;
      if(enemyId)await toggleEnemyTarget(scene,d,enemyId);
      return;
    }
    const npc=e.target.closest(".totm-scene-npc");
    if(npc&&e.shiftKey){
      e.preventDefault();
      e.stopPropagation();
      await removeNpcAtIndex(+npc.dataset.nidx);
      return;
    }
    const prop=e.target.closest(".totm-scene-prop");
    if(prop&&e.shiftKey){
      e.preventDefault();
      e.stopPropagation();
      const propBucket=getPropBucket(),idx=+prop.dataset.pidx,liveProp=propBucket[idx];
      if(liveProp)await deleteScenePropById(liveProp.id);
      return;
    }
    const actor=e.target.closest(".totm-stage-actor");
    if(actor&&(e.shiftKey||e.altKey)){
      e.preventDefault();
      e.stopPropagation();
      const idx=+actor.dataset.baidx;
      if(!Number.isInteger(idx)||idx<0)return;
      if(e.shiftKey)await moveStageActor(scene,d,idx,1);
      else await moveStageActor(scene,d,idx,-1);
    }
  });
  stage?.addEventListener("dblclick",e=>{
    const enemy=e.target.closest(".totm-scene-enemy");
    if(enemy){
      const en=d.enemies[+enemy.dataset.eidx],a=en?getEncounterActor(en,scene):null;
      a?.sheet?.render?.(true);
      return;
    }
    const npcNode=e.target.closest(".totm-scene-npc");
    if(npcNode){
      const npc=d.npcs?.[+npcNode.dataset.nidx];
      const actor=game.actors?.contents?.find?.(a=>a.img===npc?.image||a.prototypeToken?.texture?.src===npc?.image);
      actor?.sheet?.render?.(true);
      return;
    }
    const actorNode=e.target.closest(".totm-stage-actor");
    if(actorNode){
      const entry=d.boardActors?.[+actorNode.dataset.baidx],actor=entry?game.actors.get(entry.actorId):null;
      actor?.sheet?.render?.(true);
    }
  });
  stage?.addEventListener("contextmenu",async e=>{
    const enemy=e.target.closest(".totm-scene-enemy");
    if(enemy){
      e.preventDefault();
      const idx=+enemy.dataset.eidx,en=d.enemies[idx];
      if(!en)return;
      if(!e.shiftKey&&hasSceneEntityAltImage(en)){
        void toggleEnemyImageAtIndex(idx,enemy);
        return;
      }
      openEnemyPosition(idx,enemy);
      return;
    }
    const npc=e.target.closest(".totm-scene-npc");
    if(npc){
      e.preventDefault();
      const idx=+npc.dataset.nidx,liveNpc=d.npcs?.[idx];
      if(!liveNpc)return;
      if(!e.shiftKey&&hasSceneEntityAltImage(liveNpc)){
        void toggleNpcImageAtIndex(idx,npc);
        return;
      }
      openNpcPosition(idx,npc);
      return;
    }
    const prop=e.target.closest(".totm-scene-prop");
    if(prop){
      e.preventDefault();
      const idx=+prop.dataset.pidx,propBucket=getPropBucket(),liveProp=propBucket[idx];
      if(!liveProp)return;
      if(!e.shiftKey&&hasSceneEntityAltImage(liveProp)){
        await toggleScenePropImageById(liveProp.id,prop);
        return;
      }
      if(e.altKey){
        await deleteScenePropById(liveProp.id);
        return;
      }
      openPropPosition(idx,prop);
      return;
    }
    const actor=e.target.closest(".totm-stage-actor");
    if(actor){
      e.preventDefault();
      const idx=+actor.dataset.baidx;
      if(!Number.isInteger(idx)||idx<0)return;
      if(e.shiftKey){await moveStageActorToEdge(scene,d,idx,"front");return;}
      if(e.altKey){await moveStageActorToEdge(scene,d,idx,"back");return;}
      openStageActorCfg?.(scene,d,idx);
      return;
    }
    const quest=e.target.closest(".totm-scene-quest");
    if(quest){
      e.preventDefault();
      const idx=+quest.dataset.qidx,pin=Number.isInteger(idx)&&idx>=0?getQuestBucket()[idx]:null;
      if(pin)openQuestPinMenu(pin);
    }
  });
}
