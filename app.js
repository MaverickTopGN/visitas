// ============================
// SUPABASE CONFIG
// ============================
const SUPABASE_URL = "https://bpdafatlwefzrqcgvtss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZGFmYXRsd2VmenJxY2d2dHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQzMDcsImV4cCI6MjA4NzAyMDMwN30.KyDRMcUcIytKCd2hZDmQ-6N-vex5pKk22MpUedDdusk";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ============================
// GLOBAL STATE
// ============================
let RAW = { pls: [], eventos: [], tipos: [] };
let FILTERS = { operador: "", estado: "", semaforo: "", grupo2500: "" };

// Calendario (mes seleccionado)
let CAL_MONTH = new Date().toISOString().slice(0, 7); // "YYYY-MM"

let pieChart = null;
let barChart = null;

// Vista filtrada actual (para modal y export)
let VIEW = {
  plsFiltered: [],
  eventosFiltered: [],
};

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

function fmtDateISOToPretty(iso) {
  // iso "YYYY-MM-DD"
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${months[m-1]} ${y}`;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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
  el("btnAddPL")?.addEventListener("click", onAddPL);
  el("btnAddEvento")?.addEventListener("click", onAddEvento);
  el("btnAplicarFiltros")?.addEventListener("click", onApplyFilters);

  // Calendar + Export
  const monthInput = el("calMonth");
  if (monthInput) {
    monthInput.value = CAL_MONTH;
    monthInput.addEventListener("change", () => {
      CAL_MONTH = monthInput.value || CAL_MONTH;
      renderCalendar(); // solo el calendario
    });
  }

  el("btnExportCSV")?.addEventListener("click", exportCSVForSelectedMonth);

  // Modal
  el("btnCloseModal")?.addEventListener("click", closeModal);
  el("dayModal")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "dayModal") closeModal();
  });

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

  if (e1 || e2 || e3) console.error("Supabase error:", e1 || e2 || e3);

  return { pls: pls || [], eventos: eventos || [], tipos: tipos || [] };
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
    selOp.innerHTML = `<option value="">Operador (Todos)</option>` +
      ops.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    selOp.value = FILTERS.operador || "";
  }

  if (selEst) {
    selEst.innerHTML = `<option value="">Estado (Todos)</option>` +
      ests.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    selEst.value = FILTERS.estado || "";
  }

  el("filterSemaforo") && (el("filterSemaforo").value = FILTERS.semaforo || "");
  el("filter2500") && (el("filter2500").value = FILTERS.grupo2500 || "");
}

// ============================
// RENDER: KPIs
// ============================
function renderKPIs(plsFiltered, eventosFiltered) {
  el("statPls") && (el("statPls").innerText = plsFiltered.length);
  el("statEventos") && (el("statEventos").innerText = eventosFiltered.length);

  const operadoresCount = new Set(
    plsFiltered.map((p) => (p.operador || "Sin operador").trim() || "Sin operador")
  ).size;
  el("statOperadores") && (el("statOperadores").innerText = operadoresCount);

  const g2500 = plsFiltered.filter((p) => p.grupo_2500).length;
  el("stat2500") && (el("stat2500").innerText = g2500);
}

// ============================
// RENDER: DONUT (por comando)
// ============================
function renderDonut(tipos, eventosFiltered) {
  const canvas = el("pieChart");
  if (!canvas) return;

  const count = {};
  eventosFiltered.forEach((e) => (count[e.tipo] = (count[e.tipo] || 0) + 1));

  const labels = Object.keys(count);
  const values = Object.values(count);

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
// RENDER: BAR (PLs por operador)
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

  cont.innerHTML = entries.length
    ? entries.map(([op, n]) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.10);">
        <span style="color:rgba(245,247,255,.85); font-weight:800;">${escapeHtml(op)}</span>
        <span style="color:rgba(245,247,255,.92); font-weight:900;">${n}</span>
      </div>
    `).join("")
    : `<div style="color:rgba(245,247,255,.65); font-size:12px;">Sin datos con los filtros actuales.</div>`;
}

// ============================
// REGISTRO: selectors + mini-historial
// ============================
function renderRegistroSelectors(plsFiltered, tipos) {
  const selPL = el("ev_pl");
  const selTipo = el("ev_tipo");

  if (selPL) {
    const current = selPL.value || "";
    selPL.innerHTML = `<option value="">Selecciona PL</option>` +
      plsFiltered.map((p) => `<option value="${p.id}">${escapeHtml(p.pl)} — ${escapeHtml(p.razon_social)}</option>`).join("");
    if (current && plsFiltered.some((p) => p.id === current)) selPL.value = current;
  }

  if (selTipo) {
    const current = selTipo.value || "";
    selTipo.innerHTML = tipos.map((t) => `<option value="${escapeHtml(t.nombre)}">${escapeHtml(t.nombre)}</option>`).join("");
    if (current && tipos.some((t) => t.nombre === current)) selTipo.value = current;
  }
}

function renderMiniHistorial(plsFiltered, eventosFiltered) {
  const wrap = el("plList");
  if (!wrap) return;

  if (!plsFiltered.length) {
    wrap.innerHTML = `<div style="color:rgba(245,247,255,.65); font-size:12px;">No hay PLs con los filtros actuales.</div>`;
    return;
  }

  wrap.innerHTML = plsFiltered.map((p) => {
    const hist = eventosFiltered.filter((e) => e.pl_id === p.id).slice(0, 6);

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
            <div style="font-weight:900; color:rgba(245,247,255,.95);">${escapeHtml(p.pl)} — ${escapeHtml(p.razon_social)}</div>
            <div style="font-size:12px; color:rgba(245,247,255,.62); margin-top:4px;">
              ${escapeHtml(p.estado)} / ${escapeHtml(p.municipio)} · ${escapeHtml(p.operador)}
            </div>
          </div>
          ${tags}
        </div>

        <div style="margin-top:10px;">
          <div style="font-weight:900; font-size:12px; color:rgba(245,247,255,.86); margin-bottom:6px;">Mini-historial</div>
          ${histHtml}
        </div>
      </div>
    `;
  }).join("");
}

// ============================
// CALENDAR (Monthly) + Modal
// ============================
function getMonthParts(ym) {
  const [y, m] = (ym || CAL_MONTH).split("-").map(Number); // m 1-12
  return { y, m };
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate(); // m is 1-12
}

function weekdayMonFirst(y, m, d) {
  // JS: 0 Sun .. 6 Sat
  const js = new Date(y, m - 1, d).getDay();
  // convert to Mon-first: 0 Mon .. 6 Sun
  return (js + 6) % 7;
}

function calendarIntensity(count, max) {
  if (!count) return 0;
  if (max <= 1) return 2;
  const ratio = count / max; // 0..1
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.50) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function renderCalendar() {
  const grid = el("calendarGrid");
  if (!grid) return;

  const { y, m } = getMonthParts(CAL_MONTH);

  // Agrupar eventos por fecha (solo del mes seleccionado)
  const monthPrefix = `${y}-${String(m).padStart(2, "0")}-`;
  const eventsMonth = VIEW.eventosFiltered.filter((e) => String(e.fecha || "").startsWith(monthPrefix));

  const byDate = {};
  for (const e of eventsMonth) {
    const key = e.fecha;
    byDate[key] = (byDate[key] || 0) + 1;
  }

  const max = Math.max(0, ...Object.values(byDate));

  // Construir celdas
  const totalDays = daysInMonth(y, m);
  const firstDow = weekdayMonFirst(y, m, 1); // 0..6

  const cells = [];

  // empty leading
  for (let i = 0; i < firstDow; i++) {
    cells.push(`<div class="calCell empty"></div>`);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateISO = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const c = byDate[dateISO] || 0;
    const level = calendarIntensity(c, max);

    cells.push(`
      <div class="calCell level${level}" data-date="${dateISO}" ${c ? "" : 'aria-disabled="true"'}>
        <div class="calDay">${day}</div>
        ${c ? `<div class="calCount">${c}</div>` : ""}
      </div>
    `);
  }

  grid.innerHTML = cells.join("");

  // Click handlers
  qsa(".calCell").forEach((cell) => {
    const date = cell.dataset.date;
    if (!date) return;
    cell.addEventListener("click", () => openModalForDate(date));
  });
}

function openModalForDate(dateISO) {
  const modal = el("dayModal");
  const title = el("modalTitle");
  const subtitle = el("modalSubtitle");
  const body = el("modalBody");
  if (!modal || !body) return;

  const plsMap = new Map(VIEW.plsFiltered.map((p) => [p.id, p]));
  const items = VIEW.eventosFiltered
    .filter((e) => e.fecha === dateISO)
    .map((e) => {
      const p = plsMap.get(e.pl_id);
      const pl = p?.pl || "—";
      const rs = p?.razon_social || "";
      const op = p?.operador || "";
      const edo = p?.estado || "";
      const mun = p?.municipio || "";
      const sem = p?.semaforo || "";
      const g2500 = p?.grupo_2500 ? "Sí" : "No";

      return {
        tipo: e.tipo,
        notas: e.notas || "",
        pl, rs, op, edo, mun, sem, g2500
      };
    });

  const pretty = fmtDateISOToPretty(dateISO);

  title && (title.textContent = `Detalle del día · ${pretty}`);
  subtitle && (subtitle.textContent = `${items.length} evento(s) — filtros aplicados`);

  if (!items.length) {
    body.innerHTML = `<div class="muted">No hay eventos en este día con los filtros actuales.</div>`;
  } else {
    body.innerHTML = items.map((it) => `
      <div class="modalItem">
        <div class="modalItemTop">
          <div class="modalStrong">${escapeHtml(it.tipo)}</div>
          <div class="muted">${escapeHtml(it.pl)} — ${escapeHtml(it.rs)}</div>
        </div>
        <div class="modalMeta">
          ${escapeHtml(it.edo)} / ${escapeHtml(it.mun)} · ${escapeHtml(it.op)} · Semáforo: <strong>${escapeHtml(it.sem)}</strong> · 2500: <strong>${escapeHtml(it.g2500)}</strong>
          ${it.notas ? `<div style="margin-top:6px;">Notas: ${escapeHtml(it.notas)}</div>` : ""}
        </div>
      </div>
    `).join("");
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = el("dayModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

// ============================
// EXPORT CSV (month selected + filters)
// ============================
function exportCSVForSelectedMonth() {
  const { y, m } = getMonthParts(CAL_MONTH);
  const monthPrefix = `${y}-${String(m).padStart(2, "0")}-`;

  const plsMap = new Map(VIEW.plsFiltered.map((p) => [p.id, p]));
  const rows = VIEW.eventosFiltered
    .filter((e) => String(e.fecha || "").startsWith(monthPrefix))
    .map((e) => {
      const p = plsMap.get(e.pl_id) || {};
      return {
        fecha: e.fecha || "",
        tipo: e.tipo || "",
        notas: e.notas || "",
        pl: p.pl || "",
        razon_social: p.razon_social || "",
        operador: p.operador || "",
        estado: p.estado || "",
        municipio: p.municipio || "",
        direccion: p.direccion || "",
        semaforo: p.semaforo || "",
        grupo_2500: p.grupo_2500 ? "Sí" : "No",
      };
    });

  const headers = [
    "fecha","tipo","notas","pl","razon_social","operador","estado","municipio","direccion","semaforo","grupo_2500"
  ];

  const csv =
    headers.join(",") + "\n" +
    rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")).join("\n");

  const filename = `eventos_${y}-${String(m).padStart(2, "0")}_filtrado.csv`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

// ============================
// ACTIONS: APPLY FILTERS
// ============================
function onApplyFilters() {
  FILTERS.operador = el("filterOperador")?.value || "";
  FILTERS.estado = el("filterEstado")?.value || "";
  FILTERS.semaforo = el("filterSemaforo")?.value || "";
  FILTERS.grupo2500 = el("filter2500")?.value || "";
  renderAll();
}

// ============================
// INSERTS
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
  ["pl","razon_social","estado","municipio","direccion","operador"].forEach((id) => {
    const n = el(id); if (n) n.value = "";
  });
  el("semaforo") && (el("semaforo").value = "VERDE");
  el("grupo_2500") && (el("grupo_2500").checked = false);

  await boot(true);
  showTab("registro");
}

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

  el("ev_fecha") && (el("ev_fecha").value = "");
  el("ev_notas") && (el("ev_notas").value = "");

  await boot(true);
  showTab("registro");
}

// ============================
// RENDER ALL
// ============================
function renderAll() {
  // filtros (opciones)
  renderFilterSelects(RAW.pls);

  // aplicar filtros
  const { plsFiltered, eventosFiltered } = applyFilters(RAW);
  VIEW = { plsFiltered, eventosFiltered };

  // kpis + charts + registro
  renderKPIs(plsFiltered, eventosFiltered);
  renderDonut(RAW.tipos, eventosFiltered);
  renderBarOperadores(plsFiltered);
  renderDetalleOperadores(plsFiltered);
  renderRegistroSelectors(plsFiltered, RAW.tipos);
  renderMiniHistorial(plsFiltered, eventosFiltered);

  // calendario mensual
  renderCalendar();
}

// ============================
// BOOT
// ============================
async function boot(forceReload = false) {
  if (forceReload || !RAW.pls.length) {
    RAW = await fetchAll();
  }

  // Si el input month existe y está vacío, set default
  const mi = el("calMonth");
  if (mi && !mi.value) mi.value = CAL_MONTH;

  renderAll();
}
