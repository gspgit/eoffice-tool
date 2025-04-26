let pdfFile = null;
let pageOrder = [];
let sortable = null;

// File Handling
document.getElementById('fileInput').addEventListener('change', handleFileUpload);
initDragDrop();

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if(validateFile(file)) {
        pdfFile = file;
        await showFileInfo(file);
        await generatePagePreviews();
        initSortable();
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
    document.getElementById('fileInfo').innerHTML = `
        <p><strong>File:</strong> ${file.name}</p>
        <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
    `;
}

async function generatePagePreviews() {
    const pdfData = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const pageCount = pdf.numPages;
    pageOrder = Array.from({ length: pageCount }, (_, i) => i + 1);
    
    const grid = document.getElementById('pageGrid');
    grid.innerHTML = '';
    
    for(let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: context, viewport }).promise;
        
        const item = document.createElement('div');
        item.className = 'page-item';
        item.dataset.page = i;
        item.innerHTML = `
            <img src="${canvas.toDataURL()}" class="page-thumb" alt="Page ${i}">
            <div class="page-number">${i}</div>
        `;
        grid.appendChild(item);
    }
    updateOrderInput();
}

function initSortable() {
    sortable = new Sortable(document.getElementById('pageGrid'), {
        animation: 150,
        onUpdate: () => {
            pageOrder = Array.from(sortable.el.children).map(
                (el, index) => parseInt(el.dataset.page)
            );
            updateOrderInput();
        }
    });
}

function updateOrderInput() {
    document.getElementById('pageOrder').value = pageOrder.join(', ');
}

function resetOrder() {
    pageOrder = Array.from({ length: pageOrder.length }, (_, i) => i + 1);
    sortable.sort(pageOrder.map(String));
    updateOrderInput();
}

async function reorderPages() {
    if(!pdfFile) return alert('Please select a PDF file');
    if(pageOrder.length === 0) return alert('No pages to reorder');
    
    try {
        const pdfBytes = await pdfFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
        
        const newOrder = pageOrder.map(n => n - 1); // Convert to 0-based index
        const newPdf = await PDFLib.PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, newOrder);
        copiedPages.forEach(page => newPdf.addPage(page));
        
        const modifiedBytes = await newPdf.save();
        saveAs(new Blob([modifiedBytes], { type: 'application/pdf' }), 
            `reordered-${pdfFile.name}`);
        
        alert('Pages reordered successfully!');
    } catch(err) {
        alert(`Reordering failed: ${err.message}`);
    }
}

function clearAll() {
    pdfFile = null;
    pageOrder = [];
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('pageGrid').innerHTML = '';
    document.getElementById('pageOrder').value = '';
    if(sortable) sortable.destroy();
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
        if(dt.files.length) handleFileUpload({ target: { files: dt.files } });
    });
}

function formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if(bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}