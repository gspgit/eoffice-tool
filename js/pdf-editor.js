// PDF Editor Core Functionality
let currentPdfDoc = null;
let currentPage = 1;
let scale = 1.5;
let annotations = [];
let activeTool = 'select';
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let canvas, ctx;

// Initialize the editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('pdfCanvas');
    ctx = canvas.getContext('2d');
    
    // Set up event listeners
    initializeEventListeners();
    
    // Set default properties
    document.getElementById('fontSize').addEventListener('input', updateActiveToolProperties);
    document.getElementById('colorPicker').addEventListener('input', updateActiveToolProperties);
    document.getElementById('opacity').addEventListener('input', updateActiveToolProperties);
});

function initializeEventListeners() {
    // File input handling
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    
    // Drop zone handling
    const dropZone = document.getElementById('dropZone');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlightDropZone, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlightDropZone, false);
    });
    
    dropZone.addEventListener('drop', handleDrop, false);
    
    // Tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveTool(btn.dataset.tool);
        });
    });
    
    // Canvas interaction
    canvas.addEventListener('mousedown', startDrawingAction);
    canvas.addEventListener('mousemove', continueDrawingAction);
    canvas.addEventListener('mouseup', stopDrawingAction);
    canvas.addEventListener('mouseout', stopDrawingAction);
    
    // Action buttons
    document.getElementById('savePdf').addEventListener('click', savePDF);
    document.getElementById('clearChanges').addEventListener('click', clearAnnotations);
    document.getElementById('downloadPdf').addEventListener('click', downloadPDF);
}

// PDF Loading and Rendering
async function loadPdf(file) {
    try {
        showLoading(true);
        const reader = new FileReader();
        
        reader.onload = async () => {
            const pdfData = new Uint8Array(reader.result);
            const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            currentPdfDoc = pdfDoc;
            document.getElementById('fileInfo').textContent = file.name;
            await renderPage(currentPage);
            await generateThumbnails();
            showLoading(false);
        };
        
        reader.onerror = () => {
            showLoading(false);
            alert('Error reading file');
        };
        
        reader.readAsArrayBuffer(file);
    } catch (error) {
        showLoading(false);
        console.error('Error loading PDF:', error);
        alert('Error loading PDF: ' + error.message);
    }
}

async function renderPage(pageNum) {
    if (!currentPdfDoc) return;
    
    try {
        showLoading(true);
        const page = await currentPdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        redrawAnnotations();
        showLoading(false);
    } catch (error) {
        showLoading(false);
        console.error('Error rendering page:', error);
    }
}

// Thumbnail Generation
async function generateThumbnails() {
    if (!currentPdfDoc) return;
    
    const container = document.getElementById('pageThumbnails');
    container.innerHTML = '';
    
    for (let i = 1; i <= currentPdfDoc.numPages; i++) {
        try {
            const page = await currentPdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.2 });
            
            const thumbCanvas = document.createElement('canvas');
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCanvas.height = viewport.height;
            thumbCanvas.width = viewport.width;
            
            await page.render({
                canvasContext: thumbCtx,
                viewport: viewport
            }).promise;
            
            const thumbnail = document.createElement('div');
            thumbnail.className = 'thumbnail-page';
            thumbnail.innerHTML = `<img src="${thumbCanvas.toDataURL()}" data-page="${i}">`;
            thumbnail.addEventListener('click', () => gotoPage(i));
            container.appendChild(thumbnail);
        } catch (error) {
            console.error('Error generating thumbnail for page', i, error);
        }
    }
}

function gotoPage(pageNum) {
    if (pageNum !== currentPage) {
        currentPage = pageNum;
        renderPage(currentPage);
    }
}

// Tool Management
function setActiveTool(tool) {
    activeTool = tool;
    
    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
    });
    
    const activeBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-pressed', 'true');
    }
    
    // Update cursor
    switch(tool) {
        case 'select':
            canvas.style.cursor = 'default';
            break;
        case 'text':
            canvas.style.cursor = 'text';
            break;
        case 'draw':
        case 'shape':
            canvas.style.cursor = 'crosshair';
            break;
        case 'erase':
            canvas.style.cursor = 'cell';
            break;
        default:
            canvas.style.cursor = 'pointer';
    }
}

function updateActiveToolProperties() {
    // Update properties for the current tool
    // This could be extended to save properties per tool
}

// Drawing and Annotation System
function startDrawingAction(e) {
    if (!currentPdfDoc) return;
    
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
        case 'highlight':
            startHighlight(x, y);
            break;
        case 'shape':
            startShape(x, y);
            break;
        case 'erase':
            eraseAtPosition(x, y);
            break;
    }
}

function continueDrawingAction(e) {
    if (!isDrawing || !currentPdfDoc) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    switch(activeTool) {
        case 'draw':
            continueDrawing(x, y);
            break;
        case 'highlight':
            continueHighlight(x, y);
            break;
        case 'shape':
            continueShape(x, y);
            break;
        case 'erase':
            eraseAtPosition(x, y);
            break;
    }
    
    lastX = x;
    lastY = y;
}

function stopDrawingAction() {
    isDrawing = false;
}

function startDrawing(x, y) {
    isDrawing = true;
    lastX = x;
    lastY = y;
    
    annotations.push({
        type: 'drawing',
        points: [{x, y}],
        color: document.getElementById('colorPicker').value,
        lineWidth: document.getElementById('fontSize').value / 4,
        opacity: document.getElementById('opacity').value,
        page: currentPage
    });
}

function continueDrawing(x, y) {
    const currentDrawing = annotations.findLast(a => a.type === 'drawing' && a.page === currentPage);
    if (currentDrawing) {
        currentDrawing.points.push({x, y});
        redrawAnnotations();
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
            color: document.getElementById('colorPicker').value,
            opacity: document.getElementById('opacity').value
        });
        redrawAnnotations();
    }
}

function startHighlight(x, y) {
    isDrawing = true;
    lastX = x;
    lastY = y;
    
    annotations.push({
        type: 'highlight',
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        color: document.getElementById('colorPicker').value,
        opacity: document.getElementById('opacity').value * 0.3, // Highlights are typically more transparent
        page: currentPage
    });
}

function continueHighlight(x, y) {
    const currentHighlight = annotations.findLast(a => a.type === 'highlight' && a.page === currentPage);
    if (currentHighlight) {
        currentHighlight.endX = x;
        currentHighlight.endY = y;
        redrawAnnotations();
    }
}

function redrawAnnotations() {
    if (!currentPdfDoc) return;
    
    // First re-render the PDF page
    renderPage(currentPage).then(() => {
        // Then draw all annotations for the current page
        const pageAnnotations = annotations.filter(a => a.page === currentPage);
        
        pageAnnotations.forEach(ann => {
            ctx.globalAlpha = ann.opacity || 1;
            
            switch(ann.type) {
                case 'text':
                    ctx.fillStyle = ann.color;
                    ctx.font = `${ann.fontSize}px Arial`;
                    ctx.fillText(ann.content, ann.x, ann.y);
                    break;
                    
                case 'drawing':
                    if (ann.points.length > 1) {
                        ctx.strokeStyle = ann.color;
                        ctx.lineWidth = ann.lineWidth;
                        ctx.lineJoin = 'round';
                        ctx.lineCap = 'round';
                        ctx.beginPath();
                        ctx.moveTo(ann.points[0].x, ann.points[0].y);
                        
                        for (let i = 1; i < ann.points.length; i++) {
                            ctx.lineTo(ann.points[i].x, ann.points[i].y);
                        }
                        
                        ctx.stroke();
                    }
                    break;
                    
                case 'highlight':
                    ctx.fillStyle = ann.color;
                    const width = ann.endX - ann.startX;
                    const height = 20; // Fixed highlight height
                    ctx.fillRect(ann.startX, ann.startY - height/2, width, height);
                    break;
            }
        });
        
        ctx.globalAlpha = 1.0;
    });
}

// File Handling
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        loadPdf(file);
    }
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file && file.type === 'application/pdf') {
        loadPdf(file);
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlightDropZone() {
    document.getElementById('dropZone').classList.add('highlight');
}

function unhighlightDropZone() {
    document.getElementById('dropZone').classList.remove('highlight');
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

function clearAnnotations() {
    if (confirm('Are you sure you want to clear all annotations?')) {
        annotations = annotations.filter(a => a.page !== currentPage);
        redrawAnnotations();
    }
}

// UI Helpers
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'block' : 'none';
    }
    
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.disabled = show;
    });
}

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js';
