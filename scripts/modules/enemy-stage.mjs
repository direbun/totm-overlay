const esc=value=>foundry.utils.escapeHTML(String(value??""));
const attr=esc;
const cssUrl=value=>`url("${String(value??"").replace(/\\/g,"/").replace(/"/g,"%22").replace(/[\r\n\f]/g,"")}")`;
const UNKNOWN_ENEMY_NAME="[Unknown]";
const UNKNOWN_ENEMY_IMAGE=`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="32" fill="#171b26"/><circle cx="128" cy="128" r="86" fill="#252b3a" stroke="#d8cfbf" stroke-width="8"/><text x="128" y="158" text-anchor="middle" font-family="Arial, sans-serif" font-size="116" font-weight="700" fill="#d8cfbf">?</text></svg>`)}`;
const enemyRevealState=(enemy,key)=>!!enemy?.reveal?.[key]||!!enemy?.[`${key}Revealed`];
const canSeeEnemyDetail=(enemy,key,isGM)=>!!isGM?.()||enemyRevealState(enemy,key);
const enemyDisplayName=(enemy,isGM)=>canSeeEnemyDetail(enemy,"name",isGM)?(enemy?.name||"Enemy"):UNKNOWN_ENEMY_NAME;
const enemyDisplayImage=(enemy,image,isGM)=>canSeeEnemyDetail(enemy,"image",isGM)?image:UNKNOWN_ENEMY_IMAGE;
const enemyDisplayDescription=(enemy,isGM)=>canSeeEnemyDetail(enemy,"description",isGM)?String(enemy?.description||"").trim():"";

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
    SCENE_IMAGE_SWAP_MS,
    isGM
  }=deps;

  const sceneImgs=[];
  const activeBackgroundKey=String(d.background||"");
  const backgroundProps=Array.isArray(d.propsByBackground?.[activeBackgroundKey])?d.propsByBackground[activeBackgroundKey]:(Array.isArray(d.props)?d.props.filter(p=>String(p?.backgroundKey||"")===activeBackgroundKey):[]);
  const backgroundQuestPins=Array.isArray(d.questPins)?d.questPins.filter(p=>String(p?.backgroundKey||"")===activeBackgroundKey):(Array.isArray(d.questPinsByBackground?.[activeBackgroundKey])?d.questPinsByBackground[activeBackgroundKey]:[]);
  (d.npcs||[]).forEach((n,i)=>{
    if(!n.visible)return;
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
    const actualImg=getSceneEntityImage?.(e)||a?.prototypeToken?.texture?.src||a?.img||e.image||"icons/svg/mystery-man.svg";
    const img=enemyDisplayImage(e,actualImg,isGM);
    const displayName=enemyDisplayName(e,isGM);
    const fadeClass=e.transitionState&&now-(e.transitionAt||0)<ENEMY_FADE_MS+150?`is-${e.transitionState}`:"";
    const imageFadeClass=e.imageSwapAt&&Date.now()-(e.imageSwapAt||0)<SCENE_IMAGE_SWAP_MS+100?"is-image-swapping":"";
    sceneImgs.push(`<div class="totm-scene-img totm-scene-enemy ${enemyTargets.includes(enemyTargetId(e))?"enemy-targeted":""} ${fadeClass} ${imageFadeClass} ${canSeeEnemyDetail(e,"image",isGM)?"":"is-unrevealed-image"}" data-eidx="${i}" data-target-id="${attr(enemyTargetId(e))}" data-token-id="${attr(e.tokenId||"")}" style="--totm-scene-scale:${layout.scale/100};left:${layout.posX}%;top:${layout.posY}%;transform:translate(-50%,-50%) scale(var(--totm-scene-scale));"><img src="${attr(img)}" alt="${attr(displayName)}"/></div>`);
  });
  return sceneImgs;
}

export function renderEnemyBar({d,scene,deps}){
  const {getTargets,normalizeEnemyEntry,getEncounterActor,getRes,enemyTargetId,getEnemyTargetUsers,ENEMY_FADE_MS,isGM}=deps;
  const enemies=d.enemies||[],targets=scene?getTargets(scene):[];
  if(!d.combatActive||!enemies.length)return "";
  const now=Date.now();
  const tools=isGM()
    ? `<button class="totm-tb-btn" data-target-act="random-player"><i class="fas fa-dice"></i> Random Player</button><button class="totm-tb-btn" data-target-act="choose-player"><i class="fas fa-user-check"></i> Choose Player</button><button class="totm-tb-btn" data-target-act="choose-enemy"><i class="fas fa-crosshairs"></i> Choose Enemy</button><button class="totm-tb-btn" data-target-act="random-enemy"><i class="fas fa-dice-d20"></i> Random Enemy</button><button class="totm-tb-btn" data-target-act="clear-all"><i class="fas fa-ban"></i> Clear</button>`
    : `<button class="totm-tb-btn" data-target-act="random"><i class="fas fa-dice"></i> Random Target</button><button class="totm-tb-btn" data-target-act="next"><i class="fas fa-crosshairs"></i> T Target</button><button class="totm-tb-btn" data-target-act="clear"><i class="fas fa-ban"></i> Clear</button>`;
  return `<div id="totm-enemy-wrap"><div id="totm-enemy-tools">${tools}</div><div id="totm-enemy-bar">${enemies.map((e,i)=>{normalizeEnemyEntry(e);const a=getEncounterActor(e,scene);const res=getRes(e,scene,{enemy:true,auto:true}).filter(r=>r.label==="HP"||r.label==="MP");const actualImg=a?.prototypeToken?.texture?.src||a?.img||e.img||e.image||"icons/svg/mystery-man.svg";const img=enemyDisplayImage(e,actualImg,isGM),displayName=enemyDisplayName(e,isGM),description=enemyDisplayDescription(e,isGM);const dead=(res.find(r=>r.label==="HP")?.value??1)<=0,targeted=targets.includes(enemyTargetId(e)),targeters=getEnemyTargetUsers(e,scene);const fadeClass=e.transitionState&&now-(e.transitionAt||0)<ENEMY_FADE_MS+150?`is-${e.transitionState}`:"";const revealButtons=isGM()?`<button data-eact="reveal-name" class="${enemyRevealState(e,"name")?"active-reveal":""}" title="Reveal Name"><i class="fas fa-signature"></i></button><button data-eact="reveal-image" class="${enemyRevealState(e,"image")?"active-reveal":""}" title="Reveal Image"><i class="fas fa-image"></i></button><button data-eact="reveal-description" class="${enemyRevealState(e,"description")?"active-reveal":""}" title="Reveal Description"><i class="fas fa-align-left"></i></button><button data-eact="remove" title="Remove"><i class="fas fa-times"></i></button>`:"";return `<div class="totm-enemy-card ${dead?"enemy-dead":""} ${targeted?"enemy-targeted":""} ${description?"has-description":""} ${canSeeEnemyDetail(e,"image",isGM)?"":"is-unrevealed-image"} ${fadeClass}" data-eidx="${i}" data-target-id="${attr(enemyTargetId(e))}"><div class="totm-card-bg" style="${attr(`background-image:${cssUrl(img)}`)}"></div><div class="totm-card-overlay"></div><div class="totm-enemy-targeters">${targeters.map(t=>`<span class="totm-enemy-targeter" title="${attr(t.name)}" style="${attr(`--targeter-color:${t.color};background-image:${cssUrl(t.img)}`)}"></span>`).join("")}</div><div class="totm-enemy-actions"><button data-eact="target" class="${targeted?"active-target":""}" title="Target"><i class="fas fa-crosshairs"></i></button>${revealButtons}</div><div class="totm-card-content"><div class="totm-actor-name">${esc(displayName)}</div>${description?`<div class="totm-enemy-desc" title="${attr(description)}">${esc(description)}</div>`:""}${deps.renderBars(res,{kind:"enemy"})}</div></div>`;}).join("")}</div></div>`;
}

export function bindEnemyStageEvents({el,scene,d,deps}){
  const {isGM,setTargets,getTargets,targetRandomEnemy,targetNextEnemy,targetRandomAttackPlayer,targetRandomAttackEnemy,openAttackTargetChooser,clearAttackTargets,toggleEnemyTarget,getEncounterActor,pruneEnemyTokenDocs,saveData,getData,emit,refreshUI,scheduleRefresh,makeEnemyEntry,normalizeEnemyEntry,ensureEnemyTokenDocs,openDragPos,getQuestPinImage,addStageActor,openStageActorCfg,openStageActorLayoutPos,getBoardActorFromElement,removeStageActor,moveStageActor,moveStageActorToEdge,toggleSceneEntityImage,hasSceneEntityAltImage,confirmDestructive}=deps;
  const refresh=()=>scheduleRefresh?scheduleRefresh(scene):refreshUI(scene);
  const confirmDelete=(title,content)=>confirmDestructive?confirmDestructive({title,content,yes:"Delete"}):Promise.resolve(true);
  const liveData=()=>getData?.(scene)||d;
  const boardActorSelector="#totm-board-actor-layer .totm-stage-actor, #totm-board-actor-layer .totm-board-actor";
  const resolveBoardActor=node=>{
    const found=getBoardActorFromElement?.(scene,node);
    if(found)return found;
    const data=liveData();
    const idx=Number(node?.dataset?.baidx);
    const entry=Number.isInteger(idx)&&idx>=0?data.boardActors?.[idx]:null;
    const actor=entry?game.actors.get(entry.actorId):null;
    return entry&&actor?{d:data,entry,index:idx,actor}:null;
  };
  const warnMissingBoardActor=()=>ui.notifications.warn("Could not find board character placement data.");
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
    const data=liveData();
    if(act==="random")await targetRandomEnemy(scene,data);
    else if(act==="next")await targetNextEnemy(scene,data);
    else if(act==="clear")await setTargets(scene,[],game.user,data);
    else if(act==="random-player")await targetRandomAttackPlayer?.(scene,data);
    else if(act==="choose-player")openAttackTargetChooser?.(scene,data,{scope:"players"});
    else if(act==="choose-enemy")openAttackTargetChooser?.(scene,data,{scope:"enemies"});
    else if(act==="random-enemy")await targetRandomAttackEnemy?.(scene,data);
    else if(act==="clear-all")await clearAttackTargets?.(scene,data);
  });

  el.querySelector("#totm-enemy-bar")?.addEventListener("click",async e=>{
    const card=e.target.closest(".totm-enemy-card"),ab=e.target.closest("[data-eact]");
    if(!card)return;
    const i=+card.dataset.eidx,targetId=card.dataset.targetId;
    const data=liveData();
    const act=ab?.dataset.eact||"";
    if(act.startsWith("reveal-")){
      if(!isGM())return;
      const key=act.slice("reveal-".length);
      if(!["name","image","description"].includes(key))return;
      const enemy=data.enemies?.[i];
      if(!enemy)return;
      normalizeEnemyEntry?.(enemy);
      if(!enemy.reveal||typeof enemy.reveal!=="object"||Array.isArray(enemy.reveal))enemy.reveal={};
      enemy.reveal[key]=!enemy.reveal[key];
      await saveData(scene,data);
      emit();
      refresh();
      return;
    }
    if(act==="remove"){
      if(!isGM())return;
      await removeEnemyAtIndex(i);
      return;
    }
    if(targetId)await toggleEnemyTarget(scene,data,targetId,{exclusive:!e.shiftKey});
  });

  const stage=el.querySelector("#totm-stage-wrap")||el.querySelector("#totm-stage");
  stage?.addEventListener("click",async e=>{
    const enemy=e.target.closest(".totm-scene-enemy");
    if(!enemy)return;
    const data=liveData();
    if(!data.combatActive)return;
    const enemyId=enemy.dataset.targetId;
    if(enemyId)await toggleEnemyTarget(scene,data,enemyId,{exclusive:!e.shiftKey});
  });

  if(!isGM())return;

  const removeNpcAtIndex = async idx => {
    const data=liveData();
    if(!Number.isInteger(idx)||idx<0||!Array.isArray(data.npcs)||!data.npcs[idx])return;
    if(!await confirmDelete("Delete NPC?",`${data.npcs[idx].name||"NPC"} will be removed from this scene.`))return;
    data.npcs.splice(idx,1);
    await saveData(scene,data);
    emit();
    refreshUI(scene);
  };
  const toggleNpcImageAtIndex = async (idx,node=null) => {
    const data=liveData();
    if(!Number.isInteger(idx)||idx<0||!Array.isArray(data.npcs)||!data.npcs[idx])return false;
    await animateSwapThen(node, async ()=>{
      const latest=liveData();
      const npc=latest.npcs?.[idx];
      if(!npc||!toggleSceneEntityImage(npc))return false;
      await saveData(scene,latest);
      emit();
      refreshUI(scene);
    });
    return true;
  };
  const removeEnemyAtIndex = async idx => {
    const data=liveData();
    if(!Number.isInteger(idx)||idx<0||!Array.isArray(data.enemies)||!data.enemies[idx])return;
    if(!await confirmDelete("Delete Enemy?",`${data.enemies[idx].name||"Enemy"} will be removed from this encounter.`))return;
    const targetId=data.enemies[idx].instanceId||data.enemies[idx].id;
    data.enemies.splice(idx,1);
    if(!data.enemies.length)data.combatActive=false;
    await setTargets(scene,getTargets(scene).filter(id=>id!==targetId),game.user,data);
    await pruneEnemyTokenDocs(scene,data);
    await saveData(scene,data);
    emit();
    refreshUI(scene);
  };
  const toggleEnemyImageAtIndex = async (idx,node=null) => {
    const data=liveData();
    if(!Number.isInteger(idx)||idx<0||!Array.isArray(data.enemies)||!data.enemies[idx])return false;
    if(!hasSceneEntityAltImage(data.enemies[idx]))return false;
    await animateSwapThen(node, async ()=>{
      const latest=liveData();
      const enemy=latest.enemies?.[idx];
      if(!enemy)return false;
      toggleSceneEntityImage(enemy);
      await saveData(scene,latest);
      emit();
      refreshUI(scene);
    });
    return true;
  };

  const getActiveBackgroundKey = data => String((data||liveData()).background||"");
  const ensureQuestCollections = data => {
    if(!Array.isArray(data.questPins)) data.questPins=[];
    if(!data.questPinsByBackground || typeof data.questPinsByBackground!=="object" || Array.isArray(data.questPinsByBackground)) data.questPinsByBackground={};
    return data;
  };
  const syncCurrentQuestView = (data,bucket,key=getActiveBackgroundKey(data)) => {
    ensureQuestCollections(data);
    const normalized=(Array.isArray(bucket)?bucket:[]).map(pin=>foundry.utils.deepClone({...pin,backgroundKey:key}));
    data.questPins=data.questPins.filter(pin=>String(pin?.backgroundKey||"")!==key);
    data.questPins.push(...normalized);
    data.questPinsByBackground[key]=normalized.map(pin=>foundry.utils.deepClone(pin));
    return data.questPinsByBackground[key];
  };
  const getQuestBucketState = () => {
    const data=ensureQuestCollections(liveData());
    const key=getActiveBackgroundKey(data);
    const hasFlatData=data.questPins.some(pin=>pin);
    const hasBucketData=Object.values(data.questPinsByBackground).some(bucket=>Array.isArray(bucket)&&bucket.length);
    if(!hasFlatData && hasBucketData){
      const flat=[];
      for(const [bucketKey,bucket] of Object.entries(data.questPinsByBackground)){
        if(!Array.isArray(bucket))continue;
        flat.push(...bucket.map(pin=>foundry.utils.deepClone({...pin,backgroundKey:String(pin?.backgroundKey||bucketKey)})));
      }
      data.questPins=flat;
    }else if(!hasBucketData && data.questPins.length){
      const legacy=data.questPins.splice(0,data.questPins.length);
      for(const pin of legacy){
        const pinKey=String(pin?.backgroundKey||key);
        if(!Array.isArray(data.questPinsByBackground[pinKey])) data.questPinsByBackground[pinKey]=[];
        data.questPinsByBackground[pinKey].push(foundry.utils.deepClone({...pin,backgroundKey:pinKey}));
        data.questPins.push(foundry.utils.deepClone({...pin,backgroundKey:pinKey}));
      }
    }
    const current=data.questPins.filter(pin=>String(pin?.backgroundKey||"")===key);
    const bucket=syncCurrentQuestView(data,current,key);
    return {data,key,bucket};
  };
  const getQuestBucket = () => getQuestBucketState().bucket;
  const saveQuestBucket = async (data,bucket,key=getActiveBackgroundKey(data)) => {
    syncCurrentQuestView(data,bucket,key);
    await saveData(scene,data);
    emit();
    refreshUI(scene,data);
  };
  const getQuestPinRef = pinId => {
    const {data,key,bucket}=getQuestBucketState();
    const idx=bucket.findIndex(p=>p?.id===pinId);
    return {data,key,bucket,idx,pin:idx>=0?bucket[idx]:null};
  };
  const deleteQuestPinById = async pinId => {
    const {data,key,bucket,idx,pin}=getQuestPinRef(pinId);
    if(idx<0){ui.notifications.warn("That quest pin could not be found anymore.");return false;}
    if(!await confirmDelete("Delete Quest Pin?",`${pin.name||pin.label||"Quest Pin"} will be removed from this scene.`))return false;
    bucket.splice(idx,1);
    await saveQuestBucket(data,bucket,key);
    return true;
  };
  const saveQuestPinById = async (pinId,values={}) => {
    const {data,key,bucket,pin:livePin}=getQuestPinRef(pinId);
    if(!livePin){ui.notifications.warn("That quest pin could not be found anymore.");return false;}
    livePin.name=String(values.name||"Quest").trim()||"Quest";
    livePin.type=String(values.type||"quest");
    livePin.image=getQuestPinImage?.(livePin.type);
    livePin.label=livePin.type==="question"?"Question":livePin.type==="complete"?"Complete":"Quest";
    await saveQuestBucket(data,bucket,key);
    return true;
  };
  const moveQuestPinById = pinId => {
    const {data,key,bucket,pin:livePin}=getQuestPinRef(pinId);
    if(!livePin){ui.notifications.warn("That quest pin could not be found anymore.");return false;}
    if(!openDragPos){ui.notifications.warn("The position editor is not available.");return false;}
    const opened=openDragPos(livePin,scene,data,async()=>{await saveQuestBucket(data,bucket,key);},async()=>{await deleteQuestPinById(pinId);});
    if(opened===false){ui.notifications.warn("Could not open the position editor for that quest pin.");return false;}
    ui.notifications.info("Drag the quest pin, then click Done.");
    return true;
  };
  const openQuestPinMenu = pin => {
    const pinId=pin?.id;
    if(!pinId)return;
    new Dialog({
      title: pin.name||pin.label||"Quest Pin",
      content: `<form><div class="form-group"><label>Name</label><input name="name" value="${attr(pin.name||"Quest")}"/></div><div class="form-group"><label>State</label><select name="type"><option value="quest" ${pin.type==="quest"?"selected":""}>Exclamation</option><option value="question" ${pin.type==="question"?"selected":""}>Question Mark</option><option value="complete" ${pin.type==="complete"?"selected":""}>Tick</option></select></div></form>`,
      buttons: {
        move:{icon:'<i class="fas fa-arrows-alt"></i>',label:"Move",callback:()=>{moveQuestPinById(pinId);}},
        del:{icon:'<i class="fas fa-trash"></i>',label:"Delete",callback:async()=>{await deleteQuestPinById(pinId);}},
        save:{icon:'<i class="fas fa-check"></i>',label:"Save",callback:async html=>{
          await saveQuestPinById(pinId,{name:html.find("[name=name]").val(),type:html.find("[name=type]").val()});
        }}
      },
      default:"save"
    }).render(true);
  };
  const syncCurrentPropView = bucket => {
    const data=liveData();
    const key=String(data.background||"");
    if(!data.propsByBackground || typeof data.propsByBackground!=="object" || Array.isArray(data.propsByBackground)) data.propsByBackground={};
    data.propsByBackground[key]=bucket;
    data.props=Array.isArray(bucket)?bucket.map(p=>foundry.utils.deepClone(p)):[];
    return data.propsByBackground[key];
  };
  const getPropBucket = () => {
    const data=liveData();
    const key=String(data.background||"");
    if(!data.propsByBackground || typeof data.propsByBackground!=="object" || Array.isArray(data.propsByBackground)) data.propsByBackground={};
    const hasBucketData=Object.values(data.propsByBackground).some(bucket=>Array.isArray(bucket)&&bucket.length);
    if(!hasBucketData && Array.isArray(data.props) && data.props.length){
      const legacy=data.props.splice(0,data.props.length);
      for(const prop of legacy){
        const propKey=String(prop?.backgroundKey||key);
        if(!Array.isArray(data.propsByBackground[propKey])) data.propsByBackground[propKey]=[];
        data.propsByBackground[propKey].push(prop);
      }
    }
    if(!Array.isArray(data.propsByBackground[key])) data.propsByBackground[key]=[];
    return syncCurrentPropView(data.propsByBackground[key]);
  };
  const deleteScenePropById = async propId => {
    if(!propId)return;
    if(!await confirmDelete("Delete Prop?","This prop will be removed from the scene."))return;
    const data=liveData();
    if(!data.propsByBackground || typeof data.propsByBackground!=="object" || Array.isArray(data.propsByBackground)) data.propsByBackground={};
    let removed=false;
    for(const [key,bucket] of Object.entries(data.propsByBackground)){
      if(!Array.isArray(bucket))continue;
      const next=bucket.filter(p=>p?.id!==propId);
      if(next.length!==bucket.length){
        data.propsByBackground[key]=next;
        removed=true;
      }
    }
    if(Array.isArray(data.props)){
      data.props=data.props.filter(p=>p?.id!==propId);
      if(!removed){
        removed=true;
      }
    }
    if(!removed)return;
    syncCurrentPropView(getPropBucket());
    await saveData(scene,data);
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
      await saveData(scene,liveData());
      emit();
      refreshUI(scene);
    });
    return true;
  };

  const commitSceneProp = (targetData, prop) => {
    if(!targetData||!prop)return [];
    const key=String(prop.backgroundKey||targetData.background||"");
    const saved=foundry.utils.deepClone({...prop,backgroundKey:key});
    if(!targetData.propsByBackground || typeof targetData.propsByBackground!=="object" || Array.isArray(targetData.propsByBackground)) targetData.propsByBackground={};
    const bucket=Array.isArray(targetData.propsByBackground[key])?targetData.propsByBackground[key]:[];
    const idx=bucket.findIndex(item=>item?.id===saved.id);
    if(idx>=0)bucket[idx]=saved;
    else bucket.push(saved);
    targetData.propsByBackground[key]=bucket;
    if(String(targetData.background||"")===key)targetData.props=bucket.map(item=>foundry.utils.deepClone(item));
    return bucket;
  };

  const addSceneProp = async (image, opts={}) => {
    if(!image)return;
    const activeBackgroundKey=String(liveData().background||"");
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
    const commit=async()=>{
      const live=liveData();
      commitSceneProp(live,prop);
      await saveData(scene,live);
      emit();
      refreshUI(scene);
    };
    if(!openDragPos){
      await commit();
      return;
    }
    ui.notifications.info(`Position ${name}. Players will see it after you click Done.`);
    openDragPos(prop, scene, liveData(), commit, async () => {
      ui.notifications.info(`Cancelled ${name} placement.`);
    });
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
    const commit=async()=>{
      const live=liveData();
      if(!Array.isArray(live.enemies))live.enemies=[];
      live.enemies.push(foundry.utils.deepClone(enemy));
      await ensureEnemyTokenDocs(scene, live);
      await saveData(scene, live);
      emit();
      refreshUI(scene);
      ui.notifications.info(`Added ${actor.name} to the encounter.`);
    };
    if(!openDragPos){
      await commit();
      return;
    }
    ui.notifications.info(`Position ${actor.name}. Players will see it after you click Done.`);
    openDragPos(enemy, scene, liveData(), commit, async () => {
      ui.notifications.info(`Cancelled ${actor.name} placement.`);
    });
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
          await addStageActor(scene, liveData(), actor, {
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
  bindEnemyDropZone(el.querySelector("#totm-board-actor-layer"));
  bindEnemyDropZone(el.querySelector("#totm-stage-wrap"));
  bindEnemyDropZone(el.querySelector("#totm-enemy-wrap"));
  bindEnemyDropZone(el.querySelector("#totm-enemy-bar"));

  const openEnemyPosition = (idx,node=null) => {
    const data=liveData();
    const en=data.enemies?.[idx];
    if(!en)return;
    openDragPos?.(en, scene, data, async () => {
      const latest=liveData();
      await ensureEnemyTokenDocs(scene, latest);
      await saveData(scene, latest);
      emit();
      refresh();
    }, async () => {
      await removeEnemyAtIndex(idx);
    });
  };
  const openNpcPosition = (idx,node=null) => {
    const data=liveData();
    const npc=data.npcs?.[idx];
    if(!npc)return;
    openDragPos?.(npc, scene, data, async () => {
      await saveData(scene, liveData());
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
    openDragPos?.(prop, scene, liveData(), async () => {
      syncCurrentPropView(propBucket);
      await saveData(scene,liveData());
      emit();
      refresh();
    }, async () => {
      await deleteScenePropById(prop.id);
    });
  };

  el.querySelector("#totm-enemy-bar")?.addEventListener("dblclick",e=>{
    const card=e.target.closest(".totm-enemy-card");
    if(!card)return;
    const data=liveData();
    const en=data.enemies?.[+card.dataset.eidx],a=en?getEncounterActor(en,scene):null;
    a?.sheet?.render?.(true);
  });
  el.querySelector("#totm-enemy-bar")?.addEventListener("contextmenu",e=>{
    const card=e.target.closest(".totm-enemy-card");
    if(!card)return;
    e.preventDefault();
    openEnemyPosition(+card.dataset.eidx,card);
  });

  stage?.addEventListener("click",async e=>{
    if(e.target.closest(".totm-scene-enemy"))return;
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
    const actor=e.target.closest(boardActorSelector);
    if(actor&&(e.shiftKey||e.altKey)){
      e.preventDefault();
      e.stopPropagation();
      const found=resolveBoardActor(actor);
      if(!found){warnMissingBoardActor();return;}
      if(e.shiftKey)await moveStageActor(scene,found.d,found.index,1);
      else await moveStageActor(scene,found.d,found.index,-1);
      return;
    }
  });
  stage?.addEventListener("dblclick",e=>{
    const actorNode=e.target.closest(boardActorSelector);
    if(actorNode){
      e.preventDefault();
      e.stopPropagation();
      const found=resolveBoardActor(actorNode);
      found?.actor?.sheet?.render?.(true);
      return;
    }
    const enemy=e.target.closest(".totm-scene-enemy");
    if(enemy){
      const data=liveData();
      const en=data.enemies?.[+enemy.dataset.eidx],a=en?getEncounterActor(en,scene):null;
      a?.sheet?.render?.(true);
      return;
    }
    const npcNode=e.target.closest(".totm-scene-npc");
    if(npcNode){
      const data=liveData();
      const npc=data.npcs?.[+npcNode.dataset.nidx];
      const actor=game.actors?.contents?.find?.(a=>a.img===npc?.image||a.prototypeToken?.texture?.src===npc?.image);
      actor?.sheet?.render?.(true);
      return;
    }
  });
  stage?.addEventListener("contextmenu",async e=>{
    const boardActor=e.target.closest(boardActorSelector);
    if(boardActor){
      e.preventDefault();
      e.stopPropagation();
      const found=resolveBoardActor(boardActor);
      if(!found){warnMissingBoardActor();return;}
      if(e.shiftKey){await moveStageActorToEdge(scene,found.d,found.index,"front");return;}
      if(e.altKey){await moveStageActorToEdge(scene,found.d,found.index,"back");return;}
      openStageActorCfg?.(scene,found.d,found.index);
      return;
    }
    const enemy=e.target.closest(".totm-scene-enemy");
    if(enemy){
      e.preventDefault();
      const data=liveData();
      const idx=+enemy.dataset.eidx,en=data.enemies?.[idx];
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
      const data=liveData();
      const idx=+npc.dataset.nidx,liveNpc=data.npcs?.[idx];
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
      const data=liveData();
      if(e.shiftKey){await moveStageActorToEdge(scene,data,idx,"front");return;}
      if(e.altKey){await moveStageActorToEdge(scene,data,idx,"back");return;}
      openStageActorCfg?.(scene,data,idx);
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
