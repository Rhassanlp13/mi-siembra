/* ════════════════════════════════════════════════════════════
   CONFIGURACIÓN SUPABASE
   ════════════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://wjkdwkiaxmnymnpxubsa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqa2R3a2lheG1ueW1ucHh1YnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NzIzMDEsImV4cCI6MjEwNjI0ODMwMX0.aPxUzOWfp3SVk9P4hkBjDOqhg48pX2aEHw80X-38idU';
const API_BASE = `${SUPABASE_URL}/rest/v1/siembras`;
const SB_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

/* ════════════════════════════════════════════════════════════
   ALMACENAMIENTO LOCAL
   ════════════════════════════════════════════════════════════ */
const KEY = 'siembras_local_v1';

function cargarSiembras(){
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}

function guardarSiembras(lista){
  try { localStorage.setItem(KEY, JSON.stringify(lista)); } catch(e){}
}

function contarPendientes(){
  return cargarSiembras().filter(s => s._pendiente).length;
}

/* ════════════════════════════════════════════════════════════
   SINCRONIZACIÓN CON SUPABASE
   ════════════════════════════════════════════════════════════ */
async function sincronizar(){
  if (!navigator.onLine){
    mostrarToast('📡 Sin conexión — solo tienes datos locales', 'error');
    return;
  }

  const btn = document.getElementById('btnRefresh');
  if (btn){ btn.classList.add('spinning'); btn.disabled = true; }
  mostrarToast('🔄 Sincronizando…');

  try {
    let lista = cargarSiembras();

    const porCrear = lista.filter(s => s._pendiente === 'crear');
    for (const s of porCrear){
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            cultivo: s.cultivo,
            variedad: s.variedad,
            fecha: s.fecha,
            notas: s.notas || ''
          })
        });
        if (res.ok){
          const [creada] = await res.json();
          s.supabase_id = creada.id;
          s._pendiente = null;
        } else {
          console.warn('Falló subir a Supabase:', s);
        }
      } catch(e){ console.warn('Error subiendo:', e); }
    }

    const porEliminar = lista.filter(s => s._pendiente === 'eliminar' && s.supabase_id);
    for (const s of porEliminar){
      try {
        await fetch(`${API_BASE}?id=eq.${s.supabase_id}`, {
          method: 'DELETE',
          headers: SB_HEADERS
        });
      } catch(e){ console.warn('Error borrando:', e); }
    }

    lista = lista.filter(s => s._pendiente !== 'eliminar');

    const res = await fetch(`${API_BASE}?select=*&order=creada.desc`, { headers: SB_HEADERS });
    if (res.ok){
      const remotas = await res.json();
      for (const r of remotas){
        const existe = lista.find(s => s.supabase_id === r.id);
        if (!existe){
          lista.push({
            cultivo: r.cultivo,
            variedad: r.variedad,
            fecha: r.fecha,
            notas: r.notas || '',
            creada: r.creada,
            supabase_id: r.id,
            _pendiente: null
          });
        }
      }
    }

    lista.sort((a, b) => {
      const fa = a.creada || a.fecha;
      const fb = b.creada || b.fecha;
      return fb.localeCompare(fa);
    });

    guardarSiembras(lista);
    renderSiembras();
    mostrarToast('✅ Sincronizado con la nube');

  } catch (err){
    console.error(err);
    mostrarToast('⚠️ Error al sincronizar', 'error');
  } finally {
    if (btn){ btn.classList.remove('spinning'); btn.disabled = false; }
  }
}
window.sincronizar = sincronizar;

/* ════════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════════ */
function mostrarToast(msg, tipo = 'ok'){
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${tipo}`;
  clearTimeout(mostrarToast._timer);
  mostrarToast._timer = setTimeout(() => t.classList.remove('show'), 2500);
}
window.mostrarToast = mostrarToast;

/* ════════════════════════════════════════════════════════════
   TEMA
   ════════════════════════════════════════════════════════════ */
let currentTheme = 'dark';

function setTheme(theme){
  currentTheme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem('tema', theme); } catch(e){}
  const iconMoon = document.getElementById('iconMoon');
  const iconSun  = document.getElementById('iconSun');
  if (iconMoon) iconMoon.style.display = theme === 'dark'  ? 'block' : 'none';
  if (iconSun)  iconSun.style.display  = theme === 'light' ? 'block' : 'none';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#080d17' : '#f6f8fb');
}

try {
  const saved = localStorage.getItem('tema');
  if (saved === 'light' || saved === 'dark') currentTheme = saved;
} catch(e){}

setTheme(currentTheme);

function attachThemeListener(){
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachThemeListener);
} else {
  attachThemeListener();
}

/* ════════════════════════════════════════════════════════════
   ESTRELLAS
   ════════════════════════════════════════════════════════════ */
(function renderStars(){
  const cont = document.getElementById('stars');
  if (!cont) return;
  let html = '';
  for (let i = 0; i < 40; i++){
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const s = Math.random() * 1.6 + 0.4;
    const d = Math.random() * 3;
    const o = Math.random() * .6 + .3;
    html += `<span class="star" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:${d}s;opacity:${o}"></span>`;
  }
  cont.innerHTML = html;
})();

/* ════════════════════════════════════════════════════════════
   CULTIVOS
   ════════════════════════════════════════════════════════════ */
const CULTIVOS = {
  yuca: {
    nombre: 'Yuca', tipo: 'raiz', ciclo: 150, color: 'amber',
    variedades: ['CMC-40', 'Señorita', 'Enano Guantanamero'],
    fases: [
      { nombre:'Brotación',         inicio:0,  fin:9,   emoji:'🌰', desc:'La estaca está bajo tierra, sin señal visible.', tamano:'Bajo tierra' },
      { nombre:'Emergencia',        inicio:10, fin:29,  emoji:'🌱', desc:'Aparecen las primeras hojas verde claro.', tamano:'5–10 cm' },
      { nombre:'Crecimiento lento', inicio:30, fin:59,  emoji:'🌿', desc:'Pequeño arbusto, raíces aún fibrosas.', tamano:'20–30 cm' },
      { nombre:'Máximo crecimiento',inicio:60, fin:89,  emoji:'🪴', desc:'Arbusto frondoso, raíces empiezan a engrosar.', tamano:'80–100 cm' },
      { nombre:'Tuberización',      inicio:90, fin:150, emoji:'🥔', desc:'Raíces de reserva engrosadas, listas para cosecha.', tamano:'~2.5 kg por mata' }
    ]
  },
  frijol: {
    nombre: 'Frijol', tipo: 'grano', ciclo: 75, color: 'emerald',
    variedades: ['Pilón', 'Velazco Largo', 'Cubanito 24'],
    fases: [
      { nombre:'Emergencia',    inicio:0,  fin:5,  emoji:'🌱', desc:'La plántula rompe el suelo con dos hojas carnosas.', tamano:'3–5 cm' },
      { nombre:'V4 (3 hojas)',  inicio:6,  fin:22, emoji:'🌿', desc:'Aparece la tercera hoja trifoliada.', tamano:'20–30 cm' },
      { nombre:'Floración',     inicio:23, fin:38, emoji:'🌸', desc:'Primeras flores blancas o violetas.', tamano:'40–50 cm' },
      { nombre:'Vainas verdes', inicio:39, fin:60, emoji:'🫛', desc:'Vainas verdes colgando, aún planas.', tamano:'Vainas de 8–12 cm' },
      { nombre:'Maduración',    inicio:61, fin:75, emoji:'🟤', desc:'Vainas amarillas/marrones secándose.', tamano:'Listo para cosecha' }
    ]
  },
  boniato: {
    nombre: 'Boniato', tipo: 'raiz', ciclo: 120, color: 'yellow',
    variedades: ['CEMSA 78-354', 'INIVIT B-90', 'Cautla', 'Señorita'],
    fases: [
      { nombre:'Enraizamiento',      inicio:0,  fin:15,  emoji:'🌰', desc:'La estaca emite raíces y brota la primera hoja.', tamano:'Bajo tierra' },
      { nombre:'Crecimiento vegetal',inicio:16, fin:45,  emoji:'🌿', desc:'La guía se extiende por el suelo, follaje verde.', tamano:'30–60 cm de guía' },
      { nombre:'Formación de raíces',inicio:46, fin:75,  emoji:'🍠', desc:'Empiezan a engrosar las raíces reservantes.', tamano:'Raíces del grosor de un lápiz' },
      { nombre:'Engrosamiento',      inicio:76, fin:105, emoji:'🥔', desc:'Las raíces crecen y toman color de la variedad.', tamano:'Raíces de 4–7 cm' },
      { nombre:'Maduración',         inicio:106,fin:120, emoji:'✅', desc:'Piel firme, guías amarillean. Listo para cosechar.', tamano:'Listo para cosecha' }
    ]
  },
  platano: {
    nombre: 'Plátano', tipo: 'fruto', ciclo: 330, color: 'lime',
    variedades: ['Burro CEMSA', 'Enano Guantanamero', 'Pacífico'],
    fases: [
      { nombre:'Fase infantil',   inicio:0,   fin:90,  emoji:'🌱', desc:'Hijo creciendo, hojas escuamiformes.', tamano:'~50 cm a los 3 meses' },
      { nombre:'Fase vegetativa', inicio:91,  fin:180, emoji:'🌿', desc:'Pseudotallo grueso visible.', tamano:'2–2.75 m' },
      { nombre:'Fase floral',     inicio:181, fin:270, emoji:'🌸', desc:'Emerge la inflorescencia (bellote).', tamano:'Racimo en formación' },
      { nombre:'Fructificación',  inicio:271, fin:330, emoji:'🍌', desc:'Los plátanos engrosan en el racimo.', tamano:'Listo para corte' }
    ]
  }
};

/* ════════════════════════════════════════════════════════════
   CALENDARIO Y GUÍA
   ════════════════════════════════════════════════════════════ */
const CALENDARIO = {
  ene: [{ c:'frijol', n:'Frijol' }, { c:'yuca', n:'Yuca' }, { c:'boniato', n:'Boniato' }],
  feb: [{ c:'frijol', n:'Frijol' }, { c:'yuca', n:'Yuca' }],
  mar: [{ c:'boniato', n:'Boniato' }, { c:'frijol', n:'Frijol' }, { c:'yuca', n:'Yuca' }],
  abr: [{ c:'boniato', n:'Boniato' }, { c:'yuca', n:'Yuca' }],
  may: [{ c:'boniato', n:'Boniato' }, { c:'yuca', n:'Yuca' }],
  jun: [{ c:'boniato', n:'Boniato' }, { c:'yuca', n:'Yuca' }],
  jul: [{ c:'boniato', n:'Boniato' }],
  ago: [{ c:'boniato', n:'Boniato' }, { c:'frijol', n:'Frijol' }, { c:'platano', n:'Plátano' }],
  sep: [{ c:'frijol', n:'Frijol' }, { c:'platano', n:'Plátano' }, { c:'yuca', n:'Yuca' }],
  oct: [{ c:'frijol', n:'Frijol' }, { c:'platano', n:'Plátano' }, { c:'boniato', n:'Boniato' }],
  nov: [{ c:'frijol', n:'Frijol' }, { c:'platano', n:'Plátano' }, { c:'boniato', n:'Boniato' }],
  dic: [{ c:'frijol', n:'Frijol' }, { c:'yuca', n:'Yuca' }, { c:'platano', n:'Plátano' }]
};

const GUIA = {
  yuca: { emoji:'🥔', tips:[
    'Siembra en cuarto menguante para buen desarrollo de raíces.',
    'Distancia: 1 m entre matas y 1 m entre surcos.',
    'No necesita mucho riego, resiste sequía.',
    'Cosecha a los 5-8 meses según variedad.',
    'No abonar con exceso de nitrógeno: hace mucha hoja y poca raíz.'
  ]},
  frijol: { emoji:'🫘', tips:[
    'La mejor siembra: del 15 oct al 15 dic.',
    'Distancia: 60 cm entre surcos, 8-10 cm entre plantas.',
    'Necesita buen drenaje, evita encharcamientos.',
    'Cosecha cuando las vainas estén amarillas y secas.',
    'Rota con maíz o boniato para evitar plagas.'
  ]},
  boniato: { emoji:'🍠', tips:[
    'Siembra con la luna menguante o nueva.',
    'Distancia: 30 cm entre plantas, 80 cm entre surcos.',
    'Necesita suelo suelto y bien drenado.',
    'Riego moderado; exceso de agua pudre las raíces.',
    'Cosecha entre 100 y 130 días según variedad.',
    'Las guías tiernas también son comestibles.'
  ]},
  platano: { emoji:'🍌', tips:[
    'Siembra los hijos con la luna nueva o creciente.',
    'Distancia: 2-2.5 m entre plantas.',
    'Necesita mucha agua y materia orgánica.',
    'Deshije cada 2 meses para dejar 2-3 hijos por mata.',
    'Cosecha el racimo cuando los plátanos estén "gordos" pero verdes.'
  ]}
};

/* ════════════════════════════════════════════════════════════
   RECOMENDACIONES LUNARES
   ════════════════════════════════════════════════════════════ */
const RECOMENDACIONES = [
  { fase:'menguante', tipo:'raiz',  fav:true,  txt:'Siembra raíces y tubérculos para buen desarrollo subterráneo.' },
  { fase:'menguante', tipo:'grano', fav:true,  txt:'Buen momento para cosechar granos, no se pican.' },
  { fase:'menguante', tipo:'fruto', fav:false, txt:'Evita plantar plátano: los hijos se "pelan".' },
  { fase:'menguante', tipo:'todos', fav:true,  txt:'Ideal para podar y limpiar el terreno.' },
  { fase:'creciente', tipo:'grano', fav:true,  txt:'Siembra frijol y maíz: mayor crecimiento del tallo.' },
  { fase:'creciente', tipo:'hoja',  fav:true,  txt:'Buen momento para trasplantar hortalizas de hoja.' },
  { fase:'creciente', tipo:'todos', fav:true,  txt:'Favorece el crecimiento aéreo de las plantas.' },
  { fase:'llena',     tipo:'raiz',  fav:true,  txt:'Siembra yuca en llena para raíces gruesas.' },
  { fase:'llena',     tipo:'todos', fav:false, txt:'Evita podar en llena: la savia está arriba y "sangra".' },
  { fase:'llena',     tipo:'todos', fav:true,  txt:'Momento de máximo vigor, bueno para cosechar consumo fresco.' },
  { fase:'nueva',     tipo:'todos', fav:true,  txt:'Buen momento para preparar tierra y abonar.' },
  { fase:'nueva',     tipo:'fruto', fav:true,  txt:'Algunos agricultores siembran plátano en luna nueva.' }
];

/* ════════════════════════════════════════════════════════════
   FASE LUNAR — 8 fases con nombres astronómicos
   ════════════════════════════════════════════════════════════ */
function getMoonPhase(date = new Date()) {
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const synodic = 29.530588853;
  const days = (date.getTime() - ref) / 86400000;
  let age = days % synodic;
  if (age < 0) age += synodic;
  const phase = age / synodic;
  const ilum = Math.round((1 - Math.cos(2 * Math.PI * phase)) / 2 * 100);

  let nombre, icono;
  if      (phase < 0.0625) { nombre = 'nueva';              icono = '🌑'; }
  else if (phase < 0.1875) { nombre = 'creciente cóncava';  icono = '🌒'; }
  else if (phase < 0.3125) { nombre = 'cuarto creciente';   icono = '🌓'; }
  else if (phase < 0.4375) { nombre = 'gibosa creciente';   icono = '🌔'; }
  else if (phase < 0.5625) { nombre = 'llena';              icono = '🌕'; }
  else if (phase < 0.6875) { nombre = 'gibosa menguante';   icono = '🌖'; }
  else if (phase < 0.8125) { nombre = 'cuarto menguante';   icono = '🌗'; }
  else if (phase < 0.9375) { nombre = 'menguante cóncava';  icono = '🌘'; }
  else                     { nombre = 'nueva';              icono = '🌑'; }

  const diasParaNueva = synodic - age;
  const proximaNueva = new Date(date.getTime() + diasParaNueva * 86400000);
  return { nombre, icono, ilum, age: Math.round(age), proximaNueva };
}

/* ════════════════════════════════════════════════════════════
   UTILIDADES
   ════════════════════════════════════════════════════════════ */
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const diasEntre = (a, b) => {
  const d1 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const d2 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((d2 - d1) / 86400000);
};
const sumarDias = (f, n) => { const d = new Date(f); d.setDate(d.getDate() + n); return d; };
const fmt       = f => `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
const fmtCorto  = f => `${f.getDate()} ${MESES[f.getMonth()]}`;
const hoyISO    = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

/* ════════════════════════════════════════════════════════════
   ESTADO DE CULTIVO
   ════════════════════════════════════════════════════════════ */
function calcularEstado(s){
  const c = CULTIVOS[s.cultivo];
  const fSiembra = new Date(s.fecha + 'T00:00:00');
  const hoy = new Date();
  const dds = Math.max(0, diasEntre(fSiembra, hoy));
  const progreso = Math.min(100, Math.round((dds / c.ciclo) * 100));
  const esCosecha = dds >= c.ciclo;

  let fase = esCosecha
    ? c.fases[c.fases.length - 1]
    : (c.fases.find(f => dds >= f.inicio && dds <= f.fin) || c.fases[0]);

  const idx = c.fases.indexOf(fase);
  const proxima = (!esCosecha && idx < c.fases.length - 1) ? c.fases[idx + 1] : null;
  const fechaProxima = proxima ? sumarDias(fSiembra, proxima.inicio) : null;
  const fechaCosecha = sumarDias(fSiembra, c.ciclo);
  const diasParaCosecha = diasEntre(hoy, fechaCosecha);

  return { c, dds, progreso, fase, proxima, fechaProxima, fechaCosecha, diasParaCosecha, esCosecha, fSiembra };
}

const getRecomendacion = (faseLunar, tipo) =>
     RECOMENDACIONES.find(r => r.fase === faseLunar && r.tipo === tipo)
  || RECOMENDACIONES.find(r => r.fase === faseLunar && r.tipo === 'todos')
  || { txt: 'Sin recomendación específica para esta fase.', fav: true };

/* ════════════════════════════════════════════════════════════
   PALETA
   ════════════════════════════════════════════════════════════ */
const PALETA = {
  amber: {
    badge: 'bg-amber-400/10 text-amber-300 border-amber-400/25',
    visualBg: 'bg-gradient-to-br from-amber-400/10 via-amber-500/[.06] to-transparent border-amber-400/20',
    visualText: 'text-amber-300',
    bar: 'from-amber-400 via-amber-300 to-yellow-400',
    iconBox: 'bg-amber-400/15 border-amber-400/25 text-amber-300'
  },
  emerald: {
    badge: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
    visualBg: 'bg-gradient-to-br from-emerald-400/10 via-emerald-500/[.06] to-transparent border-emerald-400/20',
    visualText: 'text-emerald-300',
    bar: 'from-emerald-400 via-emerald-300 to-teal-300',
    iconBox: 'bg-emerald-400/15 border-emerald-400/25 text-emerald-300'
  },
  yellow: {
    badge: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/25',
    visualBg: 'bg-gradient-to-br from-yellow-400/10 via-yellow-500/[.06] to-transparent border-yellow-400/20',
    visualText: 'text-yellow-300',
    bar: 'from-yellow-400 via-yellow-300 to-amber-300',
    iconBox: 'bg-yellow-400/15 border-yellow-400/25 text-yellow-300'
  },
  lime: {
    badge: 'bg-lime-400/10 text-lime-300 border-lime-400/25',
    visualBg: 'bg-gradient-to-br from-lime-400/10 via-lime-500/[.06] to-transparent border-lime-400/20',
    visualText: 'text-lime-300',
    bar: 'from-lime-400 via-lime-300 to-emerald-300',
    iconBox: 'bg-lime-400/15 border-lime-400/25 text-lime-300'
  }
};

/* ════════════════════════════════════════════════════════════
   RENDER LUNA (barra superior)
   ════════════════════════════════════════════════════════════ */
function renderMoonBar(){
  const m = getMoonPhase();
  document.getElementById('moonIcon').textContent = m.icono;
  document.getElementById('moonName').textContent = `Luna ${m.nombre}`;
  document.getElementById('moonRec').innerHTML =
    `Próxima luna nueva: <span class="text-white font-bold">${fmt(m.proximaNueva)}</span>`;
  document.getElementById('moonIlum').textContent = `${m.ilum}% iluminada`;
  document.getElementById('moonAge').textContent  = `${m.age} días de edad`;
}

/* ════════════════════════════════════════════════════════════
   RENDER SIEMBRAS
   ════════════════════════════════════════════════════════════ */
function renderSiembras(){
  const lista = cargarSiembras();
  const cont = document.getElementById('listaSiembras');
  const contador = document.getElementById('contador');
  contador.textContent = lista.length;

  const lastUpd = document.getElementById('lastUpdate');
  if (lastUpd){
    const pendientes = contarPendientes();
    if (pendientes > 0){
      lastUpd.textContent = `${pendientes} sin sincronizar`;
      lastUpd.style.color = '#fbbf24';
    } else {
      lastUpd.textContent = '';
      lastUpd.style.color = '';
    }
  }

  if (!lista.length){
    cont.innerHTML = `
      <div class="col-span-full panel rounded-3xl p-12 text-center animate-fade-in">
        <div class="text-5xl mb-4 opacity-30 animate-float">🌱</div>
        <p class="text-slate-400 text-sm font-bold">Aún no has registrado ninguna siembra</p>
        <p class="text-slate-500 text-xs mt-1.5">Usa el formulario para empezar</p>
      </div>`;
    return;
  }

  const m = getMoonPhase();

  cont.innerHTML = lista.map((s, i) => {
    const e = calcularEstado(s);
    const rec = getRecomendacion(m.nombre, e.c.tipo);
    const p = PALETA[e.c.color];

    const recBlock = `
      <div class="mt-3 flex items-start gap-3 rounded-2xl ${rec.fav ? 'bg-white/[.03] border-white/[.06]' : 'bg-red-500/[.08] border-red-500/25'} border px-3.5 py-3">
        <span class="text-lg leading-none mt-0.5 shrink-0">${rec.fav ? '✅' : '⚠️'}</span>
        <div class="text-[12.5px] leading-snug">
          <span class="font-bold ${rec.fav ? 'text-slate-200' : 'text-red-300'}">Luna ${m.nombre}:</span>
          <span class="${rec.fav ? 'text-slate-400' : 'text-red-200/80'}"> ${rec.txt}</span>
        </div>
      </div>`;

    const cosechaBlock = e.esCosecha
      ? `<div class="mt-3 rounded-2xl bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-orange-500/20 border border-orange-400/30 px-4 py-3.5 flex items-center gap-3.5 animate-pulse-soft">
           <span class="text-2xl">🎉</span>
           <div>
             <p class="font-extrabold text-orange-200 text-sm">¡Lista para cosechar!</p>
             <p class="text-xs text-orange-300/80">${e.dds} días desde la siembra</p>
           </div>
         </div>`
      : `<div class="grid grid-cols-2 gap-2.5 mt-3">
           <div class="rounded-xl bg-white/[.03] border border-white/[.06] px-3 py-2.5">
             <p class="text-[9.5px] uppercase tracking-[.12em] font-bold text-slate-500">Próxima fase</p>
             <p class="text-[13px] font-bold text-slate-200 truncate mt-1">${e.proxima ? e.proxima.nombre : '—'}</p>
           </div>
           <div class="rounded-xl bg-white/[.03] border border-white/[.06] px-3 py-2.5">
             <p class="text-[9.5px] uppercase tracking-[.12em] font-bold text-slate-500">Fecha</p>
             <p class="text-[13px] font-bold text-slate-200 mt-1">${e.fechaProxima ? fmtCorto(e.fechaProxima) : '—'}</p>
           </div>
           <div class="rounded-xl bg-white/[.03] border border-white/[.06] px-3 py-2.5">
             <p class="text-[9.5px] uppercase tracking-[.12em] font-bold text-slate-500">Cosecha</p>
             <p class="text-[13px] font-bold text-slate-200 mt-1">${fmtCorto(e.fechaCosecha)}</p>
           </div>
           <div class="rounded-xl bg-white/[.03] border border-white/[.06] px-3 py-2.5">
             <p class="text-[9.5px] uppercase tracking-[.12em] font-bold text-slate-500">Faltan</p>
             <p class="text-[13px] font-bold text-slate-200 mt-1">${e.diasParaCosecha > 0 ? e.diasParaCosecha + ' días' : 'Hoy'}</p>
           </div>
         </div>`;

    const iconoCultivo = e.c.nombre === 'Yuca'    ? '🥔'
                       : e.c.nombre === 'Frijol'  ? '🫘'
                       : e.c.nombre === 'Boniato' ? '🍠'
                       : '🍌';

    const badgePendiente = s._pendiente
      ? `<span class="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded ml-1.5">●</span>`
      : '';

    return `
      <article class="panel panel-accent group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover animate-slide-up">
        <div class="flex items-start justify-between gap-3 p-5 pb-3">
          <div class="min-w-0 flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl ${p.iconBox} border flex items-center justify-center text-xl shrink-0 shadow-inner-ring">
              ${iconoCultivo}
            </div>
            <div class="min-w-0">
              <h3 class="text-[15px] font-extrabold text-slate-100 tracking-tight">${e.c.nombre}${badgePendiente}</h3>
              <p class="text-[11px] text-slate-500 mt-0.5">
                <span class="badge ${p.badge}">${s.variedad}</span>
              </p>
            </div>
          </div>
          <button onclick="eliminar(${i})" title="Eliminar"
            class="opacity-0 group-hover:opacity-100 transition-all duration-200 text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20 shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>

        <p class="px-5 pb-3 text-[11px] text-slate-500 flex items-center gap-1.5">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Sembrado el ${fmt(e.fSiembra)}
        </p>

        <div class="mx-5 rounded-2xl ${p.visualBg} border p-4 flex items-center gap-4">
          <div class="relative shrink-0">
            <div class="text-5xl leading-none drop-shadow-lg">${e.fase.emoji}</div>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[9.5px] uppercase tracking-[.18em] font-extrabold ${p.visualText} opacity-70">Fase actual</p>
            <p class="text-base font-extrabold ${p.visualText} leading-tight mt-0.5">${e.esCosecha ? 'Lista para cosecha' : e.fase.nombre}</p>
            <p class="text-[12.5px] text-slate-400 mt-1 leading-snug">${e.fase.desc}</p>
            <span class="inline-flex items-center gap-1 mt-2.5 text-[11px] font-bold bg-white/[.06] text-slate-200 px-2.5 py-1 rounded-full border border-white/[.08]">
              📏 ${e.fase.tamano}
            </span>
          </div>
        </div>

        <div class="px-5 mt-4">
          <div class="flex items-end justify-between mb-2">
            <span class="text-[11px] font-bold text-slate-500">
              Día <span class="text-slate-300 font-mono">${e.dds}</span> de <span class="text-slate-400 font-mono">${e.c.ciclo}</span>
            </span>
            <span class="text-base font-extrabold ${p.visualText} font-mono">${e.progreso}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill bg-gradient-to-r ${p.bar}" style="width:${e.progreso}%"></div>
          </div>
        </div>

        <div class="px-5">
          ${cosechaBlock}
          ${recBlock}
        </div>
        <div class="h-5"></div>
      </article>
    `;
  }).join('');
}

function eliminar(idx){
  if (!confirm('¿Eliminar esta siembra?')) return;
  const lista = cargarSiembras();
  const s = lista[idx];
  if (!s) return;

  if (!s.supabase_id){
    lista.splice(idx, 1);
  } else {
    s._pendiente = 'eliminar';
  }
  guardarSiembras(lista);
  renderSiembras();
}
window.eliminar = eliminar;

/* ════════════════════════════════════════════════════════════
   FORMULARIO
   ════════════════════════════════════════════════════════════ */
function initFormulario(){
  const selCultivo = document.getElementById('cultivo');
  const selVariedad = document.getElementById('variedad');
  const inputFecha = document.getElementById('fecha');

  Object.entries(CULTIVOS).forEach(([k, c]) => {
    const o = document.createElement('option');
    o.value = k; o.textContent = c.nombre;
    selCultivo.appendChild(o);
  });

  function actualizarVariedades(){
    const c = CULTIVOS[selCultivo.value];
    selVariedad.innerHTML = '';
    c.variedades.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      selVariedad.appendChild(o);
    });
  }
  selCultivo.addEventListener('change', actualizarVariedades);
  actualizarVariedades();
  inputFecha.value = hoyISO();

  document.getElementById('formSiembra').addEventListener('submit', ev => {
    ev.preventDefault();
    const nueva = {
      cultivo: selCultivo.value,
      variedad: selVariedad.value,
      fecha: inputFecha.value,
      notas: document.getElementById('notas').value.trim(),
      creada: new Date().toISOString(),
      supabase_id: null,
      _pendiente: 'crear'
    };
    const lista = cargarSiembras();
    lista.unshift(nueva);
    guardarSiembras(lista);
    document.getElementById('notas').value = '';
    renderSiembras();
    mostrarToast('✅ Guardado en el móvil');
  });

  document.getElementById('btnDemo').addEventListener('click', () => {
    const lista = cargarSiembras();
    lista.unshift({
      cultivo: 'yuca', variedad: 'CMC-40', fecha: '2026-09-06',
      notas: 'Ejemplo', creada: new Date().toISOString(),
      supabase_id: null, _pendiente: 'crear'
    });
    guardarSiembras(lista);
    renderSiembras();
  });
}

/* ════════════════════════════════════════════════════════════
   PESTAÑAS
   ════════════════════════════════════════════════════════════ */
function cambiarTab(nombre){
  document.querySelectorAll('.tab-btn, .bottom-nav-btn').forEach(b => {
    b.classList.toggle('tab-active', b.dataset.tab === nombre);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('hidden', p.id !== `tab-${nombre}`);
  });
  if (nombre === 'calendario') renderCalendario();
  if (nombre === 'luna') renderLunaMes();
  if (nombre === 'guia') renderGuia();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.cambiarTab = cambiarTab;

function renderCalendario(){
  const hoy = new Date();
  const mesActual = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][hoy.getMonth()];
  const nombresMes = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const cont = document.getElementById('calendarioContent');
  cont.innerHTML = `
    <p class="text-xs text-slate-500 mb-4">💡 Los cultivos típicos de cada mes en Pilón, Granma</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${Object.entries(CALENDARIO).map(([mes, cultivos]) => {
        const esActual = mes === mesActual;
        return `
          <div class="rounded-2xl border ${esActual ? 'border-brand-400/50 bg-brand-500/[.08]' : 'border-white/[.06] bg-white/[.03]'} p-3.5">
            <p class="text-[11px] font-extrabold uppercase tracking-wider ${esActual ? 'text-brand-300' : 'text-slate-500'} mb-2">
              ${nombresMes[Object.keys(CALENDARIO).indexOf(mes)]}
              ${esActual ? '<span class="ml-2 text-[9px] bg-brand-500 text-black px-1.5 py-0.5 rounded">AHORA</span>' : ''}
            </p>
            <div class="flex flex-wrap gap-1.5">
              ${cultivos.map(c => `<span class="badge badge-${CULTIVOS[c.c].color}">${c.n}</span>`).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

/* ════════════════════════════════════════════════════════════
   RENDER LUNA DEL MES — Algoritmo astronómico preciso (Meeus)
   ════════════════════════════════════════════════════════════ */
function renderLunaMes(){
  const cont = document.getElementById('lunaContent');
  const hoy = new Date();
  const m = getMoonPhase(hoy);

  const RAD = Math.PI / 180;

  function calcularFase(k, tipo){
    // tipo: 0 = Nueva, 1 = Cuarto Creciente, 2 = Llena, 3 = Cuarto Menguante
    const T  = k / 1236.85;
    const T2 = T * T;
    const T3 = T2 * T;
    const T4 = T3 * T;

    let JDE = 2451550.09766 + 29.530588861 * k
            + 0.00015437 * T2
            - 0.000000150 * T3
            + 0.00000000073 * T4;

    const E  = 1 - 0.002516 * T - 0.0000074 * T2;
    const M  = (2.5534    + 29.10535670 * k - 0.0000014  * T2 - 0.00000011  * T3) * RAD;
    const Mp = (201.5643  + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * RAD;
    const F  = (160.7108  + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * RAD;
    const O  = (124.7746  - 1.56375588  * k + 0.0020672 * T2 + 0.00000215 * T3) * RAD;

    if (tipo === 1 || tipo === 3) JDE += 0.25 * 29.530588861;
    if (tipo === 2)               JDE += 0.5  * 29.530588861;

    let c = 0;
    if (tipo === 0 || tipo === 2){ // Nueva y Llena comparten correcciones
      c += -0.40720 * Math.sin(Mp);
      c +=  0.17241 * E * Math.sin(M);
      c +=  0.01608 * Math.sin(2 * Mp);
      c +=  0.01039 * Math.sin(2 * F);
      c +=  0.00739 * E * Math.sin(Mp - M);
      c += -0.00514 * E * Math.sin(Mp + M);
      c +=  0.00208 * E * E * Math.sin(2 * M);
      c += -0.00111 * Math.sin(Mp - 2 * F);
      c += -0.00057 * Math.sin(Mp + 2 * F);
      c +=  0.00056 * E * Math.sin(2 * Mp + M);
      c += -0.00042 * Math.sin(3 * Mp);
      c +=  0.00042 * E * Math.sin(M + 2 * F);
      c +=  0.00038 * E * Math.sin(M - 2 * F);
      c += -0.00024 * E * Math.sin(2 * Mp - M);
      c += -0.00017 * Math.sin(O);
      c += -0.00007 * Math.sin(Mp + 2 * M);
      c +=  0.00004 * Math.sin(2 * Mp - 2 * F);
      c +=  0.00004 * Math.sin(3 * M);
      c +=  0.00003 * Math.sin(Mp + M - 2 * F);
      c +=  0.00003 * Math.sin(2 * Mp + 2 * F);
      c += -0.00003 * Math.sin(Mp + M + 2 * F);
      c +=  0.00003 * Math.sin(Mp - M + 2 * F);
      c += -0.00002 * Math.sin(Mp - M - 2 * F);
      c += -0.00002 * Math.sin(3 * Mp + M);
      c +=  0.00002 * Math.sin(4 * Mp);
    } else { // Cuartos
      c += -0.62801 * Math.sin(Mp);
      c +=  0.17172 * E * Math.sin(M);
      c += -0.01183 * E * Math.sin(Mp + M);
      c +=  0.00862 * Math.sin(2 * Mp);
      c +=  0.00804 * Math.sin(2 * F);
      c +=  0.00454 * E * Math.sin(Mp - M);
      c +=  0.00204 * E * E * Math.sin(2 * M);
      c += -0.00180 * Math.sin(Mp - 2 * F);
      c += -0.00070 * Math.sin(Mp + 2 * F);
      c += -0.00040 * Math.sin(3 * Mp);
      c += -0.00034 * E * Math.sin(2 * Mp - M);
      c +=  0.00032 * E * Math.sin(M + 2 * F);
      c +=  0.00032 * E * Math.sin(M - 2 * F);
      c += -0.00028 * E * E * Math.sin(Mp + 2 * M);
      c +=  0.00027 * E * Math.sin(2 * Mp + M);
      c += -0.00017 * Math.sin(O);
      c += -0.00005 * Math.sin(Mp - M - 2 * F);
      c +=  0.00004 * Math.sin(2 * Mp + 2 * F);
      c += -0.00004 * Math.sin(Mp + M + 2 * F);
      c +=  0.00004 * Math.sin(Mp - 2 * M);
      c +=  0.00003 * Math.sin(Mp + M - 2 * F);
      c +=  0.00003 * Math.sin(3 * M);
      c +=  0.00002 * Math.sin(2 * Mp - 2 * F);
      c +=  0.00002 * Math.sin(Mp - M + 2 * F);
      c += -0.00002 * Math.sin(3 * Mp + M);
    }

    return JDE + c;
  }

  function jdeADate(jde){
    return new Date((jde - 2440587.5) * 86400000);
  }

  const añoActual = hoy.getUTCFullYear();
  const mesActual = hoy.getUTCMonth() + 1;
  const kBase = Math.floor((añoActual - 2000) * 12.3685 + (mesActual - 1) * 1.0306) - 2;

  const candidatos = [];
  for (let k = kBase; k <= kBase + 6; k++){
    for (let tipo = 0; tipo < 4; tipo++){
      const jde = calcularFase(k, tipo);
      const fecha = jdeADate(jde);
      if (fecha > hoy){
        const emojis = ['🌑', '🌓', '🌕', '🌗'];
        const nombres = ['Luna Nueva', 'Cuarto Creciente', 'Luna Llena', 'Cuarto Menguante'];
        candidatos.push({
          fecha,
          emoji: emojis[tipo],
          nombre: nombres[tipo]
        });
      }
    }
  }
  candidatos.sort((a, b) => a.fecha - b.fecha);
  const proximas = candidatos.slice(0, 5);

  cont.innerHTML = `
    <div class="rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/10 border border-indigo-400/20 p-4 mb-4">
      <div class="flex items-center gap-3">
        <span class="text-4xl">${m.icono}</span>
        <div>
          <p class="text-xs uppercase tracking-wider font-bold text-indigo-300">Hoy</p>
          <p class="text-base font-extrabold text-slate-100">Luna ${m.nombre}</p>
          <p class="text-xs text-slate-400">${m.ilum}% iluminada · ${m.age} días de edad</p>
        </div>
      </div>
    </div>

    <h3 class="text-sm font-extrabold text-slate-200 mb-3">📅 Próximas fases</h3>
    <div class="space-y-2.5">
      ${proximas.map(f => {
        const dias = Math.round((f.fecha - hoy) / 86400000);
        return `
          <div class="flex items-center gap-3 rounded-xl bg-white/[.03] border border-white/[.06] px-3.5 py-2.5">
            <span class="text-2xl">${f.emoji}</span>
            <div class="flex-1">
              <p class="text-[13px] font-bold text-slate-200">${f.nombre}</p>
              <p class="text-[11px] text-slate-500">${fmt(f.fecha)} · en ${dias} día${dias === 1 ? '' : 's'}</p>
            </div>
          </div>`;
      }).join('')}
    </div>

    <h3 class="text-sm font-extrabold text-slate-200 mt-5 mb-3">🌱 Qué hacer según la luna</h3>
    <div class="space-y-2">
      <div class="rounded-xl bg-emerald-500/[.08] border border-emerald-400/20 px-3.5 py-2.5">
        <p class="text-[12.5px] font-bold text-emerald-300">Menguante 🌗</p>
        <p class="text-[12px] text-slate-400">Sembrar raíces y tubérculos. Podar, limpiar terreno.</p>
      </div>
      <div class="rounded-xl bg-brand-500/[.08] border border-brand-400/20 px-3.5 py-2.5">
        <p class="text-[12.5px] font-bold text-brand-300">Creciente 🌓</p>
        <p class="text-[12px] text-slate-400">Sembrar cultivos de hoja y fruto. Trasplantar.</p>
      </div>
      <div class="rounded-xl bg-amber-500/[.08] border border-amber-400/20 px-3.5 py-2.5">
        <p class="text-[12.5px] font-bold text-amber-300">Llena 🌕</p>
        <p class="text-[12px] text-slate-400">Cosechar para consumo fresco. Evitar podar.</p>
      </div>
      <div class="rounded-xl bg-indigo-500/[.08] border border-indigo-400/20 px-3.5 py-2.5">
        <p class="text-[12.5px] font-bold text-indigo-300">Nueva 🌑</p>
        <p class="text-[12px] text-slate-400">Preparar tierra, abonar. Sembrar plátano.</p>
      </div>
    </div>`;
}

function renderGuia(){
  const cont = document.getElementById('guiaContent');
  cont.innerHTML = Object.entries(GUIA).map(([key, g]) => `
    <details class="rounded-2xl bg-white/[.03] border border-white/[.06] mb-2.5 overflow-hidden">
      <summary class="cursor-pointer px-4 py-3 flex items-center gap-3 hover:bg-white/[.03]">
        <span class="text-2xl">${g.emoji}</span>
        <span class="text-[14px] font-extrabold text-slate-200">${CULTIVOS[key].nombre}</span>
        <span class="ml-auto text-xs text-slate-500">${CULTIVOS[key].ciclo} días</span>
      </summary>
      <ul class="px-4 pb-4 space-y-1.5">
        ${g.tips.map(t => `<li class="text-[12.5px] text-slate-400 flex gap-2"><span class="text-brand-400">•</span>${t}</li>`).join('')}
      </ul>
    </details>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   SERVICE WORKER — con auto-actualización
   ════════════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => {
        console.log('✅ Service Worker registrado');
        reg.update();

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('SKIP_WAITING');
              window.location.reload();
            }
          });
        });
      })
      .catch(err => console.warn('⚠️ Service Worker falló:', err));
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

/* ════════════════════════════════════════════════════════════
   BOTÓN REFRESH + ESTADO ONLINE
   ════════════════════════════════════════════════════════════ */
function actualizarEstadoConexion(){
  const online = navigator.onLine;
  const dot = document.getElementById('connDot');
  const dot2 = document.getElementById('connDot2');
  const status = document.getElementById('connStatus');
  const refreshBtn = document.getElementById('btnRefresh');

  if (dot && dot2){
    [dot, dot2].forEach(el => {
      el.classList.remove('bg-brand-400', 'bg-red-400', 'bg-amber-400');
      el.classList.add(online ? 'bg-brand-400' : 'bg-red-400');
    });
  }
  if (status) status.textContent = online ? 'En vivo' : 'Offline';
  if (refreshBtn){
    refreshBtn.disabled = !online;
    refreshBtn.style.opacity = online ? '1' : '.4';
  }
}

function attachRefreshListener(){
  const btn = document.getElementById('btnRefresh');
  if (btn) btn.addEventListener('click', sincronizar);
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    attachRefreshListener();
    actualizarEstadoConexion();
  });
} else {
  attachRefreshListener();
  actualizarEstadoConexion();
}

window.addEventListener('online', () => {
  actualizarEstadoConexion();
  mostrarToast('🌐 Conexión restaurada');
});
window.addEventListener('offline', () => {
  actualizarEstadoConexion();
  mostrarToast('📡 Sin conexión', 'error');
});

/* ════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════ */
initFormulario();
renderMoonBar();
renderSiembras();
setInterval(renderMoonBar, 3600000);
