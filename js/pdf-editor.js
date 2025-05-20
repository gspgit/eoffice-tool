// PDF Editor Logic with Full Annotation Features + Undo/Redo, Enhanced Image/Shape Controls, LocalStorage Sync

const fileInput = document.getElementById("fileInput");
const pdfCanvas = document.getElementById("pdfCanvas");
const ctx = pdfCanvas.getContext("2d");
const colorPicker = document.getElementById("colorPicker");
const fontSizeInput = document.getElementById("fontSize");
const opacityInput = document.getElementById("opacity");

let currentPDF = null;
let currentPageIndex = 0;
let pdfDoc = null;
let annotations = {}; // Store per-page annotations
let undoStack = [];
let redoStack = [];
let currentTool = "select";
let drawing = false;
let drawPath = [];
let startX = 0, startY = 0;

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js";

function saveState() {
  undoStack.push(JSON.stringify(annotations));
  redoStack = [];
  saveToLocalStorage();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.stringify(annotations));
  annotations = JSON.parse(undoStack.pop());
  renderPage(currentPageIndex);
  saveToLocalStorage();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.stringify(annotations));
  annotations = JSON.parse(redoStack.pop());
  renderPage(currentPageIndex);
  saveToLocalStorage();
}

function saveToLocalStorage() {
  localStorage.setItem("pdfAnnotations", JSON.stringify(annotations));
}

function loadFromLocalStorage() {
  const data = localStorage.getItem("pdfAnnotations");
  if (data) annotations = JSON.parse(data);
}

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file && file.type === "application/pdf") {
    const fileReader = new FileReader();
    fileReader.onload = async () => {
      const typedArray = new Uint8Array(fileReader.result);
      pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
      currentPDF = typedArray;
      currentPageIndex = 0;
      loadFromLocalStorage();
      renderPage(currentPageIndex);
    };
    fileReader.readAsArrayBuffer(file);
  }
});

document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTool = btn.dataset.tool;
  });
});

pdfCanvas.addEventListener("mousedown", (e) => {
  if (["draw", "highlight", "shape", "erase"].includes(currentTool)) {
    drawing = true;
    startX = e.offsetX;
    startY = e.offsetY;
    drawPath = [{ x: startX, y: startY }];
  } else if (currentTool === "text") {
    const text = prompt("Enter text:");
    if (text) {
      saveState();
      addAnnotation({
        type: "text",
        x: e.offsetX,
        y: e.offsetY,
        value: text,
        size: fontSizeInput.value,
        color: colorPicker.value,
        opacity: opacityInput.value,
        page: currentPageIndex,
      });
      renderPage(currentPageIndex);
    }
  } else if (currentTool === "image") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          saveState();
          addAnnotation({
            type: "image",
            x: e.offsetX,
            y: e.offsetY,
            width: 100,
            height: 100,
            src: reader.result,
            page: currentPageIndex,
          });
          renderPage(currentPageIndex);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }
});

pdfCanvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  drawPath.push({ x: e.offsetX, y: e.offsetY });
  renderPage(currentPageIndex);
});

pdfCanvas.addEventListener("mouseup", () => {
  if (drawing) {
    drawing = false;
    saveState();
    if (["draw", "highlight"].includes(currentTool)) {
      addAnnotation({
        type: currentTool,
        path: drawPath,
        color: colorPicker.value,
        size: fontSizeInput.value,
        opacity: opacityInput.value,
        page: currentPageIndex,
      });
    } else if (currentTool === "shape") {
      const endX = drawPath[drawPath.length - 1].x;
      const endY = drawPath[drawPath.length - 1].y;
      addAnnotation({
        type: "rect",
        x: startX,
        y: startY,
        width: endX - startX,
        height: endY - startY,
        color: colorPicker.value,
        opacity: opacityInput.value,
        page: currentPageIndex,
      });
    } else if (currentTool === "erase") {
      if (annotations[currentPageIndex]) {
        annotations[currentPageIndex] = annotations[currentPageIndex].filter(
          (a) => {
            if (a.type === "text" && Math.abs(a.x - startX) < 20 && Math.abs(a.y - startY) < 20) return false;
            if (a.type === "draw" || a.type === "highlight") {
              return !a.path.some((p) => Math.abs(p.x - startX) < 10 && Math.abs(p.y - startY) < 10);
            }
            return true;
          }
        );
      }
    }
    renderPage(currentPageIndex);
  }
});

function addAnnotation(anno) {
  if (!annotations[anno.page]) annotations[anno.page] = [];
  annotations[anno.page].push(anno);
}

async function renderPage(index) {
  const page = await pdfDoc.getPage(index + 1);
  const viewport = page.getViewport({ scale: 1.5 });
  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };
  await page.render(renderContext).promise;

  if (annotations[index]) {
    annotations[index].forEach((a) => {
      ctx.globalAlpha = a.opacity || 1;
      ctx.fillStyle = a.color || "black";
      ctx.strokeStyle = a.color || "black";
      ctx.lineWidth = a.size || 2;
      if (a.type === "text") {
        ctx.font = `${a.size}px sans-serif`;
        ctx.fillText(a.value, a.x, a.y);
      } else if (a.type === "draw" || a.type === "highlight") {
        ctx.beginPath();
        ctx.moveTo(a.path[0].x, a.path[0].y);
        a.path.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      } else if (a.type === "rect") {
        ctx.strokeRect(a.x, a.y, a.width, a.height);
      } else if (a.type === "image") {
        const img = new Image();
        img.src = a.src;
        img.onload = () => ctx.drawImage(img, a.x, a.y, a.width, a.height);
      }
    });
    ctx.globalAlpha = 1;
  }
}

document.getElementById("opacity").addEventListener("input", () => renderPage(currentPageIndex));
document.getElementById("colorPicker").addEventListener("input", () => renderPage(currentPageIndex));
document.getElementById("fontSize").addEventListener("input", () => renderPage(currentPageIndex));

window.downloadPDF = async function () {
  const { PDFDocument, rgb } = PDFLib;
  const pdfDocOut = await PDFDocument.load(currentPDF);

  for (let i = 0; i < pdfDocOut.getPageCount(); i++) {
    const page = pdfDocOut.getPages()[i];
    const pageAnnots = annotations[i] || [];
    pageAnnots.forEach((a) => {
      if (a.type === "text") {
        page.drawText(a.value, {
          x: a.x,
          y: page.getHeight() - a.y,
          size: parseInt(a.size),
          color: rgb(...hexToRgb(a.color)),
          opacity: parseFloat(a.opacity),
        });
      } else if (a.type === "rect") {
        page.drawRectangle({
          x: a.x,
          y: page.getHeight() - a.y - a.height,
          width: a.width,
          height: a.height,
          borderColor: rgb(...hexToRgb(a.color)),
          borderWidth: 1,
          opacity: parseFloat(a.opacity),
        });
      }
    });
  }

  const pdfBytes = await pdfDocOut.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "annotated.pdf";
  link.click();
};

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16 & 255) / 255, (bigint >> 8 & 255) / 255, (bigint & 255) / 255];
}

window.savePDF = window.downloadPDF;

window.clearAnnotations = function () {
  saveState();
  annotations[currentPageIndex] = [];
  renderPage(currentPageIndex);
};

window.nextPage = function () {
  if (currentPageIndex < pdfDoc.numPages - 1) {
    currentPageIndex++;
    renderPage(currentPageIndex);
  }
};

window.prevPage = function () {
  if (currentPageIndex > 0) {
    currentPageIndex--;
    renderPage(currentPageIndex);
  }
};

window.undo = undo;
window.redo = redo;
