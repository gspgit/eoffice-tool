// pdf-editor.js

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5;
let annotations = {};
let activeTool = 'select';
let canvas = document.getElementById('pdfCanvas');
let ctx = canvas.getContext('2d');
let colorPicker = document.getElementById('colorPicker');
let fontSizeInput = document.getElementById('fontSize');
let opacityInput = document.getElementById('opacity');

const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', handleFile);

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTool = btn.dataset.tool;
  });
});

function handleFile(e) {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    const fileReader = new FileReader();
    fileReader.onload = function () {
      const typedarray = new Uint8Array(this.result);
      pdfjsLib.getDocument(typedarray).promise.then(function (pdf) {
        pdfDoc = pdf;
        totalPages = pdf.numPages;
        currentPage = 1;
        annotations = {}; // Reset annotations
        renderPage(currentPage);
        renderThumbnails();
      });
    };
    fileReader.readAsArrayBuffer(file);
  }
}

function renderPage(pageNumber) {
  pdfDoc.getPage(pageNumber).then(function (page) {
    const viewport = page.getViewport({ scale: scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    page.render(renderContext).promise.then(() => {
      drawAnnotations(pageNumber);
    });
  });
}

function drawAnnotations(pageNumber) {
  if (!annotations[pageNumber]) return;
  annotations[pageNumber].forEach(ann => {
    ctx.globalAlpha = ann.opacity || 1;
    ctx.fillStyle = ann.color || '#000';
    ctx.strokeStyle = ann.color || '#000';
    ctx.lineWidth = 2;
    switch (ann.type) {
      case 'text':
        ctx.font = `${ann.size}px sans-serif`;
        ctx.fillText(ann.text, ann.x, ann.y);
        break;
      case 'draw':
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ann.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        break;
    }
    ctx.globalAlpha = 1;
  });
}

canvas.addEventListener('mousedown', onMouseDown);
let drawing = false;
let drawPoints = [];
function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (!annotations[currentPage]) annotations[currentPage] = [];

  switch (activeTool) {
    case 'text':
      const text = prompt('Enter text:');
      if (text) {
        annotations[currentPage].push({
          type: 'text',
          text,
          x, y,
          color: colorPicker.value,
          size: parseInt(fontSizeInput.value),
          opacity: parseFloat(opacityInput.value)
        });
        renderPage(currentPage);
      }
      break;
    case 'draw':
      drawing = true;
      drawPoints = [{ x, y }];
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mouseup', onMouseUp);
      break;
  }
}

function onMouseMove(e) {
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  drawPoints.push({ x, y });
  renderPage(currentPage);
  ctx.beginPath();
  ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
  drawPoints.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = colorPicker.value;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function onMouseUp() {
  drawing = false;
  annotations[currentPage].push({
    type: 'draw',
    points: drawPoints,
    color: colorPicker.value,
    opacity: parseFloat(opacityInput.value)
  });
  canvas.removeEventListener('mousemove', onMouseMove);
  canvas.removeEventListener('mouseup', onMouseUp);
  renderPage(currentPage);
}

function renderThumbnails() {
  const thumbs = document.getElementById('pageThumbnails');
  thumbs.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = `Page ${i}`;
    btn.addEventListener('click', () => {
      currentPage = i;
      renderPage(currentPage);
    });
    thumbs.appendChild(btn);
  }
}

function clearAnnotations() {
  annotations = {};
  renderPage(currentPage);
}

async function savePDF() {
  const existingPdfBytes = await pdfDoc.save();
  const pdfLib = await import('https://cdn.skypack.dev/pdf-lib');
  const { PDFDocument, rgb } = pdfLib;

  const newPdfDoc = await PDFDocument.load(existingPdfBytes);

  for (let i = 1; i <= totalPages; i++) {
    const page = newPdfDoc.getPage(i - 1);
    const { width, height } = page.getSize();

    if (annotations[i]) {
      annotations[i].forEach(ann => {
        const color = hexToRgb(ann.color);
        switch (ann.type) {
          case 'text':
            page.drawText(ann.text, {
              x: ann.x,
              y: height - ann.y,
              size: ann.size,
              color: rgb(color.r / 255, color.g / 255, color.b / 255),
              opacity: ann.opacity
            });
            break;
          case 'draw':
            for (let j = 0; j < ann.points.length - 1; j++) {
              const p1 = ann.points[j];
              const p2 = ann.points[j + 1];
              page.drawLine({
                start: { x: p1.x, y: height - p1.y },
                end: { x: p2.x, y: height - p2.y },
                thickness: 2,
                color: rgb(color.r / 255, color.g / 255, color.b / 255),
                opacity: ann.opacity
              });
            }
            break;
        }
      });
    }
  }

  const pdfBytes = await newPdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'annotated.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function downloadPDF() {
  savePDF();
}
