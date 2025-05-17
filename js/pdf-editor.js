let currentPdfDoc = null;
let currentPage = 1;
let scale = 1.5;
let annotations = [];
let activeTool = 'select';

// PDF Rendering
async function loadPdf(file) {
    const reader = new FileReader();
    reader.onload = async () => {
        const pdfData = new Uint8Array(reader.result);
        const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
        currentPdfDoc = pdfDoc;
        renderPage(currentPage);
        generateThumbnails();
    };
    reader.readAsArrayBuffer(file);
}

async function renderPage(pageNum) {
    const page = await currentPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    
    const canvas = document.getElementById('pdfCanvas');
    const context = canvas.getContext('2d');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
}

// Thumbnail Generation
async function generateThumbnails() {
    const container = document.getElementById('pageThumbnails');
    container.innerHTML = '';
    
    for(let i = 1; i <= currentPdfDoc.numPages; i++) {
        const page = await currentPdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        const thumbnail = document.createElement('div');
        thumbnail.className = 'thumbnail-page';
        thumbnail.innerHTML = `<img src="${canvas.toDataURL()}" data-page="${i}">`;
        thumbnail.addEventListener('click', () => gotoPage(i));
        container.appendChild(thumbnail);
    }
}

// Event Listeners
document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('fileInfo').textContent = file.name;
        loadPdf(file);
    }
});

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTool = btn.dataset.tool;
    });
});

document.getElementById('savePdf').addEventListener('click', async () => {
    if (!currentPdfDoc) return;
    
    // PDF-Lib modification example
    const pdfBytes = await currentPdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    // Save functionality
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'edited-document.pdf';
    link.click();
});

// Annotation System
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    switch(activeTool) {
        case 'text':
            createTextAnnotation(x, y);
            break;
        case 'draw':
            startDrawing(x, y);
            break;
        // Add other tool cases
    }
}

function createTextAnnotation(x, y) {
    const text = prompt('Enter text:');
    if (text) {
        annotations.push({
            type: 'text',
            content: text,
            x,
            y,
            page: currentPage,
            fontSize: document.getElementById('fontSize').value,
            color: document.getElementById('colorPicker').value
        });
        redrawAnnotations();
    }
}

function redrawAnnotations() {
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    
    // Clear existing annotations
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw PDF page
    renderPage(currentPage);
    
    // Draw annotations
    annotations.filter(a => a.page === currentPage).forEach(ann => {
        if (ann.type === 'text') {
            ctx.fillStyle = ann.color;
            ctx.font = `${ann.fontSize}px Arial`;
            ctx.fillText(ann.content, ann.x, ann.y);
        }
    });
}

// Initialization
document.getElementById('pdfCanvas').addEventListener('click', handleCanvasClick);
