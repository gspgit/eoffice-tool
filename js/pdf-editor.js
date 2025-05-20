// pdf-editor.js

let pdfDoc = null;
let currentPage = 1;
let scale = 1.5;
let canvas = document.getElementById("pdfCanvas");
let ctx = canvas.getContext("2d");
let annotations = {}; // Store per-page annotations
let currentTool = "select";
let drawing = false;
let startX, startY;

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");

// Load PDF file
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file && file.type === "application/pdf") {
    const fileReader = new FileReader();
    fileReader.onload = function () {
      const typedarray = new Uint8Array(this.result);
      pdfjsLib.getDocument(typedarray).promise.then((doc) => {
        pdfDoc = doc;
        annotations = {}; // Reset annotations
        renderPage(currentPage);
      });
    };
    fileReader.readAsArrayBuffer(file);
  }
});

// Drag and Drop
["dragover", "drop"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    if (evt === "drop") {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event("change"));
    }
  });
});

function renderPage(pageNum) {
  pdfDoc.getPage(pageNum).then((page) => {
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    page.render(renderContext).promise.then(() => {
      drawAnnotations(pageNum);
    });
  });
}

function drawAnnotations(pageNum) {
  if (!annotations[pageNum]) return;
  annotations[pageNum].forEach((ann) => {
    ctx.globalAlpha = ann.opacity || 1;
    ctx.strokeStyle = ann.color || "#000";
    ctx.fillStyle = ann.color || "#000";
    ctx.lineWidth = 2;
    switch (ann.type) {
      case "text":
        ctx.font = `${ann.size || 12}px Arial`;
        ctx.fillText(ann.text, ann.x, ann.y);
        break;
      case "highlight":
        ctx.fillStyle = ann.color || "yellow";
        ctx.globalAlpha = 0.4;
        ctx.fillRect(ann.x, ann.y, ann.w, ann.h);
        break;
      case "draw":
        ctx.beginPath();
        ctx.moveTo(ann.path[0].x, ann.path[0].y);
        ann.path.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
        break;
      case "rect":
        ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
        break;
      case "image":
        const img = new Image();
        img.src = ann.src;
        img.onload = () => ctx.drawImage(img, ann.x, ann.y, ann.w, ann.h);
        break;
    }
    ctx.globalAlpha = 1;
  });
}

// Tool selection
const toolButtons = document.querySelectorAll(".tool-btn");
toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".tool-btn.active")?.classList.remove("active");
    btn.classList.add("active");
    currentTool = btn.dataset.tool;
  });
});

canvas.addEventListener("mousedown", (e) => {
  if (currentTool === "draw" || currentTool === "highlight" || currentTool === "rect") {
    drawing = true;
    startX = e.offsetX;
    startY = e.offsetY;
    if (currentTool === "draw") {
      currentPath = [{ x: startX, y: startY }];
    }
  } else if (currentTool === "text") {
    const text = prompt("Enter text:");
    if (text) {
      addAnnotation({ type: "text", x: e.offsetX, y: e.offsetY, text, size: getFontSize(), color: getColor(), opacity: getOpacity() });
      renderPage(currentPage);
    }
  } else if (currentTool === "image") {
    const imgInput = document.createElement("input");
    imgInput.type = "file";
    imgInput.accept = "image/*";
    imgInput.onchange = (event) => {
      const imgFile = event.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        addAnnotation({ type: "image", x: e.offsetX, y: e.offsetY, src: reader.result, w: 100, h: 100 });
        renderPage(currentPage);
      };
      reader.readAsDataURL(imgFile);
    };
    imgInput.click();
  } else if (currentTool === "erase") {
    eraseAnnotationAt(e.offsetX, e.offsetY);
    renderPage(currentPage);
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;
  if (currentTool === "draw") {
    currentPath.push({ x: e.offsetX, y: e.offsetY });
    renderPage(currentPage);
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (!drawing) return;
  drawing = false;
  if (currentTool === "draw") {
    addAnnotation({ type: "draw", path: currentPath, color: getColor(), opacity: getOpacity() });
  } else if (currentTool === "highlight") {
    const w = e.offsetX - startX;
    const h = e.offsetY - startY;
    addAnnotation({ type: "highlight", x: startX, y: startY, w, h, color: getColor(), opacity: getOpacity() });
  } else if (currentTool === "rect") {
    const w = e.offsetX - startX;
    const h = e.offsetY - startY;
    addAnnotation({ type: "rect", x: startX, y: startY, w, h, color: getColor(), opacity: getOpacity() });
  }
  renderPage(currentPage);
});

function addAnnotation(ann) {
  if (!annotations[currentPage]) annotations[currentPage] = [];
  annotations[currentPage].push(ann);
}

function eraseAnnotationAt(x, y) {
  const pageAnnotations = annotations[currentPage] || [];
  annotations[currentPage] = pageAnnotations.filter((ann) => {
    if (ann.type === "text") {
      const textWidth = ctx.measureText(ann.text).width;
      return !(x > ann.x && x < ann.x + textWidth && y > ann.y - 12 && y < ann.y);
    } else if (ann.type === "highlight" || ann.type === "rect" || ann.type === "image") {
      return !(x > ann.x && x < ann.x + ann.w && y > ann.y && y < ann.y + ann.h);
    } else if (ann.type === "draw") {
      return true; // Skip for now unless point-in-path detection is implemented
    }
    return true;
  });
}

function getFontSize() {
  return parseInt(document.getElementById("fontSize").value);
}

function getColor() {
  return document.getElementById("colorPicker").value;
}

function getOpacity() {
  return parseFloat(document.getElementById("opacity").value);
}

function clearAnnotations() {
  annotations = {};
  renderPage(currentPage);
}

// Document Actions
async function savePDF() {
    if (!currentPdfDoc) {
        alert('No PDF loaded');
        return;
    }
    
    try {
        showLoading(true);
        // Using PDF-Lib to save with annotations
        const { PDFDocument, rgb } = PDFLib;
        
        const existingPdfBytes = await currentPdfDoc.getData();
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        
        // Here you would add code to draw annotations into the PDF
        // This is simplified - you'd need to implement proper PDF annotation creation
        
        const modifiedPdfBytes = await pdfDoc.save();
        const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
        
        // For now, we'll just save the original with a note that annotations aren't embedded
        alert('Note: In this demo, annotations are not saved into the PDF file. For full functionality, implement PDF annotation creation with PDF-Lib.');
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'edited-document.pdf';
        link.click();
        showLoading(false);
    } catch (error) {
        showLoading(false);
        console.error('Error saving PDF:', error);
        alert('Error saving PDF: ' + error.message);
    }
}

function downloadPDF() {
    if (!currentPdfDoc) {
        alert('No PDF loaded');
        return;
    }
    
    // Similar to save but might implement different behavior
    savePDF();
}

