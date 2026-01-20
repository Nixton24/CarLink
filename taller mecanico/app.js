// ===========================
// app.js (versión completa - tiempo real + gráficas)
// ===========================

// --- Importar Firebase (CDN modular) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  collectionGroup,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  updateDoc,
  onSnapshot,
  where,
  limit,
  limitToLast
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ===========================
// Configuración Firebase
// ===========================
const firebaseConfig = {
  apiKey: "AIzaSyBWxPrcwGg4RJPnVHza-cvN5yxKA4kTxCw",
  authDomain: "transmisiones-mauricio-8ab3b.firebaseapp.com",
  projectId: "transmisiones-mauricio-8ab3b",
  storageBucket: "transmisiones-mauricio-8ab3b.appspot.com",
  messagingSenderId: "902068354824",
  appId: "1:902068354824:web:TU_APP_ID_AQUI"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===========================
// Referencias UI (DOM)
// ===========================
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const userPanel = document.getElementById('userPanel');

const totalVehiculosEl = document.getElementById('totalVehiculos');
const serviciosAbiertosEl = document.getElementById('serviciosAbiertos');
const serviciosCerradosEl = document.getElementById('serviciosCerrados');
const ingresosTotalesEl = document.getElementById('ingresosTotales');

const totalVehiculosSmall = document.getElementById('totalVehiculosSmall');
const serviciosAbiertosSmall = document.getElementById('serviciosAbiertosSmall');
const serviciosCerradosSmall = document.getElementById('serviciosCerradosSmall');
const ingresosTotalesSmall = document.getElementById('ingresosTotalesSmall');

const ultimosIngresosEl = document.getElementById('ultimosIngresos');
const ultimosIngresosSmall = document.getElementById('ultimosIngresosSmall');

const chartServiciosCtx = document.getElementById('chartServicios')?.getContext?.('2d');
const chartVehiculosCtx = document.getElementById('chartVehiculos')?.getContext?.('2d');
const chartServiciosSmallCtx = document.getElementById('chartServiciosSmall')?.getContext?.('2d');
const chartVehiculosSmallCtx = document.getElementById('chartVehiculosSmall')?.getContext?.('2d');

// Guardar referencias de gráficos para actualizar
let pieChart = null;
let barChart = null;
let pieChartSmall = null;
let barChartSmall = null;

// ---------------------------
// Util: mostrar toast simple
// ---------------------------
function showToast(title, message) {
  const toastEl = document.getElementById('liveToast');
  if (!toastEl) {
    alert(title + "\n" + message);
    return;
  }
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastBody').textContent = message;
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

// ===========================
// Registro y Login
// ===========================
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('regEmail').value;
  const pass = document.getElementById('regPass').value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    showToast('Registro', `Usuario registrado: ${cred.user.email}`);
    e.target.reset();
  } catch (err) {
    showToast('Error registro', err.message);
  }
});

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    e.target.reset();
  } catch (err) {
    showToast('Error login', err.message);
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    userPanel.textContent = 'Conectado: ' + user.email;
    authSection.style.display = 'none';
    appSection.style.display = 'block';
  } else {
    userPanel.textContent = 'No autenticado';
    authSection.style.display = 'block';
    appSection.style.display = 'none';
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth));

// ===========================
// Registrar Vehículo
// ===========================
document.getElementById('registerVehicleForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const vin = document.getElementById('vin').value.trim().toUpperCase();
  if (!vin) return showToast('Error', 'VIN requerido');

  const docRef = doc(db, 'vehiculos', vin);
  const data = {
    datosGenerales: {
      marca: document.getElementById('marca').value,
      modelo: document.getElementById('modelo').value,
      año: Number(document.getElementById('anio').value),
      placas: document.getElementById('placas').value || ''
    },
    estado: 'entregado',
    creadoEn: serverTimestamp()
  };
  try {
    await setDoc(docRef, data, { merge: true });
    showToast('Vehículo', `Vehículo registrado: ${vin}`);
    e.target.reset();
  } catch (err) {
    showToast('Error', err.message);
  }
});

// ===========================
// Abrir Servicio (Ingreso)
// ===========================
document.getElementById('openServiceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const vin = document.getElementById('vin_ingreso').value.trim().toUpperCase();
  const falla = document.getElementById('falla').value;
  if (!vin || !falla) return showToast('Error', 'VIN y falla requeridos');

  try {
    const vehRef = doc(db, 'vehiculos', vin);
    const vehSnap = await getDoc(vehRef);

    if (!vehSnap.exists()) {
      await setDoc(vehRef, {
        datosGenerales: { placas: '', marca: '', modelo: '', año: null },
        estado: 'en_reparacion',
        creadoEn: serverTimestamp()
      });
    } else {
      await updateDoc(vehRef, { estado: 'en_reparacion' });
    }

    const now = new Date();
    const fechaId = now.toISOString().replace(/[:.]/g, "-");
    const histDocRef = doc(vehRef, 'historial', fechaId);

    await setDoc(histDocRef, {
      fechaIngreso: serverTimestamp(),
      fechaEntrega: null,
      falla,
      reparacion: '',
      costo: 0,
      garantiaDias: 0,
      tiempoTallerDias: 0,
      condiciones: '',
      estado: 'abierto',
      creadoPor: auth.currentUser ? auth.currentUser.uid : null
    });

    await updateDoc(vehRef, { ultimoIngresoId: fechaId });

    showToast('Ingreso', `Ingreso registrado: ${fechaId}`);
    e.target.reset();
  } catch (err) {
    showToast('Error', err.message);
  }
});

// ===========================
// Cerrar Servicio (Entrega)
// ===========================
document.getElementById('closeServiceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const vin = document.getElementById('vin_entrega').value.trim().toUpperCase();
  const ingresoId = document.getElementById('ingresoId_entrega').value.trim();
  if (!vin || !ingresoId) return showToast('Error', 'VIN e ID requeridos');

  try {
    const vehRef = doc(db, 'vehiculos', vin);
    const histDocRef = doc(vehRef, 'historial', ingresoId);
    const ingresoSnap = await getDoc(histDocRef);
    if (!ingresoSnap.exists()) return showToast('Error', 'Ingreso no encontrado');

    const ingresoData = ingresoSnap.data();
    const fechaIngreso = ingresoData.fechaIngreso;
    const now = new Date();
    const ingresoDate = fechaIngreso?.toDate ? fechaIngreso.toDate() : now;
    const diffMs = Math.max(0, now - ingresoDate);
    const diasTaller = Math.round(diffMs / (1000 * 60 * 60 * 24));

    await updateDoc(histDocRef, {
      fechaEntrega: serverTimestamp(),
      reparacion: document.getElementById('reparacion').value,
      costo: Number(document.getElementById('costo').value) || 0,
      garantiaDias: Number(document.getElementById('garantiaDias').value) || 0,
      tiempoTallerDias: diasTaller,
      condiciones: document.getElementById('condiciones').value,
      estado: 'cerrado',
      actualizadoPor: auth.currentUser ? auth.currentUser.uid : null
    });

    await updateDoc(vehRef, { estado: 'entregado' });

    showToast('Cierre', `Servicio cerrado. Tiempo en taller: ${diasTaller} días`);
    e.target.reset();
  } catch (err) {
    showToast('Error', err.message);
  }
});

// ===========================
// Buscar Vehículo (consulta única)
// ===========================
document.getElementById('searchForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const vin = document.getElementById('vinBuscar').value.trim().toUpperCase();
  if (!vin) return;

  try {
    const vehRef = doc(db, 'vehiculos', vin);
    const vehSnap = await getDoc(vehRef);
    if (!vehSnap.exists()) {
      showToast('Buscar', 'Vehículo no encontrado');
      return;
    }
    const veh = vehSnap.data();
    document.getElementById('vehiculoInfo').style.display = 'block';
    document.getElementById('infoGeneral').innerHTML = `
      <b>VIN:</b> ${vin}<br>
      <b>Marca:</b> ${veh.datosGenerales?.marca || '-'}<br>
      <b>Modelo:</b> ${veh.datosGenerales?.modelo || '-'}<br>
      <b>Año:</b> ${veh.datosGenerales?.año || '-'}<br>
      <b>Placas:</b> ${veh.datosGenerales?.placas || '-'}<br>
      <b>Estado:</b> ${veh.estado || '-'}
    `;

    // traer historial ordenado
    const histCol = collection(vehRef, 'historial');
    const q = query(histCol, orderBy('fechaIngreso', 'desc'));
    const histSnap = await getDocs(q);

    const list = document.getElementById('historialList');
    list.innerHTML = '';
    histSnap.forEach(docItem => {
      const d = docItem.data();
      const fechaIngreso = d.fechaIngreso?.toDate ? d.fechaIngreso.toDate().toLocaleString() : '-';
      const fechaEntrega = d.fechaEntrega?.toDate ? d.fechaEntrega.toDate().toLocaleString() : '-';
      const card = document.createElement('div');
      card.className = 'card mb-2 p-2';
      card.innerHTML = `
        <b>ID:</b> ${docItem.id}<br>
        <b>Falla:</b> ${d.falla}<br>
        <b>Reparación:</b> ${d.reparacion || '-'}<br>
        <b>Costo:</b> ${d.costo || 0}<br>
        <b>Garantía (días):</b> ${d.garantiaDias || 0}<br>
        <b>Ingreso:</b> ${fechaIngreso}<br>
        <b>Entrega:</b> ${fechaEntrega}<br>
        <b>Tiempo en taller:</b> ${d.tiempoTallerDias ?? '-'} días<br>
        <b>Estado:</b> ${d.estado || '-'}
      `;
      list.appendChild(card);
    });
  } catch (err) {
    showToast('Error', err.message);
  }
});

// ===========================
// FUNCIONES: actualización UI y gráficas (tiempo real)
// ===========================

/**
 * resumenFromSnapshots: recibe snapshots de vehiculos y de todos los historial (collectionGroup)
 * y calcula indicadores y datos para gráficas.
 */
function resumenFromSnapshots(vehiculosSnapshot, historialSnapshot) {
  // indicadores básicos
  const totalVehiculos = vehiculosSnapshot.size;

  // calcular servicios abiertos / cerrados y suma de ingresos
  let serviciosAbiertos = 0;
  let serviciosCerrados = 0;
  let ingresosTotales = 0;

  // últimos ingresos (array)
  const ingresosArray = [];

  // recorrer todos los docs de historial (collectionGroup)
  historialSnapshot.forEach(docHist => {
    const d = docHist.data();
    const estado = d.estado || '';
    if (estado === 'abierto') serviciosAbiertos++;
    else if (estado === 'cerrado') {
      serviciosCerrados++;
      ingresosTotales += Number(d.costo || 0);
      // si tiene fechaEntrega -> push para últimos ingresos
      ingresosArray.push({
        id: docHist.id,
        vin: docHist.ref.parent.parent ? docHist.ref.parent.parent.id : 'N/A',
        costo: Number(d.costo || 0),
        fechaEntrega: d.fechaEntrega ? (d.fechaEntrega.toDate ? d.fechaEntrega.toDate() : null) : null,
        reparacion: d.reparacion || ''
      });
    } else {
      // otros estados posible
    }
  });

  // ordenar últimos ingresos por fechaEntrega desc
  ingresosArray.sort((a, b) => {
    const ta = a.fechaEntrega ? a.fechaEntrega.getTime() : 0;
    const tb = b.fechaEntrega ? b.fechaEntrega.getTime() : 0;
    return tb - ta;
  });

  // preparar datos para gráfica de vehículos por año
  const vehPorAño = {}; // {2023: 5, 2024: 10}
  vehiculosSnapshot.forEach(docVeh => {
    const v = docVeh.data();
    const año = v.creadoEn && v.creadoEn.toDate ? v.creadoEn.toDate().getFullYear() : (v.datosGenerales?.año || 'SinAño');
    const key = año || 'SinAño';
    vehPorAño[key] = (vehPorAño[key] || 0) + 1;
  });

  return {
    totalVehiculos,
    serviciosAbiertos,
    serviciosCerrados,
    ingresosTotales,
    ingresosArray,
    vehPorAño
  };
}

/**
 * updateIndicatorsUI - escribe valores en DOM
 */
function updateIndicatorsUI({ totalVehiculos, serviciosAbiertos, serviciosCerrados, ingresosTotales }) {
  totalVehiculosEl && (totalVehiculosEl.textContent = totalVehiculos);
  serviciosAbiertosEl && (serviciosAbiertosEl.textContent = serviciosAbiertos);
  serviciosCerradosEl && (serviciosCerradosEl.textContent = serviciosCerrados);
  ingresosTotalesEl && (ingresosTotalesEl.textContent = `$${ingresosTotales.toLocaleString()}`);

  // pequeñas versiones
  totalVehiculosSmall && (totalVehiculosSmall.textContent = totalVehiculos);
  serviciosAbiertosSmall && (serviciosAbiertosSmall.textContent = serviciosAbiertos);
  serviciosCerradosSmall && (serviciosCerradosSmall.textContent = serviciosCerrados);
  ingresosTotalesSmall && (ingresosTotalesSmall.textContent = `$${ingresosTotales.toLocaleString()}`);
}

/**
 * updateUltimosIngresos - rellena lista de últimos ingresos
 */
function updateUltimosIngresos(ingresosArray) {
  if (!ultimosIngresosEl || !ultimosIngresosSmall) return;

  ultimosIngresosEl.innerHTML = '';
  ultimosIngresosSmall.innerHTML = '';

  const top = ingresosArray.slice(0, 8);
  top.forEach(item => {
    const li = document.createElement('li');
    const fecha = item.fechaEntrega ? item.fechaEntrega.toLocaleString() : '-';
    li.textContent = `${fecha} — VIN: ${item.vin} — $${item.costo.toLocaleString()} — ${item.reparacion}`;
    ultimosIngresosEl.appendChild(li);

    // small
    const li2 = document.createElement('li');
    li2.textContent = `${fecha} — $${item.costo.toLocaleString()} — ${item.vin}`;
    ultimosIngresosSmall.appendChild(li2);
  });

  if (top.length === 0) {
    ultimosIngresosEl.innerHTML = '<li>No hay ingresos cerrados aún</li>';
    ultimosIngresosSmall.innerHTML = '<li>No hay ingresos cerrados aún</li>';
  }
}

/**
 * updateCharts - actualizar o crear gráficas con Chart.js
 */
function updateCharts(servicesCounts, vehPorAño) {
  // ServicesCounts: {abiertos: n, cerrados: m}
  const abiertos = servicesCounts.abiertos || 0;
  const cerrados = servicesCounts.cerrados || 0;

  // PIE: Servicios Abiertos vs Cerrados
  const pieData = {
    labels: ['Abiertos', 'Cerrados'],
    datasets: [{
      data: [abiertos, cerrados],
      backgroundColor: ['#f6c23e', '#1cc88a']
    }]
  };

  if (pieChart) {
    pieChart.data = pieData;
    pieChart.update();
  } else if (chartServiciosCtx) {
    pieChart = new Chart(chartServiciosCtx, {
      type: 'doughnut',
      data: pieData,
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // small pie (contabilidad)
  if (pieChartSmall && chartServiciosSmallCtx) {
    pieChartSmall.data = pieData;
    pieChartSmall.update();
  } else if (chartServiciosSmallCtx) {
    pieChartSmall = new Chart(chartServiciosSmallCtx, {
      type: 'doughnut',
      data: pieData,
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // BAR: Vehículos por año
  // ordenar claves numéricas cronológicamente
  const years = Object.keys(vehPorAño).sort((a, b) => {
    if (a === 'SinAño') return 1;
    if (b === 'SinAño') return -1;
    return Number(a) - Number(b);
  });
  const counts = years.map(y => vehPorAño[y]);

  const barData = {
    labels: years,
    datasets: [{
      label: 'Vehículos',
      data: counts,
      backgroundColor: '#4e73df'
    }]
  };

  if (barChart) {
    barChart.data = barData;
    barChart.update();
  } else if (chartVehiculosCtx) {
    barChart = new Chart(chartVehiculosCtx, {
      type: 'bar',
      data: barData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // small bar
  if (barChartSmall && chartVehiculosSmallCtx) {
    barChartSmall.data = barData;
    barChartSmall.update();
  } else if (chartVehiculosSmallCtx) {
    barChartSmall = new Chart(chartVehiculosSmallCtx, {
      type: 'bar',
      data: barData,
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
  }
}

// ===========================
// LISTENERS EN TIEMPO REAL
// - onSnapshot(collection('vehiculos'))
// - onSnapshot(collectionGroup('historial'))
// ===========================

let latestVehSnapshot = null;
let latestHistSnapshot = null;

const vehRef = collection(db, 'vehiculos');
const vehListener = onSnapshot(vehRef, (vehSnap) => {
  latestVehSnapshot = vehSnap;
  // only proceed if we also have historial snapshot (we'll combine them)
  if (latestHistSnapshot) combinedUpdate(latestVehSnapshot, latestHistSnapshot);
}, (err) => {
  console.error('Error veh listener:', err);
  showToast('Error', 'No se pudo escuchar vehículos en tiempo real: ' + err.message);
});

// collectionGroup for all 'historial' subcollections
const histGroupRef = collectionGroup(db, 'historial');
const histListener = onSnapshot(histGroupRef, (histSnap) => {
  latestHistSnapshot = histSnap;
  if (latestVehSnapshot) combinedUpdate(latestVehSnapshot, latestHistSnapshot);
}, (err) => {
  console.error('Error historial listener:', err);
  showToast('Error', 'No se pudo escuchar historial en tiempo real: ' + err.message);
});

/**
 * combinedUpdate: cuando tenemos ambas snapshots actualiza UI y graficas
 */
function combinedUpdate(vehSnap, histSnap) {
  try {
    const resumen = resumenFromSnapshots(vehSnap, histSnap);
    updateIndicatorsUI(resumen);
    updateUltimosIngresos(resumen.ingresosArray);
    updateCharts({ abiertos: resumen.serviciosAbiertos, cerrados: resumen.serviciosCerrados }, resumen.vehPorAño);
  } catch (err) {
    console.error('Error combinedUpdate:', err);
  }
}

// ---------------------------
// Inicializar (cargar datos una vez si no hay listeners aún)
// ---------------------------
async function initOnce() {
  try {
    // if snapshots already running, they'll call combinedUpdate.
    const vSnap = await getDocs(query(collection(db, 'vehiculos')));
    const hSnap = await getDocs(query(collectionGroup(db, 'historial'), orderBy('fechaIngreso', 'desc')));
    latestVehSnapshot = vSnap;
    latestHistSnapshot = hSnap;
    combinedUpdate(latestVehSnapshot, latestHistSnapshot);
  } catch (err) {
    console.error('Error initOnce:', err);
  }
}
initOnce();

// ===========================
// FIN del archivo
// ===========================
