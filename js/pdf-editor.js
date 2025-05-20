// === Global State ===
let pdfDoc = null;
let currentPage = 1;
let scale = 1.5;
let canvas = document.getElementById('pdfCanvas');
let ctx = canvas.getContext('2d');
let annotationStorage = {}; // { pageNumber: [ {type, x, y, ...}, ... ] }
let currentTool = 'select';
let isDrawing = false;
let drawPath = [];

// === Load PDF ===
document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const typedArray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedArray).promise.then(doc => {
                pdfDoc = doc;
                currentPage = 1;
                renderPage(currentPage);
            });
        };
        fileReader.readAsArrayBuffer(file);
    }
});

// === Render PDF Page ===
function renderPage(pageNum) {
    pdfDoc.getPage(pageNum).then(page => {
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        page.render(renderContext).promise.then(() => {
            redrawAnnotations();
        });
    });
}

// === Redraw Annotations ===
function redrawAnnotations() {
    const annotations = annotationStorage[currentPage] || [];
    annotations.forEach(ann => {
        ctx.globalAlpha = ann.opacity || 1;
        ctx.strokeStyle = ann.color || '#000';
        ctx.fillStyle = ann.color || '#000';
        ctx.lineWidth = 2;

        if (ann.type === 'draw') {
            ctx.beginPath();
            ctx.moveTo(ann.path[0].x, ann.path[0].y);
            for (let i = 1; i < ann.path.length; i++) {
                ctx.lineTo(ann.path[i].x, ann.path[i].y);
            }
            ctx.stroke();
        }
        // Add more annotation types (text, highlight, shape, etc.) here
    });
    ctx.globalAlpha = 1;
}

// === Drawing Tool ===
canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'draw') {
        isDrawing = true;
        drawPath = [{ x, y }];
    } else if (currentTool === 'erase') {
        eraseAtPosition(x, y);
    }
});

canvas.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    if (currentTool === 'draw') {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        drawPath.push({ x, y });
        redraw();
    }
});

canvas.addEventListener('mouseup', () => {
    if (currentTool === 'draw' && isDrawing) {
        if (!annotationStorage[currentPage]) {
            annotationStorage[currentPage] = [];
        }
        annotationStorage[currentPage].push({
            type: 'draw',
            path: drawPath,
            color: document.getElementById('colorPicker').value,
            opacity: parseFloat(document.getElementById('opacity').value || '1')
        });
    }
    isDrawing = false;
    drawPath = [];
});

function redraw() {
    renderPage(currentPage);
    ctx.beginPath();
    ctx.moveTo(drawPath[0].x, drawPath[0].y);
    for (let i = 1; i < drawPath.length; i++) {
        ctx.lineTo(drawPath[i].x, drawPath[i].y);
    }
    ctx.strokeStyle = document.getElementById('colorPicker').value;
    ctx.globalAlpha = parseFloat(document.getElementById('opacity').value || '1');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
}

// === Eraser Tool ===
function eraseAtPosition(x, y) {
    const annotations = annotationStorage[currentPage] || [];
    const ERASE_RADIUS = 10;
    annotationStorage[currentPage] = annotations.filter(ann => {
        if (ann.type === 'draw') {
            return !ann.path.some(pt => Math.abs(pt.x - x) < ERASE_RADIUS && Math.abs(pt.y - y) < ERASE_RADIUS);
        }
        return true;
    });
    renderPage(currentPage);
}

// === Tool Switcher ===
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.tool-btn.active')?.classList.remove('active');
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
    });
});
