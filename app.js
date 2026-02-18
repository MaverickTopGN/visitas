// ====== 1) Config Supabase (PEGA TUS DATOS) ======
const SUPABASE_URL = "https://bpdafatlwefzrqcgvtss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZGFmYXRsd2VmenJxY2d2dHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQzMDcsImV4cCI6MjA4NzAyMDMwN30.KyDRMcUcIytKCd2hZDmQ-6N-vex5pKk22MpUedDdusk";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== 2) Helpers UI ======
const $ = (id) => document.getElementById(id);

const SEMAFORO = {
  ROJA: { label: "ROJA", color: getCss("--roja"), bg: getCss("--rojaBg") },
  VERDE: { label: "VERDE", color: getCss("--verde"), bg: getCss("--verdeBg") },
};

function getCss(varName){ return getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); }

function badgeEl(text, color, bg){
  const s = document.createElement("span");
  s.className = "badge";
  s.textContent = text;
  s.style.color = color;
  s.style.background = bg;
  return s;
}

function pillEl(label, color){
  const p = document.createElement("span");
  p.className = "pill";
  const d = document.createElement("span");
  d.className = "dot";
  d.style.background = color;
  p.appendChild(d);
  p.appendChild(document.createTextNode(label));
  return p;
}

// ====== 3) Tabs ======
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
  });
});

// ====== 4) Chart ======
let pieChart = null;

function renderPie(pieData){
  const ctx = $("pieChart").getContext("2d");
  const labels = pieData.map(x=>x.name);
  const values = pieData.map(x=>x.value);
  const colors = pieData.map(x=>x.color);

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data: values, backgroundColor: colors }] },
    options: { responsive:true, plugins:{ legend:{ position:"bottom" } } }
  });
}

// ====== 5) Data fetch ======
async function fetchAll(){
  const [{ data: pls, error: e1 }, { data: tipos, error: e2 }, { data: eventos, error: e3 }] = await Promise.all([
    supabase.from("pls").select("*").order("created_at", { ascending:false }),
    supabase.from("tipos_evento").select("*").order("nombre", { ascending:true }),
    supabase.from("eventos").select("*").order("fecha", { ascending:false }),
  ]);

  if (e1 || e2 || e3){
    console.error(e1 || e2 || e3);
    alert("Error cargando datos. Revisa consola y credenciales de Supabase.");
    return { pls:[], tipos:[], eventos:[] };
  }
  return { pls, tipos, eventos };
}

function buildPieData(tipos, eventos){
  const map = new Map();
  tipos.forEach(t=> map.set(t.nombre, { name: t.nombre, value: 0, color: t.color || "#64748B" }));

  eventos.forEach(ev=>{
    if (!map.has(ev.tipo)) map.set(ev.tipo, { name: ev.tipo, value:0, color:"#64748B" });
    map.get(ev.tipo).value += 1;
  });

  return Array.from(map.values()).filter(x=>x.value > 0);
}

function refreshLegendPills(tipos){
  const wrap = $("legendPills");
  wrap.innerHTML = "";
  tipos.forEach(t=> wrap.appendChild(pillEl(t.nombre, t.color || "#64748B")));
}

function refreshStats(pls, eventos){
  $("statPls").textContent = pls.length;
  $("statEventos").textContent = eventos.length;

  const rojas = pls.filter(p=>p.semaforo==="ROJA").length;
  const verdes = pls.filter(p=>p.semaforo==="VERDE").length;
  const g2500 = pls.filter(p=>p.grupo_2500).length;

  const br = $("badgeRoja");
  br.className = "badge";
  br.textContent = `ROJA: ${rojas}`;
  br.style.color = SEMAFORO.ROJA.color;
  br.style.background = SEMAFORO.ROJA.bg;

  const bv = $("badgeVerde");
  bv.className = "badge";
  bv.textContent = `VERDE: ${verdes}`;
  bv.style.color = SEMAFORO.VERDE.color;
  bv.style.background = SEMAFORO.VERDE.bg;

  const b2500 = $("badge2500");
  b2500.className = "badge neutral";
  b2500.textContent = `Grupo 2500: ${g2500}/${pls.length}`;
}

function refreshPLSelect(pls){
  const sel = $("ev_pl");
  sel.innerHTML = `<option value="">Selecciona PL</option>`;
  pls.forEach(p=>{
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = `${p.pl} — ${p.razon_social || ""}`;
    sel.appendChild(o);
  });
}

function refreshTiposSelect(tipos){
  const sel = $("ev_tipo");
  sel.innerHTML = "";
  tipos.forEach(t=>{
    const o = document.createElement("option");
    o.value = t.nombre;
    o.textContent = t.nombre;
    sel.appendChild(o);
  });
}

function refreshPLTable(pls){
  const tbody = document.querySelector("#plsTable tbody");
  tbody.innerHTML = "";

  pls.forEach(p=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(p.pl)}</strong></td>
      <td>${escapeHtml(p.razon_social || "")}</td>
      <td>${escapeHtml(p.estado || "")}</td>
      <td>${escapeHtml(p.municipio || "")}</td>
      <td>${escapeHtml(p.direccion || "")}</td>
      <td>${escapeHtml(p.operador || "")}</td>
      <td><span class="badge" style="color:${SEMAFORO[p.semaforo]?.color}; background:${SEMAFORO[p.semaforo]?.bg};">${p.semaforo}</span></td>
      <td><span class="badge neutral">${p.grupo_2500 ? "Sí" : "No"}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

// ====== 6) Actions ======
$("btnAddPL").addEventListener("click", async ()=>{
  const payload = {
    pl: $("pl").value.trim(),
    razon_social: $("razon_social").value.trim(),
    estado: $("estado").value.trim(),
    municipio: $("municipio").value.trim(),
    direccion: $("direccion").value.trim(),
    operador: $("operador").value.trim(),
    semaforo: $("semaforo").value,
    grupo_2500: $("grupo_2500").checked,
  };
  if (!payload.pl) return alert("PL es obligatorio.");

  const { error } = await supabase.from("pls").insert(payload);
  if (error){ console.error(error); return alert("Error guardando PL."); }

  ["pl","razon_social","estado","municipio","direccion","operador"].forEach(id=>$(id).value="");
  $("semaforo").value="VERDE";
  $("grupo_2500").checked=false;

  await boot();
});

$("btnAddEvento").addEventListener("click", async ()=>{
  const payload = {
    pl_id: $("ev_pl").value,
    tipo: $("ev_tipo").value,
    fecha: $("ev_fecha").value,
    notas: $("ev_notas").value.trim(),
  };
  if (!payload.pl_id) return alert("Selecciona una PL.");
  if (!payload.fecha) return alert("Selecciona fecha.");

  const { error } = await supabase.from("eventos").insert(payload);
  if (error){ console.error(error); return alert("Error guardando evento."); }

  $("ev_fecha").value="";
  $("ev_notas").value="";

  await boot();
});

$("btnAddCmd").addEventListener("click", async ()=>{
  const nombre = $("newCmdName").value.trim();
  const color = $("newCmdColor").value || "#64748B";
  if (!nombre) return alert("Escribe el nombre del comando.");

  const { error } = await supabase.from("tipos_evento").insert({ nombre, color });
  if (error){ console.error(error); return alert("Error agregando comando (¿ya existe?)."); }

  $("newCmdName").value="";
  $("newCmdColor").value="#64748B";

  await boot();
});

// ====== 7) Boot ======
async function boot(){
  const { pls, tipos, eventos } = await fetchAll();

  refreshLegendPills(tipos);
  refreshStats(pls, eventos);
  refreshPLSelect(pls);
  refreshTiposSelect(tipos);
  refreshPLTable(pls);

  const pieData = buildPieData(tipos, eventos);
  renderPie(pieData);
}

boot();
