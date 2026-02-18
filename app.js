const SUPABASE_URL = "https://bpdafatlwefzrqcgvtss.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZGFmYXRsd2VmenJxY2d2dHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQzMDcsImV4cCI6MjA4NzAyMDMwN30.KyDRMcUcIytKCd2hZDmQ-6N-vex5pKk22MpUedDdusk";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let pieChart;

// Tabs
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

async function cargarDatos(){

  const { data: pls } = await supabase.from("pls").select("*");
  const { data: eventos } = await supabase.from("eventos").select("*");
  const { data: tipos } = await supabase.from("tipos_evento").select("*");

  document.getElementById("statPls").innerText = pls.length;
  document.getElementById("statEventos").innerText = eventos.length;

  // Contador por operador
  const contador = {};
  pls.forEach(p=>{
    contador[p.operador] = (contador[p.operador] || 0) + 1;
  });

  const contenedor = document.getElementById("contadorOperadores");
  contenedor.innerHTML = "<h4>PLs por Operador</h4>";
  Object.keys(contador).forEach(op=>{
    contenedor.innerHTML += `<div>${op}: <strong>${contador[op]}</strong></div>`;
  });

  // Pie
  const map = {};
  eventos.forEach(ev=>{
    map[ev.tipo] = (map[ev.tipo] || 0) + 1;
  });

  const labels = Object.keys(map);
  const values = Object.values(map);
  const colors = tipos.map(t=>t.color);

  if(pieChart) pieChart.destroy();

  pieChart = new Chart(document.getElementById("pieChart"),{
    type:"pie",
    data:{
      labels,
      datasets:[{data:values, backgroundColor:colors}]
    }
  });

  // Select PL
  const selPL = document.getElementById("ev_pl");
  selPL.innerHTML="";
  pls.forEach(p=>{
    selPL.innerHTML+=`<option value="${p.id}">${p.pl}</option>`;
  });

  // Select tipos
  const selTipo = document.getElementById("ev_tipo");
  selTipo.innerHTML="";
  tipos.forEach(t=>{
    selTipo.innerHTML+=`<option value="${t.nombre}">${t.nombre}</option>`;
  });

  // Mini historial
  const plList = document.getElementById("plList");
  plList.innerHTML="";

  pls.forEach(p=>{
    const eventosPL = eventos.filter(e=>e.pl_id===p.id);

    let html = `<div style="margin-bottom:20px;">
      <strong>${p.pl}</strong> - ${p.razon_social}<br/>
      <small>${p.operador}</small><br/>
      <div style="margin-top:6px;font-size:12px;color:#6b7280;">`;

    eventosPL.forEach(ev=>{
      html += `• ${ev.fecha} - ${ev.tipo}<br/>`;
    });

    html += "</div></div>";

    plList.innerHTML += html;
  });

}

document.getElementById("btnAddPL").addEventListener("click",async()=>{
  await supabase.from("pls").insert({
    pl:pl.value,
    razon_social:razon_social.value,
    estado:estado.value,
    municipio:municipio.value,
    direccion:direccion.value,
    operador:operador.value,
    semaforo:semaforo.value,
    grupo_2500:grupo_2500.checked
  });

  cargarDatos();
});

document.getElementById("btnAddEvento").addEventListener("click",async()=>{
  await supabase.from("eventos").insert({
    pl_id:ev_pl.value,
    tipo:ev_tipo.value,
    fecha:ev_fecha.value,
    notas:ev_notas.value
  });

  cargarDatos();
});

cargarDatos();
