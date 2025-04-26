/* ======================
   CONFIGURATION CONSTANTS
   ====================== */
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const VALID_MIME_TYPES = ['application/pdf'];
const VALID_EXTENSIONS = ['pdf'];
const PREVIEW_SCALE = 0.5;
const PREVIEW_CONTAINER_ID = 'pageThumbnails';

/* ================
   STATE MANAGEMENT
   ================ */
let currentPDF = null;
let pageRotations = new Map(); // Tracks rotation degrees for each page (0-indexed)

/* ====================
   DOM INITIALIZATION
   ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initializeFileInput();
    initializeRotationButtons();
    initializeDragAndDrop();
    initializePDFJSWorker();
});

function initializeFileInput() {
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
}

function initializeRotationButtons() {
    document.querySelectorAll('.angle-btn').forEach(btn => {
        btn.addEventListener('click', handleRotationSelection);
    });
}

function initializePDFJSWorker() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* =================
   FILE HANDLING
   ================= */
async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!validateFile(file)) return;

    try {
        currentPDF = file;
        pageRotations.clear();
        await showFileInfo(file);
        await renderPDFPreview(URL.createObjectURL(file));
    } catch (err) {
        handleFileError(err);
    }
}

function validateFile(file) {
    if (!file) {
        showAlert('Please select a file');
        return false;
    }

    const isValidType = VALID_MIME_TYPES.includes(file.type) || 
                      VALID_EXTENSIONS.includes(file.name.split('.').pop().toLowerCase());
    
    if (!isValidType) {
        showAlert('Please select a PDF file');
        return false;
    }

    if (file.size > MAX_FILE_SIZE) {
        showAlert('File size exceeds 50MB limit');
        return false;
    }

    return true;
}

async function showFileInfo(file) {
    try {
        showLoading(true);
        const pdfDoc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        const pageCount = pdfDoc.getPages().length;
        
        document.getElementById('fileInfo').innerHTML = `
            <p><strong>File Name:</strong> ${file.name}</p>
            <p><strong>Pages:</strong> ${pageCount}</p>
            <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
        `;
    } finally {
        showLoading(false);
    }
}

/* =================
   PDF PREVIEW
   ================= */
async function renderPDFPreview(url) {
    try {
        showLoading(true);
        const pdf = await pdfjsLib.getDocument(url).promise;
        const container = document.getElementById(PREVIEW_CONTAINER_ID);
        container.innerHTML = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            await renderPageThumbnail(pdf, pageNum, container);
        }
    } catch (err) {
        console.error("Preview error:", err);
        showAlert('Error generating PDF preview');
    } finally {
        showLoading(false);
        URL.revokeObjectURL(url);
    }
}

async function renderPageThumbnail(pdf, pageNum, container) {
    const pageIndex = pageNum - 1;
    const page = await pdf.getPage(pageNum);
    const rotation = pageRotations.get(pageIndex) || 0;
    
    const viewport = page.getViewport({ 
        scale: PREVIEW_SCALE,
        rotation: rotation 
    });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Set white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ 
        canvasContext: context, 
        viewport 
    }).promise;

    const thumbnail = createThumbnailElement(canvas, pageNum, pageIndex);
    container.appendChild(thumbnail);
}

function createThumbnailElement(canvas, pageNum, pageIndex) {
    const div = document.createElement('div');
    div.className = 'page-thumbnail';
    div.id = `thumbnail-${pageIndex}`;
    div.innerHTML = `
        <canvas></canvas>
        <span class="page-number">Page ${pageNum}</span>
    `;
    div.querySelector('canvas').replaceWith(canvas);
    return div;
}

/* =================
   ROTATION CONTROL
   ================= */
function handleRotationSelection(e) {
    const rotationDelta = parseInt(e.currentTarget.dataset.degrees);
    const pagesToRotate = getPagesToRotate();
    
    pagesToRotate.forEach(pageIndex => {
        const current = pageRotations.get(pageIndex) || 0;
        pageRotations.set(pageIndex, (current + rotationDelta) % 360);
    });
    
    updatePreviewRotations(pagesToRotate);
    updateButtonStyles(e.currentTarget);
}

async function updatePreviewRotations(pageIndices) {
    const url = URL.createObjectURL(currentPDF);
    const pdf = await pdfjsLib.getDocument(url).promise;
    
    for (const pageIndex of pageIndices) {
        const pageNum = pageIndex + 1;
        const page = await pdf.getPage(pageNum);
        const thumbnailDiv = document.getElementById(`thumbnail-${pageIndex}`);
        
        if (thumbnailDiv) {
            const newCanvas = await renderPageWithRotation(page, pageIndex);
            thumbnailDiv.querySelector('canvas').replaceWith(newCanvas);
        }
    }
    URL.revokeObjectURL(url);
}

async function renderPageWithRotation(page, pageIndex) {
    const rotation = pageRotations.get(pageIndex) || 0;
    const viewport = page.getViewport({ 
        scale: PREVIEW_SCALE,
        rotation: rotation 
    });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
    
    return canvas;
}

function updateButtonStyles(activeButton) {
    document.querySelectorAll('.angle-btn').forEach(btn => {
        btn.style.backgroundColor = btn === activeButton ? '#3498db' : '#f8f9fa';
        btn.style.color = btn === activeButton ? 'white' : '#2c3e50';
    });
}

/* =================
   PDF PROCESSING
   ================= */
async function rotatePDF() {
    if (!currentPDF) return showAlert('Please select a PDF file first');
    
    try {
        showLoading(true);
        const pdfDoc = await processPDFRotation();
        saveRotatedPDF(pdfDoc);
        showAlert('PDF rotated successfully!', 'success');
    } catch (err) {
        handleRotationError(err);
    } finally {
        showLoading(false);
    }
}

async function processPDFRotation() {
    const pdfBytes = await currentPDF.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    getPagesToRotate().forEach(pageIndex => {
        if (pageIndex >= 0 && pageIndex < pages.length) {
            const currentRotation = pages[pageIndex].getRotation().angle;
            const additionalRotation = pageRotations.get(pageIndex) || 0;
            pages[pageIndex].setRotation(PDFLib.degrees(currentRotation + additionalRotation));
        }
    });

    return pdfDoc;
}

function saveRotatedPDF(pdfDoc) {
    pdfDoc.save().then(rotatedBytes => {
        saveAs(new Blob([rotatedBytes], { type: 'application/pdf' }), 
            `rotated-${currentPDF.name}`);
    });
}

/* ======================
   PAGE RANGE MANAGEMENT
   ====================== */
function getPagesToRotate() {
    const rangeInput = document.getElementById('pageRange').value.trim();
    const totalPages = currentPDF ? currentPDF._pdfInfo?.numPages : 0;
    return rangeInput ? parsePageRange(rangeInput, totalPages) 
        : Array.from({ length: totalPages }, (_, i) => i);
}

function parsePageRange(input, maxPages) {
    return input.split(',')
        .flatMap(part => {
            const trimmed = part.trim();
            if (!trimmed) return [];
            
            if (trimmed.includes('-')) {
                const range = trimmed.split('-').map(n => {
                    const num = parseInt(n);
                    return isNaN(num) ? NaN : Math.max(1, Math.min(num, maxPages));
                });
                
                if (range.some(isNaN)) return [];
                const [start, end = start] = range.map(n => n - 1);
                const first = Math.min(start, end);
                const last = Math.max(start, end);
                
                return Array.from({ length: last - first + 1 }, (_, i) => first + i);
            }
            
            const page = parseInt(trimmed);
            return isNaN(page) ? [] : [page - 1];
        })
        .filter(n => n >= 0 && n < maxPages);
}

/* ======================
   DRAG & DROP HANDLING
   ====================== */
function initializeDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    processDroppedFiles(e.dataTransfer.files);
}

function processDroppedFiles(files) {
    if (files.length > 0) {
        handleFileSelect({ target: { files } })
            .catch(err => console.error("Drag-drop error:", err));
    }
}

/* =================
   UTILITY FUNCTIONS
   ================= */
function clearFile() {
    currentPDF = null;
    pageRotations.clear();
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById(PREVIEW_CONTAINER_ID).innerHTML = '';
    document.getElementById('pageRange').value = '';
    resetRotationButtons();
}

function resetRotationButtons() {
    document.querySelectorAll('.angle-btn').forEach(btn => {
        btn.style.backgroundColor = '#f8f9fa';
        btn.style.color = '#2c3e50';
    });
}

function formatFileSize(bytes) {
    const units = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** exponent).toFixed(2)} ${units[exponent]}`;
}

function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

function showAlert(message, type = 'error') {
    alert(message); // Replace with a proper modal implementation
}

function handleFileError(err) {
    console.error("File error:", err);
    showAlert('Error processing PDF file');
    clearFile();
}

function handleRotationError(err) {
    console.error("Rotation error:", err);
    showAlert(`Rotation failed: ${err.message}`);
}