function esc(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
function cssUrl(value){
  return `url("${String(value ?? "").replace(/\\/g,"/").replace(/"/g,"%22").replace(/[\r\n\f]/g,"")}")`;
}

function getPage(){
  return Math.max(1, Number(ui.hotbar?.page) || 1);
}

function getSlots(){
  const page = getPage();
  const start = ((page - 1) * 10) + 1;
  const out = [];
  for(let i=0;i<10;i++) out.push(start + i);
  return out;
}

function getSlotEntries(){
  const page = getPage();
  const map = new Map();
  let entries = [];
  if(typeof game.user?.getHotbarMacros === "function"){
    try { entries = game.user.getHotbarMacros(page) || []; } catch {}
  }
  if((!entries || !entries.length) && Array.isArray(ui.hotbar?.macros)) entries = ui.hotbar.macros;
  for(const entry of entries || []){
    const slot = Number(entry?.slot);
    if(!slot) continue;
    const macro = entry?.macro || null;
    map.set(slot, macro);
  }
  return map;
}

function digitForSlot(slot){
  const n = ((slot - 1) % 10) + 1;
  return n === 10 ? "0" : String(n);
}

export function syncHotbarPosition(){
  const hotbar=document.getElementById("hotbar");
  if(!hotbar) return;
  if(!document.body.classList.contains("totm-active")){
    hotbar.style.removeProperty("display");
    hotbar.style.removeProperty("position");
    hotbar.style.removeProperty("left");
    hotbar.style.removeProperty("top");
    hotbar.style.removeProperty("bottom");
    hotbar.style.removeProperty("right");
    hotbar.style.removeProperty("width");
    hotbar.style.removeProperty("height");
    hotbar.style.removeProperty("z-index");
    hotbar.style.removeProperty("pointer-events");
    hotbar.style.removeProperty("opacity");
    return;
  }
  hotbar.style.display="block";
  hotbar.style.position="fixed";
  hotbar.style.left="-9999px";
  hotbar.style.top="-9999px";
  hotbar.style.bottom="auto";
  hotbar.style.right="auto";
  hotbar.style.width="1px";
  hotbar.style.height="1px";
  hotbar.style.zIndex="-1";
  hotbar.style.pointerEvents="none";
  hotbar.style.opacity="0";
}

export function getHotbarDropSlot(clientX){
  const slotEl = document.elementFromPoint(clientX, Math.max(0, (document.getElementById("totm-hotbar-slot")?.getBoundingClientRect().top || 0) + 20))?.closest?.(".totm-hotbar-btn[data-slot]");
  if(slotEl?.dataset?.slot) return Number(slotEl.dataset.slot);
  return null;
}

export async function createProjectFUItemHotbarMacro(data,slot){
  if(data?.type!=="Item"||!data?.uuid) return null;
  if(!data.uuid.includes("Actor.")&&!data.uuid.includes("Token.")){
    ui.notifications.warn("You can only create macro buttons for owned Items");
    return false;
  }
  const item=await Item.fromDropData(data);
  if(!item) return false;
  const command=`game.projectfu.rollItemMacro("${data.uuid}");`;
  let macro=game.macros.find(m=>m.name===item.name&&m.command===command);
  if(!macro){
    macro=await Macro.create({name:item.name,type:"script",img:item.img,command,flags:{"projectfu.itemMacro":true}});
  }
  await game.user.assignHotbarMacro(macro,slot);
  return false;
}

async function assignDropDataToSlot(data, slot){
  if(!slot || !ui.hotbar) return;
  const handled = Hooks.call("hotbarDrop", ui.hotbar, data, slot);
  if(handled === false) return;
  if(data.type === "Item"){
    const itemHandled = await createProjectFUItemHotbarMacro(data, slot);
    if(itemHandled === false) return;
  }
  if(data.type === "Macro"){
    const macro = await fromUuid(data.uuid);
    if(macro) await game.user.assignHotbarMacro(macro, slot);
  }
}

export async function handleTotmHotbarDrop(ev){
  ev.preventDefault();
  ev.stopPropagation();
  let data;
  try{
    data=JSON.parse(ev.dataTransfer?.getData("text/plain")||"{}");
  }catch{
    return;
  }
  const slot = Number(ev.currentTarget?.dataset?.slot) || getHotbarDropSlot(ev.clientX);
  await assignDropDataToSlot(data, slot);
}

export function renderTotmHotbar(){
  const slots = getSlots();
  const entries = getSlotEntries();
  const hasAny = slots.some(slot => !!entries.get(slot));
  const buttons = slots.map(slot => {
    const macro = entries.get(slot);
    const label = digitForSlot(slot);
    const name = macro?.name ? esc(macro.name) : "";
    const img = macro?.img ? esc(macro.img) : "";
    const title = macro ? name : `Slot ${label}`;
    const inner = macro
      ? `<span class="totm-hotbar-icon" style="${esc(`background-image:${cssUrl(macro.img)}`)}"></span><span class="totm-hotbar-name">${name}</span>`
      : `<span class="totm-hotbar-empty">Drop</span>`;
    return `<button type="button" class="totm-hotbar-btn ${macro ? "has-macro" : "is-empty"}" data-slot="${slot}" title="${title}"><span class="totm-hotbar-slotno">${label}</span>${inner}</button>`;
  }).join("");
  const hint = hasAny ? "" : `<div class="totm-hotbar-hint">Drag actions, items, or macros onto a numbered slot</div>`;
  return `<div class="totm-hotbar-shell"><div class="totm-hotbar-grid">${buttons}</div>${hint}</div>`;
}

export function bindTotmHotbarDropZone(_node){
  // Kept for compatibility with the runtime wiring. Slot-level binding handles drops.
}

export function bindTotmHotbarUi(root,{refresh}={}){
  root?.querySelectorAll?.(".totm-hotbar-btn[data-slot]")?.forEach(btn=>{
    if(btn.dataset.totmHotbarBound === "1") return;
    btn.dataset.totmHotbarBound = "1";
    btn.addEventListener("click", async () => {
      const slot = Number(btn.dataset.slot);
      const macro = getSlotEntries().get(slot);
      if(macro) await macro.execute();
    });
    btn.addEventListener("contextmenu", async e => {
      e.preventDefault();
      const slot = Number(btn.dataset.slot);
      const macro = getSlotEntries().get(slot);
      if(!macro) return;
      await game.user.assignHotbarMacro(null, slot);
      refresh?.();
    });
    btn.addEventListener("dragenter", e => { e.preventDefault(); btn.classList.add("is-drop-ready"); });
    btn.addEventListener("dragover", e => { e.preventDefault(); btn.classList.add("is-drop-ready"); });
    btn.addEventListener("dragleave", () => btn.classList.remove("is-drop-ready"));
    btn.addEventListener("drop", async e => {
      btn.classList.remove("is-drop-ready");
      await handleTotmHotbarDrop(e);
      refresh?.();
    });
  });
}
