// ============================
// SUPABASE CONFIG
// ============================
const SUPABASE_URL = "https://bpdafatlwefzrqcgvtss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZGFmYXRsd2VmenJxY2d2dHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQzMDcsImV4cCI6MjA4NzAyMDMwN30.KyDRMcUcIytKCd2hZDmQ-6N-vex5pKk22MpUedDdusk";

// Creamos cliente UNA sola vez
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let pieChart = null;

// ============================
// Helpers
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

  window.scrollTo({ top: 0 });
}

// ============================
// INIT TABS
// ============================
document.addEventListener("DOMContentLoaded", () => {
  qsa(".tab").forEach((btn) => {
    btn.type = "button";
    btn.addEventListener("click", () => {
      showTab(btn.dataset.tab);
    });
  });

  boot();
});

// ============================
// FETCH DATA
// ============================
async function fetchAll() {
  const [{ data: pls }, { data: eventos }, { data: tipos }] =
    await Promise.all([
      supabaseClient.from("pls").select("*"),
      supabaseClient.from("eventos").select("*"),
      supabaseClient.from("tipos_evento").select("*"),
    ]);

  return {
    pls: pls || [],
    eventos: eventos || [],
    tipos: tipos || [],
  };
}

// ============================
// RENDER DASHBOARD
// ============================
function renderOperadores(pls) {
  const cont = el("contadorOperadores");
  if (!cont) return;

  const map = {};
  pls.forEach((p) => {
    const op = p.operador || "Sin operador";
    map[op] = (map[op] || 0) + 1;
  });

  cont.innerHTML = `<h4>PLs por Operador</h4>` +
    Object.entries(map)
      .map(([op, n]) => `<div>${escapeHtml(op)}: <strong>${n}</strong></div>`)
      .join("");
}

function renderPie(tipos, eventos) {
  const canvas = el("pieChart");
  if (!canvas) return;

  const count = {};
  eventos.forEach((e) => {
    count[e.tipo] = (count[e.tipo] || 0) + 1;
  });

  const labels = Object.keys(count);
  const values = Object.values(count);

  // Color por tipo
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
      cutout: "68%",                 // más “friendly”
      radius: "88%",                 // no tan grande
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
// RENDER REGISTRO
// ============================
function renderSelectors(pls, tipos) {
  const selPL = el("ev_pl");
  const selTipo = el("ev_tipo");

  if (selPL) {
    selPL.innerHTML = `<option value="">Selecciona PL</option>`;
    pls.forEach((p) => {
      selPL.innerHTML += `<option value="${p.id}">
        ${escapeHtml(p.pl)} — ${escapeHtml(p.razon_social)}
      </option>`;
    });
  }

  if (selTipo) {
    selTipo.innerHTML = "";
    tipos.forEach((t) => {
      selTipo.innerHTML += `<option value="${t.nombre}">
        ${escapeHtml(t.nombre)}
      </option>`;
    });
  }
}

function renderMiniHistorial(pls, eventos) {
  const wrap = el("plList");
  if (!wrap) return;

  wrap.innerHTML = pls
    .map((p) => {
      const hist = eventos.filter((e) => e.pl_id === p.id);

      return `
        <div style="margin-bottom:20px;">
          <strong>${escapeHtml(p.pl)}</strong> - ${escapeHtml(p.razon_social)}<br/>
          <small>${escapeHtml(p.operador)}</small>
          <div style="margin-top:6px;font-size:12px;color:#6b7280;">
            ${
              hist.length
                ? hist
                    .map(
                      (h) =>
                        `• ${escapeHtml(h.fecha)} - ${escapeHtml(
                          h.tipo
                        )}<br/>`
                    )
                    .join("")
                : "Sin eventos"
            }
          </div>
        </div>
      `;
    })
    .join("");
}

// ============================
// INSERTS
// ============================
function wireActions() {
  const btnPL = el("btnAddPL");
  const btnEv = el("btnAddEvento");

  if (btnPL) {
    btnPL.onclick = async () => {
      const payload = {
        pl: el("pl").value,
        razon_social: el("razon_social").value,
        estado: el("estado").value,
        municipio: el("municipio").value,
        direccion: el("direccion").value,
        operador: el("operador").value,
        semaforo: el("semaforo").value,
        grupo_2500: el("grupo_2500").checked,
      };

      if (!payload.pl) return alert("PL obligatorio");

      await supabaseClient.from("pls").insert(payload);
      boot();
      showTab("registro");
    };
  }

  if (btnEv) {
    btnEv.onclick = async () => {
      const payload = {
        pl_id: el("ev_pl").value,
        tipo: el("ev_tipo").value,
        fecha: el("ev_fecha").value,
        notas: el("ev_notas").value,
      };

      if (!payload.pl_id) return alert("Selecciona PL");
      if (!payload.fecha) return alert("Selecciona fecha");

      await supabaseClient.from("eventos").insert(payload);
      boot();
      showTab("registro");
    };
  }
}

// ============================
// BOOT
// ============================
async function boot() {
  wireActions();

  const { pls, eventos, tipos } = await fetchAll();

  el("statPls").innerText = pls.length;
  el("statEventos").innerText = eventos.length;

  renderOperadores(pls);
  renderPie(tipos, eventos);
  renderSelectors(pls, tipos);
  renderMiniHistorial(pls, eventos);
}
