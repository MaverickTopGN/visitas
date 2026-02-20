// ============================
// SUPABASE CONFIG
// ============================
const SUPABASE_URL = "https://bpdafatlwefzrqcgvtss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZGFmYXRsd2VmenJxY2d2dHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQzMDcsImV4cCI6MjA4NzAyMDMwN30.KyDRMcUcIytKCd2hZDmQ-6N-vex5pKk22MpUedDdusk";

// Creamos el cliente UNA sola vez (sin redeclarar "supabase")
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ============================
// GLOBAL STATE
// ============================
let RAW = { pls: [], eventos: [], tipos: [] };
let FILTERS = {
  operador: "",
  estado: "",
  semaforo: "",
  grupo2500: "", // "" | "true" | "false"
};

let pieChart = null;
let barChart = null;

// ============================
// HELPERS
// ============================
const el = (id) => document.getElementById(id);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[c]));
}

function showTab(tabId) {
  qsa(".tab").forEach((b) => b.classList.remove("active"));
  qsa(".panel").forEach((p) => p.classList.remove("active"));

  const btn = document.querySelector(`.tab[data-tab="${tabId}"]`);
  const panel = el(tabId);

  if (btn) btn.classList.add("active");
  if (panel) panel.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean).map((x) => String(x).trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "es"));
}

function asBoolStr(v) {
  if (v === true) return "true";
  if (v === false) return "false";
  return "";
}

// ============================
// INIT
// ============================
document.addEventListener("DOMContentLoaded", () => {
  // Tabs
  qsa(".tab").forEach((btn) => {
    btn.type = "button";
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  // Buttons
  const btnAddPL = el("btnAddPL");
  if (btnAddPL) btnAddPL.addEventListener("click", onAddPL);

  const btnAddEvento = el("btnAddEvento");
  if (btnAddEvento) btnAddEvento.addEventListener("click", onAddEvento);

  const btnFiltros = el("btnAplicarFiltros");
  if (btnFiltros) btnFiltros.addEventListener("click", onApplyFilters);

  // Boot
  boot();
});

// ============================
// DATA LOADING
// ============================
async function fetchAll() {
  const [{ data: pls, error: e1 }, { data: eventos, error: e2 }, { data: tipos, error: e3 }] =
    await Promise.all([
      supabaseClient.from("pls").select("*").order("created_at", { ascending: false }),
      supabaseClient.from("eventos").select("*").order("fecha", { ascending: false }),
      supabaseClient.from("tipos_evento").select("*").order("nombre", { ascending: true }),
    ]);

  if (e1 || e2 || e3) {
    console.error("Supabase error:", e1 || e2 || e3);
    // Devolvemos lo que haya, sin reventar UI
  }

  return {
    pls: pls || [],
    eventos: eventos || [],
    tipos: tipos || [],
  };
}

// ============================
// FILTERING
// ============================
function applyFilters(raw) {
  const { operador, estado, semaforo, grupo2500 } = FILTERS;

  const plsFiltered = raw.pls.filter((p) => {
    if (operador && String(p.operador || "").trim() !== operador) return false;
    if (estado && String(p.estado || "").trim() !== estado) return false;
    if (semaforo && String(p.semaforo || "").trim() !== semaforo) return false;

    if (grupo2500 === "true" && !p.grupo_2500) return false;
    if (grupo2500 === "false" && p.grupo_2500) return false;

    return true;
  });

  const plIdSet = new Set(plsFiltered.map((p) => p.id));
  const eventosFiltered = raw.eventos.filter((e) => plIdSet.has(e.pl_id));

  return { plsFiltered, eventosFiltered };
}

// ============================
// RENDER: FILTER SELECTS
// ============================
function renderFilterSelects(pls) {
  const ops = uniqSorted(pls.map((p) => p.operador));
  const ests = uniqSorted(pls.map((p) => p.estado));

  const selOp = el("filterOperador");
  const selEst = el("filterEstado");

  if (selOp) {
    const current = FILTERS.operador;
    selOp.innerHTML = `<option value="">Operador (Todos)</option>` +
      ops.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    selOp.value = current;
  }

  if (selEst) {
    const current = FILTERS.estado;
    selEst.innerHTML = `<option value="">Estado (Todos)</option>` +
      ests.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    selEst.value = current;
  }

  const selSem = el("filterSemaforo");
  if (selSem) selSem.value = FILTERS.semaforo || "";

  const sel2500 = el("filter2500");
  if (sel2500) sel2500.value = FILTERS.grupo2500 || "";
}

// ============================
// RENDER: KPIs
// ============================
function renderKPIs(plsFiltered, eventosFiltered) {
  const statPls = el("statPls");
  const statEventos = el("statEventos");
  const statOperadores = el("statOperadores");
  const stat2500 = el("stat2500");

  if (statPls) statPls.innerText = plsFiltered.length;
  if (statEventos) statEventos.innerText = eventosFiltered.length;

  const operadoresCount = new Set(plsFiltered.map((p) => (p.operador || "Sin operador").trim() || "Sin operador")).size;
  if (statOperadores) statOperadores.innerText = operadoresCount;

  const g2500 = plsFiltered.filter((p) => p.grupo_2500).length;
  if (stat2500) stat2500.innerText = g2500;
}

// ============================
// RENDER: DONUT (por comando)
// ============================
function renderDonut(tipos, eventosFiltered) {
  const canvas = el("pieChart");
  if (!canvas) return;

  // count por tipo
  const count = {};
  eventosFiltered.forEach((e) => {
    count[e.tipo] = (count[e.tipo] || 0) + 1;
  });

  const labels = Object.keys(count);
  const values = Object.values(count);

  // color por tipo (tipos_evento)
  const colors = labels.map((l) => {
    const tipo = tipos.find((t) => t.nombre === l);
    return tipo?.color || "#94A3B8";
  });

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: "rgba(255,255,255,.20)",
        borderWidth: 1,
        hoverOffset: 10,
        spacing: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      radius: "88%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "rgba(245,247,255,.82)",
            boxWidth: 10,
            boxHeight: 10,
            padding: 14,
            font: { family: "Open Sans", size: 12, weight: "700" },
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, .92)",
          titleColor: "rgba(245,247,255,.92)",
          bodyColor: "rgba(245,247,255,.86)",
          borderColor: "rgba(255,255,255,.18)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
        },
      },
    },
  });
}

// ============================
// RENDER: BARRAS por operador (PLs)
// ============================
function renderBarOperadores(plsFiltered) {
  const canvas = el("barOperadores");
  if (!canvas) return;

  const map = {};
  plsFiltered.forEach((p) => {
    const op = (p.operador || "Sin operador").trim() || "Sin operador";
    map[op] = (map[op] || 0) + 1;
  });

  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const labels = entries.map((x) => x[0]);
  const values = entries.map((x) => x[1]);

  if (barChart) barChart.destroy();

  barChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: "rgba(59,130,246,.80)",
        borderColor: "rgba(255,255,255,.18)",
        borderWidth: 1,
        borderRadius: 10,
        barThickness: 22,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, .92)",
          titleColor: "rgba(245,247,255,.92)",
          bodyColor: "rgba(245,247,255,.86)",
          borderColor: "rgba(255,255,255,.18)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
        },
      },
      scales: {
        x: {
          ticks: { color: "rgba(245,247,255,.72)", font: { family: "Open Sans", weight: "700" } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "rgba(245,247,255,.72)", font: { family: "Open Sans", weight: "700" } },
          grid: { color: "rgba(255,255,255,.10)" },
        },
      },
    },
  });
}

// ============================
// RENDER: Detalle Operadores (lista)
// ============================
function renderDetalleOperadores(plsFiltered) {
  const cont = el("contadorOperadores");
  if (!cont) return;

  const map = {};
  plsFiltered.forEach((p) => {
    const op = (p.operador || "Sin operador").trim() || "Sin operador";
    map[op] = (map[op] || 0) + 1;
  });

  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    cont.innerHTML = `<div style="color:rgba(245,247,255,.65); font-size:12px;">Sin datos con los filtros actuales.</div>`;
    return;
  }

  cont.innerHTML = entries.map(([op, n]) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.10);">
      <span style="color:rgba(245,247,255,.85); font-weight:800;">${escapeHtml(op)}</span>
      <span style="color:rgba(245,247,255,.92); font-weight:900;">${n}</span>
    </div>
  `).join("");
}

// ============================
// RENDER: Registro selects (PL / Tipo)
// ============================
function renderRegistroSelectors(plsFiltered, tipos) {
  const selPL = el("ev_pl");
  const selTipo = el("ev_tipo");

  if (selPL) {
    const current = selPL.value || "";
    selPL.innerHTML = `<option value="">Selecciona PL</option>` +
      plsFiltered.map((p) =>
        `<option value="${p.id}">${escapeHtml(p.pl)} — ${escapeHtml(p.razon_social)}</option>`
      ).join("");
    // si existe aún
    if (current && plsFiltered.some((p) => p.id === current)) selPL.value = current;
  }

  if (selTipo) {
    const current = selTipo.value || "";
    selTipo.innerHTML =
      tipos.map((t) => `<option value="${escapeHtml(t.nombre)}">${escapeHtml(t.nombre)}</option>`).join("");
    if (current && tipos.some((t) => t.nombre === current)) selTipo.value = current;
  }
}

// ============================
// RENDER: Mini-historial por PL
// ============================
function renderMiniHistorial(plsFiltered, eventosFiltered) {
  const wrap = el("plList");
  if (!wrap) return;

  if (!plsFiltered.length) {
    wrap.innerHTML = `<div style="color:rgba(245,247,255,.65); font-size:12px;">No hay PLs con los filtros actuales.</div>`;
    return;
  }

  wrap.innerHTML = plsFiltered.map((p) => {
    const hist = eventosFiltered
      .filter((e) => e.pl_id === p.id)
      .slice(0, 6); // últimos 6

    const semColor = p.semaforo === "ROJA" ? "#DC2626" : "#16A34A";
    const semBg = p.semaforo === "ROJA" ? "rgba(220,38,38,.18)" : "rgba(22,163,74,.18)";

    const tags = `
      <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
        <span style="padding:6px 10px; border-radius:999px; font-size:12px; font-weight:900; background:${semBg}; color:${semColor}; border:1px solid rgba(255,255,255,.16);">
          ${escapeHtml(p.semaforo)}
        </span>
        <span style="padding:6px 10px; border-radius:999px; font-size:12px; font-weight:900; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14);">
          2500: ${p.grupo_2500 ? "Sí" : "No"}
        </span>
      </div>
    `;

    const histHtml = hist.length
      ? hist.map((h) => `
          <div style="display:flex; gap:10px; font-size:12px; color:rgba(245,247,255,.80); padding:4px 0;">
            <span style="min-width:92px; color:rgba(245,247,255,.60);">${escapeHtml(h.fecha)}</span>
            <strong style="color:rgba(245,247,255,.92);">${escapeHtml(h.tipo)}</strong>
            ${h.notas ? `<span style="color:rgba(245,247,255,.62);">— ${escapeHtml(h.notas)}</span>` : ""}
          </div>
        `).join("")
      : `<div style="color:rgba(245,247,255,.65); font-size:12px;">Sin eventos</div>`;

    return `
      <div style="border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:14px;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
          <div>
            <div style="font-weight:900; color:rgba(245,247,255,.95);">
              ${escapeHtml(p.pl)} — ${escapeHtml(p.razon_social)}
            </div>
            <div style="font-size:12px; color:rgba(245,247,255,.62); margin-top:4px;">
              ${escapeHtml(p.estado)} / ${escapeHtml(p.municipio)} · ${escapeHtml(p.operador)}
            </div>
          </div>
          ${tags}
        </div>

        <div style="margin-top:10px;">
          <div style="font-weight:900; font-size:12px; color:rgba(245,247,255,.86); margin-bottom:6px;">
            Mini-historial
          </div>
          ${histHtml}
        </div>
      </div>
    `;
  }).join("");
}

// ============================
// ACTIONS: APPLY FILTERS
// ============================
function onApplyFilters() {
  FILTERS.operador = el("filterOperador")?.value || "";
  FILTERS.estado = el("filterEstado")?.value || "";
  FILTERS.semaforo = el("filterSemaforo")?.value || "";
  FILTERS.grupo2500 = el("filter2500")?.value || "";

  renderAll(); // re-render con filtros
}

// ============================
// ACTIONS: INSERT PL
// ============================
async function onAddPL() {
  const payload = {
    pl: el("pl")?.value?.trim() || "",
    razon_social: el("razon_social")?.value?.trim() || "",
    estado: el("estado")?.value?.trim() || "",
    municipio: el("municipio")?.value?.trim() || "",
    direccion: el("direccion")?.value?.trim() || "",
    operador: el("operador")?.value?.trim() || "",
    semaforo: el("semaforo")?.value || "VERDE",
    grupo_2500: !!el("grupo_2500")?.checked,
  };

  if (!payload.pl) return alert("PL es obligatorio.");

  const { error } = await supabaseClient.from("pls").insert(payload);
  if (error) {
    console.error(error);
    return alert("Error guardando PL (¿ya existe?).");
  }

  // limpiar
  ["pl", "razon_social", "estado", "municipio", "direccion", "operador"].forEach((id) => {
    const node = el(id);
    if (node) node.value = "";
  });
  if (el("semaforo")) el("semaforo").value = "VERDE";
  if (el("grupo_2500")) el("grupo_2500").checked = false;

  await boot(true);
  showTab("registro");
}

// ============================
// ACTIONS: INSERT EVENTO
// ============================
async function onAddEvento() {
  const payload = {
    pl_id: el("ev_pl")?.value || "",
    tipo: el("ev_tipo")?.value || "",
    fecha: el("ev_fecha")?.value || "",
    notas: el("ev_notas")?.value?.trim() || "",
  };

  if (!payload.pl_id) return alert("Selecciona una PL.");
  if (!payload.tipo) return alert("Selecciona el tipo.");
  if (!payload.fecha) return alert("Selecciona la fecha.");

  const { error } = await supabaseClient.from("eventos").insert(payload);
  if (error) {
    console.error(error);
    return alert("Error guardando evento.");
  }

  if (el("ev_fecha")) el("ev_fecha").value = "";
  if (el("ev_notas")) el("ev_notas").value = "";

  await boot(true);
  showTab("registro");
}

// ============================
// RENDER ALL
// ============================
function renderAll() {
  // 1) Selects de filtros se alimentan del RAW completo (para que siempre tengas todas las opciones)
  renderFilterSelects(RAW.pls);

  // 2) Aplicar filtros reales
  const { plsFiltered, eventosFiltered } = applyFilters(RAW);

  // 3) KPIs
  renderKPIs(plsFiltered, eventosFiltered);

  // 4) Charts
  renderDonut(RAW.tipos, eventosFiltered);
  renderBarOperadores(plsFiltered);

  // 5) Detalle operadores (lista)
  renderDetalleOperadores(plsFiltered);

  // 6) Registro (selects + mini historial) usa filtrados para que coincida con lo que estás viendo
  renderRegistroSelectors(plsFiltered, RAW.tipos);
  renderMiniHistorial(plsFiltered, eventosFiltered);
}

// ============================
// BOOT
// ============================
async function boot(forceReload = false) {
  if (forceReload || !RAW.pls.length) {
    RAW = await fetchAll();
  }

  // Si filtros seleccionados ya no existen, los limpiamos elegantemente
  const ops = uniqSorted(RAW.pls.map((p) => p.operador));
  const ests = uniqSorted(RAW.pls.map((p) => p.estado));
  if (FILTERS.operador && !ops.includes(FILTERS.operador)) FILTERS.operador = "";
  if (FILTERS.estado && !ests.includes(FILTERS.estado)) FILTERS.estado = "";

  renderAll();
}
