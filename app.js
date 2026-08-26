// 1. CONFIGURACIÓN REAL DE FIREBASE (CET N° 3)
const firebaseConfig = {
  apiKey: "AIzaSyByXg-G6N2VBy8u2V5gDQmvLlDjl3aMUew",
  authDomain: "facturacion-educativa-arca.firebaseapp.com",
  projectId: "facturacion-educativa-arca",
  storageBucket: "facturacion-educativa-arca.firebasestorage.app",
  messagingSenderId: "691417158907",
  appId: "1:691417158907:web:caabc36c60be2f71bacc5e",
  measurementId: "G-5416373NHC"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let usuarioActual = null;
let comprobantesEmitidos = [];

// Ajuste dinámico del año en el footer
document.addEventListener("DOMContentLoaded", () => {
  const anioElement = document.getElementById('lbl-anio');
  if (anioElement) {
    anioElement.innerText = new Date().getFullYear();
  }
});

// 2. AUTENTICACIÓN CON GOOGLE
function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert("Error al iniciar sesión: " + err.message));
}

function logoutGoogle() {
  auth.signOut();
}

auth.onAuthStateChanged(user => {
  if (user) {
    usuarioActual = user;
    document.getElementById('btn-login').classList.add('hidden');
    document.getElementById('user-info').classList.remove('hidden');
    document.getElementById('user-name').innerText = user.displayName;
    cargarComprobantesDesdeFirebase();
  } else {
    usuarioActual = null;
    document.getElementById('btn-login').classList.remove('hidden');
    document.getElementById('user-info').classList.add('hidden');
    comprobantesEmitidos = [];
    renderizarTablas();
  }
});

// 3. LÓGICA FISCAL DE LA ARCA
function calcularTipoComprobante() {
  const emisor = document.getElementById('emisor-cond').value;
  const receptor = document.getElementById('receptor-cond').value;
  const lbl = document.getElementById('lbl-tipo-factura');

  if (emisor === 'MONO') {
    lbl.innerText = "Factura C (Cód. 011)";
  } else if (emisor === 'RI' && receptor === 'RI') {
    lbl.innerText = "Factura A (Cód. 001)";
  } else {
    lbl.innerText = "Factura B (Cód. 006)";
  }
  recalcularTotales();
}

function recalcularTotales() {
  const emisor = document.getElementById('emisor-cond').value;
  const rows = document.querySelectorAll('#tb-items tr');
  let netoTotal = 0;
  let iva21Total = 0;
  let iva10Total = 0;

  rows.forEach(r => {
    const cant = parseFloat(r.querySelector('.item-cant').value) || 0;
    const precio = parseFloat(r.querySelector('.item-precio').value) || 0;
    const alicuota = parseFloat(r.querySelector('.item-iva').value) || 0;
    const subtotalBruto = cant * precio;

    if (emisor === 'RI') {
      netoTotal += subtotalBruto;
      if (alicuota === 21) iva21Total += subtotalBruto * 0.21;
      if (alicuota === 10.5) iva10Total += subtotalBruto * 0.105;
      r.querySelector('.item-subtotal').innerText = `$${subtotalBruto.toFixed(2)}`;
    } else {
      netoTotal += subtotalBruto;
      r.querySelector('.item-subtotal').innerText = `$${subtotalBruto.toFixed(2)}`;
    }
  });

  const grandTotal = netoTotal + iva21Total + iva10Total;
  document.getElementById('lbl-neto').innerText = `$${netoTotal.toFixed(2)}`;
  document.getElementById('lbl-iva21').innerText = `$${iva21Total.toFixed(2)}`;
  document.getElementById('lbl-iva10').innerText = `$${iva10Total.toFixed(2)}`;
  document.getElementById('lbl-total').innerText = `$${grandTotal.toFixed(2)}`;
}

// 4. EMISIÓN Y GENERACIÓN DE CAE SIMULADO
function emitirFactura() {
  const tipoTexto = document.getElementById('lbl-tipo-factura').innerText;
  const recNombre = document.getElementById('rec-nombre').value || "Consumidor Final";
  const recCuit = document.getElementById('rec-cuit').value || "00-00000000-0";
  const recCond = document.getElementById('receptor-cond').value;
  const recDom = document.getElementById('rec-domicilio').value || "Sin Domicilio";

  const neto = parseFloat(document.getElementById('lbl-neto').innerText.replace('$',''));
  const iva21 = parseFloat(document.getElementById('lbl-iva21').innerText.replace('$',''));
  const iva10 = parseFloat(document.getElementById('lbl-iva10').innerText.replace('$',''));
  const total = parseFloat(document.getElementById('lbl-total').innerText.replace('$',''));

  // Generar CAE simulado (cadena numérica aleatoria de 14 dígitos)
  const caeSimulado = "74" + Math.floor(100000000000 + Math.random() * 900000000000);
  const hoy = new Date().toLocaleDateString('es-AR');
  const numComp = `00001-${String(comprobantesEmitidos.length + 1).padStart(8, '0')}`;

  const nuevoComprobante = {
    id: Date.now().toString(),
    fecha: hoy,
    tipo: tipoTexto,
    numero: numComp,
    receptorNombre: recNombre,
    receptorCuit: recCuit,
    receptorCond: recCond,
    receptorDom: recDom,
    neto: neto,
    iva21: iva21,
    iva10: iva10,
    total: total,
    cae: caeSimulado,
    vencimientoCae: "05/09/2026"
  };

  comprobantesEmitidos.push(nuevoComprobante);
  guardarEnFirebase(nuevoComprobante);
  renderizarTablas();
  alert("Factura emitida exitosamente con CAE Simulado: " + caeSimulado);
  mostrarSeccion('registros');
}

// 5. REGISTROS Y LIBRO IVA
function renderizarTablas() {
  const tbReg = document.getElementById('tb-registros');
  const tbIva = document.getElementById('tb-libro-iva');
  tbReg.innerHTML = '';
  tbIva.innerHTML = '';

  comprobantesEmitidos.forEach(c => {
    // Fila Registro
    tbReg.innerHTML += `
      <tr class="border-b">
        <td class="p-2">${c.fecha}</td>
        <td class="p-2 font-semibold">${c.tipo} N° ${c.numero}</td>
        <td class="p-2">${c.receptorNombre}</td>
        <td class="p-2 font-bold">$${c.total.toFixed(2)}</td>
        <td class="p-2 text-xs font-mono">${c.cae}</td>
        <td class="p-2 text-center">
          <button onclick="descargarPDF('${c.id}')" class="bg-blue-600 text-white text-xs px-2 py-1 rounded">Descargar PDF A4</button>
        </td>
      </tr>
    `;

    // Fila Libro IVA
    tbIva.innerHTML += `
      <tr class="border-b">
        <td class="p-2">${c.fecha}</td>
        <td class="p-2">${c.tipo}</td>
        <td class="p-2">${c.numero}</td>
        <td class="p-2">${c.receptorCuit}</td>
        <td class="p-2">${c.receptorNombre}</td>
        <td class="p-2 text-right">$${c.neto.toFixed(2)}</td>
        <td class="p-2 text-right">$${c.iva21.toFixed(2)}</td>
        <td class="p-2 text-right">$${c.iva10.toFixed(2)}</td>
        <td class="p-2 text-right font-bold">$${c.total.toFixed(2)}</td>
      </tr>
    `;
  });
}

// 6. GENERACIÓN DE PDF Y QR EN TAMAÑO A4 EXACTO
function descargarPDF(id) {
  const c = comprobantesEmitidos.find(x => x.id === id);
  if (!c) {
    alert("No se encontró el comprobante especificado.");
    return;
  }

  document.getElementById('pdf-numero').innerText = c.numero || "00001-00000001";
  document.getElementById('pdf-fecha').innerText = c.fecha || new Date().toLocaleDateString('es-AR');
  document.getElementById('pdf-rec-nombre').innerText = c.receptorNombre || "Consumidor Final";
  document.getElementById('pdf-rec-cuit').innerText = c.receptorCuit || "00-00000000-0";
  document.getElementById('pdf-rec-cond').innerText = c.receptorCond || "Consumidor Final";
  document.getElementById('pdf-rec-domicilio').innerText = c.receptorDom || "Sin Domicilio";

  const pdfLetra = document.getElementById('pdf-letra');
  const pdfCod = document.getElementById('pdf-cod');
  if (c.tipo.includes('A')) {
    pdfLetra.innerText = 'A';
    pdfCod.innerText = 'COD. 001';
  } else if (c.tipo.includes('B')) {
    pdfLetra.innerText = 'B';
    pdfCod.innerText = 'COD. 006';
  } else {
    pdfLetra.innerText = 'C';
    pdfCod.innerText = 'COD. 011';
  }

  const pdfTbItems = document.getElementById('pdf-tb-items');
  pdfTbItems.innerHTML = ''; 

  const filasFormulario = document.querySelectorAll('#tb-items tr');
  
  if (filasFormulario.length > 0) {
    filasFormulario.forEach(r => {
      const desc = r.querySelector('.item-desc')?.value || "Concepto General";
      const cant = parseFloat(r.querySelector('.item-cant')?.value) || 1;
      const precio = parseFloat(r.querySelector('.item-precio')?.value) || 0;
      const iva = r.querySelector('.item-iva')?.value || "21";
      const subtotal = cant * precio;

      pdfTbItems.innerHTML += `
        <tr class="border-b text-xs">
          <td class="p-2 border-r">${desc}</td>
          <td class="p-2 border-r text-center">${cant}</td>
          <td class="p-2 border-r text-right">$${precio.toFixed(2)}</td>
          <td class="p-2 border-r text-center">${iva}%</td>
          <td class="p-2 text-right">$${subtotal.toFixed(2)}</td>
        </tr>
      `;
    });
  } else {
    pdfTbItems.innerHTML = `
      <tr class="border-b text-xs">
        <td class="p-2 border-r">Servicios / Productos Varios</td>
        <td class="p-2 border-r text-center">1</td>
        <td class="p-2 border-r text-right">$${c.neto.toFixed(2)}</td>
        <td class="p-2 border-r text-center">21%</td>
        <td class="p-2 text-right">$${c.neto.toFixed(2)}</td>
      </tr>
    `;
  }

  document.getElementById('pdf-neto').innerText = Number(c.neto).toFixed(2);
  document.getElementById('pdf-iva').innerText = (Number(c.iva21) + Number(c.iva10)).toFixed(2);
  document.getElementById('pdf-total').innerText = Number(c.total).toFixed(2);
  document.getElementById('pdf-cae').innerText = c.cae;
  document.getElementById('pdf-venc-cae').innerText = c.vencimientoCae || "05/09/2026";

  const qrDiv = document.getElementById('qrcode');
  qrDiv.innerHTML = '';
  new QRCode(qrDiv, {
    text: `https://www.arca.gob.ar/fe/qr/?p=${btoa(JSON.stringify({cuit:30112233445,cae:c.cae,total:c.total}))}`,
    width: 96,
    height: 96
  });

  const element = document.getElementById('pdf-template');
  element.classList.remove('hidden');

  const opt = {
    margin:       [5, 5, 5, 5],
    filename:     `CET3_Factura_${c.numero}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    element.classList.add('hidden');
  });
}

// 7. BASE DE DATOS Y PORTABILIDAD (.JSON)
function guardarEnFirebase(comp) {
  if (usuarioActual) {
    db.collection('usuarios').doc(usuarioActual.uid).collection('comprobantes').doc(comp.id).set(comp);
  }
}

function cargarComprobantesDesdeFirebase() {
  if (!usuarioActual) return;
  db.collection('usuarios').doc(usuarioActual.uid).collection('comprobantes').get().then(snap => {
    comprobantesEmitidos = [];
    snap.forEach(doc => comprobantesEmitidos.push(doc.data()));
    renderizarTablas();
  });
}

function exportarTrabajo() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(comprobantesEmitidos));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `CET3_trabajo_facturacion_${Date.now()}.json`);
  dlAnchor.click();
}

function importarTrabajo(event) {
  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    comprobantesEmitidos = JSON.parse(e.target.result);
    renderizarTablas();
    alert("Trabajos cargados correctamente.");
  };
  fileReader.readAsText(event.target.files[0]);
}

function mostrarSeccion(sec) {
  document.getElementById('sec-facturador').classList.add('hidden');
  document.getElementById('sec-registros').classList.add('hidden');
  document.getElementById('sec-libro-iva').classList.add('hidden');
  document.getElementById(`sec-${sec}`).classList.remove('hidden');
}

function imprimirPantalla() { window.print(); }