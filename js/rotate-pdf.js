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
let currentPDFDoc = null;
let totalPages = 0;
let pageRotations = new Map();

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
        clearFile();
        currentPDF = file;
        showLoading(true);

        const url = URL.createObjectURL(file);
        currentPDFDoc = await pdfjsLib.getDocument(url).promise;
        totalPages = currentPDFDoc.numPages;
        URL.revokeObjectURL(url);

        await showFileInfo();
        await renderPDFPreview();
    } catch (err) {
        handleFileError(err);
    } finally {
        showLoading(false);
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

async function showFileInfo() {
    document.getElementById('fileInfo').innerHTML = `
        <p><strong>File Name:</strong> ${currentPDF.name}</p>
        <p><strong>Pages:</strong> ${totalPages}</p>
        <p><strong>Size:</strong> ${formatFileSize(currentPDF.size)}</p>
    `;
}

/* =================
   PDF PREVIEW
   ================= */
async function renderPDFPreview() {
    const container = document.getElementById(PREVIEW_CONTAINER_ID);
    container.innerHTML = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
            const page = await currentPDFDoc.getPage(pageNum);
            const pageIndex = pageNum - 1;
            const thumbnail = await createThumbnailElement(page, pageIndex);
            container.appendChild(thumbnail);
        } catch (err) {
            console.error(`Error rendering page ${pageNum}:`, err);
        }
    }
}

async function createThumbnailElement(page, pageIndex) {
    const originalRotation = page.getViewport({ scale: 1 }).rotation;
    const userRotation = pageRotations.get(pageIndex) || 0;
    const totalRotation = (originalRotation + userRotation) % 360;

    const viewport = page.getViewport({ 
        scale: PREVIEW_SCALE,
        rotation: totalRotation
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

    const div = document.createElement('div');
    div.className = 'page-thumbnail';
    div.id = `thumbnail-${pageIndex}`;
    div.innerHTML = `
        <canvas></canvas>
        <span class="page-number">Page ${pageIndex + 1}</span>
    `;
    div.querySelector('canvas').replaceWith(canvas);
    return div;
}

/* =================
   ROTATION CONTROL
   ================= */
function handleRotationSelection(e) {
    try {
        const rotationDelta = parseInt(e.currentTarget.dataset.degrees);
        const pagesToRotate = getPagesToRotate();
        
        pagesToRotate.forEach(pageIndex => {
            const current = pageRotations.get(pageIndex) || 0;
            pageRotations.set(pageIndex, (current + rotationDelta) % 360);
        });
        
        updatePreviewRotations(pagesToRotate);
        updateButtonStyles(e.currentTarget);
    } catch (err) {
        handleRotationError(err);
    }
}

async function updatePreviewRotations(pageIndices) {
    try {
        showLoading(true);
        for (const pageIndex of pageIndices) {
            const page = await currentPDFDoc.getPage(pageIndex + 1);
            const thumbnailDiv = document.getElementById(`thumbnail-${pageIndex}`);
            
            if (thumbnailDiv) {
                const newCanvas = await createThumbnailElement(page, pageIndex);
                thumbnailDiv.querySelector('canvas').replaceWith(newCanvas);
            }
        }
    } catch (err) {
        console.error("Rotation preview error:", err);
        showAlert('Error updating preview');
    } finally {
        showLoading(false);
    }
}

/* =================
   PDF PROCESSING
   ================= */
async function rotatePDF() {
    if (!currentPDF) return showAlert('Please select a PDF file first');
    
    try {
        showLoading(true);
        const pdfDoc = await PDFLib.PDFDocument.load(await currentPDF.arrayBuffer());
        const pages = pdfDoc.getPages();
        const pagesToRotate = getPagesToRotate();

        for (const pageIndex of pagesToRotate) {
            if (pageIndex >= pages.length) continue;
            
            const originalRotation = pages[pageIndex].getRotation().angle;
            const userRotation = pageRotations.get(pageIndex) || 0;
            pages[pageIndex].setRotation(PDFLib.degrees(originalRotation + userRotation));
        }

        const rotatedBytes = await pdfDoc.save();
        saveAs(new Blob([rotatedBytes], { type: 'application/pdf' }), 
            `rotated-${currentPDF.name}`);
        
        showAlert('PDF rotated successfully!', 'success');
    } catch (err) {
        handleRotationError(err);
    } finally {
        showLoading(false);
    }
}

/* ======================
   PAGE RANGE MANAGEMENT
   ====================== */
function getPagesToRotate() {
    const rangeInput = document.getElementById('pageRange').value.trim();
    return rangeInput ? parsePageRange(rangeInput) 
        : Array.from({ length: totalPages }, (_, i) => i);
}

function parsePageRange(input) {
    return input.split(',')
        .flatMap(part => {
            const trimmed = part.trim();
            if (!trimmed) return [];
            
            if (trimmed.includes('-')) {
                const range = trimmed.split('-').map(n => {
                    const num = parseInt(n);
                    return isNaN(num) ? NaN : Math.max(1, Math.min(num, totalPages));
                });
                
                if (range.some(isNaN)) return [];
                const [start, end = start] = range.map(n => n - 1);
                return Array.from({ length: Math.max(end - start + 1, 0) }, (_, i) => start + i);
            }
            
            const page = parseInt(trimmed);
            return isNaN(page) ? [] : [page - 1];
        })
        .filter(n => n >= 0 && n < totalPages);
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
        const event = { target: { files } };
        handleFileSelect(event).catch(err => console.error("Drag-drop error:", err));
    }
}

/* =================
   UTILITY FUNCTIONS
   ================= */
function clearFile() {
    currentPDF = null;
    currentPDFDoc = null;
    totalPages = 0;
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
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** exponent).toFixed(2)} ${units[exponent]}`;
}

function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

function showAlert(message, type = 'error') {
    alert(`${type.toUpperCase()}: ${message}`);
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

// Initialize button styles update
function updateButtonStyles(activeButton) {
    document.querySelectorAll('.angle-btn').forEach(btn => {
        btn.style.backgroundColor = btn === activeButton ? '#3498db' : '#f8f9fa';
        btn.style.color = btn === activeButton ? 'white' : '#2c3e50';
    });
}