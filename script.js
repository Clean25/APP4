
let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let captureBtn = document.getElementById("capture-btn");
let startBtn = document.getElementById("start-btn");
let pdfBtn = document.getElementById("pdf-btn");
let resetBtn = document.getElementById("reset-btn");
let thumbnailsDiv = document.getElementById("photo-thumbnails");

let photos = [];
let currentPosition = null;

const firmaCanvas = document.getElementById("firma-canvas");
const firmaCtx = firmaCanvas.getContext("2d");
let drawing = false;

function getCoordsTouch(e) {
  const rect = firmaCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

firmaCanvas.addEventListener("mousedown", e => {
  drawing = true;
  firmaCtx.beginPath();
  firmaCtx.moveTo(e.offsetX, e.offsetY);
});
firmaCanvas.addEventListener("mousemove", e => {
  if (drawing) {
    firmaCtx.lineTo(e.offsetX, e.offsetY);
    firmaCtx.stroke();
  }
});
firmaCanvas.addEventListener("mouseup", () => drawing = false);
firmaCanvas.addEventListener("mouseleave", () => drawing = false);

firmaCanvas.addEventListener("touchstart", e => {
  e.preventDefault();
  drawing = true;
  const { x, y } = getCoordsTouch(e);
  firmaCtx.beginPath();
  firmaCtx.moveTo(x, y);
});
firmaCanvas.addEventListener("touchmove", e => {
  e.preventDefault();
  if (!drawing) return;
  const { x, y } = getCoordsTouch(e);
  firmaCtx.lineTo(x, y);
  firmaCtx.stroke();
});
firmaCanvas.addEventListener("touchend", e => {
  e.preventDefault();
  drawing = false;
});
document.getElementById("clear-firma").onclick = () => {
  firmaCtx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
};

navigator.geolocation.getCurrentPosition(
  (pos) => currentPosition = pos.coords,
  () => alert("No se pudo obtener ubicación")
);

startBtn.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream;
    captureBtn.disabled = false;
  } catch (err) {
    alert("Error accediendo a la cámara: " + err.message);
  }
};

captureBtn.onclick = () => {
  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);

  const now = new Date();
  const timestamp = now.toLocaleString();
  const coords = currentPosition
    ? `${currentPosition.latitude.toFixed(6)}, ${currentPosition.longitude.toFixed(6)}`
    : "Ubicación no disponible";

  context.fillStyle = "white";
  context.font = "20px Arial";
  context.fillText(timestamp, 10, canvas.height - 40);
  context.fillText(coords, 10, canvas.height - 15);

  const imgData = canvas.toDataURL("image/jpeg");
  photos.push({ imgData, timestamp, coords });

  const thumb = document.createElement("img");
  thumb.src = imgData;
  thumbnailsDiv.appendChild(thumb);

  pdfBtn.disabled = false;
};

resetBtn.onclick = () => {
  thumbnailsDiv.innerHTML = "";
  photos = [];
  pdfBtn.disabled = true;
  firmaCtx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
};

document.getElementById("buscar-datos").onclick = async () => {
  const tipoUsuario = document.getElementById("tipo-usuario").value;
  const codigo = document.getElementById("codigo-suministro").value.trim().toUpperCase();
  if (!codigo) return alert("Ingresa el código de suministro.");

  const res = await fetch("base_titulares.json");
  const data = await res.json();
  const user = data.find(u => u.codigo_usuario.trim().toUpperCase() === codigo);
  if (!user) return alert("No se encontró el suministro.");

  if (tipoUsuario === "titular") {
    document.getElementById("nombres_apellidos").value = user.nombres_apellidos || "";
    document.getElementById("dni").value = user.dni || "";
    document.getElementById("codigo_usuario").value = user.codigo_usuario || "";
  }

  document.getElementById("departamento").value = user.departamento || "";
  document.getElementById("provincia").value = user.provincia || "";
  document.getElementById("distrito").value = user.distrito || "";
  document.getElementById("localidad").value = user.localidad || "";

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      document.getElementById("utm_este").value = Math.round((longitude + 180) * 1000);
      document.getElementById("utm_norte").value = Math.round((latitude + 90) * 1000);
      document.getElementById("utm_zona").value = "18";
    });
  }

  document.getElementById("pdf-btn").disabled = false;
};

pdfBtn.onclick = async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");
  const firmaImg = firmaCanvas.toDataURL("image/png");
  const campos = {};
  document.querySelectorAll("#inspection-form input, #inspection-form textarea, #inspection-form select").forEach(input => {
    if (input.type === "radio") {
      if (input.checked) campos[input.name] = input.value;
    } else {
      const key = input.id || input.name;
      if (key) campos[key] = input.value.trim();
    }
  });

  const res = await fetch("formulario.json");
  const secciones = await res.json();

  doc.setFontSize(14);
  doc.text("FORMATO DE INSPECCIÓN DE INSTALACIÓN RER AUTÓNOMA", 10, 20);
  doc.setFontSize(11);
  const estado = document.getElementById("estado-usuario")?.value || "No especificado";
  doc.text(`Estado del Usuario: ${estado}`, 10, 30);

  let y = 50;
  for (let i = 0; i < secciones.length; i++) {
    doc.setFont(undefined, "bold");
    doc.text(secciones[i].titulo, 10, y);
    doc.setFont(undefined, "normal");
    y += 7;
    for (const campo of secciones[i].campos) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${campo.etiqueta}: ${campos[campo.id] || ""}`, 10, y);
      y += 7;
    }
  }

  if (y > 230) { doc.addPage(); y = 20; }
  doc.text("Firma del Usuario:", 10, y);
  doc.addImage(firmaImg, "PNG", 10, y + 5, 80, 40);

  photos.forEach((photo, index) => {
    doc.addPage();
    doc.setFontSize(14);
    doc.text(`Foto ${index + 1}`, 10, 10);
    doc.addImage(photo.imgData, "JPEG", 10, 20, 180, 135);
  });

  doc.save(`${campos["codigo_usuario"] || "formulario"}.pdf`);
};
