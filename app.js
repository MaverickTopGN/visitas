// =====================
// 0) SUPABASE CONFIG
// =====================
const SUPABASE_URL = "https://bpdafatlwefzrqcgvtss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZGFmYXRsd2VmenJxY2d2dHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQzMDcsImV4cCI6MjA4NzAyMDMwN30.KyDRMcUcIytKCd2hZDmQ-6N-vex5pKk22MpUedDdusk";

const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let pieChart = null;

// Helpers
const el = (id) => document.getElementById(id);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

function safeText(node, value) {
  if (!node) return;
  node.innerText = value;
}

function showTab(tabId) {
  qsa(".tab").forEach((b) => b.classList.remove("active"));
  qsa(".panel").forEach((p) => p.classList.remove("active"));

  const btn = document.querySelector(`.tab[data-tab="${tabId}"]`);
  const panel = el(tabId);

  if (btn) btn.classList.add("active");
  if (panel) panel.classList.add("active");

  // opcional: subir al inicio para que se vea el contenido
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[c]));
}

// =====================
// 1) INIT UI + TABS
// =====================
document.addEventListener("DOMContentLoaded", () => {
  // Tabs
  qsa(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      showTab(tabId);
    });
  });

  // Boot data
  boot().catch((e) => console.error("BOOT ERROR:", e));
});

// =====================
// 2) DATA LOADING
// =====================
async function fetchAll() {
  if (!supabase) {
    console.warn("Supabase no inicializado. Revisa CDN y credenciales.");
    return { pls: [], eventos: [], tipos: [] };
  }

  const [{ data: pls, error: e1 }, { data: eventos, error: e2 }, { data: tipos, error: e3 }] =
    await Promise.all([
      supabase.from("pls").select("*").order("created_at", { ascending: false }),
      supabase.from("eventos").select("*").order("fecha", { ascending: false }),
      supabase.from("tipos_evento").select("*").order("nombre", { ascending: true }),
    ]);

  if (e1 || e2 || e3) {
    console.error(e1 || e2 || e3);
    // No truena la UI; solo devuelve vacío si hay error
    return { pls: pls ?? [], eventos: eventos ?? [], tipos: tipos ?? [] };
  }

  return { pls: pls ?? [], eventos: eventos ?? [], tipos: tipos ?? [] };
}

function buildPieData(tipos, eventos) {
  // Mapa con color por tipo
  const colorMap = new Map();
  tipos.forEach((t) => colorMap.set(t.nombre, t.color || "#64748B"));

  const count = new Map();
  eventos.forEach((ev) => {
    count.set(ev.tipo, (count.get(ev.tipo) || 0) + 1);
  });

  const data = Array.from(count.entries()).map(([tipo, value]) => ({
    name: tipo,
    value,
    color: colorMap.get(tipo) || "#64748B",
  }));

  return data;
}

function renderPie(pieData) {
  const canvas = el("pieChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = pieData.map((x) => x.name);
  const values = pieData.map((x) => x.value);
  const colors = pieData.map((x) => x.color);

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
    },
  });
}

function renderOperadorCounter(pls) {
  const cont = el("contadorOperadores");
  if (!cont) return;

  const map = {};
  pls.forEach((p) => {
    const op = (p.operador || "Sin operador").trim() || "Sin operador";
    map[op] = (map[op] || 0) + 1;
  });

  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);

  cont.innerHTML = `
    <div style="font-weight:800; margin:10px 0 8px;">PLs por Operador</div>
    ${entries.length ? "" : `<div style="color:#6b7280;font-size:12px;">Sin datos</div>`}
    ${entries.map(([op, n]) => `
      <div style="display:flex;justify-content:space-between; padding:8px 0; border-bottom:1px solid #eef2f7;">
        <span>${escapeHtml(op)}</span>
        <strong>${n}</strong>
      </div>
    `).join("")}
  `;
}

function renderRegistroSelectors(pls, tipos) {
  const selPL = el("ev_pl");
  const selTipo = el("ev_tipo");

  if (selPL) {
    selPL.innerHTML = `<option value="">Selecciona PL</option>`;
    pls.forEach((p) => {
      selPL.innerHTML += `<option value="${p.id}">${escapeHtml(p.pl)} — ${escapeHtml(p.razon_social)}</option>`;
    });
  }

  if (selTipo) {
    selTipo.innerHTML = "";
    tipos.forEach((t) => {
      selTipo.innerHTML += `<option value="${escapeHtml(t.nombre)}">${escapeHtml(t.nombre)}</option>`;
    });
  }
}

function renderRegistroList(pls, eventos) {
  const wrap = el("plList");
  if (!wrap) return;

  if (!pls.length) {
    wrap.innerHTML = `<div style="color:#6b7280;font-size:12px;">Aún no hay PLs registradas.</div>`;
    return;
  }

  // mini historial por PL
  wrap.innerHTML = pls
    .map((p) => {
      const hist = eventos.filter((e) => e.pl_id === p.id).slice(0, 6); // últimos 6
      const histHtml = hist.length
        ? hist
            .map(
              (h) =>
                `<div style="display:flex;gap:10px;font-size:12px;color:#475569;">
                  <span style="min-width:92px;color:#64748b;">${escapeHtml(h.fecha)}</span>
                  <strong style="color:#0f172a;">${escapeHtml(h.tipo)}</strong>
                  ${h.notas ? `<span style="color:#64748b;">— ${escapeHtml(h.notas)}</span>` : ""}
                </div>`
            )
            .join("")
        : `<div style="color:#6b7280;font-size:12px;">Sin eventos</div>`;

      const semColor = p.semaforo === "ROJA" ? "#DC2626" : "#16A34A";
      const semBg = p.semaforo === "ROJA" ? "#FEE2E2" : "#DCFCE7";

      return `
        <div style="border:1px solid #eef2f7; border-radius:12px; padding:14px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-weight:900;">${escapeHtml(p.pl)} — ${escapeHtml(p.razon_social)}</div>
              <div style="font-size:12px;color:#64748b; margin-top:4px;">
                ${escapeHtml(p.estado)} / ${escapeHtml(p.municipio)} · ${escapeHtml(p.operador)}
              </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
              <span style="padding:6px 10px; border-radius:999px; font-size:12px; font-weight:900; background:${semBg}; color:${semColor}; border:1px solid #e5e7eb;">
                ${escapeHtml(p.semaforo)}
              </span>
              <span style="padding:6px 10px; border-radius:999px; font-size:12px; font-weight:900; background:#f3f4f6; border:1px solid #e5e7eb;">
                2500: ${p.grupo_2500 ? "Sí" : "No"}
              </span>
            </div>
          </div>

          <div style="margin-top:10px;">
            <div style="font-weight:800; font-size:12px; color:#0f172a; margin-bottom:6px;">Mini-historial</div>
            ${histHtml}
          </div>
        </div>
      `;
    })
    .join("");
}

// =====================
// 3) ACTIONS (INSERTS)
// =====================
function wireActions() {
  const btnAddPL = el("btnAddPL");
  const btnAddEvento = el("btnAddEvento");

  if (btnAddPL) {
    btnAddPL.onclick = async () => {
      if (!supabase) return alert("Supabase no configurado.");

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

      const { error } = await supabase.from("pls").insert(payload);
      if (error) {
        console.error(error);
        return alert("Error guardando PL.");
      }

      // limpiar
      ["pl", "razon_social", "estado", "municipio", "direccion", "operador"].forEach((id) => {
        const n = el(id);
        if (n) n.value = "";
      });
      if (el("semaforo")) el("semaforo").value = "VERDE";
      if (el("grupo_2500")) el("grupo_2500").checked = false;

      await boot();
      showTab("registro");
    };
  }

  if (btnAddEvento) {
    btnAddEvento.onclick = async () => {
      if (!supabase) return alert("Supabase no configurado.");

      const payload = {
        pl_id: el("ev_pl")?.value || "",
        tipo: el("ev_tipo")?.value || "",
        fecha: el("ev_fecha")?.value || "",
        notas: el("ev_notas")?.value?.trim() || "",
      };

      if (!payload.pl_id) return alert("Selecciona una PL.");
      if (!payload.tipo) return alert("Selecciona un tipo.");
      if (!payload.fecha) return alert("Selecciona una fecha.");

      const { error } = await supabase.from("eventos").insert(payload);
      if (error) {
        console.error(error);
        return alert("Error guardando evento.");
      }

      if (el("ev_fecha")) el("ev_fecha").value = "";
      if (el("ev_notas")) el("ev_notas").value = "";

      await boot();
      showTab("registro");
    };
  }
}

// =====================
// 4) BOOT (RENDER ALL)
// =====================
async function boot() {
  wireActions();

  const { pls, eventos, tipos } = await fetchAll();

  safeText(el("statPls"), pls.length);
  safeText(el("statEventos"), eventos.length);

  renderOperadorCounter(pls);

  const pieData = buildPieData(tipos, eventos);
  renderPie(pieData);

  renderRegistroSelectors(pls, tipos);
  renderRegistroList(pls, eventos);
}
