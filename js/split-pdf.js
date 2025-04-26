let currentPDF = null;
let pageCount = 0;
let pdfDocInstance = null;

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.addEventListener('DOMContentLoaded', initDragDrop);

// Loading Spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Progress Indicator
function updateProgress(percent) {
    document.getElementById('splitProgress').value = percent;
    document.getElementById('progressText').textContent = `${Math.round(percent)}%`;
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if(validateFile(file)) {
        showLoading(true);
        try {
            currentPDF = file;
            await showFileInfo(file);
            await generateThumbnails(await file.arrayBuffer());
        } catch(err) {
            alert('Error processing file: ' + err.message);
        }
        showLoading(false);
    }
}

function validateFile(file) {
    const maxSize = 50 * 1024 * 1024;
    if(file.type !== 'application/pdf') {
        alert('Please select a PDF file');
        return false;
    }
    if(file.size > maxSize) {
        alert('File size exceeds 50MB limit');
        return false;
    }
    return true;
}

async function showFileInfo(file) {
    pdfDocInstance = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    pageCount = pdfDocInstance.getPageCount();
    
    document.getElementById('fileInfo').innerHTML = `
        <p><strong>File Name:</strong> ${file.name}</p>
        <p><strong>Pages:</strong> ${pageCount}</p>
        <p><strong>Size:</strong> ${(file.size/1024/1024).toFixed(2)} MB</p>
    `;
    
    // Update all page inputs
    document.getElementById('splitPage').max = pageCount - 1;
    document.getElementById('splitPages').placeholder = `1,3,5 (max ${pageCount})`;
    document.getElementById('startPage').max = pageCount;
    document.getElementById('endPage').max = pageCount;
}

// Thumbnail Generation
async function generateThumbnails(pdfBytes) {
    const container = document.getElementById('thumbnailContainer');
    container.innerHTML = '';
    
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const scale = 0.3;

    for (let i = 1; i <= Math.min(pageCount, 10); i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        
        const thumbnail = document.createElement('div');
        thumbnail.className = 'thumbnail-item';
        thumbnail.innerHTML = `
            <img src="${canvas.toDataURL()}" style="width:100%">
            <div>Page ${i}</div>
        `;
        container.appendChild(thumbnail);
    }
}

// Split Mode Handling
function toggleSplitMode() {
    const mode = document.getElementById('splitMode').value;
    document.getElementById('singleSplitControl').style.display = 
        mode === 'single' ? 'block' : 'none';
    document.getElementById('multiSplitControl').style.display = 
        mode === 'multi' ? 'block' : 'none';
    document.getElementById('pageRangeControl').style.display = 
        mode === 'range' ? 'block' : 'none';
}

// Enhanced Split Function
async function splitPDF() {
    if (!currentPDF) return alert('Please select a PDF file');
    
    const mode = document.getElementById('splitMode').value;
    const originalName = currentPDF.name.replace(/\.pdf$/i, '');
    
    try {
        showLoading(true);
        document.getElementById('progressContainer').style.display = 'block';
        
        const splitPoints = await getSplitPoints(mode);
        const results = [];
        
        for (let i = 0; i < splitPoints.length; i++) {
            const { start, end } = splitPoints[i];
            const partDoc = await PDFLib.PDFDocument.create();
            const pages = await partDoc.copyPages(pdfDocInstance, 
                Array.from({ length: end - start + 1 }, (_, i) => start + i));
            pages.forEach(page => partDoc.addPage(page));
            
            results.push({
                blob: await partDoc.save(),
                name: `part${i+1}-${originalName}.pdf`
            });
            
            updateProgress((i + 1) / splitPoints.length * 100);
        }

        results.forEach(result => {
            window.saveAs(new Blob([result.blob], { type: 'application/pdf' }), result.name);
        });
        
        alert(`Successfully split into ${results.length} files!`);
    } catch(err) {
        alert(`Error splitting PDF: ${err.message}`);
    } finally {
        showLoading(false);
        document.getElementById('progressContainer').style.display = 'none';
    }
}

// Split Points Calculation
async function getSplitPoints(mode) {
    const totalPages = pdfDocInstance.getPageCount();
    const points = [];
    
    switch(mode) {
        case 'single':
            const splitPage = parseInt(document.getElementById('splitPage').value);
            if (!splitPage || splitPage < 1 || splitPage >= totalPages) {
                throw new Error(`Invalid split page (1-${totalPages - 1})`);
            }
            points.push({ start: 0, end: splitPage - 1 });
            points.push({ start: splitPage, end: totalPages - 1 });
            break;

        case 'multi':
            const pagesInput = document.getElementById('splitPages').value;
            const splitPages = [...new Set(pagesInput.split(',').map(Number).sort((a,b) => a - b))];
            if (!splitPages.every(p => p > 0 && p < totalPages)) {
                throw new Error(`Invalid pages (1-${totalPages - 1})`);
            }
            
            let prev = 0;
            for (const page of splitPages) {
                points.push({ start: prev, end: page - 1 });
                prev = page;
            }
            points.push({ start: prev, end: totalPages - 1 });
            break;

        case 'range':
            const start = parseInt(document.getElementById('startPage').value) - 1;
            const end = parseInt(document.getElementById('endPage').value) - 1;
            if (start < 0 || end >= totalPages || start > end) {
                throw new Error(`Invalid range (1-${totalPages})`);
            }
            points.push({ start, end });
            break;

        default:
            throw new Error('Invalid split mode');
    }
    
    return points;
}

function clearFile() {
    currentPDF = null;
    pdfDocInstance = null;
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('thumbnailContainer').innerHTML = '';
    document.getElementById('splitPage').value = '';
    document.getElementById('splitPages').value = '';
    document.getElementById('startPage').value = '';
    document.getElementById('endPage').value = '';
}

// Drag & Drop
function initDragDrop() {
    const dropZone = document.getElementById('dropZone');
    
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const dt = e.dataTransfer;
        if(dt.files.length) handleFileSelect({ target: { files: dt.files } });
    });
}